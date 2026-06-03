/**
 * @module markdown/markdownTableCanvasRenderer.test
 * @description Markdown table Canvas body rendering geometry tests.
 */

import { describe, expect, test } from "bun:test";
import {
    buildMarkdownTableCanvasOffsets,
    resolveMarkdownTableCanvasCellGeometry,
    resolveMarkdownTableCanvasCommands,
    resolveMarkdownTableCanvasIndexAtOffset,
    shouldRenderMarkdownTableBodyWithCanvas,
    sumMarkdownTableCanvasSizes,
} from "./markdownTableCanvasRenderer";

describe("markdown table canvas renderer", () => {
    test("uses Canvas only for large row or cell counts", () => {
        expect(shouldRenderMarkdownTableBodyWithCanvas(319, 6)).toBe(false);
        expect(shouldRenderMarkdownTableBodyWithCanvas(320, 6)).toBe(true);
        expect(shouldRenderMarkdownTableBodyWithCanvas(100, 19)).toBe(false);
        expect(shouldRenderMarkdownTableBodyWithCanvas(100, 20)).toBe(true);
    });

    test("builds stable offsets and hit-tests zero-height gaps", () => {
        const sizes = [20, 30, 0, 10];

        expect(buildMarkdownTableCanvasOffsets(sizes)).toEqual([0, 20, 50, 50]);
        expect(sumMarkdownTableCanvasSizes(sizes)).toBe(60);
        expect(resolveMarkdownTableCanvasIndexAtOffset(sizes, -4)).toBe(0);
        expect(resolveMarkdownTableCanvasIndexAtOffset(sizes, 19.9)).toBe(0);
        expect(resolveMarkdownTableCanvasIndexAtOffset(sizes, 20)).toBe(1);
        expect(resolveMarkdownTableCanvasIndexAtOffset(sizes, 50)).toBe(3);
        expect(resolveMarkdownTableCanvasIndexAtOffset(sizes, 80)).toBe(3);
    });

    test("resolves cell geometry from precomputed row and column offsets", () => {
        const rowHeights = [40, 50];
        const columnWidths = [100, 140];
        const rowOffsets = buildMarkdownTableCanvasOffsets(rowHeights);
        const columnOffsets = buildMarkdownTableCanvasOffsets(columnWidths);

        expect(resolveMarkdownTableCanvasCellGeometry(
            rowOffsets,
            columnOffsets,
            rowHeights,
            columnWidths,
            1,
            1,
        )).toEqual({
            left: 100,
            top: 40,
            width: 140,
            height: 50,
        });
        expect(resolveMarkdownTableCanvasCellGeometry(
            rowOffsets,
            columnOffsets,
            rowHeights,
            columnWidths,
            2,
            1,
        )).toBeNull();
    });

    test("creates draw commands only for the visible body row range", () => {
        const commands = resolveMarkdownTableCanvasCommands({
            rows: [
                ["r0c0", "r0c1"],
                ["r1c0", "r1c1"],
                ["r2c0", "r2c1"],
            ],
            columnWidths: [100, 140],
            rowHeights: [40, 50, 60],
            startIndex: 1,
            endIndex: 3,
        });

        expect(commands).toHaveLength(4);
        expect(commands[0]).toEqual({
            rowIndex: 1,
            columnIndex: 0,
            left: 0,
            top: 40,
            width: 100,
            height: 50,
            text: "r1c0",
        });
        expect(commands[3]).toEqual({
            rowIndex: 2,
            columnIndex: 1,
            left: 100,
            top: 90,
            width: 140,
            height: 60,
            text: "r2c1",
        });
    });
});
