"use client";

import { ArrowLeft, ArrowRight, Rotate3D } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { heroPieces, type CollectionPiece } from "@/data/collection";

function FlipPhoto({ piece, index }: { piece: CollectionPiece; index: number }) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const flipped = pinned || hovered;

  return (
    <button
      type="button"
      className="flip-photo"
      data-flipped={flipped}
      aria-label={`Alternate view of ${piece.visualLabel}`}
      aria-pressed={flipped}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onClick={() => { setPinned(!flipped); setHovered(false); }}
    >
      <span className="flip-photo__inner">
        {piece.photos.slice(0, 2).map((photo, face) => (
          <span key={photo.src} className={`flip-photo__face flip-photo__face--${face === 0 ? "front" : "back"}`} aria-hidden={face === 0 ? flipped : !flipped}>
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              preload={index === 0 && face === 0}
              loading={index === 0 && face === 0 ? undefined : "eager"}
              sizes={index === 0 ? "(min-width: 1024px) 430px, (min-width: 768px) 430px, 76vw" : "(min-width: 1024px) 270px, (min-width: 768px) 430px, 76vw"}
            />
          </span>
        ))}
      </span>
      <span className="flip-photo__hint" aria-hidden="true"><Rotate3D size={16} strokeWidth={1.4} /><span>Another view</span></span>
    </button>
  );
}

export function HeroLookbook() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function moveTo(index: number) {
    const track = trackRef.current;
    const item = track?.children[index] as HTMLElement | undefined;
    if (!track || !item) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: item.offsetLeft - (track.children[0] as HTMLElement).offsetLeft, behavior: reduced ? "instant" : "smooth" });
  }

  return (
    <div className="hero-visuals" role="group" aria-label="A closer look at SEEN">
      <div className="hero-lookbook" ref={trackRef} onScroll={() => {
        const track = trackRef.current;
        if (!track) return;
        const cards = Array.from(track.children) as HTMLElement[];
        const origin = cards[0].offsetLeft;
        const closest = cards.reduce((best, card, index) => Math.abs(card.offsetLeft - origin - track.scrollLeft) < Math.abs(cards[best].offsetLeft - origin - track.scrollLeft) ? index : best, 0);
        setActive(closest);
      }}>
        {heroPieces.map((piece, index) => (
          <figure className="hero-shot" key={piece.id}>
            <FlipPhoto piece={piece} index={index} />
            <figcaption><span>{piece.visualLabel}</span><span aria-hidden="true">0{index + 1}</span></figcaption>
          </figure>
        ))}
      </div>
      <div className="lookbook-controls">
        <p>Explore the details</p>
        <div className="lookbook-controls__paging">
          <button className="icon-button" type="button" aria-label="Previous featured photograph" disabled={active === 0} onClick={() => moveTo(active - 1)}><ArrowLeft size={18} strokeWidth={1.3} /></button>
          <span role="status" aria-live="polite">0{active + 1} / 0{heroPieces.length}</span>
          <button className="icon-button" type="button" aria-label="Next featured photograph" disabled={active === heroPieces.length - 1} onClick={() => moveTo(active + 1)}><ArrowRight size={18} strokeWidth={1.3} /></button>
        </div>
      </div>
      <p className="lookbook-desktop-hint">Hover to turn. Click to keep a view.</p>
    </div>
  );
}
