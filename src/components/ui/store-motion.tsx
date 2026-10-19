"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { SiteDocument } from "@/lib/cms/model";

export function StoreMotion({
  settings,
}: {
  settings: SiteDocument["appearance"];
}) {
  const pathname = usePathname();
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();
        media.add("(prefers-reduced-motion: no-preference)", () => {
          const ctx = gsap.context(() => {
            if (settings.motion !== "none") {
              const distance = { subtle: 10, editorial: 22, cinematic: 34 }[
                settings.motion
              ];
              gsap.utils
                .toArray<HTMLElement>(
                  ".story-heading, .story-copy, .collection-heading, .film-introduction > *, .catalog-assistance",
                )
                .forEach((el) => {
                  gsap.from(el, {
                    y: distance,
                    autoAlpha: 0,
                    duration: 0.95,
                    ease: "power3.out",
                    scrollTrigger: {
                      trigger: el,
                      start: "top 93%",
                      once: true,
                    },
                  });
                });
            }
          });
          const disposers: (() => void)[] = [];
          if (
            settings.hover !== "none" &&
            matchMedia("(hover: hover) and (pointer: fine)").matches
          ) {
            document
              .querySelectorAll<HTMLElement>(
                ".button, .film-hero__shop, .text-link",
              )
              .forEach((el) => {
                const enter = (e: PointerEvent) => {
                  if (settings.hover === "magnetic") {
                    const r = el.getBoundingClientRect();
                    gsap.to(el, {
                      x: (e.clientX - r.left - r.width / 2) * 0.1,
                      y: (e.clientY - r.top - r.height / 2) * 0.14,
                      duration: 0.5,
                      ease: "power3.out",
                      overwrite: "auto",
                    });
                  } else if (settings.hover === "lift")
                    gsap.to(el, {
                      y: -3,
                      duration: 0.45,
                      ease: "power3.out",
                      overwrite: "auto",
                    });
                  else
                    gsap.fromTo(
                      el,
                      { filter: "brightness(1)" },
                      {
                        filter: "brightness(1.16)",
                        duration: 0.65,
                        ease: "sine.out",
                        overwrite: "auto",
                      },
                    );
                };
                const leave = () => {
                  gsap.to(el, {
                    x: 0,
                    y: 0,
                    filter: "brightness(1)",
                    duration: 0.65,
                    ease: "power3.out",
                    overwrite: "auto",
                    clearProps: "transform,filter",
                  });
                };
                el.addEventListener("pointermove", enter);
                el.addEventListener("pointerleave", leave);
                disposers.push(() => {
                  el.removeEventListener("pointermove", enter);
                  el.removeEventListener("pointerleave", leave);
                  gsap.killTweensOf(el);
                  gsap.set(el, { clearProps: "transform,filter" });
                });
              });
          }
          return () => {
            disposers.forEach((fn) => fn());
            ctx.revert();
          };
        });
        cleanup = () => media.revert();
      })
      .catch(() => {
        /* The website remains readable if the motion bundle cannot load. */
      });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [pathname, settings]);
  return null;
}
