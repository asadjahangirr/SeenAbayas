"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Content stays visible without JavaScript. Only intersecting content animates.
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animation: Animation | undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      if (preference.matches) return;
      animation = element.animate(
        [{ opacity: 0, transform: "translateY(22px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 750, delay, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" },
      );
    }, { threshold: 0.08 });
    const stopMotion = () => { if (preference.matches) animation?.cancel(); };
    preference.addEventListener("change", stopMotion);
    observer.observe(element);
    return () => {
      observer.disconnect();
      animation?.cancel();
      preference.removeEventListener("change", stopMotion);
    };
  }, [delay]);

  return <div className={className} ref={ref}>{children}</div>;
}
