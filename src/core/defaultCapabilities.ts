import {
  createEditorCapabilityRegistry,
  type EditorCapabilities,
  type EditorCapabilitiesSource,
  type EditorContextMenuItem,
  type EditorContextMenuTrigger,
  type EditorMediaEmbedBinaryResult,
  type EditorWikiLinkPreview,
  type EditorWikiLinkResolvedTarget,
  type EditorWikiLinkSuggestionItem,
  type EditorWikiLinkTargetContext,
} from "./capabilities";

export interface DefaultEditorMemoryDocument {
  path: string;
  title?: string;
  content: string;
  referenceCount?: number;
}

export interface DefaultEditorMemoryAsset {
  relativePath: string;
  mimeType: string;
  base64Content?: string;
  dataUrl?: string;
  bytes?: Uint8Array | ArrayBuffer;
  label?: string;
}

export interface DefaultEditorCapabilitiesOptions {
  documents?: DefaultEditorMemoryDocument[];
  assets?: DefaultEditorMemoryAsset[];
  translations?: Record<string, string>;
  openExternalLink?: (url: string) => Promise<void> | void;
  onOpenWikiLink?: (target: EditorWikiLinkResolvedTarget) => Promise<void> | void;
  showContextMenu?: (
    items: EditorContextMenuItem[],
    trigger: EditorContextMenuTrigger,
  ) => Promise<string | null> | string | null;
}

export interface DefaultEditorCapabilities extends EditorCapabilities {
  memory: {
    listDocuments: () => DefaultEditorMemoryDocument[];
    upsertDocument: (document: DefaultEditorMemoryDocument) => void;
    readDocument: (relativePath: string) => string | null;
    listAssets: () => DefaultEditorMemoryAsset[];
    upsertAsset: (asset: DefaultEditorMemoryAsset) => void;
    registry: ReturnType<typeof createEditorCapabilityRegistry>;
  };
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function resolveTitle(document: Pick<DefaultEditorMemoryDocument, "path" | "title">): string {
  return document.title ?? normalizePath(document.path).split("/").pop() ?? document.path;
}

function rankDocument(query: string, document: DefaultEditorMemoryDocument): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return 1;
  }

  const title = resolveTitle(document).toLowerCase();
  const path = normalizePath(document.path).toLowerCase();
  if (title === normalizedQuery || path === normalizedQuery) {
    return 100;
  }
  if (title.startsWith(normalizedQuery)) {
    return 80;
  }
  if (path.startsWith(normalizedQuery)) {
    return 70;
  }
  if (title.includes(normalizedQuery)) {
    return 55;
  }
  if (path.includes(normalizedQuery)) {
    return 45;
  }
  return 0;
}

function createDocumentStore(documents: readonly DefaultEditorMemoryDocument[]): Map<string, DefaultEditorMemoryDocument> {
  return new Map(documents.map((document) => [
    normalizePath(document.path),
    {
      ...document,
      path: normalizePath(document.path),
      title: resolveTitle(document),
    },
  ]));
}

function createAssetStore(assets: readonly DefaultEditorMemoryAsset[]): Map<string, DefaultEditorMemoryAsset> {
  return new Map(assets.map((asset) => [
    normalizePath(asset.relativePath),
    {
      ...asset,
      relativePath: normalizePath(asset.relativePath),
    },
  ]));
}

function resolveDocumentByTarget(
  documents: Map<string, DefaultEditorMemoryDocument>,
  target: string,
): DefaultEditorMemoryDocument | null {
  const normalizedTarget = normalizePath(target.trim());
  if (!normalizedTarget) {
    return null;
  }

  const exact = documents.get(normalizedTarget)
    ?? documents.get(normalizedTarget.endsWith(".md") ? normalizedTarget : `${normalizedTarget}.md`);
  if (exact) {
    return exact;
  }

  const lowered = normalizedTarget.toLowerCase();
  return [...documents.values()].find((document) => {
    const path = normalizePath(document.path).toLowerCase();
    const title = resolveTitle(document).toLowerCase();
    return path === lowered
      || path.replace(/\.md$/u, "") === lowered
      || title === lowered
      || title.replace(/\.md$/u, "") === lowered;
  }) ?? null;
}

function toSuggestion(document: DefaultEditorMemoryDocument): EditorWikiLinkSuggestionItem {
  return {
    title: resolveTitle(document).replace(/\.md$/u, ""),
    relativePath: normalizePath(document.path),
    referenceCount: document.referenceCount ?? 0,
  };
}

function createFallbackContextMenu(
  items: EditorContextMenuItem[],
): string | null {
  return items.find((item) => item.enabled !== false)?.id ?? null;
}

export function createDefaultEditorCapabilities(
  options: DefaultEditorCapabilitiesOptions = {},
): DefaultEditorCapabilities {
  const documents = createDocumentStore(options.documents ?? []);
  const assets = createAssetStore(options.assets ?? []);
  const registry = createEditorCapabilityRegistry();

  const capabilities: DefaultEditorCapabilities = {
    localization: {
      t(key, interpolation, fallback) {
        const translated = options.translations?.[key] ?? fallback ?? key;
        return Object.entries(interpolation ?? {}).reduce(
          (text, [name, value]) => text.split(`{{${name}}}`).join(String(value)),
          translated,
        );
      },
    },
    contextMenu: {
      show(items, trigger) {
        return options.showContextMenu?.(items, trigger) ?? createFallbackContextMenu(items);
      },
    },
    openExternalLink: options.openExternalLink ?? ((url) => {
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }),
    wikiLinks: {
      suggestTargets: async (query, limit) => [...documents.values()]
        .map((document) => ({ document, score: rankDocument(query, document) }))
        .filter(({ score }) => score > 0 || query.trim().length === 0)
        .sort((left, right) =>
          right.score - left.score
          || (right.document.referenceCount ?? 0) - (left.document.referenceCount ?? 0)
          || resolveTitle(left.document).localeCompare(resolveTitle(right.document)),
        )
        .slice(0, limit)
        .map(({ document }) => toSuggestion(document)),
      resolveTarget: (target, context) => {
        const resolved = resolveDocumentByTarget(documents, target)
          ?? (target.trim().startsWith("#") ? resolveDocumentByTarget(documents, context.currentFilePath ?? "") : null);
        if (!resolved) {
          return null;
        }

        return {
          relativePath: normalizePath(resolved.path),
          title: resolveTitle(resolved),
          content: resolved.content,
        };
      },
      previewTarget: (target, context): EditorWikiLinkPreview | null => {
        const resolved = resolveDocumentByTarget(documents, target)
          ?? (target.trim().startsWith("#") ? resolveDocumentByTarget(documents, context.currentFilePath ?? "") : null);
        if (!resolved) {
          return null;
        }

        return {
          kind: "markdown",
          resolvedPath: normalizePath(resolved.path),
          content: resolved.content,
        };
      },
      readTargetContent: async (relativePath) =>
        resolveDocumentByTarget(documents, relativePath)?.content ?? "",
      openTarget: async (target, context: EditorWikiLinkTargetContext) => {
        const resolved = await capabilities.wikiLinks?.resolveTarget?.(target, context);
        if (resolved) {
          await options.onOpenWikiLink?.(resolved);
        }
      },
    },
    mediaEmbeds: {
      resolveTarget: (target) => {
        const asset = assets.get(normalizePath(target));
        return asset ? { relativePath: asset.relativePath, label: asset.label } : null;
      },
      readBinary: async (target): Promise<EditorMediaEmbedBinaryResult | null> => {
        const asset = assets.get(normalizePath(target));
        return asset
          ? {
            relativePath: asset.relativePath,
            mimeType: asset.mimeType,
            base64Content: asset.base64Content,
            dataUrl: asset.dataUrl,
            bytes: asset.bytes,
          }
          : null;
      },
      createAsset: async (file, context) => {
        const relativePath = normalizePath(
          context.suggestedRelativePath ?? `assets/${context.suggestedFileName ?? file.name}`,
        );
        assets.set(relativePath, {
          relativePath,
          mimeType: file.type || "application/octet-stream",
          base64Content: context.base64Content,
          dataUrl: context.base64Content ? `data:${file.type};base64,${context.base64Content}` : undefined,
        });
        return {
          relativePath,
          markdown: context.markdown ?? `![[${relativePath}]]`,
        };
      },
    },
    memory: {
      listDocuments: () => [...documents.values()],
      upsertDocument(document) {
        documents.set(normalizePath(document.path), {
          ...document,
          path: normalizePath(document.path),
          title: resolveTitle(document),
        });
        registry.update(capabilities);
      },
      readDocument(relativePath) {
        return resolveDocumentByTarget(documents, relativePath)?.content ?? null;
      },
      listAssets: () => [...assets.values()],
      upsertAsset(asset) {
        assets.set(normalizePath(asset.relativePath), {
          ...asset,
          relativePath: normalizePath(asset.relativePath),
        });
        registry.update(capabilities);
      },
      registry,
    },
  };

  registry.update(capabilities);
  return capabilities;
}

export const defaultEditorCapabilities: EditorCapabilitiesSource =
  createDefaultEditorCapabilities();
