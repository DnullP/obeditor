import { describe, expect, it, mock } from "bun:test";
import {
  createEditorCapabilityRegistry,
  suggestEditorWikiLinkTargets,
  translateEditorText,
} from "./capabilities";

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
});
