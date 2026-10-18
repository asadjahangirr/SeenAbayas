"use client";

import { ArrowLeft, ArrowRight, Minus, Plus, X, ZoomIn } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, type TouchEvent } from "react";

import type { CollectionPiece } from "@/data/collection";
import { keepFocusInDialog } from "@/lib/dialog-focus";

export function ProductGallery({ piece }: { piece: CollectionPiece }) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number; onPhoto: boolean } | null>(null);
  const suppressClick = useRef(false);
  const photo = piece.photos[index];
  const multiple = piece.photos.length > 1;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({
      left: zoomed ? (viewport.scrollWidth - viewport.clientWidth) / 2 : 0,
      top: zoomed ? (viewport.scrollHeight - viewport.clientHeight) / 2 : 0,
      behavior: "instant",
    });
  }, [zoomed, index, viewerOpen]);

  function select(next: number) {
    setIndex((next + piece.photos.length) % piece.photos.length);
    setZoomed(false);
  }

  function beginSwipe(event: TouchEvent) {
    if (event.touches.length !== 1) { touchStart.current = null; return; }
    touchStart.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
      onPhoto: event.target instanceof Element && event.target.closest("button") === triggerRef.current,
    };
    suppressClick.current = false;
  }

  function openViewer() {
    setZoomed(false);
    setViewerOpen(true);
    dialogRef.current?.showModal();
  }

  function endSwipe(event: TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || zoomed) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressClick.current = true;
      if (multiple) select(index + (dx < 0 ? 1 : -1));
    } else if (start.onPhoto && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      // Handle the tap directly; a preceding swipe can suppress compatibility clicks.
      suppressClick.current = true;
      openViewer();
    }
  }

  function moveFromButton(direction: number) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    select(index + direction);
  }

  return (
    <div className="piece-gallery" role="group" aria-label={`Photographs of ${piece.visualLabel}`} onKeyDown={(event) => {
      if (!dialogRef.current?.open && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        select(index + (event.key === "ArrowRight" ? 1 : -1));
      }
    }}>
      <div className="piece-gallery__main" onTouchStart={beginSwipe} onTouchEnd={endSwipe} onTouchCancel={() => { touchStart.current = null; }} onPointerDown={(event) => { if (event.pointerType === "mouse") suppressClick.current = false; }}>
        <button ref={triggerRef} type="button" className="piece-photo" aria-label={`Enlarge ${photo.label.toLowerCase()} photograph of ${piece.visualLabel}`} aria-haspopup="dialog"
          onClick={() => {
            if (suppressClick.current) { suppressClick.current = false; return; }
            openViewer();
          }}
        >
          <Image key={photo.src} src={photo.src} alt={photo.alt} fill preload={index === 0} loading={index === 0 ? undefined : "eager"} sizes="(min-width: 1440px) 720px, (min-width: 1024px) 56vw, 94vw" />
          <span className="piece-photo__hint" aria-hidden="true"><ZoomIn size={17} strokeWidth={1.3} /><span>Explore the details</span></span>
        </button>
        {multiple && <>
          <button type="button" className="icon-button piece-gallery__arrow piece-gallery__arrow--prev" aria-label="Previous product photograph" onClick={() => moveFromButton(-1)}><ArrowLeft size={19} strokeWidth={1.3} /></button>
          <button type="button" className="icon-button piece-gallery__arrow piece-gallery__arrow--next" aria-label="Next product photograph" onClick={() => moveFromButton(1)}><ArrowRight size={19} strokeWidth={1.3} /></button>
        </>}
      </div>
      <div className="piece-gallery__meta" role="status" aria-live="polite" aria-atomic="true"><span>{photo.label}</span><span>{index + 1} / {piece.photos.length}</span></div>
      {multiple && <div className="piece-thumbnails" role="group" aria-label="Choose a product photograph">
        {piece.photos.map((item, position) => <button key={item.src} type="button" aria-label={`Show ${item.label.toLowerCase()} photograph`} aria-pressed={index === position} onClick={() => select(position)}><span><Image src={item.src} alt="" fill sizes="80px" /></span><span>{item.label}</span></button>)}
      </div>}

      <dialog ref={dialogRef} className="piece-zoom" aria-labelledby="piece-zoom-title" onClose={() => { suppressClick.current = false; setZoomed(false); setViewerOpen(false); triggerRef.current?.focus({ preventScroll: true }); }} onKeyDown={(event) => {
        keepFocusInDialog(event);
        if (!zoomed && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
          event.preventDefault();
          select(index + (event.key === "ArrowRight" ? 1 : -1));
        }
      }}>
        <div className="piece-zoom__toolbar"><h2 id="piece-zoom-title">{piece.visualLabel}<span>Photo viewer</span></h2><div>
          <button className="icon-button" type="button" aria-label={zoomed ? "Zoom out photograph" : "Zoom in photograph"} onClick={() => setZoomed(!zoomed)}>{zoomed ? <Minus size={21} strokeWidth={1.3} /> : <Plus size={21} strokeWidth={1.3} />}</button>
          <button autoFocus className="icon-button" type="button" aria-label="Close enlarged photograph" onClick={() => dialogRef.current?.close()}><X size={23} strokeWidth={1.3} /></button>
        </div></div>
        <div className="piece-zoom__viewport" ref={viewportRef} data-magnified={zoomed} role="region" tabIndex={zoomed ? 0 : -1} aria-label="Photograph; scroll to explore when magnified" onTouchStart={beginSwipe} onTouchEnd={endSwipe} onTouchCancel={() => { touchStart.current = null; }}>
          {/* Prepared WebP files already have the resolution needed for detail views. */}
          <div className="piece-zoom__canvas">{viewerOpen && <Image key={photo.src} loading="eager" unoptimized src={photo.src} alt={photo.alt} fill sizes="100vw" />}</div>
        </div>
        <div className="piece-zoom__footer">{multiple && <button type="button" className="icon-button" aria-label="Previous enlarged photograph" onClick={() => select(index - 1)}><ArrowLeft size={19} strokeWidth={1.3} /></button>}<p role="status" aria-live="polite">{photo.label} · {index + 1} / {piece.photos.length}{zoomed && " · 200%"}</p>{multiple && <button type="button" className="icon-button" aria-label="Next enlarged photograph" onClick={() => select(index + 1)}><ArrowRight size={19} strokeWidth={1.3} /></button>}</div>
      </dialog>
    </div>
  );
}
