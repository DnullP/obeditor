import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { EditorCapabilitiesSource } from "../core/capabilities";
import { resolveEditorCapabilities } from "../core/capabilities";
import { serializeImageEmbedSyntax } from "../markdown/imageEmbedLayout";

interface PasteImageEditorView {
  state: {
    selection: {
      main: {
        head: number;
      };
    };
  };
  dispatch(transaction: {
    changes: { from: number; to?: number; insert: string };
    selection?: { anchor: number; head?: number };
  }): void;
}

export interface PasteImageDependencies {
  getCurrentFilePath: () => string;
  capabilities: EditorCapabilitiesSource;
  canMutateDocument?: () => boolean;
  log?: (level: "debug" | "info" | "warn" | "error", message: string, context?: Record<string, unknown>) => void;
}

export interface PasteImageAssetRequest {
  file: File;
  fileName: string;
  relativePath: string;
  base64Content: string;
  markdown: string;
}

const IMAGE_DIRECTORY = "Images";

const SUPPORTED_PASTE_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
};

function logPasteImage(
  deps: Pick<PasteImageDependencies, "log">,
  level: "debug" | "info" | "warn" | "error",
  message: string,
  context?: Record<string, unknown>,
): void {
  deps.log?.(level, message, context);
  if (deps.log) {
    return;
  }

  const logger = level === "debug" ? console.debug : console[level];
  logger(`[editor-paste-image] ${message}`, context ?? {});
}

export function generatePastedImageFileName(mimeType: string): string {
  const extension = SUPPORTED_PASTE_IMAGE_TYPES[mimeType] ?? "png";
  const now = new Date();
  const pad2 = (n: number): string => n.toString().padStart(2, "0");
  const timestamp = [
    now.getFullYear(),
    pad2(now.getMonth() + 1),
    pad2(now.getDate()),
    "-",
    pad2(now.getHours()),
    pad2(now.getMinutes()),
    pad2(now.getSeconds()),
  ].join("");
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `pasted-image-${timestamp}-${randomSuffix}.${extension}`;
}

export function resolveImageRelativePath(fileName: string): string {
  return `${IMAGE_DIRECTORY}/${fileName}`;
}

export function buildImageEmbedSyntax(imageRelativePath: string): string {
  return serializeImageEmbedSyntax(imageRelativePath, null);
}

function findImageClipboardItem(items: DataTransferItemList): DataTransferItem | null {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file" && item.type in SUPPORTED_PASTE_IMAGE_TYPES) {
      return item;
    }
  }
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof blob.arrayBuffer === "function") {
    return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
  }

  if (typeof FileReader === "undefined") {
    throw new Error("FileReader is unavailable.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("FileReader returned an unexpected result."));
        return;
      }

      const commaIndex = result.indexOf(",");
      if (commaIndex < 0) {
        reject(new Error("FileReader returned an invalid data URL."));
        return;
      }
      resolve(result.slice(commaIndex + 1));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read pasted image."));
    };
    reader.readAsDataURL(blob);
  });
}

export async function buildPasteImageAssetRequest(file: File): Promise<PasteImageAssetRequest> {
  const fileName = generatePastedImageFileName(file.type);
  const relativePath = resolveImageRelativePath(fileName);
  const markdown = buildImageEmbedSyntax(relativePath);
  return {
    file,
    fileName,
    relativePath,
    base64Content: await blobToBase64(file),
    markdown,
  };
}

function handlePasteImageEvent(
  view: PasteImageEditorView,
  deps: PasteImageDependencies,
  event: ClipboardEvent,
): boolean {
  if (deps.canMutateDocument && !deps.canMutateDocument()) {
    logPasteImage(deps, "info", "paste image skipped: editor is read-only", {
      currentFilePath: deps.getCurrentFilePath(),
    });
    return false;
  }

  const clipboardData = event.clipboardData;
  if (!clipboardData) {
    return false;
  }

  const imageItem = findImageClipboardItem(clipboardData.items);
  if (!imageItem) {
    return false;
  }

  const imageFile = imageItem.getAsFile();
  if (!imageFile) {
    logPasteImage(deps, "warn", "paste image skipped: failed to read clipboard file");
    return false;
  }

  const capabilities = resolveEditorCapabilities(deps.capabilities);
  const createAsset = capabilities?.mediaEmbeds?.createAsset;
  if (!createAsset) {
    logPasteImage(deps, "warn", "paste image skipped: missing media asset capability", {
      currentFilePath: deps.getCurrentFilePath(),
    });
    return false;
  }

  event.preventDefault();
  event.stopPropagation();

  void (async () => {
    const currentFilePath = deps.getCurrentFilePath();
    try {
      const assetRequest = await buildPasteImageAssetRequest(imageFile);

      logPasteImage(deps, "info", "paste image detected", {
        mimeType: imageFile.type,
        fileName: assetRequest.fileName,
        relativePath: assetRequest.relativePath,
        currentFilePath,
      });

      const createdAsset = await createAsset(assetRequest.file, {
        currentFilePath,
        sourceDocumentId: currentFilePath,
        suggestedFileName: assetRequest.fileName,
        suggestedRelativePath: assetRequest.relativePath,
        base64Content: assetRequest.base64Content,
        markdown: assetRequest.markdown,
      });
      const embedSyntax = createdAsset.markdown || buildImageEmbedSyntax(createdAsset.relativePath);
      const cursor = view.state.selection.main.head;
      view.dispatch({
        changes: {
          from: cursor,
          to: cursor,
          insert: embedSyntax,
        },
        selection: {
          anchor: cursor + embedSyntax.length,
        },
      });

      logPasteImage(deps, "info", "paste image inserted", {
        relativePath: createdAsset.relativePath,
        markdown: embedSyntax,
      });
    } catch (error) {
      logPasteImage(deps, "error", "paste image failed", {
        currentFilePath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  return true;
}

export function createPasteImageExtension(deps: PasteImageDependencies): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      return handlePasteImageEvent(view, deps, event);
    },
  });
}

export function attachPasteImageHandler(
  view: PasteImageEditorView & { dom: HTMLElement },
  deps: PasteImageDependencies,
): () => void {
  const handlePaste = (event: ClipboardEvent): void => {
    handlePasteImageEvent(view, deps, event);
  };

  view.dom.addEventListener("paste", handlePaste);
  return () => {
    view.dom.removeEventListener("paste", handlePaste);
  };
}
