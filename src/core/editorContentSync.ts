export interface DeferredEditorContentSyncController {
  requestSync: (contentLength: number) => void;
  flush: (reason?: string) => void;
  cancel: () => void;
  hasPendingSync: () => boolean;
}

export interface DeferredEditorContentSyncOptions {
  readContent: () => string;
  applyContent: (content: string, reason: string) => void;
  reason?: string;
  immediateContentLengthLimit?: number;
  deferredSyncDelayMs?: number;
  schedule?: (callback: () => void, delayMs: number) => () => void;
}

export const DEFAULT_IMMEDIATE_CONTENT_SYNC_LIMIT = 50_000;
export const DEFAULT_DEFERRED_CONTENT_SYNC_DELAY_MS = 120;

function scheduleTimeout(callback: () => void, delayMs: number): () => void {
  const timerId = globalThis.setTimeout(callback, delayMs);
  return () => {
    globalThis.clearTimeout(timerId);
  };
}

export function createDeferredEditorContentSync(
  options: DeferredEditorContentSyncOptions,
): DeferredEditorContentSyncController {
  const immediateContentLengthLimit =
    options.immediateContentLengthLimit ?? DEFAULT_IMMEDIATE_CONTENT_SYNC_LIMIT;
  const deferredSyncDelayMs =
    options.deferredSyncDelayMs ?? DEFAULT_DEFERRED_CONTENT_SYNC_DELAY_MS;
  const schedule = options.schedule ?? scheduleTimeout;
  const defaultReason = options.reason ?? "editor";
  let cancelScheduledSync: (() => void) | null = null;
  let pending = false;

  const clearScheduledSync = (): void => {
    if (!cancelScheduledSync) {
      return;
    }

    cancelScheduledSync();
    cancelScheduledSync = null;
  };

  const flush = (reason = defaultReason): void => {
    if (!pending) {
      clearScheduledSync();
      return;
    }

    clearScheduledSync();
    pending = false;
    options.applyContent(options.readContent(), reason);
  };

  return {
    requestSync(contentLength) {
      pending = true;

      if (contentLength <= immediateContentLengthLimit) {
        flush(defaultReason);
        return;
      }

      if (cancelScheduledSync) {
        return;
      }

      cancelScheduledSync = schedule(() => {
        cancelScheduledSync = null;
        flush(defaultReason);
      }, deferredSyncDelayMs);
    },
    flush,
    cancel() {
      clearScheduledSync();
      pending = false;
    },
    hasPendingSync() {
      return pending;
    },
  };
}
