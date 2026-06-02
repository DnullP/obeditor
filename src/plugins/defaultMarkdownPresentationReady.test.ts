import { EditorState } from "@codemirror/state";
import { describe, expect, test } from "bun:test";
import {
  isDefaultMarkdownPresentationReady,
  markdownDocumentStartsWithFrontmatter,
} from "./defaultMarkdownPresentationReady";

function createState(doc: string): EditorState {
  return EditorState.create({ doc });
}

function createDomStub(hasReadyFrontmatter: boolean): ParentNode {
  return {
    querySelector: () => (hasReadyFrontmatter ? {} : null),
  } as unknown as ParentNode;
}

describe("default Markdown presentation readiness", () => {
  test("does not wait when document has no frontmatter", () => {
    const state = createState("# Note\n\nBody");

    expect(markdownDocumentStartsWithFrontmatter(state)).toBe(false);
    expect(isDefaultMarkdownPresentationReady({ state, dom: createDomStub(false) })).toBe(true);
  });

  test("waits for the frontmatter widget readiness contract", () => {
    const state = createState("---\ntitle: Note\n---\n\nBody");

    expect(markdownDocumentStartsWithFrontmatter(state)).toBe(true);
    expect(isDefaultMarkdownPresentationReady({ state, dom: createDomStub(false) })).toBe(false);
    expect(isDefaultMarkdownPresentationReady({ state, dom: createDomStub(true) })).toBe(true);
  });
});
