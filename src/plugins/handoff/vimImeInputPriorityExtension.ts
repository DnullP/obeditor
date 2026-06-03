/**
 * @module plugins/handoff/vimImeInputPriorityExtension
 * @description Vim 非 insert 命令态下让输入法文本优先交给 Vim，并统一执行编辑器正文到 widget 的 Vim handoff。
 */

import { Prec, type Extension } from "@codemirror/state";
import { EditorView } from "codemirror";
import { getCM, Vim, type CodeMirror } from "@replit/codemirror-vim";
import { resolveEditorBodyAnchor } from "../../core/editorBodyAnchor";
import {
    resolveRegisteredVimHandoff,
    type VimHandoffResult,
    type VimHandoffWidget,
    type VimHandoffWidgetPosition,
} from "./vimHandoffRegistry";

export interface VimStateLike {
    insertMode?: boolean;
    visualMode?: boolean;
}

export interface CodeMirrorLike {
    state?: {
        vim?: VimStateLike | null;
    };
}

export interface VimImeInputPriorityDependencies {
    getCodeMirror?: (view: EditorView) => CodeMirrorLike | null;
    handleVimKey?: (cm: CodeMirrorLike, key: string) => boolean | undefined;
    isVimModeEnabled?: () => boolean;
    focusWidgetNavigationTarget?: (
        widget: VimHandoffWidget,
        position: VimHandoffWidgetPosition,
        blockFrom?: number,
    ) => boolean;
}

export interface ResolveEditorBodyVimHandoffDependencies {
    resolveEditorBodyAnchor: typeof resolveEditorBodyAnchor;
    resolveRegisteredVimHandoff: typeof resolveRegisteredVimHandoff;
    isVimNormalMode(view: EditorView): boolean;
}

export interface ResolveEditorBodyVimHandoffOptions {
    view: EditorView;
    key: string;
    isVimModeEnabled: boolean;
    dependencies?: Partial<ResolveEditorBodyVimHandoffDependencies>;
}

export interface VimImeKeydownEventLike {
    key: string;
    code?: string;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    getModifierState?: (key: string) => boolean;
    preventDefault(): void;
    stopPropagation(): void;
}

export interface HandleVimImeKeydownOptions {
    event: VimImeKeydownEventLike;
    view: EditorView;
    vimKey: string | null;
    dependencies?: Pick<VimImeInputPriorityDependencies, "getCodeMirror" | "handleVimKey">;
}

function isVimCommandMode(cm: CodeMirrorLike | null): boolean {
    const vimState = cm?.state?.vim ?? null;
    return Boolean(vimState && !vimState.insertMode);
}

function isSinglePlainTextInput(text: string): boolean {
    return [...text].length === 1 && text !== "\n" && text !== "\r";
}

function isPlainLetterKeydown(event: VimImeKeydownEventLike): boolean {
    return !event.metaKey
        && !event.ctrlKey
        && !event.altKey
        && !event.getModifierState?.("AltGraph");
}

function resolveLetterKeyFromPhysicalCode(event: VimImeKeydownEventLike): string | null {
    const match = /^Key([A-Z])$/.exec(event.code ?? "");
    if (!match) {
        return null;
    }

    const letter = match[1]!;
    return event.shiftKey ? letter : letter.toLowerCase();
}

export function resolvePlainTextVimKeydownKey(
    event: VimImeKeydownEventLike,
    isComposing: boolean,
): string | null {
    if (!isPlainLetterKeydown(event)) {
        return null;
    }

    if ([...event.key].length === 1 && event.key !== "\n" && event.key !== "\r") {
        return event.key;
    }

    if (!isComposing) {
        return null;
    }

    return resolveLetterKeyFromPhysicalCode(event);
}

/**
 * @function isVimNormalMode
 * @description 判断当前 EditorView 是否处于 Vim normal 模式。
 * @param view 编辑器视图。
 * @returns 是否处于 Vim normal 模式。
 */
export function isVimNormalMode(view: EditorView): boolean {
    const cm = getCM(view) as CodeMirrorLike | null;
    const vimState = cm?.state?.vim;
    if (!vimState) {
        return false;
    }

    return !vimState.insertMode && !vimState.visualMode;
}

/**
 * @function applyResolvedVimHandoff
 * @description 执行 Vim handoff 的宿主副作用。
 * @param view 编辑器视图。
 * @param result handoff 结果。
 * @param focusWidgetNavigationTarget 隐藏 widget 导航聚焦回调。
 * @returns 是否成功消费 handoff。
 */
export function applyResolvedVimHandoff(
    view: EditorView,
    result: VimHandoffResult,
    focusWidgetNavigationTarget: (
        widget: VimHandoffWidget,
        position: VimHandoffWidgetPosition,
        blockFrom?: number,
    ) => boolean,
): boolean {
    if (result.kind === "move-selection") {
        const targetLine = view.state.doc.line(result.targetLineNumber);
        view.dispatch({
            selection: { anchor: targetLine.from },
            scrollIntoView: true,
        });
        if (result.postFocusWidget) {
            queueMicrotask(() => {
                focusWidgetNavigationTarget(
                    result.postFocusWidget!.widget,
                    result.postFocusWidget!.position,
                    result.postFocusWidget!.blockFrom,
                );
            });
        }
        return true;
    }

    if (result.kind === "focus-widget-navigation") {
        return focusWidgetNavigationTarget(result.widget, result.position, result.blockFrom);
    }

    return false;
}

export function resolveEditorBodyVimHandoff(
    options: ResolveEditorBodyVimHandoffOptions,
): VimHandoffResult | null {
    const dependencies: ResolveEditorBodyVimHandoffDependencies = {
        resolveEditorBodyAnchor,
        resolveRegisteredVimHandoff,
        isVimNormalMode,
        ...options.dependencies,
    };
    if (!options.isVimModeEnabled) {
        return null;
    }

    const selection = options.view.state.selection.main;
    const bodyAnchor = dependencies.resolveEditorBodyAnchor(options.view.state);
    const firstBodyLineNumber = options.view.state.doc.lineAt(bodyAnchor).number;
    const currentLineNumber = options.view.state.doc.lineAt(selection.head).number;

    return dependencies.resolveRegisteredVimHandoff({
        surface: "editor-body",
        key: options.key,
        markdown: options.view.state.doc.toString(),
        currentLineNumber,
        selectionHead: selection.head,
        hasFrontmatter: bodyAnchor > 0,
        firstBodyLineNumber,
        isVimEnabled: options.isVimModeEnabled,
        isVimNormalMode: dependencies.isVimNormalMode(options.view),
    });
}

export function handleVimImeTextInput(
    text: string,
    cm: CodeMirrorLike | null,
    handleVimKey: (cm: CodeMirrorLike, key: string) => boolean | undefined,
): boolean {
    if (cm === null || !isVimCommandMode(cm)) {
        return false;
    }

    if (isSinglePlainTextInput(text)) {
        handleVimKey(cm, text);
    }

    return true;
}

export function handleVimImeKeydown(options: HandleVimImeKeydownOptions): boolean {
    if (!options.vimKey) {
        return false;
    }

    const getCodeMirrorInstance = options.dependencies?.getCodeMirror ?? ((view: EditorView) => getCM(view));
    const handleVimKey = options.dependencies?.handleVimKey ?? ((cm: CodeMirrorLike, key: string) =>
        Vim.handleKey(cm as CodeMirror, key, "user"));
    const cm = getCodeMirrorInstance(options.view);
    if (cm === null || !isVimCommandMode(cm)) {
        return false;
    }

    handleVimKey(cm, options.vimKey);
    options.event.preventDefault();
    options.event.stopPropagation();
    return true;
}

export function handleEditorBodyVimHandoffTextInput(
    view: EditorView,
    text: string,
    isVimModeEnabled: () => boolean,
    focusWidgetNavigationTarget: (
        widget: VimHandoffWidget,
        position: VimHandoffWidgetPosition,
        blockFrom?: number,
    ) => boolean,
): boolean {
    const handoffResult = resolveEditorBodyVimHandoff({
        view,
        key: text,
        isVimModeEnabled: isVimModeEnabled(),
    });
    if (!handoffResult) {
        return false;
    }

    return applyResolvedVimHandoff(view, handoffResult, focusWidgetNavigationTarget);
}

function isWidgetNavigationEventTarget(target: EventTarget | null): boolean {
    if (typeof Element === "undefined") {
        return false;
    }

    if (!(target instanceof Element)) {
        return false;
    }

    return Boolean(target.closest([
        "[data-markdown-table-block-from]",
        "[data-frontmatter-vim-nav='true']",
        "[data-frontmatter-field-focusable='true']",
    ].join(",")));
}

function handleEditorBodyVimHandoffKeydown(
    view: EditorView,
    event: KeyboardEvent,
    isVimModeEnabled: () => boolean,
    focusWidgetNavigationTarget: (
        widget: VimHandoffWidget,
        position: VimHandoffWidgetPosition,
        blockFrom?: number,
    ) => boolean,
): boolean {
    if (isWidgetNavigationEventTarget(event.target)) {
        return false;
    }

    const vimKey = resolvePlainTextVimKeydownKey(event, false);
    if (!vimKey) {
        return false;
    }

    const handoffResult = resolveEditorBodyVimHandoff({
        view,
        key: vimKey,
        isVimModeEnabled: isVimModeEnabled(),
    });
    if (!handoffResult) {
        return false;
    }

    if (!applyResolvedVimHandoff(view, handoffResult, focusWidgetNavigationTarget)) {
        return false;
    }

    event.preventDefault();
    event.stopPropagation();
    return true;
}

/**
 * @function createVimImeInputPriorityExtension
 * @description 在 Vim 非 insert 命令态中拦截 IME 落下来的单字符文本，让 j/k/h/l 等键仍由 Vim 处理。
 * @param dependencies 测试注入依赖；生产默认使用 @replit/codemirror-vim。
 * @returns CodeMirror 扩展。
 */
export function createVimImeInputPriorityExtension(
    dependencies: VimImeInputPriorityDependencies = {},
): Extension {
    const getCodeMirrorInstance = dependencies.getCodeMirror ?? ((view: EditorView) => getCM(view));
    const handleVimKey = dependencies.handleVimKey ?? ((cm: CodeMirrorLike, key: string) =>
        Vim.handleKey(cm as CodeMirror, key, "user"));

    return Prec.highest([
        EditorView.domEventHandlers({
            keydown(event, view) {
                if (
                    dependencies.isVimModeEnabled
                    && dependencies.focusWidgetNavigationTarget
                    && handleEditorBodyVimHandoffKeydown(
                        view,
                        event,
                        dependencies.isVimModeEnabled,
                        dependencies.focusWidgetNavigationTarget,
                    )
                ) {
                    return true;
                }

                return false;
            },
        }),
        EditorView.inputHandler.of((view, _from, _to, text) => {
            if (
                isSinglePlainTextInput(text)
                && dependencies.isVimModeEnabled
                && dependencies.focusWidgetNavigationTarget
                && handleEditorBodyVimHandoffTextInput(
                    view,
                    text,
                    dependencies.isVimModeEnabled,
                    dependencies.focusWidgetNavigationTarget,
                )
            ) {
                return true;
            }

            const cm = getCodeMirrorInstance(view);
            return handleVimImeTextInput(text, cm, handleVimKey);
        }),
    ]);
}
