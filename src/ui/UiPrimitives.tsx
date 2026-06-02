import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from "react";

type UiControlSize = "compact" | "default" | "large";
type UiControlVariant = "default" | "settings" | "plain" | "unstyled";

export type UiNumberInputCommitReason = "change" | "blur";

export interface UiNumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "inputMode" | "onChange" | "type" | "value"> {
  controlSize?: UiControlSize;
  invalid?: boolean;
  monospace?: boolean;
  onValueChange: (nextValue: number, rawValue: string, reason: UiNumberInputCommitReason) => void;
  parseValue?: (rawValue: string, currentValue: number) => number | null;
  value: number;
  variant?: UiControlVariant;
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function defaultParseNumberInputValue(rawValue: string): number | null {
  if (rawValue.trim().length === 0) {
    return null;
  }

  const nextValue = Number(rawValue);
  return Number.isFinite(nextValue) ? nextValue : null;
}

function formatNumberInputValue(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

export const UiNumberInput = forwardRef<HTMLInputElement, UiNumberInputProps>(function UiNumberInput(
  {
    className,
    controlSize = "default",
    invalid = false,
    monospace = false,
    onBlur,
    onValueChange,
    parseValue,
    value,
    variant = "default",
    ...props
  },
  ref,
) {
  const [draftValue, setDraftValue] = useState(() => formatNumberInputValue(value));
  const isFocusedRef = useRef(false);
  const parse = parseValue ?? ((rawValue: string) => defaultParseNumberInputValue(rawValue));

  useEffect(() => {
    if (isFocusedRef.current) {
      return;
    }

    setDraftValue(formatNumberInputValue(value));
  }, [value]);

  const commitDraftValue = (rawValue: string, reason: UiNumberInputCommitReason): number | null => {
    const nextValue = parse(rawValue, value);
    if (nextValue === null || !Number.isFinite(nextValue)) {
      return null;
    }

    if (!Object.is(nextValue, value)) {
      onValueChange(nextValue, rawValue, reason);
    }
    return nextValue;
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const nextDraftValue = event.target.value;
    setDraftValue(nextDraftValue);
    commitDraftValue(nextDraftValue, "change");
  };

  return (
    <input
      ref={ref}
      {...props}
      type="text"
      inputMode="decimal"
      value={draftValue}
      onFocus={(event) => {
        isFocusedRef.current = true;
        props.onFocus?.(event);
      }}
      onChange={handleChange}
      onBlur={(event) => {
        isFocusedRef.current = false;
        const nextValue = commitDraftValue(event.target.value, "blur");
        setDraftValue(formatNumberInputValue(nextValue ?? value));
        onBlur?.(event);
      }}
      className={cx(
        "oe-ui-control",
        "oe-ui-number-input",
        `oe-ui-control--${controlSize}`,
        `oe-ui-control--${variant}`,
        invalid && "oe-ui-control--invalid",
        monospace && "oe-ui-control--monospace",
        className,
      )}
    />
  );
});
