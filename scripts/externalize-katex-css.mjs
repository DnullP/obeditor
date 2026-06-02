/**
 * @file scripts/externalize-katex-css.mjs
 * @description Keep the published CSS bundle from inlining KaTeX font assets.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const cssPath = resolve(import.meta.dirname, "../dist/obeditor.css");
const katexImport = '@import "katex/dist/katex.min.css";';

const originalCss = readFileSync(cssPath, "utf8");
const withoutKatexFontFaces = originalCss.replace(
  /@font-face\{font-display:block;font-family:KaTeX_[^}]+src:url\(data:font\/[^}]+\}/gu,
  "",
);
const normalizedCss = withoutKatexFontFaces
  .replace(/^@import\s+["']katex\/dist\/katex\.min\.css["'];\s*/u, "")
  .trimStart();

writeFileSync(cssPath, `${katexImport}\n${normalizedCss}`);
