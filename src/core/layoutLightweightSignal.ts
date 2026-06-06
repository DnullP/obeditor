/**
 * @module core/layoutLightweightSignal
 * @description Shared document-level signal for hosts that run continuous layout resize.
 */

export const DOCUMENT_LAYOUT_LIGHTWEIGHT_ATTR = "data-layout-lightweight";

export type DocumentLayoutLightweightListener = (isLightweight: boolean) => void;

export interface LayoutLightweightMeasurementController {
    request(options?: { force?: boolean }): void;
    flush(): void;
    dispose(): void;
    hasPendingLightweightMeasure(): boolean;
}

function getDocumentElement(): HTMLElement | null {
    return typeof document === "undefined" ? null : document.documentElement;
}

export function isDocumentLayoutLightweight(): boolean {
    return getDocumentElement()?.getAttribute(DOCUMENT_LAYOUT_LIGHTWEIGHT_ATTR) === "true";
}

export function subscribeDocumentLayoutLightweight(
    listener: DocumentLayoutLightweightListener,
): () => void {
    const root = getDocumentElement();
    if (!root || typeof MutationObserver === "undefined") {
        return () => {};
    }

    let previousValue = isDocumentLayoutLightweight();
    const notifyIfChanged = (): void => {
        const nextValue = isDocumentLayoutLightweight();
        if (nextValue === previousValue) {
            return;
        }

        previousValue = nextValue;
        listener(nextValue);
    };

    const observer = new MutationObserver(notifyIfChanged);
    observer.observe(root, {
        attributes: true,
        attributeFilter: [DOCUMENT_LAYOUT_LIGHTWEIGHT_ATTR],
    });

    return () => observer.disconnect();
}

function requestAnimationFrameCompat(callback: () => void): number | null {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
        callback();
        return null;
    }

    return window.requestAnimationFrame(callback);
}

function cancelAnimationFrameCompat(frameId: number | null): void {
    if (frameId === null) {
        return;
    }

    if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frameId);
        return;
    }
}

const pendingBatchedMeasurements = new Set<() => void>();
let batchedMeasurementFrameId: number | null = null;

function flushBatchedMeasurements(): void {
    const measurements = [...pendingBatchedMeasurements];
    pendingBatchedMeasurements.clear();
    batchedMeasurementFrameId = null;
    measurements.forEach((measurement) => {
        measurement();
    });
}

function scheduleBatchedMeasurement(measurement: () => void): (() => void) | null {
    pendingBatchedMeasurements.add(measurement);
    if (batchedMeasurementFrameId === null) {
        let flushedSynchronously = false;
        const frameId = requestAnimationFrameCompat(() => {
            flushedSynchronously = true;
            flushBatchedMeasurements();
        });
        batchedMeasurementFrameId = flushedSynchronously ? null : frameId;
    }

    if (!pendingBatchedMeasurements.has(measurement)) {
        return null;
    }

    return () => {
        pendingBatchedMeasurements.delete(measurement);
        if (pendingBatchedMeasurements.size === 0) {
            cancelAnimationFrameCompat(batchedMeasurementFrameId);
            batchedMeasurementFrameId = null;
        }
    };
}

export function createLayoutLightweightMeasurementController(
    measure: () => void,
): LayoutLightweightMeasurementController {
    let disposed = false;
    let pendingAfterLightweight = false;
    let cancelScheduledMeasure: (() => void) | null = null;
    let forceNextFrame = false;

    const runMeasure = (): void => {
        if (disposed) {
            return;
        }

        pendingAfterLightweight = false;
        measure();
    };

    const request = (options: { force?: boolean } = {}): void => {
        if (disposed) {
            return;
        }

        const force = options.force === true;
        if (!force && isDocumentLayoutLightweight()) {
            pendingAfterLightweight = true;
            return;
        }

        forceNextFrame = forceNextFrame || force;
        if (cancelScheduledMeasure !== null) {
            return;
        }

        cancelScheduledMeasure = scheduleBatchedMeasurement(() => {
            const shouldForce = forceNextFrame;
            cancelScheduledMeasure = null;
            forceNextFrame = false;
            if (!shouldForce && isDocumentLayoutLightweight()) {
                pendingAfterLightweight = true;
                return;
            }

            runMeasure();
        });
    };

    const unsubscribe = subscribeDocumentLayoutLightweight((isLightweight) => {
        if (isLightweight || !pendingAfterLightweight) {
            return;
        }

        request({ force: true });
    });

    return {
        request,
        flush(): void {
            if (disposed) {
                return;
            }

            cancelScheduledMeasure?.();
            cancelScheduledMeasure = null;
            forceNextFrame = false;
            runMeasure();
        },
        dispose(): void {
            disposed = true;
            unsubscribe();
            cancelScheduledMeasure?.();
            cancelScheduledMeasure = null;
            forceNextFrame = false;
            pendingAfterLightweight = false;
        },
        hasPendingLightweightMeasure(): boolean {
            return pendingAfterLightweight;
        },
    };
}
