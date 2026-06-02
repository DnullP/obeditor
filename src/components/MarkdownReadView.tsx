/**
 * @module components/MarkdownReadView
 * @description Generic Markdown read view with frontmatter, embeds, tags, highlights,
 *   LaTeX, Mermaid and WikiLink previews. Host-specific actions are provided through
 *   EditorCapabilities.
 */

import {
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ComponentPropsWithoutRef,
    type CSSProperties,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import katex from "katex";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import {
    EMPTY_EDITOR_CAPABILITIES,
    openEditorWikiLinkTarget,
    previewEditorWikiLinkTarget,
    resolveEditorCapabilities,
    translateEditorText,
    type EditorCapabilities,
    type EditorCapabilitiesSource,
    type EditorMediaEmbedContext,
    type EditorWikiLinkPreview,
    type EditorWikiLinkTargetContext,
} from "../core/capabilities";
import {
  decodeReadModeBlockLatexHref,
  decodeReadModeHighlightHref,
  decodeReadModeInlineLatexHref,
  decodeReadModeMediaEmbedHref,
  decodeReadModeTagHref,
  decodeReadModeWikiLinkHref,
  prepareMarkdownForReadMode,
  type ReadModeFrontmatterField,
} from "../markdown/markdownReadTransform";
import { parseImageEmbedTarget, type ImageEmbedLayout } from "../markdown/imageEmbedLayout";
import { shouldSkipWikiLinkNavigationForSelection } from "../markdown/readModeSelectionPolicy";
import { resolveParentDirectory } from "../plugins/pathUtils";
import { isMermaidLanguage, renderMermaidToElement } from "../plugins/syntaxPlugins/mermaidRenderer";
import { computeTagColorStyles } from "../plugins/utils/tagColor";
import {
  createWikiLinkPreviewId,
  hasWikiLinkPreviewDescendant,
  registerWikiLinkPreview,
  subscribeWikiLinkPreviewHierarchy,
  unregisterWikiLinkPreview,
  WikiLinkPreviewParentContext,
} from "../plugins/wikiLinkPreviewHierarchy";

const READ_MODE_WIKILINK_PREVIEW_HIDE_DELAY_MS = 500;
const READ_MODE_WIKILINK_PREVIEW_EXIT_ANIMATION_MS = 140;
const READ_MODE_WIKILINK_PREVIEW_GAP_PX = 4;
const READ_MODE_WIKILINK_PREVIEW_INTERACTION_GRACE_MS = 700;

type ReadModeWikiLinkPreviewData =
    | { status: "loading" }
    | { status: "not-found" }
    | { status: "error"; message: string }
    | ({ status: "ready" } & EditorWikiLinkPreview);

interface ReadModeWikiLinkAnchorProps extends ComponentPropsWithoutRef<"a"> {
    /** WikiLink 原始目标。 */
    wikiLinkTarget: string;
    /** 当前文档路径。 */
    currentFilePath: string;
    /** Host capabilities used for WikiLink navigation and previews. */
    capabilities: EditorCapabilities;
    /** 父级 preview id。 */
    parentPreviewId: string | null;
}

const readModeWikiLinkPreviewCache = new Map<string, ReadModeWikiLinkPreviewData>();

function isApplePlatform(platform: string): boolean {
    return /(Mac|iPhone|iPad|iPod)/i.test(platform);
}

function isWikiLinkPreviewModifierPressed(
    metaKey: boolean,
    ctrlKey: boolean,
    platform: string = globalThis.navigator?.platform ?? "",
): boolean {
    return isApplePlatform(platform) ? metaKey : ctrlKey;
}

function buildReadModeWikiLinkPreviewCacheKey(currentFilePath: string, target: string): string {
    return `${resolveParentDirectory(currentFilePath)}::${target}`;
}

function translateReadViewText(
    capabilities: EditorCapabilities,
    key: string,
    fallback: string,
    options?: Record<string, unknown>,
): string {
    return translateEditorText(capabilities, key, fallback, options);
}

function buildWikiLinkTargetContext(
    currentFilePath: string,
    content?: string,
): EditorWikiLinkTargetContext {
    return {
        currentFilePath,
        currentDocumentContent: content,
    };
}

function buildMediaEmbedContext(currentFilePath: string): EditorMediaEmbedContext {
    return {
        currentFilePath,
    };
}

function resolveBinaryDataUrl(binary: {
    dataUrl?: string;
    mimeType: string;
    base64Content?: string;
    bytes?: Uint8Array | ArrayBuffer;
}): string | null {
    if (binary.dataUrl) {
        return binary.dataUrl;
    }

    if (binary.base64Content) {
        return `data:${binary.mimeType};base64,${binary.base64Content}`;
    }

    if (binary.bytes instanceof Uint8Array) {
        const binaryString = Array.from(binary.bytes, (byte) => String.fromCharCode(byte)).join("");
        return `data:${binary.mimeType};base64,${btoa(binaryString)}`;
    }

    if (binary.bytes instanceof ArrayBuffer) {
        const bytes = new Uint8Array(binary.bytes);
        const binaryString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
        return `data:${binary.mimeType};base64,${btoa(binaryString)}`;
    }

    return null;
}

interface MarkdownAstNodeLike {
    position?: {
        start?: {
            line?: number;
        };
    };
}

function sourceLineForMarkdownNode(
    node: unknown,
    sourceLineByRenderedLine: Array<number | null>,
): number | null {
    const renderedLine = (node as MarkdownAstNodeLike | undefined)?.position?.start?.line;
    if (typeof renderedLine !== "number" || !Number.isFinite(renderedLine)) {
        return null;
    }

    return sourceLineByRenderedLine[renderedLine - 1] ?? null;
}

function sourceLineDataAttributes(
    node: unknown,
    sourceLineByRenderedLine: Array<number | null>,
): { "data-source-line"?: string } {
    const sourceLine = sourceLineForMarkdownNode(node, sourceLineByRenderedLine);
    return sourceLine === null
        ? {}
        : { "data-source-line": String(sourceLine) };
}

export function revealMarkdownReadViewLine(
    root: HTMLElement | null,
    line: number,
    options: { block?: "start" | "center" } = {},
): boolean {
    if (!root || !Number.isFinite(line)) {
        return false;
    }

    const readerRoot = root.classList.contains("cm-tab-reader")
        ? root
        : root.querySelector<HTMLElement>(".cm-tab-reader");
    if (!readerRoot) {
        return false;
    }

    const targetLine = Math.max(1, Math.trunc(line));
    const candidates = Array.from(readerRoot.querySelectorAll<HTMLElement>("[data-source-line]"))
        .map((element) => ({
            element,
            line: Number.parseInt(element.dataset.sourceLine ?? "", 10),
        }))
        .filter((candidate) => Number.isFinite(candidate.line))
        .sort((left, right) => left.line - right.line);

    if (candidates.length === 0) {
        return false;
    }

    const exactCandidate = candidates.find((candidate) => candidate.line === targetLine);
    const nextCandidate = candidates.find((candidate) => candidate.line > targetLine);
    const previousCandidates = candidates.filter((candidate) => candidate.line < targetLine);
    const previousCandidate = previousCandidates[previousCandidates.length - 1];
    const target = exactCandidate ?? nextCandidate ?? previousCandidate ?? null;
    if (!target) {
        return false;
    }

    target.element.scrollIntoView({ block: options.block ?? "start", inline: "nearest" });
    return true;
}

/**
 * @function shouldKeepReadModeWikiLinkPreviewHovered
 * @description 判断鼠标离开锚点或预览时，是否仍应视为停留在同一预览链路内。
 * @param isTransitioningIntoPreview `relatedTarget` 是否仍在当前 preview DOM 内。
 * @param isPointerInsidePreview 当前指针坐标是否仍命中 preview 盒模型。
 * @returns 若应继续保活当前 preview，则返回 true。
 */
export function shouldKeepReadModeWikiLinkPreviewHovered(
    isTransitioningIntoPreview: boolean,
    isPointerInsidePreview: boolean,
): boolean {
    return isTransitioningIntoPreview || isPointerInsidePreview;
}

function ReadModeWikiLinkAnchor(props: ReadModeWikiLinkAnchorProps): ReactNode {
    const {
        wikiLinkTarget,
        currentFilePath,
        capabilities,
        parentPreviewId,
        children,
        className,
        onClick,
        onMouseEnter,
        onMouseLeave,
        onMouseMove,
        ...anchorProps
    } = props;
    const anchorRef = useRef<HTMLAnchorElement | null>(null);
    const previewRef = useRef<HTMLDivElement | null>(null);
    const previewIdRef = useRef<string>(createWikiLinkPreviewId());
    const pointerPositionRef = useRef<{ clientX: number; clientY: number } | null>(null);
    const lastPreviewInteractionAtRef = useRef(0);
    const hideTimerRef = useRef<number | null>(null);
    const unmountTimerRef = useRef<number | null>(null);
    const isAnchorHoveredRef = useRef(false);
    const isPreviewHoveredRef = useRef(false);
    const modifierPressedRef = useRef(false);
    const requestSequenceRef = useRef(0);
    const [previewMounted, setPreviewMounted] = useState(false);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [interactionActive, setInteractionActive] = useState(false);
    const [previewPlacement, setPreviewPlacement] = useState<"above" | "below">("below");
    const [previewPosition, setPreviewPosition] = useState<{ left: number; top: number } | null>(null);
    const [previewData, setPreviewData] = useState<ReadModeWikiLinkPreviewData>({ status: "loading" });

    const hasDescendantPreview = (): boolean => hasWikiLinkPreviewDescendant(previewIdRef.current);

    const cancelScheduledHide = (): void => {
        if (hideTimerRef.current === null) {
            return;
        }

        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
    };

    const markPreviewInteraction = (): void => {
        lastPreviewInteractionAtRef.current = Date.now();
    };

    const hasRecentPreviewInteraction = (): boolean => {
        return Date.now() - lastPreviewInteractionAtRef.current
            <= READ_MODE_WIKILINK_PREVIEW_INTERACTION_GRACE_MS;
    };

    const cancelScheduledUnmount = (): void => {
        if (unmountTimerRef.current === null) {
            return;
        }

        window.clearTimeout(unmountTimerRef.current);
        unmountTimerRef.current = null;
    };

    const revivePreviewVisibility = (): void => {
        cancelScheduledUnmount();
        if (previewMounted) {
            setPreviewVisible(true);
        }
        markPreviewInteraction();
    };

    const hidePreview = (): void => {
        cancelScheduledHide();
        setPreviewVisible(false);
        setInteractionActive(false);
        isPreviewHoveredRef.current = false;
        cancelScheduledUnmount();
        unmountTimerRef.current = window.setTimeout(() => {
            unmountTimerRef.current = null;
            setPreviewMounted(false);
        }, READ_MODE_WIKILINK_PREVIEW_EXIT_ANIMATION_MS);
    };

    const scheduleHidePreview = (): void => {
        if (!previewMounted || isPreviewHoveredRef.current || hasDescendantPreview()) {
            return;
        }

        if (hideTimerRef.current !== null) {
            return;
        }

        hideTimerRef.current = window.setTimeout(() => {
            hideTimerRef.current = null;
            syncPreviewHoverStateFromPointer();
            if (isPreviewHoveredRef.current) {
                return;
            }
            if (isAnchorHoveredRef.current && modifierPressedRef.current) {
                return;
            }
            if (hasDescendantPreview()) {
                return;
            }
            if (hasRecentPreviewInteraction()) {
                scheduleHidePreview();
                return;
            }
            hidePreview();
        }, READ_MODE_WIKILINK_PREVIEW_HIDE_DELAY_MS);
    };

    const updatePreviewPosition = (): void => {
        const anchorElement = anchorRef.current;
        const previewElement = previewRef.current;
        if (!anchorElement || !previewElement) {
            return;
        }

        const anchorRect = anchorElement.getBoundingClientRect();
        const previewWidth = previewElement.offsetWidth;
        const previewHeight = previewElement.offsetHeight;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const viewportPadding = 12;

        let left = Math.min(
            Math.max(viewportPadding, anchorRect.left),
            Math.max(viewportPadding, viewportWidth - previewWidth - viewportPadding),
        );

        let placement: "above" | "below" = "below";
        let top = anchorRect.bottom + READ_MODE_WIKILINK_PREVIEW_GAP_PX;

        if (
            top + previewHeight > viewportHeight - viewportPadding
            && anchorRect.top - previewHeight - READ_MODE_WIKILINK_PREVIEW_GAP_PX >= viewportPadding
        ) {
            placement = "above";
            top = anchorRect.top - previewHeight - READ_MODE_WIKILINK_PREVIEW_GAP_PX;
        }

        if (top + previewHeight > viewportHeight - viewportPadding) {
            top = Math.max(viewportPadding, viewportHeight - previewHeight - viewportPadding);
        }

        if (left + previewWidth > viewportWidth - viewportPadding) {
            left = Math.max(viewportPadding, viewportWidth - previewWidth - viewportPadding);
        }

        setPreviewPlacement(placement);
        setPreviewPosition({
            left: Math.round(left),
            top: Math.round(top),
        });
    };

    const isPointerInsidePreview = (clientX: number, clientY: number): boolean => {
        const previewElement = previewRef.current;
        if (!previewElement || typeof document === "undefined") {
            return false;
        }

        const hoveredElement = document.elementFromPoint(clientX, clientY);
        if (hoveredElement instanceof Node && previewElement.contains(hoveredElement)) {
            return true;
        }

        const rect = previewElement.getBoundingClientRect();
        return clientX >= rect.left
            && clientX <= rect.right
            && clientY >= rect.top
            && clientY <= rect.bottom;
    };

    const resolvePointerCoords = (clientX: number, clientY: number): { clientX: number; clientY: number } => {
        if (clientX !== 0 || clientY !== 0) {
            return { clientX, clientY };
        }

        return pointerPositionRef.current ?? { clientX, clientY };
    };

    const isEventTransitioningIntoPreview = (relatedTarget: EventTarget | null): boolean => {
        const previewElement = previewRef.current;
        if (!previewElement || !(relatedTarget instanceof Node)) {
            return false;
        }

        return previewElement.contains(relatedTarget);
    };

    const syncPreviewHoverStateFromPointer = (): void => {
        const pointerPosition = pointerPositionRef.current;
        if (!pointerPosition) {
            return;
        }

        const isPointerInside = isPointerInsidePreview(
            pointerPosition.clientX,
            pointerPosition.clientY,
        );

        if (!isPointerInside) {
            isPreviewHoveredRef.current = false;
            return;
        }

        isPreviewHoveredRef.current = true;
        setInteractionActive(true);
        cancelScheduledHide();
        markPreviewInteraction();
        revivePreviewVisibility();
    };

    const syncPreviewHoverStateFromCoords = (clientX: number, clientY: number): void => {
        const isPointerInside = isPointerInsidePreview(clientX, clientY);

        if (!isPointerInside) {
            isPreviewHoveredRef.current = false;
            return;
        }

        pointerPositionRef.current = { clientX, clientY };
        isPreviewHoveredRef.current = true;
        setInteractionActive(true);
        cancelScheduledHide();
        markPreviewInteraction();
        revivePreviewVisibility();
    };

    const showPreview = (): void => {
        cancelScheduledHide();
        cancelScheduledUnmount();
        setInteractionActive(true);
        setPreviewMounted(true);
        setPreviewVisible(true);
        markPreviewInteraction();

        const cacheKey = buildReadModeWikiLinkPreviewCacheKey(currentFilePath, wikiLinkTarget);
        const cachedPreview = readModeWikiLinkPreviewCache.get(cacheKey);
        if (cachedPreview) {
            setPreviewData(cachedPreview);
            return;
        }

        setPreviewData({ status: "loading" });
        const requestToken = requestSequenceRef.current + 1;
        requestSequenceRef.current = requestToken;

        void previewEditorWikiLinkTarget(
            capabilities,
            wikiLinkTarget,
            buildWikiLinkTargetContext(currentFilePath),
        )
            .then((preview) => {
                if (requestSequenceRef.current !== requestToken) {
                    return;
                }

                if (!preview) {
                    const notFoundData: ReadModeWikiLinkPreviewData = { status: "not-found" };
                    readModeWikiLinkPreviewCache.set(cacheKey, notFoundData);
                    setPreviewData(notFoundData);
                    return;
                }

                const readyData: ReadModeWikiLinkPreviewData = {
                    status: "ready",
                    ...preview,
                };
                readModeWikiLinkPreviewCache.set(cacheKey, readyData);
                setPreviewData(readyData);
            })
            .catch((error) => {
                if (requestSequenceRef.current !== requestToken) {
                    return;
                }

                setPreviewData({
                    status: "error",
                    message: error instanceof Error ? error.message : String(error),
                });
            });
    };

    useEffect(() => {
        if (!previewMounted) {
            return;
        }

        registerWikiLinkPreview(previewIdRef.current, parentPreviewId);

        return () => {
            unregisterWikiLinkPreview(previewIdRef.current);
        };
    }, [parentPreviewId, previewMounted]);

    useEffect(() => {
        if (!previewMounted) {
            return;
        }

        return subscribeWikiLinkPreviewHierarchy(() => {
            if (hasDescendantPreview()) {
                cancelScheduledHide();
                return;
            }

            if (!isAnchorHoveredRef.current && !isPreviewHoveredRef.current) {
                scheduleHidePreview();
            }
        });
    }, [previewMounted]);

    useEffect(() => {
        if (!previewMounted) {
            return;
        }

        const frameId = window.requestAnimationFrame(() => {
            updatePreviewPosition();
            syncPreviewHoverStateFromPointer();
        });

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [previewMounted, previewVisible, previewData]);

    useLayoutEffect(() => {
        if (!interactionActive) {
            return;
        }

        const handleWindowKeyChange = (event: KeyboardEvent): void => {
            modifierPressedRef.current = isWikiLinkPreviewModifierPressed(
                event.metaKey,
                event.ctrlKey,
            );
            if (modifierPressedRef.current) {
                if (isAnchorHoveredRef.current || isPreviewHoveredRef.current) {
                    showPreview();
                }
                return;
            }

            if (!isPreviewHoveredRef.current) {
                scheduleHidePreview();
            }
        };

        const handleViewportChange = (): void => {
            updatePreviewPosition();
        };

        const handleWindowWheel = (event: WheelEvent): void => {
            const pointerCoords = resolvePointerCoords(event.clientX, event.clientY);
            syncPreviewHoverStateFromCoords(pointerCoords.clientX, pointerCoords.clientY);
        };

        window.addEventListener("keydown", handleWindowKeyChange, true);
        window.addEventListener("keyup", handleWindowKeyChange, true);
        window.addEventListener("resize", handleViewportChange, true);
        window.addEventListener("scroll", handleViewportChange, true);
        window.addEventListener("wheel", handleWindowWheel, true);

        return () => {
            window.removeEventListener("keydown", handleWindowKeyChange, true);
            window.removeEventListener("keyup", handleWindowKeyChange, true);
            window.removeEventListener("resize", handleViewportChange, true);
            window.removeEventListener("scroll", handleViewportChange, true);
            window.removeEventListener("wheel", handleWindowWheel, true);
        };
    }, [interactionActive, previewMounted]);

    useEffect(() => () => {
        cancelScheduledHide();
        cancelScheduledUnmount();
    }, []);

    return (
        <>
            <a
                {...anchorProps}
                ref={anchorRef}
                className={className}
                onClick={(event) => {
                    onClick?.(event);
                    if (event.defaultPrevented) {
                        return;
                    }

                    event.preventDefault();
                    if (shouldSkipWikiLinkNavigationForSelection(
                        window.getSelection(),
                        event.currentTarget,
                    )) {
                        return;
                    }

                    void openEditorWikiLinkTarget(
                        capabilities,
                        wikiLinkTarget,
                        buildWikiLinkTargetContext(currentFilePath),
                    );
                }}
                onMouseEnter={(event) => {
                    isAnchorHoveredRef.current = true;
                    setInteractionActive(true);
                    markPreviewInteraction();
                    pointerPositionRef.current = {
                        clientX: event.clientX,
                        clientY: event.clientY,
                    };
                    modifierPressedRef.current = isWikiLinkPreviewModifierPressed(
                        event.metaKey,
                        event.ctrlKey,
                    );
                    onMouseEnter?.(event);
                    if (modifierPressedRef.current) {
                        showPreview();
                    }
                }}
                onMouseMove={(event) => {
                    pointerPositionRef.current = {
                        clientX: event.clientX,
                        clientY: event.clientY,
                    };
                    markPreviewInteraction();
                    modifierPressedRef.current = isWikiLinkPreviewModifierPressed(
                        event.metaKey,
                        event.ctrlKey,
                    );
                    onMouseMove?.(event);
                    if (modifierPressedRef.current) {
                        showPreview();
                    } else if (!isPreviewHoveredRef.current) {
                        scheduleHidePreview();
                    }
                }}
                onMouseLeave={(event) => {
                    const transitioningIntoPreview = isEventTransitioningIntoPreview(
                        event.relatedTarget,
                    );
                    const pointerInsidePreview = isPointerInsidePreview(
                        event.clientX,
                        event.clientY,
                    );
                    isAnchorHoveredRef.current = false;
                    pointerPositionRef.current = {
                        clientX: event.clientX,
                        clientY: event.clientY,
                    };
                    onMouseLeave?.(event);
                    if (shouldKeepReadModeWikiLinkPreviewHovered(
                        transitioningIntoPreview,
                        pointerInsidePreview,
                    )) {
                        isPreviewHoveredRef.current = true;
                        setInteractionActive(true);
                        cancelScheduledHide();
                        revivePreviewVisibility();
                        return;
                    }
                    if (!previewMounted && !isPreviewHoveredRef.current) {
                        setInteractionActive(false);
                    }
                    scheduleHidePreview();
                }}
            >
                {children}
            </a>
            {previewMounted && typeof document !== "undefined"
                ? createPortal(
                    <div
                        ref={previewRef}
                        className={`cm-wikilink-preview-tooltip${previewVisible ? " is-visible" : " is-hiding"}`}
                        data-floating-surface="true"
                        data-placement={previewPlacement}
                        style={previewPosition ? {
                            left: `${previewPosition.left}px`,
                            top: `${previewPosition.top}px`,
                        } : undefined}
                        onMouseEnter={(event) => {
                            event.stopPropagation();
                            isPreviewHoveredRef.current = true;
                            setInteractionActive(true);
                            markPreviewInteraction();
                            pointerPositionRef.current = {
                                clientX: event.clientX,
                                clientY: event.clientY,
                            };
                            cancelScheduledHide();
                            revivePreviewVisibility();
                        }}
                        onMouseMove={(event) => {
                            event.stopPropagation();
                            markPreviewInteraction();
                            pointerPositionRef.current = {
                                clientX: event.clientX,
                                clientY: event.clientY,
                            };
                        }}
                        onWheel={(event) => {
                            event.stopPropagation();
                            const pointerCoords = resolvePointerCoords(
                                event.clientX,
                                event.clientY,
                            );
                            isPreviewHoveredRef.current = true;
                            setInteractionActive(true);
                            markPreviewInteraction();
                            pointerPositionRef.current = {
                                clientX: pointerCoords.clientX,
                                clientY: pointerCoords.clientY,
                            };
                            cancelScheduledHide();
                            revivePreviewVisibility();
                        }}
                        onMouseLeave={(event) => {
                            event.stopPropagation();
                            const transitioningWithinPreview = isEventTransitioningIntoPreview(
                                event.relatedTarget,
                            );
                            const pointerInsidePreview = isPointerInsidePreview(
                                event.clientX,
                                event.clientY,
                            );
                            pointerPositionRef.current = {
                                clientX: event.clientX,
                                clientY: event.clientY,
                            };
                            if (shouldKeepReadModeWikiLinkPreviewHovered(
                                transitioningWithinPreview,
                                pointerInsidePreview,
                            )) {
                                isPreviewHoveredRef.current = true;
                                setInteractionActive(true);
                                cancelScheduledHide();
                                revivePreviewVisibility();
                                return;
                            }
                            isPreviewHoveredRef.current = false;
                            if (isAnchorHoveredRef.current && modifierPressedRef.current) {
                                return;
                            }
                            if (!isAnchorHoveredRef.current) {
                                setInteractionActive(false);
                            }
                            scheduleHidePreview();
                        }}
                    >
                        <div className="cm-wikilink-preview">
                            <div
                                className="cm-wikilink-preview__body"
                                onScroll={(event) => {
                                    event.stopPropagation();
                                    isPreviewHoveredRef.current = true;
                                    setInteractionActive(true);
                                    markPreviewInteraction();
                                    cancelScheduledHide();
                                    revivePreviewVisibility();
                                }}
                            >
                                {previewData.status === "loading" ? (
                                    <div className="cm-wikilink-preview__status">
                                        {translateReadViewText(capabilities, "editor.wikilinkPreviewLoading", "Loading preview...")}
                                    </div>
                                ) : null}
                                {previewData.status === "not-found" ? (
                                    <div className="cm-wikilink-preview__status">
                                        {translateReadViewText(capabilities, "editor.wikilinkPreviewNotFound", "Target not found")}
                                    </div>
                                ) : null}
                                {previewData.status === "error" ? (
                                    <div className="cm-wikilink-preview__status">
                                        {`${translateReadViewText(capabilities, "editor.wikilinkPreviewError", "Preview error:")} ${previewData.message}`}
                                    </div>
                                ) : null}
                                {previewData.status === "ready" && previewData.kind === "markdown" ? (
                                    <WikiLinkPreviewParentContext.Provider value={previewIdRef.current}>
                                        <MarkdownReadView
                                            content={previewData.content}
                                            currentFilePath={previewData.resolvedPath}
                                            capabilities={capabilities}
                                            initialRevealLine={previewData.revealLine ?? null}
                                        />
                                    </WikiLinkPreviewParentContext.Provider>
                                ) : null}
                                {previewData.status === "ready" && previewData.kind === "custom" ? (
                                    <>{previewData.render()}</>
                                ) : null}
                            </div>
                        </div>
                    </div>,
                    document.body,
                )
                : null}
        </>
    );
}

export interface MarkdownReadViewProps {
    /** 阅读态 Markdown 正文。 */
    content: string;
    /** 当前文件相对路径。 */
    currentFilePath?: string;
    /** Host-provided editor capabilities, or a getter for the latest capabilities. */
    capabilities?: EditorCapabilitiesSource;
    /** 阅读态中需要滚动定位的原始行号。 */
    initialRevealLine?: number | null;
}

/**
 * @function MarkdownReadView
 * @description 渲染阅读态 Markdown 内容，并为 WikiLink 提供点击跳转。
 * @param props 组件参数。
 * @returns React 节点。
 */
export function MarkdownReadView(props: MarkdownReadViewProps): ReactNode {
    const parentPreviewId = useContext(WikiLinkPreviewParentContext);
    const readerRootRef = useRef<HTMLDivElement | null>(null);
    const capabilities = resolveEditorCapabilities(props.capabilities) ?? EMPTY_EDITOR_CAPABILITIES;
    const currentFilePath = props.currentFilePath ?? "";
    const preparedMarkdown = useMemo(
        () => prepareMarkdownForReadMode(props.content),
        [props.content],
    );
    const sourceLineByRenderedLine = preparedMarkdown.sourceLineByRenderedLine;
    const markdownComponents = useMemo<Components>(() => ({
        p: (componentProps) => {
            const { node, children, ...restProps } = componentProps;
            const blockLatexSource = extractBlockLatexFromParagraph(node);
            if (blockLatexSource) {
                return <ReadModeLatex latex={blockLatexSource} displayMode />;
            }

            return <p {...restProps} {...sourceLineDataAttributes(node, sourceLineByRenderedLine)}>{children}</p>;
        },
        h1: (componentProps) => {
            const { node, children, ...restProps } = componentProps;
            return (
                <h1
                    className="cm-rendered-header cm-rendered-header-h1"
                    {...restProps}
                    {...sourceLineDataAttributes(node, sourceLineByRenderedLine)}
                >
                    {children}
                </h1>
            );
        },
        h2: (componentProps) => {
            const { node, children, ...restProps } = componentProps;
            return (
                <h2
                    className="cm-rendered-header cm-rendered-header-h2"
                    {...restProps}
                    {...sourceLineDataAttributes(node, sourceLineByRenderedLine)}
                >
                    {children}
                </h2>
            );
        },
        h3: (componentProps) => {
            const { node, children, ...restProps } = componentProps;
            return (
                <h3
                    className="cm-rendered-header cm-rendered-header-h3"
                    {...restProps}
                    {...sourceLineDataAttributes(node, sourceLineByRenderedLine)}
                >
                    {children}
                </h3>
            );
        },
        h4: (componentProps) => {
            const { node, children, ...restProps } = componentProps;
            return (
                <h4
                    className="cm-rendered-header cm-rendered-header-h4"
                    {...restProps}
                    {...sourceLineDataAttributes(node, sourceLineByRenderedLine)}
                >
                    {children}
                </h4>
            );
        },
        h5: (componentProps) => {
            const { node, children, ...restProps } = componentProps;
            return (
                <h5
                    className="cm-rendered-header cm-rendered-header-h5"
                    {...restProps}
                    {...sourceLineDataAttributes(node, sourceLineByRenderedLine)}
                >
                    {children}
                </h5>
            );
        },
        h6: (componentProps) => {
            const { node, children, ...restProps } = componentProps;
            return (
                <h6
                    className="cm-rendered-header cm-rendered-header-h6"
                    {...restProps}
                    {...sourceLineDataAttributes(node, sourceLineByRenderedLine)}
                >
                    {children}
                </h6>
            );
        },
        strong: (componentProps) => <strong className="cm-rendered-bold" {...componentProps} />,
        em: (componentProps) => <em className="cm-rendered-italic" {...componentProps} />,
        del: (componentProps) => <del className="cm-rendered-strikethrough" {...componentProps} />,
        blockquote: (componentProps) => <blockquote className="cm-rendered-blockquote" {...componentProps} />,
        hr: (componentProps) => <hr className="cm-rendered-horizontal-rule" {...componentProps} />,
        code: ({ node: _node, className, children, ...componentProps }: ComponentPropsWithoutRef<"code"> & { node?: unknown }) => {
            const isInline = !String(className ?? "").includes("language-");
            if (isInline) {
                return (
                    <code
                        className={`cm-rendered-inline-code ${className ?? ""}`.trim()}
                        {...componentProps}
                    >
                        {children}
                    </code>
                );
            }

            const language = String(className ?? "").match(/language-([^\s]+)/)?.[1] ?? "";
            if (isMermaidLanguage(language)) {
                return <ReadModeMermaidDiagram source={String(children).replace(/\n$/, "")} />;
            }

            return (
                <code className={`cm-tab-reader-code ${className ?? ""}`.trim()} {...componentProps}>
                    {children}
                </code>
            );
        },
        pre: (componentProps) => <pre className="cm-tab-reader-pre" {...componentProps} />,
        ul: (componentProps) => <ul className="cm-tab-reader-list cm-tab-reader-list-unordered" {...componentProps} />,
        ol: (componentProps) => <ol className="cm-tab-reader-list cm-tab-reader-list-ordered" {...componentProps} />,
        img: (componentProps) => {
            const { src, alt, ...restProps } = componentProps;
            const mediaTarget = decodeReadModeMediaEmbedHref(src);
            if (mediaTarget) {
                const parsedMediaTarget = parseImageEmbedTarget(mediaTarget);
                return (
                    <ReadModeImageEmbed
                        alt={alt ?? parsedMediaTarget.target}
                        capabilities={capabilities}
                        currentFilePath={currentFilePath}
                        layout={parsedMediaTarget.layout}
                        rawTarget={parsedMediaTarget.target}
                    />
                );
            }

            return (
                <img
                    {...restProps}
                    alt={alt ?? ""}
                    className="cm-tab-reader-image"
                    src={src}
                />
            );
        },
        li: (componentProps) => {
            const { node, className, ...restProps } = componentProps;
            return (
            <li
                className={className
                    ? `cm-tab-reader-list-item ${className}`
                    : "cm-tab-reader-list-item"}
                {...sourceLineDataAttributes(node, sourceLineByRenderedLine)}
                {...restProps}
            />
            );
        },
        a: (componentProps) => {
            const { href, children, ...restProps } = componentProps;
            const wikiLinkTarget = decodeReadModeWikiLinkHref(href);
            if (wikiLinkTarget) {
                return (
                    <ReadModeWikiLinkAnchor
                        {...restProps}
                        href={href}
                        className="cm-rendered-wikilink"
                        wikiLinkTarget={wikiLinkTarget}
                        currentFilePath={currentFilePath}
                        capabilities={capabilities}
                        parentPreviewId={parentPreviewId}
                    >
                        {children}
                    </ReadModeWikiLinkAnchor>
                );
            }

            if (decodeReadModeHighlightHref(href) !== null) {
                return (
                    <mark className="cm-rendered-highlight">
                        {children}
                    </mark>
                );
            }

            const tagTarget = decodeReadModeTagHref(href);
            if (tagTarget !== null) {
                const styles = computeTagColorStyles(tagTarget);
                const styleAttr = {
                    background: styles.background,
                    borderColor: styles.border,
                    color: styles.text,
                } as React.CSSProperties;

                return (
                    <span className="cm-rendered-tag" style={styleAttr}>
                        {children}
                    </span>
                );
            }

            const inlineLatexSource = decodeReadModeInlineLatexHref(href);
            if (inlineLatexSource !== null) {
                return <ReadModeLatex latex={inlineLatexSource} displayMode={false} />;
            }

            return (
                <a
                    {...restProps}
                    href={href}
                    className="cm-rendered-link"
                    target="_blank"
                    rel="noreferrer"
                >
                    {children}
                </a>
            );
        },
    }), [capabilities, currentFilePath, parentPreviewId, sourceLineByRenderedLine]);

    useLayoutEffect(() => {
        if (props.initialRevealLine === null || props.initialRevealLine === undefined) {
            return;
        }

        const frameId = window.requestAnimationFrame(() => {
            revealMarkdownReadViewLine(readerRootRef.current, props.initialRevealLine ?? 0);
        });

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [props.initialRevealLine, preparedMarkdown.renderedMarkdown]);

    return (
        <div ref={readerRootRef} className="cm-tab-reader oe-read-view">
            <div className="cm-tab-reader-content">
                {preparedMarkdown.hasFrontmatter ? (
                    <ReadModeFrontmatterPanel
                        capabilities={capabilities}
                        frontmatter={preparedMarkdown.frontmatter}
                    />
                ) : null}
                <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={markdownComponents}
                >
                    {preparedMarkdown.renderedMarkdown}
                </ReactMarkdown>
            </div>
        </div>
    );
}

interface ReadModeFrontmatterPanelProps {
    capabilities: EditorCapabilities;
    /** 阅读态 frontmatter 字段列表。 */
    frontmatter: ReadModeFrontmatterField[];
}

/**
 * @function ReadModeFrontmatterPanel
 * @description 在阅读态顶部渲染结构化 frontmatter 面板。
 * @param props 面板参数。
 * @returns frontmatter 面板。
 */
function ReadModeFrontmatterPanel(props: ReadModeFrontmatterPanelProps): ReactNode {
    return (
        <section className="cm-read-frontmatter-panel">
            <div className="cm-read-frontmatter-title">
                {translateReadViewText(props.capabilities, "frontmatter.readModeTitle", "Properties")}
            </div>
            {props.frontmatter.length > 0 ? (
                <dl className="cm-read-frontmatter-list">
                    {props.frontmatter.map((field) => (
                        <div className="cm-read-frontmatter-row" key={field.key}>
                            <dt className="cm-read-frontmatter-key">{field.key}</dt>
                            <dd className="cm-read-frontmatter-value">{field.value}</dd>
                        </div>
                    ))}
                </dl>
            ) : (
                <div className="cm-read-frontmatter-empty">
                    {translateReadViewText(props.capabilities, "frontmatter.emptyFrontmatter", "No properties")}
                </div>
            )}
        </section>
    );
}

interface ReadModeImageEmbedProps {
    /** 图片嵌入原始目标。 */
    rawTarget: string;
    capabilities: EditorCapabilities;
    /** 图片显示尺寸。 */
    layout?: ImageEmbedLayout | null;
    /** 当前文档路径。 */
    currentFilePath: string;
    /** 图片 alt 文本。 */
    alt: string;
}

type ReadModeImageState =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; source: string; label: string };

/**
 * @function ReadModeImageEmbed
 * @description 在阅读态中解析并渲染 `![[...]]` 图片嵌入。
 * @param props 图片嵌入参数。
 * @returns 图片嵌入节点。
 */
function ReadModeImageEmbed(props: ReadModeImageEmbedProps): ReactNode {
    const [imageState, setImageState] = useState<ReadModeImageState>({ status: "loading" });

    useEffect(() => {
        let isDisposed = false;
        const mediaEmbeds = props.capabilities.mediaEmbeds;

        setImageState({ status: "loading" });
        console.info("[markdown-read-view] image embed resolve start", {
            currentFilePath: props.currentFilePath,
            target: props.rawTarget,
        });

        void Promise.resolve(mediaEmbeds?.resolveTarget?.(
            props.rawTarget,
            buildMediaEmbedContext(props.currentFilePath),
        ) ?? null)
            .then(async (resolvedTarget) => {
                if (isDisposed) {
                    return;
                }

                if (!resolvedTarget) {
                    console.warn("[markdown-read-view] image embed resolve returned empty", {
                        currentFilePath: props.currentFilePath,
                        target: props.rawTarget,
                    });
                    setImageState({
                        status: "error",
                        message: translateReadViewText(props.capabilities, "image.notFound", "Image not found"),
                    });
                    return;
                }

                const resolvedPath = typeof resolvedTarget === "string"
                    ? resolvedTarget
                    : resolvedTarget.relativePath;
                const label = typeof resolvedTarget === "string"
                    ? resolvedTarget
                    : (resolvedTarget.label ?? resolvedTarget.relativePath);
                const binaryResponse = await mediaEmbeds?.readBinary?.(
                    resolvedPath,
                    buildMediaEmbedContext(props.currentFilePath),
                );
                if (!binaryResponse) {
                    setImageState({
                        status: "error",
                        message: translateReadViewText(props.capabilities, "image.notFound", "Image not found"),
                    });
                    return;
                }

                if (!binaryResponse.mimeType.startsWith("image/")) {
                    console.warn("[markdown-read-view] image embed mime unsupported", {
                        mimeType: binaryResponse.mimeType,
                        relativePath: resolvedPath,
                    });
                    setImageState({
                        status: "error",
                        message: translateReadViewText(
                            props.capabilities,
                            "image.unsupportedType",
                            `Unsupported image type: ${binaryResponse.mimeType}`,
                            { type: binaryResponse.mimeType },
                        ),
                    });
                    return;
                }

                const source = resolveBinaryDataUrl(binaryResponse);
                if (!source) {
                    setImageState({
                        status: "error",
                        message: translateReadViewText(props.capabilities, "image.notFound", "Image not found"),
                    });
                    return;
                }

                setImageState({
                    status: "ready",
                    source,
                    label: label.split("/").pop() ?? label,
                });
            })
            .catch((error) => {
                if (isDisposed) {
                    return;
                }

                console.warn("[markdown-read-view] image embed render failed", {
                    message: error instanceof Error ? error.message : String(error),
                    target: props.rawTarget,
                });
                setImageState({
                    status: "error",
                    message: translateReadViewText(
                        props.capabilities,
                        "image.loadError",
                        `Unable to load image: ${props.rawTarget}`,
                        { src: props.rawTarget },
                    ),
                });
            });

        return () => {
            isDisposed = true;
        };
    }, [props.capabilities, props.currentFilePath, props.rawTarget]);

    if (imageState.status === "ready") {
        const imageStyle = {
            width: props.layout?.width ? `${Math.round(props.layout.width)}px` : undefined,
            maxWidth: "100%",
            "--cm-image-embed-height": props.layout?.height
                ? `${Math.round(props.layout.height)}px`
                : undefined,
        } as CSSProperties;

        return (
            <span className="cm-image-embed-widget" style={imageStyle}>
                <img
                    alt={props.alt}
                    className="cm-image-embed-image"
                    src={imageState.source}
                />
                <span className="cm-image-embed-caption">{imageState.label}</span>
            </span>
        );
    }

    return (
        <span className="cm-image-embed-widget">
            <span className={imageState.status === "loading" ? "cm-image-embed-loading" : "cm-image-embed-error"}>
                {imageState.status === "loading"
                    ? translateReadViewText(props.capabilities, "image.loading", `Loading ${props.rawTarget}`, { src: props.rawTarget })
                    : imageState.message}
            </span>
        </span>
    );
}

interface ReadModeLatexProps {
    /** LaTeX 公式源码。 */
    latex: string;
    /** 是否以 display 模式渲染。 */
    displayMode: boolean;
}

interface ReadModeMermaidDiagramProps {
    /** Mermaid diagram source. */
    source: string;
}

function ReadModeMermaidDiagram(props: ReadModeMermaidDiagramProps): ReactNode {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useLayoutEffect(() => {
        if (!containerRef.current) {
            return;
        }

        renderMermaidToElement(containerRef.current, props.source);
    }, [props.source]);

    return (
        <div
            ref={containerRef}
            className="cm-mermaid-widget cm-mermaid-widget-read"
        />
    );
}

interface ReadModeLatexRenderResult {
    /** 渲染后的 HTML。 */
    html: string;
    /** 是否渲染失败。 */
    isError: boolean;
}

const readModeLatexCache = new Map<string, ReadModeLatexRenderResult>();

/**
 * @function ReadModeLatex
 * @description 在阅读态中使用 KaTeX 渲染行内或块级数学公式。
 * @param props LaTeX 参数。
 * @returns 数学公式节点。
 */
function ReadModeLatex(props: ReadModeLatexProps): ReactNode {
    const renderResult = useMemo(
        () => renderReadModeLatex(props.latex, props.displayMode),
        [props.displayMode, props.latex],
    );

    if (props.displayMode) {
        return (
            <div
                className={renderResult.isError
                    ? "cm-latex-block-widget cm-latex-block-error"
                    : "cm-latex-block-widget"}
                dangerouslySetInnerHTML={{ __html: renderResult.html }}
            />
        );
    }

    return (
        <span
            className={renderResult.isError
                ? "cm-latex-inline-widget cm-latex-inline-error"
                : "cm-latex-inline-widget"}
            dangerouslySetInnerHTML={{ __html: renderResult.html }}
        />
    );
}

/**
 * @function renderReadModeLatex
 * @description 将 LaTeX 公式缓存并渲染为 HTML。
 * @param latex LaTeX 公式源码。
 * @param displayMode 是否为 display 模式。
 * @returns 渲染结果。
 */
function renderReadModeLatex(latex: string, displayMode: boolean): ReadModeLatexRenderResult {
    const cacheKey = `${displayMode ? "block" : "inline"}::${latex}`;
    const cachedResult = readModeLatexCache.get(cacheKey);
    if (cachedResult) {
        return cachedResult;
    }

    try {
        const html = katex.renderToString(latex, {
            displayMode,
            throwOnError: false,
            strict: false,
            trust: false,
            output: "htmlAndMathml",
        });
        const renderResult = { html, isError: false };
        readModeLatexCache.set(cacheKey, renderResult);
        return renderResult;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const renderResult = {
            // i18n-guard-ignore-next-line
            html: `<span class="cm-latex-error" title="${escapeHtml(errorMessage)}">${escapeHtml(latex)}</span>`,
            isError: true,
        };
        readModeLatexCache.set(cacheKey, renderResult);
        return renderResult;
    }
}

/**
 * @function extractBlockLatexFromParagraph
 * @description 从 React Markdown 段落节点中提取块级 LaTeX 协议链接。
 * @param node 段落节点。
 * @returns 若该段落仅承载块级 LaTeX 协议，则返回 LaTeX 源码。
 */
function extractBlockLatexFromParagraph(node: unknown): string | null {
    if (!node || typeof node !== "object") {
        return null;
    }

    const children = (node as { children?: Array<{ type?: string; tagName?: string; properties?: { href?: string } }> }).children;
    if (!children || children.length !== 1) {
        return null;
    }

    const firstChild = children[0];
    if (firstChild?.type !== "element" || firstChild.tagName !== "a") {
        return null;
    }

    return decodeReadModeBlockLatexHref(firstChild.properties?.href);
}

/**
 * @function escapeHtml
 * @description 转义 HTML 特殊字符，避免错误信息和源码注入 DOM。
 * @param text 原始文本。
 * @returns 转义后的文本。
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
