import { describe, expect, it, mock } from "bun:test";
import {
  attachPasteImageHandler,
  blobToBase64,
  buildImageEmbedSyntax,
  buildPasteImageAssetRequest,
  generatePastedImageFileName,
  resolveImageRelativePath,
} from "./pasteImagePlugin";

function waitForMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createPasteEvent(file: File): ClipboardEvent {
  return {
    clipboardData: {
      items: {
        length: 1,
        0: {
          kind: "file",
          type: file.type,
          getAsFile: () => file,
        },
      },
    },
    preventDefault: mock(() => undefined),
    stopPropagation: mock(() => undefined),
  } as unknown as ClipboardEvent;
}

function createTextPasteEvent(): ClipboardEvent {
  return {
    clipboardData: {
      items: {
        length: 1,
        0: {
          kind: "string",
          type: "text/plain",
          getAsFile: () => null,
        },
      },
    },
    preventDefault: mock(() => undefined),
    stopPropagation: mock(() => undefined),
  } as unknown as ClipboardEvent;
}

function createView() {
  const listeners = new Map<string, EventListener>();
  const dispatch = mock(() => undefined);
  const dom = {
    addEventListener(type: string, listener: EventListener) {
      listeners.set(type, listener);
    },
    removeEventListener(type: string, listener: EventListener) {
      if (listeners.get(type) === listener) {
        listeners.delete(type);
      }
    },
  } as unknown as HTMLElement;

  return {
    dom,
    state: {
      selection: {
        main: {
          head: 3,
        },
      },
    },
    dispatch,
    emitPaste(event: ClipboardEvent) {
      listeners.get("paste")?.(event);
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

describe("pasteImagePlugin", () => {
  it("generates vault-friendly markdown image embed syntax", () => {
    const name = generatePastedImageFileName("image/png");
    expect(name).toMatch(/^pasted-image-\d{8}-\d{6}-[a-z0-9]+\.png$/);
    expect(generatePastedImageFileName("image/jpeg").endsWith(".jpg")).toBe(true);
    expect(generatePastedImageFileName("application/octet-stream").endsWith(".png")).toBe(true);
    expect(resolveImageRelativePath("demo.png")).toBe("Images/demo.png");
    expect(buildImageEmbedSyntax("Images/demo.png")).toBe("![[Images/demo.png]]");
  });

  it("encodes pasted image file bytes and builds an asset request", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "demo.png", {
      type: "image/png",
    });

    await expect(blobToBase64(file)).resolves.toBe("AQID");
    const request = await buildPasteImageAssetRequest(file);
    expect(request.base64Content).toBe("AQID");
    expect(request.relativePath).toMatch(/^Images\/pasted-image-.*\.png$/);
    expect(request.markdown).toBe(`![[${request.relativePath}]]`);
  });

  it("creates a media asset through capabilities and inserts returned markdown", async () => {
    const view = createView();
    const file = new File([new Uint8Array([4, 5, 6])], "demo.png", {
      type: "image/png",
    });
    const createAsset = mock(async (_file: File, context) => ({
      relativePath: context.suggestedRelativePath,
      markdown: "![[Images/custom.png|320]]",
    }));
    const cleanup = attachPasteImageHandler(view, {
      getCurrentFilePath: () => "Notes/current.md",
      capabilities: {
        mediaEmbeds: {
          createAsset,
        },
      },
    });

    const event = createPasteEvent(file);
    view.emitPaste(event);
    await waitForMicrotasks();

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(createAsset).toHaveBeenCalledTimes(1);
    expect(createAsset.mock.calls[0]?.[0]).toBe(file);
    expect(createAsset.mock.calls[0]?.[1]).toMatchObject({
      currentFilePath: "Notes/current.md",
      sourceDocumentId: "Notes/current.md",
      base64Content: "BAUG",
      markdown: expect.stringMatching(/^!\[\[Images\/pasted-image-.*\.png\]\]$/),
    });
    expect(view.dispatch).toHaveBeenCalledWith({
      changes: {
        from: 3,
        to: 3,
        insert: "![[Images/custom.png|320]]",
      },
      selection: {
        anchor: 29,
      },
    });

    cleanup();
    expect(view.listenerCount()).toBe(0);
  });

  it("does not intercept text paste or read-only image paste", async () => {
    const textView = createView();
    attachPasteImageHandler(textView, {
      getCurrentFilePath: () => "Notes/current.md",
      capabilities: {},
    });
    const textEvent = createTextPasteEvent();
    textView.emitPaste(textEvent);

    expect(textEvent.preventDefault).not.toHaveBeenCalled();
    expect(textView.dispatch).not.toHaveBeenCalled();

    const readonlyView = createView();
    attachPasteImageHandler(readonlyView, {
      getCurrentFilePath: () => "Notes/current.md",
      capabilities: {},
      canMutateDocument: () => false,
    });
    const imageEvent = createPasteEvent(new File([new Uint8Array([7])], "demo.png", {
      type: "image/png",
    }));
    readonlyView.emitPaste(imageEvent);
    await waitForMicrotasks();

    expect(imageEvent.preventDefault).not.toHaveBeenCalled();
    expect(readonlyView.dispatch).not.toHaveBeenCalled();
  });

  it("does not intercept when host asset creation is unavailable", async () => {
    const view = createView();
    const event = createPasteEvent(new File([new Uint8Array([8])], "demo.png", {
      type: "image/png",
    }));
    attachPasteImageHandler(view, {
      getCurrentFilePath: () => "Notes/current.md",
      capabilities: {},
      log: mock(() => undefined),
    });

    view.emitPaste(event);
    await waitForMicrotasks();

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalled();
  });
});
