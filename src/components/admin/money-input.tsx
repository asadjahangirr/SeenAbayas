"use client";
import { useEffect, useState, type ComponentProps } from "react";

// The owner enters pounds; APIs and the database continue storing integer pence.
export function MoneyInput({
  value,
  onChange,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number | null;
  onChange: (pence: number | null) => void;
}) {
  const [text, setText] = useState(
    value === null ? "" : (value / 100).toFixed(2),
  );
  useEffect(() => {
    const current = text === "" ? null : Math.round(Number(text) * 100);
    if (current !== value)
      setText(value === null ? "" : (value / 100).toFixed(2));
  }, [value, text]);
  return (
    <input
      {...props}
      type="number"
      inputMode="decimal"
      min={props.min ?? 0}
      max={999999.99}
      step="0.01"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(
          e.target.value === ""
            ? null
            : Math.round(Number(e.target.value) * 100),
        );
      }}
      onBlur={(e) => {
        if (e.target.value !== "")
          setText((Math.round(Number(e.target.value) * 100) / 100).toFixed(2));
        props.onBlur?.(e);
      }}
    />
  );
}
