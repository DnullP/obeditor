/**
 * @module core/layoutLightweightSignal.test
 * @description Regression tests for document-level lightweight layout measurement gating.
 */

import { afterEach, describe, expect, test } from "bun:test";
import {
    DOCUMENT_LAYOUT_LIGHTWEIGHT_ATTR,
    createLayoutLightweightMeasurementController,
    isDocumentLayoutLightweight,
    subscribeDocumentLayoutLightweight,
} from "./layoutLightweightSignal";

const originalDocument = globalThis.document;
const originalMutationObserver = globalThis.MutationObserver;
const originalWindow = globalThis.window;

class DocumentElementStub {
    private readonly attrs = new Map<string, string>();

    getAttribute(name: string): string | null {
        return this.attrs.get(name) ?? null;
    }

    setAttribute(name: string, value: string): void {
        this.attrs.set(name, value);
    }

    removeAttribute(name: string): void {
        this.attrs.delete(name);
    }
}

class MutationObserverStub {
    static instances: MutationObserverStub[] = [];

    readonly callback: MutationCallback;
    disconnected = false;
    observedAttributeFilter: string[] | undefined;

    constructor(callback: MutationCallback) {
        this.callback = callback;
        MutationObserverStub.instances.push(this);
    }

    observe(_target: Node, options: MutationObserverInit): void {
        this.observedAttributeFilter = options.attributeFilter ? [...options.attributeFilter] : undefined;
    }

    disconnect(): void {
        this.disconnected = true;
    }

    emit(): void {
        this.callback([], this as unknown as MutationObserver);
    }
}

function installDocumentStub(element: DocumentElementStub): void {
    globalThis.document = {
        documentElement: element,
    } as unknown as Document;
    globalThis.MutationObserver = MutationObserverStub as unknown as typeof MutationObserver;
    MutationObserverStub.instances = [];
}

function installAnimationFrameStub(): {
    pendingFrameCount: () => number;
    flushNextFrame: () => void;
} {
    let nextFrameId = 1;
    const callbacks = new Map<number, FrameRequestCallback>();

    globalThis.window = {
        requestAnimationFrame(callback: FrameRequestCallback): number {
            const frameId = nextFrameId;
            nextFrameId += 1;
            callbacks.set(frameId, callback);
            return frameId;
        },
        cancelAnimationFrame(frameId: number): void {
            callbacks.delete(frameId);
        },
    } as unknown as Window & typeof globalThis;

    return {
        pendingFrameCount: () => callbacks.size,
        flushNextFrame(): void {
            const [frameId, callback] = callbacks.entries().next().value ?? [];
            if (typeof frameId !== "number" || typeof callback !== "function") {
                return;
            }

            callbacks.delete(frameId);
            callback(0);
        },
    };
}

afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.MutationObserver = originalMutationObserver;
    globalThis.window = originalWindow;
    MutationObserverStub.instances = [];
});

describe("layoutLightweightSignal", () => {
    test("reads document lightweight layout flag", () => {
        const root = new DocumentElementStub();
        installDocumentStub(root);

        expect(isDocumentLayoutLightweight()).toBe(false);

        root.setAttribute(DOCUMENT_LAYOUT_LIGHTWEIGHT_ATTR, "true");

        expect(isDocumentLayoutLightweight()).toBe(true);
    });

    test("notifies subscribers only when the lightweight flag changes", () => {
        const root = new DocumentElementStub();
        installDocumentStub(root);
        const values: boolean[] = [];

        const unsubscribe = subscribeDocumentLayoutLightweight((isLightweight) => {
            values.push(isLightweight);
        });
        const observer = MutationObserverStub.instances[0];

        expect(observer?.observedAttributeFilter).toEqual([DOCUMENT_LAYOUT_LIGHTWEIGHT_ATTR]);

        observer?.emit();
        root.setAttribute(DOCUMENT_LAYOUT_LIGHTWEIGHT_ATTR, "true");
        observer?.emit();
        observer?.emit();
        root.removeAttribute(DOCUMENT_LAYOUT_LIGHTWEIGHT_ATTR);
        observer?.emit();

        unsubscribe();

        expect(values).toEqual([true, false]);
        expect(observer?.disconnected).toBe(true);
    });

    test("defers repeated measurements during lightweight layout and flushes once after it ends", () => {
        const root = new DocumentElementStub();
        installDocumentStub(root);
        root.setAttribute(DOCUMENT_LAYOUT_LIGHTWEIGHT_ATTR, "true");
        let measureCount = 0;

        const controller = createLayoutLightweightMeasurementController(() => {
            measureCount += 1;
        });

        controller.request();
        controller.request();

        expect(measureCount).toBe(0);
        expect(controller.hasPendingLightweightMeasure()).toBe(true);

        root.removeAttribute(DOCUMENT_LAYOUT_LIGHTWEIGHT_ATTR);
        MutationObserverStub.instances[0]?.emit();

        expect(measureCount).toBe(1);
        expect(controller.hasPendingLightweightMeasure()).toBe(false);

        controller.dispose();
    });

    test("coalesces repeated measurements into one animation frame outside lightweight layout", () => {
        const root = new DocumentElementStub();
        installDocumentStub(root);
        const animationFrames = installAnimationFrameStub();
        let measureCount = 0;

        const controller = createLayoutLightweightMeasurementController(() => {
            measureCount += 1;
        });

        controller.request();
        controller.request();

        expect(measureCount).toBe(0);
        expect(animationFrames.pendingFrameCount()).toBe(1);

        animationFrames.flushNextFrame();

        expect(measureCount).toBe(1);
        expect(animationFrames.pendingFrameCount()).toBe(0);

        controller.dispose();
    });

    test("batches multiple controllers into one shared animation frame", () => {
        const root = new DocumentElementStub();
        installDocumentStub(root);
        const animationFrames = installAnimationFrameStub();
        let firstMeasureCount = 0;
        let secondMeasureCount = 0;

        const firstController = createLayoutLightweightMeasurementController(() => {
            firstMeasureCount += 1;
        });
        const secondController = createLayoutLightweightMeasurementController(() => {
            secondMeasureCount += 1;
        });

        firstController.request();
        secondController.request();

        expect(animationFrames.pendingFrameCount()).toBe(1);

        animationFrames.flushNextFrame();

        expect(firstMeasureCount).toBe(1);
        expect(secondMeasureCount).toBe(1);
        expect(animationFrames.pendingFrameCount()).toBe(0);

        firstController.dispose();
        secondController.dispose();
    });

    test("disposing one batched controller keeps sibling measurements scheduled", () => {
        const root = new DocumentElementStub();
        installDocumentStub(root);
        const animationFrames = installAnimationFrameStub();
        let firstMeasureCount = 0;
        let secondMeasureCount = 0;

        const firstController = createLayoutLightweightMeasurementController(() => {
            firstMeasureCount += 1;
        });
        const secondController = createLayoutLightweightMeasurementController(() => {
            secondMeasureCount += 1;
        });

        firstController.request();
        secondController.request();
        firstController.dispose();

        expect(animationFrames.pendingFrameCount()).toBe(1);

        animationFrames.flushNextFrame();

        expect(firstMeasureCount).toBe(0);
        expect(secondMeasureCount).toBe(1);

        secondController.dispose();
    });

    test("drops pending lightweight measurements after dispose", () => {
        const root = new DocumentElementStub();
        installDocumentStub(root);
        root.setAttribute(DOCUMENT_LAYOUT_LIGHTWEIGHT_ATTR, "true");
        let measureCount = 0;

        const controller = createLayoutLightweightMeasurementController(() => {
            measureCount += 1;
        });
        controller.request();
        controller.dispose();

        root.removeAttribute(DOCUMENT_LAYOUT_LIGHTWEIGHT_ATTR);
        MutationObserverStub.instances[0]?.emit();

        expect(measureCount).toBe(0);
        expect(controller.hasPendingLightweightMeasure()).toBe(false);
    });
});
