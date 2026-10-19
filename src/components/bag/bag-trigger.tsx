"use client";
import { Copy } from "@/components/cms/content-provider";


import { useBag } from "./bag-provider";

export function BagIcon({ className }: { className?: string }) {
  return <svg className={className} width="28" height="32" viewBox="0 0 28 32" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 10.5h18l1.5 18h-21l1.5-18Z" /><path className="bag-icon__handle" d="M9 12V7a5 5 0 0 1 10 0v5" /><path d="M8 25h12" opacity=".35" /></svg>;
}

export function BagTrigger() {
  const { count, ready, isOpen, openBag } = useBag();
  return (
    <button type="button" className="bag-trigger" onClick={(event) => openBag(event.currentTarget)} aria-label={`Open shopping bag, ${count} ${count === 1 ? "item" : "items"}`} aria-haspopup="dialog" aria-controls="shopping-bag-drawer" aria-expanded={isOpen}>
      <span className="bag-trigger__label"><Copy text={"Bag"} /></span>
      <span key={count} className="bag-trigger__icon" data-filled={count > 0}><BagIcon /><span className="bag-trigger__count" aria-hidden="true"><Copy text={ready ? count : "0"} /></span></span>
    </button>
  );
}
