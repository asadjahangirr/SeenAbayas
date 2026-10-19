"use client";
import { Copy } from "@/components/cms/content-provider";


import Link from "@/components/cms/link";
import { ArrowUpRight, Ruler, X } from "lucide-react";
import { useRef } from "react";

import { LengthReference } from "@/components/content/size-guide";
import { keepFocusInDialog } from "@/lib/dialog-focus";
import "@/app/content.css";

export function SizeGuideTrigger({ lengths }: { lengths: readonly number[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button className="text-link size-guide-trigger" type="button" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}><Ruler size={16} strokeWidth={1.3} aria-hidden="true" /><Copy text={"Size guide"} /></button>
    <dialog className="size-guide-dialog" ref={dialog} aria-labelledby="size-guide-dialog-title" onKeyDown={keepFocusInDialog} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="size-guide-dialog__header"><h2 id="size-guide-dialog-title"><Copy text={"Size Guide"} /></h2><button className="icon-button" type="button" autoFocus aria-label="Close size guide" onClick={() => dialog.current?.close()}><X size={20} strokeWidth={1.3} aria-hidden="true" /></button></div>
      <p><Copy text={"Measurements are provided to help you find the best fit. Please refer to the specific product details, as styles and silhouettes may vary."} /></p>
      <LengthReference lengths={lengths} />
      <Link className="text-link" href="/size-guide" onClick={() => dialog.current?.close()}><Copy text={"View the full size guide"} /><ArrowUpRight size={16} strokeWidth={1.3} aria-hidden="true" /></Link>
    </dialog>
  </>;
}
