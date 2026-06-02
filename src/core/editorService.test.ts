import { describe, expect, it, mock } from "bun:test";
import { createEditorService } from "./editorService";
import type { EditorPlugin } from "./types";

describe("createEditorService", () => {
  it("tracks dirty state after content changes and clears it after save", async () => {
    const saved: string[] = [];
    const service = createEditorService({
      document: {
        id: "demo",
        content: "# Demo",
      },
      adapter: {
        saveDocument: async (document) => {
          saved.push(document.content);
        },
        now: () => 100,
      },
    });

    service.updateContent("# Demo\n\nUpdated");

    expect(service.getSnapshot().dirty).toBe(true);
    await service.save();
    expect(saved).toEqual(["# Demo\n\nUpdated"]);
    expect(service.getSnapshot().dirty).toBe(false);
  });

  it("returns a stable snapshot identity until state changes", () => {
    const service = createEditorService({
      document: {
        id: "demo",
        content: "# Demo",
      },
    });

    const firstSnapshot = service.getSnapshot();
    expect(service.getSnapshot()).toBe(firstSnapshot);

    service.updateContent("# Updated");

    expect(service.getSnapshot()).not.toBe(firstSnapshot);
  });

  it("keeps edits made during an in-flight save dirty", async () => {
    let completeSave!: () => void;
    const service = createEditorService({
      document: {
        id: "demo",
        content: "# Demo",
      },
      adapter: {
        saveDocument: () => new Promise<void>((resolve) => {
          completeSave = resolve;
        }),
        now: () => 100,
      },
    });

    service.updateContent("# Save this", "first edit");
    const savePromise = service.save();
    service.updateContent("# Save this\n\nBut keep this dirty", "second edit");

    completeSave();
    await savePromise;

    expect(service.getSnapshot().document.content).toBe("# Save this\n\nBut keep this dirty");
    expect(service.getSnapshot().dirty).toBe(true);
  });

  it("loads documents through the host adapter", async () => {
    const service = createEditorService({
      adapter: {
        loadDocument: async (ref) => ({
          id: ref.id,
          path: ref.path,
          title: "Loaded",
          content: "loaded content",
        }),
      },
    });

    await service.loadDocument({ id: "a", path: "notes/a.md" });

    expect(service.getSnapshot().document.content).toBe("loaded content");
    expect(service.getSnapshot().document.path).toBe("notes/a.md");
    expect(service.getSnapshot().dirty).toBe(false);
  });

  it("publishes authoritative document replacements without making the editor dirty", () => {
    const changed = mock(() => undefined);
    const service = createEditorService({
      document: { id: "demo", path: "notes/demo.md", content: "# Old" },
      adapter: {
        onDocumentChanged: changed,
      },
    });

    service.setDocument({
      id: "demo",
      path: "notes/demo.md",
      content: "# New",
    });

    expect(service.getSnapshot().document.content).toBe("# New");
    expect(service.getSnapshot().dirty).toBe(false);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("can attach a view without reporting focus during host-controlled mounting", () => {
    const focused = mock(() => undefined);
    const service = createEditorService({
      document: { id: "demo", content: "# Demo" },
      adapter: {
        onDocumentFocused: focused,
      },
    });
    const view = {} as never;

    service.attachView(view, { notifyFocus: false });
    expect(focused).not.toHaveBeenCalled();

    service.attachView(view);
    expect(focused).toHaveBeenCalledTimes(1);
  });

  it("installs plugin commands through the generic plugin contract", async () => {
    const plugin: EditorPlugin = {
      id: "test-plugin",
      setup() {
        return {
          commands: [
            {
              id: "test.append",
              label: "Append",
              run: ({ document, updateContent }) => updateContent(`${document.content}!`, "test"),
            },
          ],
        };
      },
    };
    const service = createEditorService({
      document: { id: "demo", content: "hello" },
      plugins: [plugin],
    });

    await service.executeCommand("test.append");

    expect(service.getSnapshot().document.content).toBe("hello!");
    expect(service.getSnapshot().pluginIds).toEqual(["test-plugin"]);
  });

  it("passes host capabilities into plugin setup and command execution", async () => {
    const plugin: EditorPlugin = {
      id: "capability-reader",
      setup(context) {
        const setupText = context.capabilities.localization?.t("setup", undefined, "missing") ?? "missing";
        return {
          commands: [
            {
              id: "test.readCapability",
              label: "Read capability",
              run: ({ capabilities, updateContent }) => {
                updateContent(capabilities.localization?.t("run", undefined, setupText) ?? setupText);
              },
            },
          ],
        };
      },
    };
    const service = createEditorService({
      document: { id: "demo", content: "" },
      adapter: {
        capabilities: {
          localization: {
            t: (key) => `translated:${key}`,
          },
        },
      },
      plugins: [plugin],
    });

    expect(service.getCapabilities().localization).toBeDefined();
    await service.executeCommand("test.readCapability");

    expect(service.getSnapshot().document.content).toBe("translated:run");
  });
});
