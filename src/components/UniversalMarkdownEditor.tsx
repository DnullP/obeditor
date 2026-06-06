import { useEffect, useMemo } from "react";
import { createEditorService } from "../core/editorService";
import type { EditorHostAdapter, EditorPlugin, EditorService } from "../core/types";
import { createDefaultMarkdownPlugins } from "../plugins/defaultMarkdownPlugins";
import { useEditorSnapshot } from "../react/useEditorSnapshot";
import {
  CodeMirrorMarkdownSurface,
  type CodeMirrorLineNumbersMode,
} from "./CodeMirrorMarkdownSurface";
import { EditorToolbar } from "./EditorToolbar";
import { MarkdownReadView } from "./MarkdownReadView";
import "../styles/editor.css";

export interface UniversalMarkdownEditorProps {
  service?: EditorService;
  initialContent?: string;
  title?: string;
  path?: string;
  adapter?: EditorHostAdapter;
  plugins?: EditorPlugin[];
  lineNumbers?: CodeMirrorLineNumbersMode | boolean;
  vimMode?: boolean;
  readOnly?: boolean;
  defaultMarkdownExtensions?: boolean;
  className?: string;
}

export function UniversalMarkdownEditor({
  service,
  initialContent = "",
  title = "Untitled",
  path,
  adapter,
  plugins,
  lineNumbers,
  vimMode,
  readOnly,
  defaultMarkdownExtensions,
  className,
}: UniversalMarkdownEditorProps) {
  const ownedService = useMemo(() => {
    if (service) {
      return null;
    }

    return createEditorService({
      document: {
        id: path ?? "demo",
        path,
        title,
        content: initialContent,
      },
      adapter,
      plugins: plugins ?? createDefaultMarkdownPlugins(),
    });
  }, [adapter, initialContent, path, plugins, service, title]);
  const activeService = service ?? ownedService;

  useEffect(() => {
    return () => {
      ownedService?.dispose();
    };
  }, [ownedService]);

  if (!activeService) {
    return null;
  }

  return (
    <UniversalMarkdownEditorSurface
      className={className}
      lineNumbers={lineNumbers}
      readOnly={readOnly}
      defaultMarkdownExtensions={defaultMarkdownExtensions}
      service={activeService}
      vimMode={vimMode}
    />
  );
}

function UniversalMarkdownEditorSurface({
  service,
  className,
  lineNumbers,
  vimMode,
  readOnly,
  defaultMarkdownExtensions,
}: {
  service: EditorService;
  className?: string;
  lineNumbers?: CodeMirrorLineNumbersMode | boolean;
  vimMode?: boolean;
  readOnly?: boolean;
  defaultMarkdownExtensions?: boolean;
}) {
  const snapshot = useEditorSnapshot(service);
  const rootClassName = ["oe-editor", className].filter(Boolean).join(" ");

  return (
    <section className={rootClassName} data-mode={snapshot.mode}>
      <EditorToolbar service={service} />
      {snapshot.error ? <div className="oe-editor-error">{snapshot.error}</div> : null}
      <div className="oe-editor-body" data-mode={snapshot.mode}>
        {snapshot.mode !== "read" ? (
          <div className="oe-editor-pane">
            <CodeMirrorMarkdownSurface
              defaultMarkdownExtensions={defaultMarkdownExtensions}
              lineNumbers={lineNumbers}
              readOnly={readOnly}
              service={service}
              vimMode={vimMode}
            />
          </div>
        ) : null}
        {snapshot.mode !== "edit" ? (
          <div className="oe-editor-pane oe-editor-pane-read">
            <MarkdownReadView content={snapshot.document.content} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
