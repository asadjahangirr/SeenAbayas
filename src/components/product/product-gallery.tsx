"use client";
import { Copy } from "@/components/cms/content-provider";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "@/components/cms/image";
import { useEffect, useRef, useState, type TouchEvent } from "react";
import type { CollectionPiece } from "@/data/collection";

export function ProductGallery({ piece }: { piece: CollectionPiece }) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const photoRef = useRef<HTMLButtonElement>(null);
  const origin = useRef({ x: 50, y: 50 });
  const frame = useRef<number | null>(null);
  const touchStart = useRef<{ x: number; y: number; onPhoto: boolean } | null>(null);
  const suppressClick = useRef(false);
  const photo = piece.photos[index];
  const multiple = piece.photos.length > 1;

  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);

  function paintOrigin() {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      photoRef.current?.style.setProperty("--zoom-x", `${origin.current.x}%`);
      photoRef.current?.style.setProperty("--zoom-y", `${origin.current.y}%`);
      frame.current = null;
    });
  }

  function follow(clientX: number, clientY: number) {
    const bounds = photoRef.current?.getBoundingClientRect();
    if (!bounds) return;
    origin.current = { x: Math.max(0, Math.min(100, (clientX - bounds.x) / bounds.width * 100)), y: Math.max(0, Math.min(100, (clientY - bounds.y) / bounds.height * 100)) };
    paintOrigin();
  }

  function select(next: number) {
    setIndex((next + piece.photos.length) % piece.photos.length);
    setZoomed(false);
    origin.current = { x: 50, y: 50 };
    paintOrigin();
  }

  function beginTouch(event: TouchEvent) {
    if (event.touches.length !== 1) { touchStart.current = null; return; }
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY, onPhoto: event.target instanceof Element && event.target.closest("button") === photoRef.current };
    suppressClick.current = false;
  }

  function endTouch(event: TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || !event.changedTouches[0]) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (!zoomed && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressClick.current = true;
      if (multiple) select(index + (dx < 0 ? 1 : -1));
    } else if (start.onPhoto && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      suppressClick.current = true;
      follow(touch.clientX, touch.clientY);
      setZoomed(!zoomed);
    } else if (start.onPhoto) suppressClick.current = true;
  }

  return <div className="piece-gallery" role="group" aria-label={`Photographs of ${piece.visualLabel}`} onKeyDown={(event) => {
    if (event.key === "Escape") { setZoomed(false); return; }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    if (zoomed && event.target === photoRef.current) {
      event.preventDefault();
      const { x, y } = origin.current;
      origin.current = { x: Math.max(0, Math.min(100, x + (event.key === "ArrowRight" ? 10 : event.key === "ArrowLeft" ? -10 : 0))), y: Math.max(0, Math.min(100, y + (event.key === "ArrowDown" ? 10 : event.key === "ArrowUp" ? -10 : 0))) };
      paintOrigin();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); select(index + (event.key === "ArrowRight" ? 1 : -1)); }
  }}>
    <div className="piece-gallery__main" onTouchStart={beginTouch} onTouchMove={(event) => { if (zoomed && touchStart.current?.onPhoto && event.touches.length === 1) follow(event.touches[0].clientX, event.touches[0].clientY); }} onTouchEnd={endTouch} onTouchCancel={() => { touchStart.current = null; }}>
      <button ref={photoRef} type="button" className="piece-photo" data-zoomed={zoomed} aria-pressed={zoomed} aria-label={`View ${photo.label.toLowerCase()} details of ${piece.visualLabel}`} aria-describedby={`photo-instructions-${piece.id}`}
        onPointerEnter={(event) => { if (event.pointerType === "mouse" && matchMedia("(hover: hover) and (pointer: fine)").matches) { follow(event.clientX, event.clientY); setZoomed(true); } }}
        onPointerMove={(event) => { if (event.pointerType === "mouse" && zoomed) follow(event.clientX, event.clientY); }}
        onPointerLeave={(event) => { if (event.pointerType === "mouse") setZoomed(false); }}
        onPointerDown={(event) => { if (event.pointerType === "mouse") suppressClick.current = false; }}
        onBlur={() => setZoomed(false)}
        onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setZoomed(!zoomed); }}>
        {/* Prepared source-sized WebP keeps the hover detail sharp without another request. */}
        <Image key={photo.src} unoptimized src={photo.src} alt={photo.alt} fill preload={index === 0} loading={index === 0 ? undefined : "eager"} sizes="(min-width: 1440px) 720px, (min-width: 1024px) 56vw, 94vw" />
      </button>
      {multiple && <>
        <button type="button" className="icon-button piece-gallery__arrow piece-gallery__arrow--prev" aria-label="Previous product photograph" onPointerDown={(event) => { if (event.pointerType === "mouse") suppressClick.current = false; }} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } select(index - 1); }}><ArrowLeft size={19} strokeWidth={1.3} aria-hidden="true" /></button>
        <button type="button" className="icon-button piece-gallery__arrow piece-gallery__arrow--next" aria-label="Next product photograph" onPointerDown={(event) => { if (event.pointerType === "mouse") suppressClick.current = false; }} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } select(index + 1); }}><ArrowRight size={19} strokeWidth={1.3} aria-hidden="true" /></button>
      </>}
    </div>
    <p className="sr-only" id={`photo-instructions-${piece.id}`}><Copy text={"Hover or tap to magnify. With the photograph focused, press Enter to toggle magnification, arrow keys to explore the detail, and Escape to return. When not magnified, left and right arrows change photographs."} /></p>
    <div className="piece-gallery__meta" role="status" aria-live="polite" aria-atomic="true"><span><Copy text={photo.label} /></span><span><Copy text={index + 1} /><Copy text={" / "} /><Copy text={piece.photos.length} /></span></div>
    <p className="piece-gallery__hint"><span className="piece-gallery__hint--mouse"><Copy text={"Move over the image for a closer look."} /></span><span className="piece-gallery__hint--touch"><Copy text={zoomed ? "Drag to explore. Tap to return." : multiple ? "Tap for details. Swipe to explore the views." : "Tap for a closer look."} /></span></p>
    {multiple && <div className="piece-thumbnails" role="group" aria-label="Choose a product photograph">{piece.photos.map((item, position) => <button key={item.src} type="button" aria-label={`Show ${item.label.toLowerCase()} photograph`} aria-pressed={index === position} onClick={() => select(position)}><span><Image src={item.src} alt="" fill sizes="80px" /></span><span><Copy text={item.label} /></span></button>)}</div>}
  </div>;
}
