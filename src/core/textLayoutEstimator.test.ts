import { describe, expect, test } from "bun:test";
import { createDefaultTextLayoutEstimator } from "./textLayoutEstimator";

describe("text layout estimator", () => {
  test("increases line count and height when available width narrows", () => {
    const estimator = createDefaultTextLayoutEstimator({ cacheSize: 0 });
    const text = "A long editor cell should wrap naturally during continuous resize.";

    const wide = estimator.estimate({
      text,
      maxWidth: 420,
      lineHeight: 18,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    });
    const narrow = estimator.estimate({
      text,
      maxWidth: 96,
      lineHeight: 18,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    });

    expect(wide.lineCount).toBeLessThan(narrow.lineCount);
    expect(wide.height).toBeLessThan(narrow.height);
  });

  test("preserves physical lines in pre-wrap mode", () => {
    const estimator = createDefaultTextLayoutEstimator({ cacheSize: 0 });
    const estimate = estimator.estimate({
      text: "title\nsubtitle\nbody",
      maxWidth: 600,
      lineHeight: 20,
      whiteSpace: "pre-wrap",
    });

    expect(estimate.lineCount).toBe(3);
    expect(estimate.height).toBe(60);
  });

  test("keeps pre text unwrapped for source-like content", () => {
    const estimator = createDefaultTextLayoutEstimator({ cacheSize: 0 });
    const estimate = estimator.estimate({
      text: "const veryLongIdentifierName = renderMarkdownTableWithoutReflowingTheSource",
      maxWidth: 80,
      lineHeight: 20,
      whiteSpace: "pre",
      wordBreak: "break-word",
    });

    expect(estimate.lineCount).toBe(1);
    expect(estimate.maxLineWidth).toBeGreaterThan(estimate.contentWidth);
  });

  test("returns cached estimates until cache is cleared", () => {
    const estimator = createDefaultTextLayoutEstimator();
    const request = {
      text: "cached markdown layout",
      maxWidth: 160,
      whiteSpace: "pre-wrap" as const,
    };

    const first = estimator.estimate(request);
    const second = estimator.estimate(request);
    estimator.clearCache?.();
    const third = estimator.estimate(request);

    expect(second).toBe(first);
    expect(third).toEqual(first);
    expect(third).not.toBe(first);
  });
});
