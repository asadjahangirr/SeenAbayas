import type { ComponentPropsWithoutRef } from "react";

type Variant = "primary" | "secondary";

function buttonClasses(variant: Variant, className?: string) {
  return ["button", `button--${variant}`, className].filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  children,
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: Variant }) {
  return (
    <button type={type} className={buttonClasses(variant, className)} {...props}>
      <span className="button__content">{children}</span>
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"a"> & { variant?: Variant }) {
  return (
    <a className={buttonClasses(variant, className)} {...props}>
      <span className="button__content">{children}</span>
    </a>
  );
}
