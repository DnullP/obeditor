/**
 * @module markdown/markdownTableCanvasRenderer
 * @description Markdown table Canvas rendering policy and geometry helpers.
 */

export const MARKDOWN_TABLE_CANVAS_ROW_THRESHOLD = 320;
export const MARKDOWN_TABLE_CANVAS_CELL_THRESHOLD = 2_000;

export interface MarkdownTableCanvasCellGeometry {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface MarkdownTableCanvasCellCommand extends MarkdownTableCanvasCellGeometry {
    rowIndex: number;
    columnIndex: number;
    text: string;
}

export interface ResolveMarkdownTableCanvasCommandsOptions {
    rows: readonly (readonly string[])[];
    columnWidths: readonly number[];
    rowHeights: readonly number[];
    startIndex: number;
    endIndex: number;
}

export function shouldRenderMarkdownTableBodyWithCanvas(
    rowCount: number,
    columnCount: number,
): boolean {
    return rowCount >= MARKDOWN_TABLE_CANVAS_ROW_THRESHOLD
        || rowCount * columnCount >= MARKDOWN_TABLE_CANVAS_CELL_THRESHOLD;
}

export function buildMarkdownTableCanvasOffsets(sizes: readonly number[]): number[] {
    const offsets: number[] = [];
    let offset = 0;
    sizes.forEach((size) => {
        offsets.push(offset);
        offset += Math.max(0, Number.isFinite(size) ? size : 0);
    });
    return offsets;
}

export function sumMarkdownTableCanvasSizes(sizes: readonly number[]): number {
    return sizes.reduce((total, size) => total + Math.max(0, Number.isFinite(size) ? size : 0), 0);
}

export function resolveMarkdownTableCanvasIndexAtOffset(
    sizes: readonly number[],
    offset: number,
): number {
    if (sizes.length === 0) {
        return -1;
    }

    const safeOffset = Math.max(0, offset);
    let cursor = 0;
    for (let index = 0; index < sizes.length; index += 1) {
        cursor += Math.max(0, Number.isFinite(sizes[index] ?? 0) ? sizes[index]! : 0);
        if (safeOffset < cursor) {
            return index;
        }
    }

    return sizes.length - 1;
}

export function resolveMarkdownTableCanvasCellGeometry(
    rowOffsets: readonly number[],
    columnOffsets: readonly number[],
    rowHeights: readonly number[],
    columnWidths: readonly number[],
    rowIndex: number,
    columnIndex: number,
): MarkdownTableCanvasCellGeometry | null {
    const left = columnOffsets[columnIndex];
    const top = rowOffsets[rowIndex];
    const width = columnWidths[columnIndex];
    const height = rowHeights[rowIndex];
    if (
        left === undefined
        || top === undefined
        || width === undefined
        || height === undefined
    ) {
        return null;
    }

    return {
        left,
        top,
        width,
        height,
    };
}

export function resolveMarkdownTableCanvasCommands(
    options: ResolveMarkdownTableCanvasCommandsOptions,
): MarkdownTableCanvasCellCommand[] {
    const rowOffsets = buildMarkdownTableCanvasOffsets(options.rowHeights);
    const columnOffsets = buildMarkdownTableCanvasOffsets(options.columnWidths);
    const startIndex = Math.max(0, Math.min(options.startIndex, options.rows.length));
    const endIndex = Math.max(startIndex, Math.min(options.endIndex, options.rows.length));
    const commands: MarkdownTableCanvasCellCommand[] = [];

    for (let rowIndex = startIndex; rowIndex < endIndex; rowIndex += 1) {
        const row = options.rows[rowIndex] ?? [];
        const rowTop = rowOffsets[rowIndex] ?? 0;
        for (let columnIndex = 0; columnIndex < options.columnWidths.length; columnIndex += 1) {
            commands.push({
                rowIndex,
                columnIndex,
                left: columnOffsets[columnIndex] ?? 0,
                top: rowTop,
                width: options.columnWidths[columnIndex] ?? 0,
                height: options.rowHeights[rowIndex] ?? 0,
                text: row[columnIndex] ?? "",
            });
        }
    }

    return commands;
}
