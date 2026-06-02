/**
 * @module styles/editorStylesBuildContract.test
 * @description Build contract for exported obeditor styles.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

describe("obeditor exported styles build contract", () => {
  test("does not inline font assets into the published CSS bundle", () => {
    const packageJson = readFileSync(
      join(import.meta.dir, "../../package.json"),
      "utf8",
    );
    const externalizeScript = readFileSync(
      join(import.meta.dir, "../../scripts/externalize-katex-css.mjs"),
      "utf8",
    );

    expect(packageJson).toContain("scripts/externalize-katex-css.mjs");
    expect(externalizeScript).toContain("katex/dist/katex.min.css");
    expect(externalizeScript).toContain("data:font\\/");
  });
});
