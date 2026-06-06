import { useCallback, useEffect, useMemo, useRef } from "react";
import { markdown } from "@codemirror/lang-markdown";
import { indentWithTab } from "@codemirror/commands";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import { createEditorBaseSetup } from "../core/editorBaseSetup";
import { createDeferredEditorContentSync } from "../core/editorContentSync";
import { createEditorThemeExtension } from "../core/codemirrorTheme";
import { resolveEditorBodyAnchor } from "../core/editorBodyAnchor";
import { createLayoutLightweightMeasurementController } from "../core/layoutLightweightSignal";
import { buildLineNumbersExtension } from "../core/lineNumbersModeExtension";
import type { EditorService } from "../core/types";
import { createDefaultMarkdownCodeMirrorExtensions } from "../plugins/defaultMarkdownCodeMirrorExtensions";
import { focusDefaultMarkdownWidgetVimNavigationTarget } from "../plugins/defaultMarkdownWidgetNavigation";
import { createVimImeInputPriorityExtension } from "../plugins/handoff/vimImeInputPriorityExtension";
import type { VimHandoffWidget, VimHandoffWidgetPosition } from "../plugins/handoff/vimHandoffRegistry";
import { useEditorSnapshot } from "../react/useEditorSnapshot";

export type CodeMirrorLineNumbersMode = "off" | "absolute" | "relative";

export interface CodeMirrorMarkdownSurfaceProps {
  service: EditorService;
  lineNumbers?: CodeMirrorLineNumbersMode | boolean;
  vimMode?: boolean;
  readOnly?: boolean;
  defaultMarkdownExtensions?: boolean;
}

function normalizeLineNumbersMode(lineNumbers: CodeMirrorMarkdownSurfaceProps["lineNumbers"]): CodeMirrorLineNumbersMode {
  if (lineNumbers === false) {
    return "off";
  }
  if (lineNumbers === "off" || lineNumbers === "relative") {
    return lineNumbers;
  }
  return "absolute";
}

export function CodeMirrorMarkdownSurface({
  service,
  lineNumbers = "absolute",
  vimMode = false,
  readOnly = false,
  defaultMarkdownExtensions = true,
}: CodeMirrorMarkdownSurfaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const applyingExternalChangeRef = useRef(false);
  const lastKnownViewContentRef = useRef(service.getSnapshot().document.content);
  const contentSyncRef = useRef<ReturnType<typeof createDeferredEditorContentSync> | null>(null);
  const snapshot = useEditorSnapshot(service);
  const lineNumbersMode = normalizeLineNumbersMode(lineNumbers);
  const focusWidgetNavigationTarget = useCallback((
    widget: VimHandoffWidget,
    position: VimHandoffWidgetPosition,
    blockFrom?: number,
  ) => {
    const root = hostRef.current;
    if (!root) {
      return false;
    }

    return focusDefaultMarkdownWidgetVimNavigationTarget(root, {
      widget,
      position,
      blockFrom,
    });
  }, []);
  const requestExitFrontmatterVimNavigation = useCallback(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      selection: { anchor: resolveEditorBodyAnchor(view.state) },
      scrollIntoView: true,
    });
    view.focus();
  }, []);
  const defaultMarkdownCodeMirrorExtensions = useMemo(() => {
    if (!defaultMarkdownExtensions) {
      return [];
    }

    return createDefaultMarkdownCodeMirrorExtensions({
      getCurrentFilePath: () => service.getSnapshot().document.path ?? "",
      getCurrentDocumentContent: () => viewRef.current?.state.doc.toString() ?? service.getSnapshot().document.content,
      canMutateDocument: () => !readOnly,
      capabilities: () => service.getCapabilities(),
      onRequestExitFrontmatterVimNavigation: requestExitFrontmatterVimNavigation,
      onRequestFocusFrontmatterVimNavigation: (position) => {
        focusWidgetNavigationTarget("frontmatter", position);
      },
      onRequestFocusMarkdownTableVimNavigation: (request) => {
        focusWidgetNavigationTarget("markdown-table", request.position, request.blockFrom);
      },
    });
  }, [
    defaultMarkdownExtensions,
    focusWidgetNavigationTarget,
    readOnly,
    requestExitFrontmatterVimNavigation,
    service,
  ]);
  const pluginExtensions = useMemo(
    () => service.getCodeMirrorExtensions() as Extension[],
    [service],
  );

  useEffect(() => {
    if (!hostRef.current) {
      return undefined;
    }

    const contentSync = createDeferredEditorContentSync({
      reason: "codemirror",
      readContent: () => {
        const content = viewRef.current?.state.doc.toString() ?? lastKnownViewContentRef.current;
        lastKnownViewContentRef.current = content;
        return content;
      },
      applyContent: (content, reason) => {
        lastKnownViewContentRef.current = content;
        service.updateContent(content, reason);
      },
    });
    contentSyncRef.current = contentSync;

    const updateListener = EditorView.updateListener.of((update) => {
      if (!update.docChanged || applyingExternalChangeRef.current) {
        return;
      }
      contentSync.requestSync(update.state.doc.length);
    });

    const initialContent = service.getSnapshot().document.content;
    lastKnownViewContentRef.current = initialContent;
    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        createEditorBaseSetup(),
        markdown(),
        createEditorThemeExtension(),
        EditorView.lineWrapping,
        keymap.of([indentWithTab]),
        buildLineNumbersExtension(lineNumbersMode),
        vimMode ? vim() : [],
        vimMode
          ? createVimImeInputPriorityExtension({
            isVimModeEnabled: () => vimMode,
            focusWidgetNavigationTarget,
          })
          : [],
        readOnly ? EditorState.readOnly.of(true) : [],
        updateListener,
        ...defaultMarkdownCodeMirrorExtensions,
        ...pluginExtensions,
      ],
    });

    const view = new EditorView({
      state,
      parent: hostRef.current,
    });
    viewRef.current = view;
    service.attachView(view, {
      contentSync: {
        flushPendingContent: (reason) => contentSync.flush(reason ?? "codemirror"),
      },
    });

    const resizeMeasureController = createLayoutLightweightMeasurementController(() => {
      view.requestMeasure();
    });
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
        resizeMeasureController.request();
      });
    resizeObserver?.observe(hostRef.current);

    return () => {
      contentSync.flush("unmount");
      contentSync.cancel();
      if (contentSyncRef.current === contentSync) {
        contentSyncRef.current = null;
      }
      resizeObserver?.disconnect();
      resizeMeasureController.dispose();
      service.attachView(null);
      view.destroy();
      viewRef.current = null;
    };
  }, [
    defaultMarkdownCodeMirrorExtensions,
    focusWidgetNavigationTarget,
    lineNumbersMode,
    pluginExtensions,
    readOnly,
    service,
    vimMode,
  ]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const snapshotContent = snapshot.document.content;
    if (snapshotContent === lastKnownViewContentRef.current) {
      return;
    }

    if (view.state.doc.length === snapshotContent.length) {
      const currentContent = view.state.doc.toString();
      if (currentContent === snapshotContent) {
        lastKnownViewContentRef.current = snapshotContent;
        return;
      }
    }

    contentSyncRef.current?.cancel();
    applyingExternalChangeRef.current = true;
    try {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: snapshotContent,
        },
      });
      lastKnownViewContentRef.current = snapshotContent;
    } finally {
      applyingExternalChangeRef.current = false;
    }
  }, [snapshot.document.content]);

  return <div className="oe-code-editor cm-tab-editor" ref={hostRef} />;
}
