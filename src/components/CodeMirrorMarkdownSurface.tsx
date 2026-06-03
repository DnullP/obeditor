import { useCallback, useEffect, useMemo, useRef } from "react";
import { markdown } from "@codemirror/lang-markdown";
import { indentWithTab } from "@codemirror/commands";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import { createEditorBaseSetup } from "../core/editorBaseSetup";
import { createEditorThemeExtension } from "../core/codemirrorTheme";
import { resolveEditorBodyAnchor } from "../core/editorBodyAnchor";
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
      getCurrentDocumentContent: () => service.getSnapshot().document.content,
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

    const updateListener = EditorView.updateListener.of((update) => {
      if (!update.docChanged || applyingExternalChangeRef.current) {
        return;
      }
      service.updateContent(update.state.doc.toString(), "codemirror");
    });

    const state = EditorState.create({
      doc: service.getSnapshot().document.content,
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
    service.attachView(view);

    return () => {
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

    const currentContent = view.state.doc.toString();
    if (currentContent === snapshot.document.content) {
      return;
    }

    applyingExternalChangeRef.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: currentContent.length,
        insert: snapshot.document.content,
      },
    });
    applyingExternalChangeRef.current = false;
  }, [snapshot.document.content]);

  return <div className="oe-code-editor cm-tab-editor" ref={hostRef} />;
}
