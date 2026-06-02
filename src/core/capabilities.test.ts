import { describe, expect, it, mock } from "bun:test";
import {
  createEditorCapabilityRegistry,
  suggestEditorWikiLinkTargets,
  translateEditorText,
} from "./capabilities";
import { createDefaultEditorCapabilities } from "./defaultCapabilities";

describe("editor capabilities", () => {
  it("updates capability snapshots and notifies subscribers", () => {
    const listener = mock(() => undefined);
    const registry = createEditorCapabilityRegistry();
    const unsubscribe = registry.subscribe(listener);

    const snapshot = registry.update({
      localization: {
        t: (_key, _options, fallback) => fallback ?? "translated",
      },
    });

    expect(snapshot).toBe(registry.getSnapshot());
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    registry.update({});
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("falls back when optional host capabilities are absent", async () => {
    expect(translateEditorText(undefined, "missing", "Missing")).toBe("Missing");
    await expect(suggestEditorWikiLinkTargets(undefined, "note", 10)).resolves.toEqual([]);
  });

  it("provides default in-memory wikilink capabilities for demo and mock hosts", async () => {
    const opened: string[] = [];
    const capabilities = createDefaultEditorCapabilities({
      documents: [
        {
          path: "Guides/Plugin System.md",
          title: "Plugin System",
          content: "# Plugin System\n\nGeneric editor notes.",
          referenceCount: 4,
        },
        {
          path: "Guides/Capability System.md",
          title: "Capability System",
          content: "# Capability System",
          referenceCount: 2,
        },
      ],
      translations: {
        greeting: "Hello {{name}}",
      },
      onOpenWikiLink: (target) => {
        opened.push(target.relativePath);
      },
    });

    await expect(capabilities.wikiLinks?.suggestTargets?.("plug", 5)).resolves.toEqual([
      {
        title: "Plugin System",
        relativePath: "Guides/Plugin System.md",
        referenceCount: 4,
      },
    ]);
    expect(await capabilities.wikiLinks?.resolveTarget?.("Capability System", {})).toEqual({
      relativePath: "Guides/Capability System.md",
      title: "Capability System",
      content: "# Capability System",
    });

    await capabilities.wikiLinks?.openTarget?.("Plugin System", {});
    expect(opened).toEqual(["Guides/Plugin System.md"]);
    expect(capabilities.localization?.t("greeting", { name: "Demo" })).toBe("Hello Demo");
  });

  it("stores default in-memory assets and generated paste markdown", async () => {
    const capabilities = createDefaultEditorCapabilities();
    const file = new File(["hello"], "demo.png", { type: "image/png" });
    const result = await capabilities.mediaEmbeds?.createAsset?.(file, {
      suggestedRelativePath: "Images/demo.png",
      base64Content: "aGVsbG8=",
    });

    expect(result).toEqual({
      relativePath: "Images/demo.png",
      markdown: "![[Images/demo.png]]",
    });
    await expect(capabilities.mediaEmbeds?.readBinary?.("Images/demo.png", {})).resolves.toMatchObject({
      relativePath: "Images/demo.png",
      mimeType: "image/png",
      base64Content: "aGVsbG8=",
    });
  });
});
