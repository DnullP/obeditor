/**
 * @module plugins/defaultMarkdownWidgetNavigation
 * @description Default Markdown widget DOM interaction contracts owned by obeditor.
 */

import type {
  VimHandoffWidget,
  VimHandoffWidgetPosition,
} from "./handoff/vimHandoffRegistry";

const FRONTMATTER_FOCUSABLE_SELECTOR = "[data-frontmatter-field-focusable='true']";
const FRONTMATTER_VIM_NAV_SELECTOR = "[data-frontmatter-vim-nav='true']";
const FRONTMATTER_VIM_ROW_SELECTOR = "[data-frontmatter-vim-nav='true'][data-frontmatter-field-key]";
const MARKDOWN_TABLE_SHELL_SELECTOR = "[data-markdown-table-block-from]";
const MARKDOWN_TABLE_VIM_NAV_SELECTOR = "[data-markdown-table-vim-nav='true']";
const MARKDOWN_TABLE_ENTRY_SELECTOR = `${MARKDOWN_TABLE_VIM_NAV_SELECTOR}[data-markdown-table-entry-anchor='true']`;

interface ClosestCapableTarget extends EventTarget {
  closest(selector: string): Element | null;
}

export interface DefaultMarkdownInteractionTargetState {
  isFrontmatterNavigationTarget: boolean;
  isFrontmatterFieldTarget: boolean;
  isMarkdownTableTarget: boolean;
}

export interface DefaultMarkdownWidgetNavigationRequest {
  widget: VimHandoffWidget;
  position: VimHandoffWidgetPosition;
  blockFrom?: number;
}

export const EMPTY_DEFAULT_MARKDOWN_INTERACTION_TARGET_STATE: DefaultMarkdownInteractionTargetState = {
  isFrontmatterNavigationTarget: false,
  isFrontmatterFieldTarget: false,
  isMarkdownTableTarget: false,
};

function isClosestCapableTarget(target: EventTarget | null): target is ClosestCapableTarget {
  return typeof target === "object" &&
    target !== null &&
    "closest" in target &&
    typeof target.closest === "function";
}

function findPositionedTarget(
  targets: readonly HTMLElement[],
  position: VimHandoffWidgetPosition,
): HTMLElement | null {
  return position === "first"
    ? targets[0] ?? null
    : targets[targets.length - 1] ?? null;
}

function focusFrontmatterNavigationTarget(
  root: ParentNode,
  position: VimHandoffWidgetPosition,
): boolean {
  const rowTargets = Array.from(root.querySelectorAll<HTMLElement>(FRONTMATTER_VIM_ROW_SELECTOR));
  const navigationTargets = Array.from(root.querySelectorAll<HTMLElement>(FRONTMATTER_VIM_NAV_SELECTOR));
  const preferredTargets = rowTargets.length > 0 ? rowTargets : navigationTargets;
  const target = findPositionedTarget(preferredTargets, position);
  if (!target) {
    return false;
  }

  target.focus();
  return true;
}

function focusMarkdownTableNavigationTarget(
  root: ParentNode,
  request: DefaultMarkdownWidgetNavigationRequest,
): boolean {
  if (typeof request.blockFrom !== "number") {
    return false;
  }

  const tableShell = root.querySelector<HTMLElement>(
    `${MARKDOWN_TABLE_SHELL_SELECTOR}[data-markdown-table-block-from='${request.blockFrom}']`,
  );
  if (!tableShell) {
    return false;
  }

  const entryTargets = Array.from(tableShell.querySelectorAll<HTMLElement>(MARKDOWN_TABLE_ENTRY_SELECTOR));
  const navigationTargets = Array.from(tableShell.querySelectorAll<HTMLElement>(MARKDOWN_TABLE_VIM_NAV_SELECTOR));
  const preferredTargets = entryTargets.length > 0 ? entryTargets : navigationTargets;
  const target = findPositionedTarget(preferredTargets, request.position);
  if (!target) {
    return false;
  }

  target.focus();
  return true;
}

export function resolveDefaultMarkdownInteractionTargetState(
  target: EventTarget | null,
): DefaultMarkdownInteractionTargetState {
  if (!isClosestCapableTarget(target)) {
    return EMPTY_DEFAULT_MARKDOWN_INTERACTION_TARGET_STATE;
  }

  return {
    isFrontmatterNavigationTarget: Boolean(target.closest(FRONTMATTER_VIM_NAV_SELECTOR)),
    isFrontmatterFieldTarget: Boolean(target.closest(FRONTMATTER_FOCUSABLE_SELECTOR)),
    isMarkdownTableTarget: Boolean(target.closest(MARKDOWN_TABLE_SHELL_SELECTOR)),
  };
}

export function focusDefaultMarkdownWidgetVimNavigationTarget(
  root: ParentNode,
  request: DefaultMarkdownWidgetNavigationRequest,
): boolean {
  if (request.widget === "frontmatter") {
    return focusFrontmatterNavigationTarget(root, request.position);
  }

  if (request.widget === "markdown-table") {
    return focusMarkdownTableNavigationTarget(root, request);
  }

  return false;
}
