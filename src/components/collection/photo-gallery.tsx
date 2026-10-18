"use client";

import { ArrowLeft, ArrowRight, ArrowUpRight, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useImperativeHandle, useRef, useState, type Ref } from "react";

import { store } from "@/config/store";
import { pieceHref, type CollectionPiece } from "@/data/collection";
import { keepFocusInDialog } from "@/lib/dialog-focus";

export type PhotoGalleryHandle = { open: (piece: CollectionPiece, trigger: HTMLButtonElement) => void };

export function PhotoGallery({ ref }: { ref: Ref<PhotoGalleryHandle> }) {
  const [selected, setSelected] = useState<CollectionPiece | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const photo = selected?.photos[photoIndex];

  useImperativeHandle(ref, () => ({
    open(piece, trigger) {
      returnFocusRef.current = trigger;
      setSelected(piece);
      setPhotoIndex(0);
      dialogRef.current?.showModal();
    },
  }), []);

  function navigate(direction: number) {
    if (!selected) return;
    setPhotoIndex((index) => (index + direction + selected.photos.length) % selected.photos.length);
  }

  return (
    <dialog ref={dialogRef} className="photo-dialog" aria-labelledby="gallery-title"
      onClose={() => returnFocusRef.current?.focus({ preventScroll: true })}
      onKeyDown={(event) => {
        keepFocusInDialog(event);
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          navigate(event.key === "ArrowRight" ? 1 : -1);
        }
      }}
      onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}
    >
      <div className="photo-dialog__content">
        <div className="photo-dialog__heading">
          <div><p className="eyebrow">A closer look</p><h2 id="gallery-title">{selected?.visualLabel || "SEEN photography"}</h2></div>
          <button autoFocus type="button" className="icon-button" aria-label="Close photo gallery" onClick={() => dialogRef.current?.close()}><X size={23} strokeWidth={1.3} /></button>
        </div>
        {selected && photo && <>
          <div className="gallery-stage"
            onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
            onTouchCancel={() => { touchStart.current = null; }}
            onTouchEnd={(event) => {
              const start = touchStart.current;
              touchStart.current = null;
              if (!start) return;
              const dx = event.changedTouches[0].clientX - start.x;
              const dy = event.changedTouches[0].clientY - start.y;
              if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) navigate(dx < 0 ? 1 : -1);
            }}
          >
            <Image key={photo.src} src={photo.src} alt={photo.alt} fill sizes="(min-width: 768px) 620px, 92vw" className="gallery-photo" />
            {selected.photos.length > 1 && <>
              <button type="button" className="icon-button gallery-arrow gallery-arrow--prev" aria-label="Previous photo" onClick={() => navigate(-1)}><ArrowLeft size={19} /></button>
              <button type="button" className="icon-button gallery-arrow gallery-arrow--next" aria-label="Next photo" onClick={() => navigate(1)}><ArrowRight size={19} /></button>
            </>}
          </div>
          <div className="gallery-meta" role="status" aria-live="polite"><span>{photo.label}</span><span>{photoIndex + 1} / {selected.photos.length}</span></div>
          {selected.photos.length > 1 && <div className="gallery-thumbnails" aria-label="Choose a photograph">
            {selected.photos.map((item, index) => <button key={item.src} type="button" aria-label={`Show ${item.label.toLowerCase()} photograph`} aria-pressed={index === photoIndex} onClick={() => setPhotoIndex(index)}><Image src={item.src} alt="" fill sizes="60px" /></button>)}
          </div>}
          <div className="gallery-enquiry"><Link href={pieceHref(selected)} prefetch={false} className="text-link">View this piece<ArrowUpRight size={16} aria-hidden="true" /></Link><p>For sizing and availability, contact our team.</p><a href={`mailto:${store.supportEmail}?subject=${encodeURIComponent(`SEEN enquiry: ${selected.visualLabel}`)}`} className="text-link">Enquire about this piece <ArrowUpRight size={16} aria-hidden="true" /></a></div>
        </>}
      </div>
    </dialog>
  );
}
