import type { EditorView } from "@codemirror/view";

const FRONTMATTER_DELIMITER = "---";
const FRONTMATTER_READY_SELECTOR = "[data-obeditor-frontmatter-ready='true']";

export interface MarkdownPresentationReadyContext {
  state: Pick<EditorView["state"], "doc">;
  dom: ParentNode;
}

export function markdownDocumentStartsWithFrontmatter(
  state: Pick<EditorView["state"], "doc">,
): boolean {
  const firstLine = state.doc.line(1).text.trim();
  return firstLine === FRONTMATTER_DELIMITER;
}

export function isDefaultMarkdownPresentationReady(
  context: MarkdownPresentationReadyContext,
): boolean {
  if (!markdownDocumentStartsWithFrontmatter(context.state)) {
    return true;
  }

  return context.dom.querySelector(FRONTMATTER_READY_SELECTOR) !== null;
}
