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
    if (
        frameId === null ||
        typeof window === "undefined" ||
        typeof window.cancelAnimationFrame !== "function"
    ) {
        return;
    }

    window.cancelAnimationFrame(frameId);
}

export function createLayoutLightweightMeasurementController(
    measure: () => void,
): LayoutLightweightMeasurementController {
    let disposed = false;
    let pendingAfterLightweight = false;
    let frameId: number | null = null;
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
        if (frameId !== null) {
            return;
        }

        frameId = requestAnimationFrameCompat(() => {
            const shouldForce = forceNextFrame;
            frameId = null;
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

            cancelAnimationFrameCompat(frameId);
            frameId = null;
            forceNextFrame = false;
            runMeasure();
        },
        dispose(): void {
            disposed = true;
            unsubscribe();
            cancelAnimationFrameCompat(frameId);
            frameId = null;
            forceNextFrame = false;
            pendingAfterLightweight = false;
        },
        hasPendingLightweightMeasure(): boolean {
            return pendingAfterLightweight;
        },
    };
}
