/**
 * @module plugins/defaultMarkdownWidgetNavigation.test
 * @description Default Markdown widget navigation DOM contract tests.
 */

import { describe, expect, test } from "bun:test";
import {
  focusDefaultMarkdownWidgetVimNavigationTarget,
  resolveDefaultMarkdownInteractionTargetState,
} from "./defaultMarkdownWidgetNavigation";

function createClosestTarget(
  matcher: (selector: string) => boolean,
): EventTarget {
  return {
    closest: (selector: string) => matcher(selector) ? {} : null,
  } as unknown as EventTarget;
}

describe("default Markdown widget navigation contract", () => {
  test("resolves frontmatter interaction target state", () => {
    const row = createClosestTarget((selector) => selector === "[data-frontmatter-vim-nav='true']");
    const input = createClosestTarget((selector) =>
      selector === "[data-frontmatter-vim-nav='true']" ||
      selector === "[data-frontmatter-field-focusable='true']",
    );

    expect(resolveDefaultMarkdownInteractionTargetState(row)).toEqual({
      isFrontmatterNavigationTarget: true,
      isFrontmatterFieldTarget: false,
      isMarkdownTableTarget: false,
    });
    expect(resolveDefaultMarkdownInteractionTargetState(input)).toEqual({
      isFrontmatterNavigationTarget: true,
      isFrontmatterFieldTarget: true,
      isMarkdownTableTarget: false,
    });
  });

  test("focuses frontmatter navigation targets by position", () => {
    let focusedTarget = "";
    const first = { focus: () => { focusedTarget = "first"; } };
    const last = { focus: () => { focusedTarget = "last"; } };
    const root = {
      querySelectorAll: (selector: string) =>
        selector === "[data-frontmatter-vim-nav='true'][data-frontmatter-field-key]"
          ? [first, last]
          : [],
    } as unknown as ParentNode;

    expect(focusDefaultMarkdownWidgetVimNavigationTarget(root, {
      widget: "frontmatter",
      position: "last",
    })).toBe(true);
    expect(focusedTarget).toBe("last");
  });

  test("focuses markdown table entry anchors inside the requested block", () => {
    let focusedTarget = "";
    const tableTarget = createClosestTarget((selector) => selector === "[data-markdown-table-block-from]");
    const first = { focus: () => { focusedTarget = "first"; } };
    const last = { focus: () => { focusedTarget = "last"; } };
    const table = {
      querySelectorAll: (selector: string) =>
        selector === "[data-markdown-table-vim-nav='true'][data-markdown-table-entry-anchor='true']"
          ? [first, last]
          : [],
    };
    const root = {
      querySelector: (selector: string) =>
        selector === "[data-markdown-table-block-from][data-markdown-table-block-from='42']"
          ? table
          : null,
    } as unknown as ParentNode;

    expect(resolveDefaultMarkdownInteractionTargetState(tableTarget)).toEqual({
      isFrontmatterNavigationTarget: false,
      isFrontmatterFieldTarget: false,
      isMarkdownTableTarget: true,
    });
    expect(focusDefaultMarkdownWidgetVimNavigationTarget(root, {
      widget: "markdown-table",
      position: "last",
      blockFrom: 42,
    })).toBe(true);
    expect(focusedTarget).toBe("last");
  });
});
