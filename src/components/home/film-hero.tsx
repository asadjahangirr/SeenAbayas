"use client";
import { CmsAnchor } from "@/components/cms/anchor";

import { Copy } from "@/components/cms/content-provider";

import Image from "@/components/cms/image";
import Link from "@/components/cms/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./film-hero.css";
import { useSiteDocument } from "@/components/cms/content-provider";

export function FilmHero() {
  const siteContent = useSiteDocument();
  const [clipIndex, setClipIndex] = useState(0);
  const filmSource =
    siteContent.hero.videos[clipIndex % siteContent.hero.videos.length];
  const section = useRef<HTMLElement>(null);
  const wordmark = useRef<HTMLAnchorElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [hasFrame, setHasFrame] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    // Load the scroll engine only when the film hero is rendered.
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (cancelled || !section.current || !wordmark.current) return;
        gsap.registerPlugin(ScrollTrigger);
        const hero = section.current;
        const logo = wordmark.current;
        const header = document.querySelector<HTMLElement>(".site-header");
        const target = header?.querySelector<HTMLElement>(".brand-logo");
        if (!header || !target) return;
        const measure = () =>
          hero.style.setProperty(
            "--film-header-offset",
            `${header.offsetHeight}px`,
          );
        measure();
        const dockY = () => {
          const box = target.getBoundingClientRect();
          return box.top + box.height / 2;
        };
        const heroPosition = (property: string) =>
          parseFloat(getComputedStyle(hero).getPropertyValue(property)) / 100;
        const startY = () =>
          hero.getBoundingClientRect().top +
          window.scrollY +
          hero.offsetHeight * heroPosition("--film-logo-top");
        const startX = () =>
          window.innerWidth * (heroPosition("--film-logo-left") - 0.5);
        const matchMedia = gsap.matchMedia();
        matchMedia.add(
          {
            reduced: "(prefers-reduced-motion: reduce)",
            normal: "(prefers-reduced-motion: no-preference)",
          },
          (context) => {
            const solidNavigation = {
              "--film-nav-surface": "rgba(255, 255, 255, 1)",
              "--film-nav-ink": "#171717",
              "--film-nav-border": "#e9e7e3",
              "--film-nav-reveal": 1,
            };
            if (context.conditions?.reduced) {
              gsap.set(logo, {
                top: 0,
                left: "50%",
                x: 0,
                xPercent: -50,
                yPercent: -50,
                y: dockY,
                scale: () => target.offsetWidth / logo.offsetWidth,
                color: "#171717",
              });
              gsap.set(header, {
                ...solidNavigation,
                "--film-nav-visibility": "visible",
              });
              return;
            }
            const timeline = gsap.timeline({
              scrollTrigger: {
                trigger: hero,
                start: 0,
                end: () => Math.max(180, hero.offsetHeight * 0.72),
                scrub: 0.55,
                invalidateOnRefresh: true,
                onRefreshInit: measure,
              },
            });
            timeline
              .fromTo(
                logo,
                {
                  top: 0,
                  left: "50%",
                  x: startX,
                  xPercent: -50,
                  yPercent: -50,
                  y: startY,
                  scale: 1,
                  color: "#fff",
                },
                {
                  x: 0,
                  y: dockY,
                  scale: () => target.offsetWidth / logo.offsetWidth,
                  duration: 1,
                  ease: "none",
                },
                0,
              )
              .to(
                logo,
                { color: "#171717", duration: 0.13, ease: "none" },
                0.87,
              )
              .fromTo(
                header,
                {
                  "--film-nav-surface": "rgba(255, 255, 255, 0)",
                  "--film-nav-ink": "#fff",
                  "--film-nav-border": "rgba(233, 231, 227, 0)",
                  "--film-nav-reveal": 0,
                },
                { ...solidNavigation, duration: 0.22, ease: "none" },
                0.78,
              )
              .set(header, { "--film-nav-visibility": "hidden" }, 0)
              .set(header, { "--film-nav-visibility": "visible" }, 0.78);
          },
          hero,
        );
        let refreshFrame = 0;
        const observer = new ResizeObserver(() => {
          cancelAnimationFrame(refreshFrame);
          refreshFrame = requestAnimationFrame(() => {
            measure();
            ScrollTrigger.refresh();
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
              gsap.set(logo, {
                x: 0,
                xPercent: -50,
                yPercent: -50,
                y: dockY,
                scale: () => target.offsetWidth / logo.offsetWidth,
              });
            }
          });
        });
        observer.observe(header);
        hero.dataset.motionReady = "true";
        dispose = () => {
          cancelAnimationFrame(refreshFrame);
          observer.disconnect();
          matchMedia.revert();
          delete hero.dataset.motionReady;
        };
      })
      .catch(() => {
        // Keep a solid, readable header if the animation module cannot load.
        if (!cancelled && section.current)
          section.current.dataset.motionFailed = "true";
      });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  useEffect(() => {
    const element = video.current;
    const hero = section.current;
    if (!element || !hero) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const bounds = hero.getBoundingClientRect();
    let inView = bounds.bottom > 0 && bounds.top < window.innerHeight;
    let disposed = false;
    let pending = false;
    let interruptedRetry = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    setHasFrame(false);
    const sync = () => {
      if (disposed) return;
      if (!inView || document.hidden || reduced.matches) {
        element.pause();
        return;
      }
      element.muted = true;
      element.defaultMuted = true;
      element.playsInline = true;
      if (element.getAttribute("src") !== filmSource) element.src = filmSource;
      if (element.error) element.load();
      if (pending || !element.paused) return;
      pending = true;
      // Autoplay is automatic; a natural tap on the hero can also retry a
      // browser-blocked request without adding a playback control to the design.
      void element
        .play()
        .then(() => {
          if (!disposed) {
            interruptedRetry = false;
          }
        })
        .catch((error: unknown) => {
          if (disposed || !inView || document.hidden) return;
          if (
            error instanceof DOMException &&
            error.name === "AbortError" &&
            !interruptedRetry
          ) {
            interruptedRetry = true;
            retryTimer = setTimeout(() => sync(), 150);
          }
        })
        .finally(() => {
          pending = false;
        });
    };
    const resume = () => sync();
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        sync();
      },
      { threshold: 0.05 },
    );
    observer.observe(hero);
    reduced.addEventListener("change", resume);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("online", resume);
    element.addEventListener("canplay", resume);
    hero.addEventListener("click", resume, true);
    sync();
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      observer.disconnect();
      reduced.removeEventListener("change", resume);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", resume);
      element.removeEventListener("canplay", resume);
      hero.removeEventListener("click", resume, true);
      element.pause();
    };
  }, [filmSource]);

  return (
    <>
      <section
        className="film-hero"
        ref={section}
        aria-labelledby="film-title"
        data-has-frame={hasFrame}
      >
        <div className="film-hero__media">
          <Image
            className="film-hero__poster"
            src={siteContent.hero.poster}
            alt="A burgundy SEEN abaya against ivory studio draping."
            fill
            priority
            sizes="100vw"
          />
          <video
            ref={video}
            muted
            playsInline
            loop={siteContent.hero.videos.length === 1}
            preload="none"
            poster={siteContent.hero.poster}
            aria-hidden="true"
            tabIndex={-1}
            onEnded={() => {
              setHasFrame(false);
              setClipIndex((i) => i + 1);
            }}
            onPlaying={() => {
              setHasFrame(true);
            }}
            onError={() => {
              setHasFrame(false);
            }}
          />
        </div>
        <div className="film-hero__shade" aria-hidden="true" />
        <CmsAnchor
          className="film-floating-logo"
          href="#home"
          ref={wordmark}
          aria-label="SEEN ABAYAS — back to the top"
        >
          <span aria-hidden="true" />
        </CmsAnchor>
        <div className="film-hero__caption">
          <h1 id="film-title">
            <span>
              <Copy text={"Made to"} />
            </span>{" "}
            <em>
              <Copy text={"Be Seen."} />
            </em>
          </h1>
          <Link className="film-hero__shop" href={siteContent.hero.ctaLink}>
            <Copy text={"Discover the collection"} />
            <ArrowRight size={17} strokeWidth={1.3} aria-hidden="true" />
          </Link>
        </div>
        <CmsAnchor
          className="film-scroll-cue"
          href="#film-introduction"
          aria-label="Discover SEEN"
        >
          <ArrowDown size={18} strokeWidth={1.1} aria-hidden="true" />
        </CmsAnchor>
      </section>
      <section
        className="film-introduction container"
        id="film-introduction"
        aria-labelledby="film-introduction-title"
      >
        <p className="eyebrow">
          <Copy text={"The SEEN Collection"} />
        </p>
        <h2 id="film-introduction-title">
          <Copy text={"Timeless modesty."} />
          <br />
          <em>
            <Copy text={"Effortless elegance."} />
          </em>
        </h2>
        <p>
          <Copy
            text={
              "Refined silhouettes, beautiful details and a quiet confidence. Discover modestwear thoughtfully selected to complement your individual style."
            }
          />
        </p>
      </section>
    </>
  );
}
