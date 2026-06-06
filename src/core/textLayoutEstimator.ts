export type EditorTextWhiteSpace = "normal" | "pre" | "pre-wrap";
export type EditorTextWordBreak = "normal" | "break-word" | "break-all";

export interface EditorTextLayoutEstimateRequest {
  text: string;
  maxWidth: number;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  averageCharacterWidth?: number;
  tabSize?: number;
  whiteSpace?: EditorTextWhiteSpace;
  wordBreak?: EditorTextWordBreak;
  horizontalPadding?: number;
  verticalPadding?: number;
  minHeight?: number;
  maxHeight?: number;
}

export interface EditorTextLayoutEstimate {
  height: number;
  lineCount: number;
  maxLineWidth: number;
  contentWidth: number;
}

export interface EditorTextLayoutEstimator {
  estimate: (request: EditorTextLayoutEstimateRequest) => EditorTextLayoutEstimate;
  clearCache?: () => void;
}

export interface DefaultTextLayoutEstimatorOptions {
  cacheSize?: number;
  defaultFontSize?: number;
  defaultLineHeight?: number;
  defaultAverageCharacterWidth?: number;
}

interface ResolvedTextLayoutRequest {
  text: string;
  contentWidth: number;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  averageCharacterWidth: number;
  tabSize: number;
  whiteSpace: EditorTextWhiteSpace;
  wordBreak: EditorTextWordBreak;
  verticalPadding: number;
  minHeight: number;
  maxHeight: number;
}

interface TextMeasurementMetrics {
  fontSize: number;
  averageCharacterWidth: number;
  letterSpacing: number;
  tabSize: number;
}

interface WrappedLineStats {
  lineCount: number;
  maxLineWidth: number;
}

const DEFAULT_FONT_SIZE = 14;
const DEFAULT_LINE_HEIGHT_FACTOR = 1.45;
const DEFAULT_AVERAGE_CHARACTER_WIDTH_FACTOR = 0.56;
const DEFAULT_CACHE_SIZE = 2_000;
const WIDE_CHARACTER_PATTERN = /[\u1100-\u11ff\u2e80-\u9fff\uf900-\ufaff\uff01-\uff60\uffe0-\uffe6]/u;
const COMBINING_MARK_PATTERN = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/u;
const ZERO_WIDTH_PATTERN = /[\u200b-\u200f\ufeff]/u;

function resolvePositiveNumber(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function resolveOptionalNumber(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function clampHeight(height: number, minHeight: number, maxHeight: number): number {
  return Math.min(maxHeight, Math.max(minHeight, height));
}

function normalizeWhiteSpace(text: string, whiteSpace: EditorTextWhiteSpace): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  if (whiteSpace !== "normal") {
    return normalized;
  }

  return normalized.replace(/[ \t\n\f\v]+/g, " ").trim();
}

function measureCharacterWidth(character: string, metrics: TextMeasurementMetrics, index: number): number {
  if (COMBINING_MARK_PATTERN.test(character) || ZERO_WIDTH_PATTERN.test(character)) {
    return 0;
  }

  const spacing = index > 0 ? metrics.letterSpacing : 0;
  if (character === "\t") {
    return metrics.averageCharacterWidth * metrics.tabSize + spacing;
  }
  if (character === " ") {
    return metrics.averageCharacterWidth * 0.45 + spacing;
  }
  if (WIDE_CHARACTER_PATTERN.test(character)) {
    return metrics.fontSize + spacing;
  }
  if (/[\.,;:'"`!|ijlI\[\](){}]/u.test(character)) {
    return metrics.averageCharacterWidth * 0.62 + spacing;
  }
  if (/[A-Z0-9]/u.test(character)) {
    return metrics.averageCharacterWidth * 1.08 + spacing;
  }

  return metrics.averageCharacterWidth + spacing;
}

function measureTextWidth(text: string, metrics: TextMeasurementMetrics): number {
  return Array.from(text).reduce(
    (width, character, index) => width + measureCharacterWidth(character, metrics, index),
    0,
  );
}

function appendCharactersWithWrapping(
  text: string,
  contentWidth: number,
  metrics: TextMeasurementMetrics,
  currentLineWidth: number,
): WrappedLineStats & { currentLineWidth: number } {
  let lineCount = 1;
  let maxLineWidth = 0;
  let nextLineWidth = currentLineWidth;

  Array.from(text).forEach((character) => {
    const characterWidth = measureCharacterWidth(character, metrics, nextLineWidth > 0 ? 1 : 0);
    if (nextLineWidth > 0 && nextLineWidth + characterWidth > contentWidth) {
      maxLineWidth = Math.max(maxLineWidth, nextLineWidth);
      lineCount += 1;
      nextLineWidth = 0;
    }
    nextLineWidth += characterWidth;
  });

  maxLineWidth = Math.max(maxLineWidth, nextLineWidth);
  return {
    lineCount,
    maxLineWidth,
    currentLineWidth: nextLineWidth,
  };
}

function tokenizeWrappableLine(line: string, whiteSpace: EditorTextWhiteSpace): string[] {
  if (whiteSpace === "normal") {
    const normalized = line.replace(/[ \t]+/g, " ").trim();
    return normalized.length > 0 ? normalized.split(/(?<= )/u) : [];
  }

  return line.match(/\S+\s*|\s+/gu) ?? [];
}

function measureWrappedLine(
  line: string,
  request: Pick<ResolvedTextLayoutRequest, "contentWidth" | "whiteSpace" | "wordBreak">,
  metrics: TextMeasurementMetrics,
): WrappedLineStats {
  if (line.length === 0) {
    return {
      lineCount: 1,
      maxLineWidth: 0,
    };
  }

  if (request.wordBreak === "break-all") {
    const wrapped = appendCharactersWithWrapping(line, request.contentWidth, metrics, 0);
    return {
      lineCount: wrapped.lineCount,
      maxLineWidth: wrapped.maxLineWidth,
    };
  }

  let lineCount = 1;
  let currentLineWidth = 0;
  let maxLineWidth = 0;

  tokenizeWrappableLine(line, request.whiteSpace).forEach((token) => {
    const isWhitespaceToken = token.trim().length === 0;
    if (currentLineWidth === 0 && isWhitespaceToken && request.whiteSpace === "normal") {
      return;
    }

    const tokenWidth = measureTextWidth(token, metrics);
    if (request.wordBreak === "break-word" && tokenWidth > request.contentWidth) {
      if (currentLineWidth > 0) {
        maxLineWidth = Math.max(maxLineWidth, currentLineWidth);
        lineCount += 1;
        currentLineWidth = 0;
      }
      const wrapped = appendCharactersWithWrapping(token, request.contentWidth, metrics, 0);
      lineCount += wrapped.lineCount - 1;
      currentLineWidth = wrapped.currentLineWidth;
      maxLineWidth = Math.max(maxLineWidth, wrapped.maxLineWidth);
      return;
    }

    if (currentLineWidth > 0 && currentLineWidth + tokenWidth > request.contentWidth) {
      maxLineWidth = Math.max(maxLineWidth, currentLineWidth);
      lineCount += 1;
      currentLineWidth = request.whiteSpace === "normal" && isWhitespaceToken ? 0 : tokenWidth;
      return;
    }

    currentLineWidth += tokenWidth;
  });

  return {
    lineCount,
    maxLineWidth: Math.max(maxLineWidth, currentLineWidth),
  };
}

function resolveRequest(
  request: EditorTextLayoutEstimateRequest,
  options: Required<Pick<
    DefaultTextLayoutEstimatorOptions,
    "defaultAverageCharacterWidth" | "defaultFontSize" | "defaultLineHeight"
  >>,
): ResolvedTextLayoutRequest {
  const fontSize = resolvePositiveNumber(request.fontSize, options.defaultFontSize);
  const averageCharacterWidth = resolvePositiveNumber(
    request.averageCharacterWidth,
    options.defaultAverageCharacterWidth,
  );
  const horizontalPadding = Math.max(0, resolveOptionalNumber(request.horizontalPadding, 0));
  const contentWidth = Math.max(1, resolvePositiveNumber(request.maxWidth, 1) - horizontalPadding);
  const minHeight = Math.max(0, resolveOptionalNumber(request.minHeight, 0));
  const maxHeight = Math.max(minHeight, resolveOptionalNumber(request.maxHeight, Number.POSITIVE_INFINITY));

  return {
    text: normalizeWhiteSpace(request.text, request.whiteSpace ?? "normal"),
    contentWidth,
    fontSize,
    lineHeight: resolvePositiveNumber(request.lineHeight, options.defaultLineHeight),
    letterSpacing: resolveOptionalNumber(request.letterSpacing, 0),
    averageCharacterWidth,
    tabSize: resolvePositiveNumber(request.tabSize, 4),
    whiteSpace: request.whiteSpace ?? "normal",
    wordBreak: request.wordBreak ?? "normal",
    verticalPadding: Math.max(0, resolveOptionalNumber(request.verticalPadding, 0)),
    minHeight,
    maxHeight,
  };
}

function createCacheKey(request: ResolvedTextLayoutRequest): string {
  return [
    request.text,
    request.contentWidth,
    request.fontSize,
    request.lineHeight,
    request.letterSpacing,
    request.averageCharacterWidth,
    request.tabSize,
    request.whiteSpace,
    request.wordBreak,
    request.verticalPadding,
    request.minHeight,
    request.maxHeight,
  ].join("\u0001");
}

function estimateResolvedTextLayout(request: ResolvedTextLayoutRequest): EditorTextLayoutEstimate {
  const metrics: TextMeasurementMetrics = {
    fontSize: request.fontSize,
    averageCharacterWidth: request.averageCharacterWidth,
    letterSpacing: request.letterSpacing,
    tabSize: request.tabSize,
  };
  const physicalLines = request.whiteSpace === "normal" ? [request.text] : request.text.split("\n");
  const lineStats = physicalLines.reduce(
    (stats, line) => {
      const next = request.whiteSpace === "pre"
        ? {
          lineCount: 1,
          maxLineWidth: measureTextWidth(line, metrics),
        }
        : measureWrappedLine(line, request, metrics);

      return {
        lineCount: stats.lineCount + next.lineCount,
        maxLineWidth: Math.max(stats.maxLineWidth, next.maxLineWidth),
      };
    },
    { lineCount: 0, maxLineWidth: 0 },
  );
  const lineCount = Math.max(1, lineStats.lineCount);
  const naturalHeight = request.verticalPadding + lineCount * request.lineHeight;

  return {
    height: Math.ceil(clampHeight(naturalHeight, request.minHeight, request.maxHeight)),
    lineCount,
    maxLineWidth: Math.ceil(lineStats.maxLineWidth),
    contentWidth: Math.ceil(request.contentWidth),
  };
}

export function createDefaultTextLayoutEstimator(
  options: DefaultTextLayoutEstimatorOptions = {},
): EditorTextLayoutEstimator {
  const cacheSize = Math.max(0, options.cacheSize ?? DEFAULT_CACHE_SIZE);
  const defaultFontSize = resolvePositiveNumber(options.defaultFontSize, DEFAULT_FONT_SIZE);
  const defaultLineHeight = resolvePositiveNumber(
    options.defaultLineHeight,
    defaultFontSize * DEFAULT_LINE_HEIGHT_FACTOR,
  );
  const defaultAverageCharacterWidth = resolvePositiveNumber(
    options.defaultAverageCharacterWidth,
    defaultFontSize * DEFAULT_AVERAGE_CHARACTER_WIDTH_FACTOR,
  );
  const cache = new Map<string, EditorTextLayoutEstimate>();
  const resolvedDefaults = {
    defaultAverageCharacterWidth,
    defaultFontSize,
    defaultLineHeight,
  };

  return {
    estimate(request) {
      const resolvedRequest = resolveRequest(request, resolvedDefaults);
      if (cacheSize === 0) {
        return estimateResolvedTextLayout(resolvedRequest);
      }

      const cacheKey = createCacheKey(resolvedRequest);
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const estimate = estimateResolvedTextLayout(resolvedRequest);
      if (cache.size >= cacheSize) {
        cache.clear();
      }
      cache.set(cacheKey, estimate);
      return estimate;
    },
    clearCache() {
      cache.clear();
    },
  };
}

export const defaultTextLayoutEstimator = createDefaultTextLayoutEstimator();
