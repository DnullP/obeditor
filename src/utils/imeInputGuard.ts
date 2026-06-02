interface NativeKeyboardEventLike {
  isComposing?: boolean;
  keyCode?: number;
}

interface PlainEnterInput {
  key: string;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  nativeEvent: NativeKeyboardEventLike;
}

interface BlurCommitGuardInput {
  isComposing: boolean;
  lastCompositionEndAt: number;
  now: number;
}

export interface ImeCompositionStateSnapshot {
  isComposing: boolean;
  lastCompositionEndAt: number;
}

interface ImeCompositionGuardOptions {
  getNow?: () => number;
}

export interface ImeCompositionGuard {
  state: ImeCompositionStateSnapshot;
  handleCompositionStart(): void;
  handleCompositionEnd(): void;
  shouldDeferBlurCommit(input?: { isComposing?: boolean }): boolean;
  shouldAllowBlurAction(input?: { isComposing?: boolean }): boolean;
}

const BLUR_COMMIT_GRACE_PERIOD_MS = 40;

function getDefaultNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function isImeComposing(nativeEvent: NativeKeyboardEventLike): boolean {
  return Boolean(nativeEvent.isComposing) || nativeEvent.keyCode === 229;
}

export function shouldSubmitPlainEnter(input: PlainEnterInput): boolean {
  if (input.key !== "Enter") {
    return false;
  }

  if (input.shiftKey || input.altKey || input.ctrlKey || input.metaKey) {
    return false;
  }

  return !isImeComposing(input.nativeEvent);
}

export function shouldDeferBlurCommitAfterComposition(
  input: BlurCommitGuardInput,
): boolean {
  if (input.isComposing) {
    return true;
  }

  return input.now - input.lastCompositionEndAt < BLUR_COMMIT_GRACE_PERIOD_MS;
}

export function shouldAllowBlurActionAfterComposition(
  input: BlurCommitGuardInput,
): boolean {
  return !shouldDeferBlurCommitAfterComposition(input);
}

export function createImeCompositionGuard(
  options: ImeCompositionGuardOptions = {},
): ImeCompositionGuard {
  const getNow = options.getNow ?? getDefaultNow;
  const state: ImeCompositionStateSnapshot = {
    isComposing: false,
    lastCompositionEndAt: 0,
  };

  const shouldDeferBlurCommit = (input: { isComposing?: boolean } = {}): boolean =>
    shouldDeferBlurCommitAfterComposition({
      isComposing: input.isComposing ?? state.isComposing,
      lastCompositionEndAt: state.lastCompositionEndAt,
      now: getNow(),
    });

  return {
    state,
    handleCompositionStart(): void {
      state.isComposing = true;
    },
    handleCompositionEnd(): void {
      state.isComposing = false;
      state.lastCompositionEndAt = getNow();
    },
    shouldDeferBlurCommit,
    shouldAllowBlurAction(input: { isComposing?: boolean } = {}): boolean {
      return !shouldDeferBlurCommit(input);
    },
  };
}
