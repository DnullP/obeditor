export interface EditorLocalizationCapabilities {
  t: (key: string, options?: Record<string, unknown>, fallback?: string) => string;
}

export interface EditorWikiLinkSuggestionItem {
  title: string;
  relativePath: string;
  referenceCount: number;
}

export interface EditorWikiLinkResolvedTarget {
  relativePath: string;
  title?: string;
  content?: string;
  revealLine?: number;
  cursorOffset?: number;
}

export interface EditorWikiLinkMarkdownPreview {
  kind: "markdown";
  resolvedPath: string;
  content: string;
  revealLine?: number;
}

export interface EditorWikiLinkCustomPreview {
  kind: "custom";
  resolvedPath: string;
  content?: string;
  render: () => unknown;
}

export type EditorWikiLinkPreview = EditorWikiLinkMarkdownPreview | EditorWikiLinkCustomPreview;

export interface EditorWikiLinkCapabilities {
  suggestTargets?: (query: string, limit: number) => Promise<EditorWikiLinkSuggestionItem[]>;
  openTarget?: (target: string, context: EditorWikiLinkTargetContext) => Promise<void> | void;
  resolveTarget?: (
    target: string,
    context: EditorWikiLinkTargetContext,
  ) => Promise<EditorWikiLinkResolvedTarget | null> | EditorWikiLinkResolvedTarget | null;
  previewTarget?: (
    target: string,
    context: EditorWikiLinkTargetContext,
  ) => Promise<EditorWikiLinkPreview | null> | EditorWikiLinkPreview | null;
  readTargetContent?: (relativePath: string) => Promise<string>;
}

export interface EditorWikiLinkTargetContext {
  currentFilePath?: string;
  sourceDocumentId?: string;
  currentDocumentContent?: string;
}

export interface EditorMediaEmbedResolvedTarget {
  relativePath: string;
  label?: string;
}

export interface EditorMediaEmbedBinaryResult {
  relativePath?: string;
  mimeType: string;
  base64Content?: string;
  bytes?: Uint8Array | ArrayBuffer;
  dataUrl?: string;
}

export interface EditorMediaEmbedCapabilities {
  readBinary?: (
    target: string,
    context: EditorMediaEmbedContext,
  ) => Promise<EditorMediaEmbedBinaryResult | null>;
  createAsset?: (file: File, context: EditorMediaEmbedContext) => Promise<{ markdown: string; relativePath: string }>;
  resolveTarget?: (
    target: string,
    context: EditorMediaEmbedContext,
  ) => Promise<EditorMediaEmbedResolvedTarget | string | null> | EditorMediaEmbedResolvedTarget | string | null;
}

export interface EditorMediaEmbedContext {
  currentFilePath?: string;
  sourceDocumentId?: string;
  suggestedFileName?: string;
  suggestedRelativePath?: string;
  base64Content?: string;
  markdown?: string;
}

export interface EditorTextSegment {
  text: string;
  start: number;
  end: number;
}

export interface EditorTextSegmentationCapabilities {
  segmentText?: (text: string, context?: EditorTextSegmentationContext) => Promise<EditorTextSegment[]>;
}

export interface EditorTextSegmentationContext {
  language?: string;
  currentFilePath?: string;
}

export interface EditorContextMenuItem {
  id: string;
  text: string;
  enabled?: boolean;
  checked?: boolean;
}

export interface EditorContextMenuTrigger {
  clientX: number;
  clientY: number;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

export interface EditorContextMenuCapabilities {
  show?: (
    items: EditorContextMenuItem[],
    trigger: EditorContextMenuTrigger,
  ) => Promise<string | null> | string | null;
}

export interface EditorHostCapabilities {
  localization?: EditorLocalizationCapabilities;
  wikiLinks?: EditorWikiLinkCapabilities;
  mediaEmbeds?: EditorMediaEmbedCapabilities;
  textSegmentation?: EditorTextSegmentationCapabilities;
  contextMenu?: EditorContextMenuCapabilities;
  openExternalLink?: (url: string) => Promise<void> | void;
}

export type EditorCapabilities = EditorHostCapabilities;

export type EditorCapabilitiesSource =
  | EditorCapabilities
  | (() => EditorCapabilities | undefined)
  | undefined;

export type EditorCapabilityListener = (capabilities: EditorCapabilities) => void;

export interface EditorCapabilityRegistry {
  getSnapshot: () => EditorCapabilities;
  update: (
    next:
      | EditorCapabilities
      | ((previous: EditorCapabilities) => EditorCapabilities),
  ) => EditorCapabilities;
  subscribe: (listener: EditorCapabilityListener) => () => void;
}

export const EMPTY_EDITOR_CAPABILITIES: EditorCapabilities = Object.freeze({});

export function createEditorCapabilityRegistry(
  initialCapabilities: EditorCapabilities = EMPTY_EDITOR_CAPABILITIES,
): EditorCapabilityRegistry {
  let snapshot = initialCapabilities;
  const listeners = new Set<EditorCapabilityListener>();

  return {
    getSnapshot: () => snapshot,
    update(next) {
      snapshot = typeof next === "function" ? next(snapshot) : next;
      listeners.forEach((listener) => listener(snapshot));
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function translateEditorText(
  capabilities: EditorCapabilities | undefined,
  key: string,
  fallback: string,
  options?: Record<string, unknown>,
): string {
  return capabilities?.localization?.t(key, options, fallback) ?? fallback;
}

export function resolveEditorCapabilities(
  source: EditorCapabilitiesSource,
): EditorCapabilities | undefined {
  return typeof source === "function" ? source() : source;
}

export function translateEditorTextFromSource(
  source: EditorCapabilitiesSource,
  key: string,
  fallback: string,
  options?: Record<string, unknown>,
): string {
  return translateEditorText(resolveEditorCapabilities(source), key, fallback, options);
}

export async function suggestEditorWikiLinkTargets(
  capabilities: EditorCapabilities | undefined,
  query: string,
  limit: number,
): Promise<EditorWikiLinkSuggestionItem[]> {
  return capabilities?.wikiLinks?.suggestTargets?.(query, limit) ?? [];
}

export async function openEditorWikiLinkTarget(
  capabilities: EditorCapabilities | undefined,
  target: string,
  context: EditorWikiLinkTargetContext,
): Promise<boolean> {
  const openTarget = capabilities?.wikiLinks?.openTarget;
  if (!openTarget) {
    return false;
  }

  await openTarget(target, context);
  return true;
}

export async function resolveEditorWikiLinkTarget(
  capabilities: EditorCapabilities | undefined,
  target: string,
  context: EditorWikiLinkTargetContext,
): Promise<EditorWikiLinkResolvedTarget | null> {
  return capabilities?.wikiLinks?.resolveTarget?.(target, context) ?? null;
}

export async function previewEditorWikiLinkTarget(
  capabilities: EditorCapabilities | undefined,
  target: string,
  context: EditorWikiLinkTargetContext,
): Promise<EditorWikiLinkPreview | null> {
  return capabilities?.wikiLinks?.previewTarget?.(target, context) ?? null;
}
