/**
 * @module plugins/markdown-codemirror/editor/markdownTableRowHeightEstimate
 * @description Markdown 表格大数据渲染的稳定行高估算。
 */

import type { MarkdownTableModel } from "./markdownTableModel";

export const MARKDOWN_TABLE_MIN_ROW_HEIGHT = 38;
export const MARKDOWN_TABLE_HEADER_HEIGHT = 38;
export const MARKDOWN_TABLE_VERTICAL_CHROME_HEIGHT = 74;

const DEFAULT_TABLE_COLUMN_WIDTH = 164;
const CELL_HORIZONTAL_PADDING = 20;
const ESTIMATED_CHARACTER_WIDTH = 7;
const ESTIMATED_LINE_HEIGHT = 18;
const CELL_VERTICAL_PADDING = 16;
const MAX_ESTIMATED_ROW_HEIGHT = 160;
const CJK_CHARACTER_WIDTH_FACTOR = 1.72;
const WIDE_CHARACTER_PATTERN = /[\u1100-\u11ff\u2e80-\u9fff\uf900-\ufaff\uff01-\uff60\uffe0-\uffe6]/u;
const MAX_CELL_LAYOUT_TEXT_CACHE_SIZE = 5_000;
const cellLayoutTextCache = new Map<string, string>();

function readCachedCellLayoutText(value: string): string {
    const cachedText = cellLayoutTextCache.get(value);
    if (cachedText !== undefined) {
        return cachedText;
    }

    const nextText = normalizeMarkdownTableCellLayoutText(value);
    if (cellLayoutTextCache.size >= MAX_CELL_LAYOUT_TEXT_CACHE_SIZE) {
        cellLayoutTextCache.clear();
    }
    cellLayoutTextCache.set(value, nextText);
    return nextText;
}

function normalizeWikiLinkText(value: string): string {
    return value.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target: string, alias: string | undefined) =>
        alias?.trim() || target.trim());
}

function normalizeMarkdownLinkText(value: string): string {
    return value
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, (_match, altText: string) => altText.trim() || "image")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, (_match, label: string) => label.trim());
}

function normalizeLatexText(value: string): string {
    return value
        .replace(/\$\$([\s\S]*?)\$\$/g, (_match, source: string) => {
            const compactSource = source.replace(/\s+/g, " ").trim();
            const estimatedFormulaWidth = Math.max(16, Math.ceil(compactSource.length * 0.55));
            const lineCount = Math.max(1, source.trim().split(/\r?\n/).length);
            return Array.from({ length: lineCount }, () => `formula ${"x".repeat(estimatedFormulaWidth)}`).join("\n");
        })
        .replace(/\$([^$\n]+)\$/g, (_match, source: string) => {
            const compactSource = source.replace(/\s+/g, " ").trim();
            return `formula ${"x".repeat(Math.max(8, Math.ceil(compactSource.length * 0.45)))}`;
        });
}

export function normalizeMarkdownTableCellLayoutText(value: string): string {
    return normalizeMarkdownLinkText(normalizeWikiLinkText(normalizeLatexText(value)))
        .replace(/`{3,}([\s\S]*?)`{3,}/g, (_match, source: string) => source.trim() || "code block")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^>\s?/gm, "")
        .replace(/^\s*[-*+]\s+/gm, "")
        .replace(/^\s*\d+[.)]\s+/gm, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/__([^_]+)__/g, "$1")
        .replace(/_([^_]+)_/g, "$1")
        .replace(/~~([^~]+)~~/g, "$1")
        .replace(/==([^=]+)==/g, "$1")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/\\\|/g, "|");
}

function estimateLayoutTextWidthUnits(value: string): number {
    return Array.from(value).reduce((total, character) => {
        if (character === "\t") {
            return total + 4;
        }
        if (character === " ") {
            return total + 0.45;
        }
        if (WIDE_CHARACTER_PATTERN.test(character)) {
            return total + CJK_CHARACTER_WIDTH_FACTOR;
        }
        return total + 1;
    }, 0);
}

function estimateLineCountForCell(value: string, columnWidth: number): number {
    const usableWidth = Math.max(48, columnWidth - CELL_HORIZONTAL_PADDING);
    const charactersPerLine = Math.max(8, Math.floor(usableWidth / ESTIMATED_CHARACTER_WIDTH));
    return readCachedCellLayoutText(value)
        .split(/\r?\n/)
        .reduce((lineCount, line) => {
            const lineWidthUnits = estimateLayoutTextWidthUnits(line);
            return lineCount + Math.max(1, Math.ceil(lineWidthUnits / charactersPerLine));
        }, 0);
}

export function estimateMarkdownTableRowHeight(
    cells: readonly string[],
    columnWidths: readonly number[] | null | undefined,
): number {
    const lineCount = cells.reduce((maxLineCount, cell, columnIndex) => {
        const columnWidth = columnWidths?.[columnIndex] ?? DEFAULT_TABLE_COLUMN_WIDTH;
        return Math.max(maxLineCount, estimateLineCountForCell(cell, columnWidth));
    }, 1);

    return Math.min(
        MAX_ESTIMATED_ROW_HEIGHT,
        Math.max(MARKDOWN_TABLE_MIN_ROW_HEIGHT, CELL_VERTICAL_PADDING + lineCount * ESTIMATED_LINE_HEIGHT),
    );
}

export function estimateMarkdownTableBodyRowHeights(
    model: Pick<MarkdownTableModel, "rows">,
    columnWidths: readonly number[] | null | undefined,
    persistedRowHeights: readonly number[] | null | undefined,
): number[] {
    return model.rows.map((row, rowIndex) => {
        const naturalHeight = estimateMarkdownTableRowHeight(row, columnWidths);
        const persistedHeight = Number(persistedRowHeights?.[rowIndex]);
        if (Number.isFinite(persistedHeight) && persistedHeight > 0) {
            return Math.max(naturalHeight, Math.round(persistedHeight));
        }

        return naturalHeight;
    });
}

export function estimateMarkdownTableWidgetHeight(
    model: Pick<MarkdownTableModel, "rows">,
    columnWidths: readonly number[] | null | undefined,
    persistedRowHeights: readonly number[] | null | undefined,
): number {
    const bodyRowsHeight = estimateMarkdownTableBodyRowHeights(model, columnWidths, persistedRowHeights)
        .reduce((totalHeight, rowHeight) => totalHeight + rowHeight, 0);

    return MARKDOWN_TABLE_VERTICAL_CHROME_HEIGHT
        + MARKDOWN_TABLE_HEADER_HEIGHT
        + bodyRowsHeight;
}
