"use client";
import { Copy } from "@/components/cms/content-provider";


import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { keepFocusInDialog } from "@/lib/dialog-focus";
import { BagEmpty, BagFeedback, BagLines, BagSummary } from "./bag-contents";
import { useBag } from "./bag-provider";

export function BagDrawer() {
  const { isOpen, closeBag, count, ready, quote, notice, returnFocus } = useBag();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const pathname = usePathname();
  const previousPath = useRef(pathname);

  const close = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open || closing.current) return;
    closing.current = true;
    const finish = () => { dialog.close(); closeBag(); closing.current = false; if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true }); };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { finish(); return; }
    const animation = dialog.animate([{ transform: "translateX(0)", opacity: 1 }, { transform: "translateX(100%)", opacity: 0.8 }], { duration: 250, easing: "cubic-bezier(.4,0,1,1)" });
    void animation.finished.then(finish, finish);
  }, [closeBag, returnFocus]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && dialog && !dialog.open) {
      dialog.showModal();
    }
    if (!isOpen && dialog?.open) dialog.close();
  }, [isOpen]);

  useEffect(() => { if (previousPath.current !== pathname) { previousPath.current = pathname; close(); } }, [pathname, close]);

  return <dialog ref={dialogRef} id="shopping-bag-drawer" className="bag-drawer" aria-labelledby="bag-drawer-title" onKeyDown={keepFocusInDialog} onCancel={(event) => { event.preventDefault(); close(); }} onClose={closeBag} onClick={(event) => { if (event.currentTarget === event.target) close(); }}>
    <div className="bag-drawer__inner">
      <div className="bag-drawer__header"><div><p className="eyebrow"><Copy text={"A SEEN selection"} /></p><h2 id="bag-drawer-title"><Copy text={"Your bag."} /><span><Copy text={count.toString().padStart(2, "0")} /></span></h2></div><button type="button" autoFocus className="icon-button bag-close" onClick={close} aria-label="Close shopping bag"><X size={22} strokeWidth={1.2} aria-hidden="true" /></button></div>
      <div className="bag-drawer__body"><p className="bag-added" role="status"><Copy text={quote.lines.length ? (!ready ? "Checking your saved selection…" : notice || "A considered choice. Beautifully yours.") : ""} /></p><BagFeedback />{quote.lines.length ? <BagLines close={close} /> : <BagEmpty close={close} />}</div>
      {quote.lines.length > 0 && <BagSummary drawer close={close} />}
    </div>
  </dialog>;
}
