/**
 * @module plugins/markdown-codemirror/editor/markdownTableRowHeightEstimate
 * @description Markdown 表格大数据渲染的稳定行高估算。
 */

import {
    defaultTextLayoutEstimator,
    type EditorTextLayoutEstimator,
} from "../core/textLayoutEstimator";
import type { MarkdownTableModel } from "./markdownTableModel";

export const MARKDOWN_TABLE_MIN_ROW_HEIGHT = 38;
export const MARKDOWN_TABLE_HEADER_HEIGHT = 38;
export const MARKDOWN_TABLE_VERTICAL_CHROME_HEIGHT = 74;

const DEFAULT_TABLE_COLUMN_WIDTH = 164;
const CELL_HORIZONTAL_PADDING = 20;
const ESTIMATED_LINE_HEIGHT = 18;
const CELL_VERTICAL_PADDING = 16;
const MAX_ESTIMATED_ROW_HEIGHT = 160;
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

function estimateCellHeight(
    value: string,
    columnWidth: number,
    textLayoutEstimator: EditorTextLayoutEstimator,
): number {
    return textLayoutEstimator.estimate({
        text: readCachedCellLayoutText(value),
        maxWidth: Math.max(48, columnWidth),
        fontSize: 12,
        lineHeight: ESTIMATED_LINE_HEIGHT,
        averageCharacterWidth: 7,
        horizontalPadding: CELL_HORIZONTAL_PADDING,
        verticalPadding: CELL_VERTICAL_PADDING,
        minHeight: MARKDOWN_TABLE_MIN_ROW_HEIGHT,
        maxHeight: MAX_ESTIMATED_ROW_HEIGHT,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
    }).height;
}

export function estimateMarkdownTableRowHeight(
    cells: readonly string[],
    columnWidths: readonly number[] | null | undefined,
    textLayoutEstimator: EditorTextLayoutEstimator = defaultTextLayoutEstimator,
): number {
    return cells.reduce((rowHeight, cell, columnIndex) => {
        const columnWidth = columnWidths?.[columnIndex] ?? DEFAULT_TABLE_COLUMN_WIDTH;
        return Math.max(rowHeight, estimateCellHeight(cell, columnWidth, textLayoutEstimator));
    }, MARKDOWN_TABLE_MIN_ROW_HEIGHT);
}

export function estimateMarkdownTableBodyRowHeights(
    model: Pick<MarkdownTableModel, "rows">,
    columnWidths: readonly number[] | null | undefined,
    persistedRowHeights: readonly number[] | null | undefined,
    textLayoutEstimator: EditorTextLayoutEstimator = defaultTextLayoutEstimator,
): number[] {
    return model.rows.map((row, rowIndex) => {
        const naturalHeight = estimateMarkdownTableRowHeight(row, columnWidths, textLayoutEstimator);
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
    textLayoutEstimator: EditorTextLayoutEstimator = defaultTextLayoutEstimator,
): number {
    const bodyRowsHeight = estimateMarkdownTableBodyRowHeights(
        model,
        columnWidths,
        persistedRowHeights,
        textLayoutEstimator,
    )
        .reduce((totalHeight, rowHeight) => totalHeight + rowHeight, 0);

    return MARKDOWN_TABLE_VERTICAL_CHROME_HEIGHT
        + MARKDOWN_TABLE_HEADER_HEIGHT
        + bodyRowsHeight;
}
