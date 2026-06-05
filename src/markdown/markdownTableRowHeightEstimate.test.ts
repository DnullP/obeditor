/**
 * @module markdown/markdownTableRowHeightEstimate.test
 * @description Markdown table natural row height estimation tests.
 */

import { describe, expect, test } from "bun:test";
import {
    estimateMarkdownTableBodyRowHeights,
    estimateMarkdownTableRowHeight,
    normalizeMarkdownTableCellLayoutText,
} from "./markdownTableRowHeightEstimate";

describe("markdown table row height estimate", () => {
    test("reflows row height when a column becomes narrower", () => {
        const cells = [
            "A long markdown table cell should wrap naturally instead of being squeezed into a fixed row height.",
            "owner",
        ];

        const wideHeight = estimateMarkdownTableRowHeight(cells, [420, 164]);
        const narrowHeight = estimateMarkdownTableRowHeight(cells, [96, 164]);

        expect(wideHeight).toBeLessThan(narrowHeight);
        expect(narrowHeight).toBeGreaterThanOrEqual(88);
    });

    test("normalizes markdown, wikilinks, code, and latex into lightweight layout text", () => {
        const layoutText = normalizeMarkdownTableCellLayoutText([
            "**Strong** [[Target Note|Alias]]",
            "`code sample` $\\frac{a}{b}$",
            "> quoted line",
        ].join("\n"));

        expect(layoutText).toContain("Strong Alias");
        expect(layoutText).toContain("code sample formula");
        expect(layoutText).toContain("quoted line");
        expect(layoutText).not.toContain("[[");
        expect(layoutText).not.toContain("**");
    });

    test("keeps persisted row heights from clipping natural markdown content", () => {
        const rows = [[
            "Long **markdown** content with $x^2 + y^2 = z^2$ should keep a natural row height after column resize.",
            "status",
        ]];

        const [height] = estimateMarkdownTableBodyRowHeights(
            { rows },
            [90, 164],
            [38],
        );

        expect(height).toBeGreaterThan(38);
        expect(height).toBe(estimateMarkdownTableRowHeight(rows[0] ?? [], [90, 164]));
    });
});
