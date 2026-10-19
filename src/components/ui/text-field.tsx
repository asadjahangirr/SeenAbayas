
import { CmsInput } from "@/components/cms/input";

import { Copy } from "@/components/cms/content-provider";
import type { ComponentPropsWithoutRef } from "react";

type TextFieldProps = Omit<ComponentPropsWithoutRef<"input">, "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({
  id,
  label,
  hint,
  error,
  className,
  "aria-describedby": describedBy,
  ...props
}: TextFieldProps) {
  const description = [
    describedBy,
    hint ? `${id}-hint` : undefined,
    error ? `${id}-error` : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        <Copy text={label} />
      </label>
      {hint && <p id={`${id}-hint`} className="field__hint"><Copy text={hint} /></p>}
      <CmsInput
        {...props}
        id={id}
        className={["field__input", className].filter(Boolean).join(" ")}
        aria-describedby={description || undefined}
        aria-invalid={error ? true : props["aria-invalid"]}
      />
      {error && <p id={`${id}-error`} className="field__error"><Copy text={error} /></p>}
    </div>
  );
}
