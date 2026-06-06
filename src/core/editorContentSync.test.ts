import { describe, expect, it, mock } from "bun:test";
import { createDeferredEditorContentSync } from "./editorContentSync";

function createManualScheduler() {
  const callbacks: Array<() => void> = [];
  const schedule = mock((callback: () => void) => {
    let canceled = false;
    callbacks.push(() => {
      if (!canceled) {
        callback();
      }
    });
    return () => {
      canceled = true;
    };
  });

  return {
    callbacks,
    schedule,
  };
}

describe("createDeferredEditorContentSync", () => {
  it("syncs small documents immediately", () => {
    const readContent = mock(() => "small");
    const applyContent = mock(() => undefined);
    const controller = createDeferredEditorContentSync({
      readContent,
      applyContent,
      immediateContentLengthLimit: 20,
    });

    controller.requestSync(5);

    expect(readContent).toHaveBeenCalledTimes(1);
    expect(applyContent).toHaveBeenCalledWith("small", "editor");
    expect(controller.hasPendingSync()).toBe(false);
  });

  it("coalesces large document changes into one deferred sync", () => {
    const scheduler = createManualScheduler();
    let content = "first";
    const readContent = mock(() => content);
    const applyContent = mock(() => undefined);
    const controller = createDeferredEditorContentSync({
      readContent,
      applyContent,
      immediateContentLengthLimit: 4,
      schedule: scheduler.schedule,
    });

    controller.requestSync(100_000);
    content = "latest";
    controller.requestSync(100_001);

    expect(scheduler.schedule).toHaveBeenCalledTimes(1);
    expect(readContent).not.toHaveBeenCalled();
    expect(controller.hasPendingSync()).toBe(true);

    scheduler.callbacks[0]?.();

    expect(readContent).toHaveBeenCalledTimes(1);
    expect(applyContent).toHaveBeenCalledTimes(1);
    expect(applyContent).toHaveBeenCalledWith("latest", "editor");
    expect(controller.hasPendingSync()).toBe(false);
  });

  it("flushes pending large document content with an explicit reason", () => {
    const scheduler = createManualScheduler();
    const readContent = mock(() => "saved content");
    const applyContent = mock(() => undefined);
    const controller = createDeferredEditorContentSync({
      readContent,
      applyContent,
      immediateContentLengthLimit: 4,
      schedule: scheduler.schedule,
    });

    controller.requestSync(100_000);
    controller.flush("save");
    scheduler.callbacks[0]?.();

    expect(readContent).toHaveBeenCalledTimes(1);
    expect(applyContent).toHaveBeenCalledTimes(1);
    expect(applyContent).toHaveBeenCalledWith("saved content", "save");
  });

  it("cancels pending syncs without reading the large document", () => {
    const scheduler = createManualScheduler();
    const readContent = mock(() => "unused");
    const applyContent = mock(() => undefined);
    const controller = createDeferredEditorContentSync({
      readContent,
      applyContent,
      immediateContentLengthLimit: 4,
      schedule: scheduler.schedule,
    });

    controller.requestSync(100_000);
    controller.cancel();
    scheduler.callbacks[0]?.();

    expect(readContent).not.toHaveBeenCalled();
    expect(applyContent).not.toHaveBeenCalled();
    expect(controller.hasPendingSync()).toBe(false);
  });
});
