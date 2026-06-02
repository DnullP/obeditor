import { describe, expect, test } from "bun:test";
import {
  createDefaultMarkdownCodeMirrorExtensions,
  ensureDefaultMarkdownCodeMirrorExtensionsRegistered,
} from "./defaultMarkdownCodeMirrorExtensions";
import { getRegisteredEditPluginExtensions } from "./editPluginRegistry";
import {
  getLineSyntaxRendererSnapshot,
} from "./syntaxRenderRegistry";
import { listRegisteredVimHandoffs } from "./handoff/vimHandoffRegistry";

describe("defaultMarkdownCodeMirrorExtensions", () => {
  test("registers the built-in Markdown editor plugin surface", () => {
    ensureDefaultMarkdownCodeMirrorExtensionsRegistered();

    expect(getLineSyntaxRendererSnapshot().map((renderer) => renderer.id)).toEqual([
      "header-line",
      "inline-bold",
      "inline-italic",
      "inline-strikethrough",
      "inline-code",
      "inline-wikilink",
      "inline-tag",
      "list-line",
      "blockquote-line",
      "horizontal-rule-line",
      "inline-link",
      "inline-highlight",
    ]);
    expect(listRegisteredVimHandoffs().map((handoff) => handoff.id)).toEqual(expect.arrayContaining([
      "frontmatter.body-enter-navigation",
      "latex-block.enter-source",
      "mermaid-block.enter-source",
      "markdown-table.body-enter-navigation",
    ]));
    expect(getRegisteredEditPluginExtensions({
      getCurrentFilePath: () => "notes/demo.md",
    })).toHaveLength(4);
  });

  test("creates the generic Markdown CodeMirror extension pack", () => {
    const extensions = createDefaultMarkdownCodeMirrorExtensions({
      getCurrentFilePath: () => "notes/demo.md",
      getCurrentDocumentContent: () => "# Demo",
      canMutateDocument: () => true,
      capabilities: {},
    });

    expect(extensions.length).toBeGreaterThanOrEqual(10);
  });
});
