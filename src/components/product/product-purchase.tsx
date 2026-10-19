"use client";
import { Copy, useContentPreview } from "@/components/cms/content-provider";


import { Check, Plus } from "lucide-react";
import { useRef, useState } from "react";
import type { CollectionPiece } from "@/data/collection";
import { Button } from "@/components/ui/button";
import { useBag } from "@/components/bag/bag-provider";

export function ProductPurchase({ commerce }: { commerce?: CollectionPiece["commerce"] }) {
  const preview = useContentPreview();
  const { add, busy, ready, error } = useBag();
  const [selected, setSelected] = useState("");
  const [added, setAdded] = useState(false);
  const [selectionError, setSelectionError] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const available = commerce?.variants.some((variant) => variant.available) || false;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (preview) return;
    if (!selected) { setSelectionError(true); document.querySelector<HTMLButtonElement>(".purchase-sizes button:not(:disabled)")?.focus(); return; }
    setAdded(false);
    if (await add(selected, buttonRef.current?.querySelector<HTMLButtonElement>("button") || undefined)) setAdded(true);
  }
  if (preview) return <p className="purchase-hint">Draft preview · Shopping is disabled. Save product changes to update this preview.</p>;
  return <form className="piece-purchase" onSubmit={submit}>
    <fieldset className="purchase-sizes" aria-describedby="purchase-size-hint"><legend><Copy text={commerce?.sizeKind === "length-inches" ? "Choose your length (inches)" : "Choose your size"} /></legend>{commerce ? <div>{commerce.variants.map((variant) => <button key={variant.id} type="button" aria-pressed={selected === variant.id} disabled={!variant.available || busy} aria-label={`${variant.sizeLabel}${variant.available ? "" : ", out of stock"}`} onClick={() => { setSelected(variant.id); setAdded(false); setSelectionError(false); }}><Copy text={variant.sizeLabel} />{!variant.available && <span className="sr-only"><Copy text={"— Out of stock"} /></span>}</button>)}</div> : <p className="purchase-pending"><Copy text={"Size availability is being confirmed."} /></p>}</fieldset>
    <p id="purchase-size-hint" className="purchase-hint"><Copy text={!commerce ? "Please contact customer care for current sizing and availability." : available ? "Select a size to make it yours." : "This piece is currently out of stock. Please contact our team for help."} /></p>
    {selectionError && <p className="purchase-error" role="alert"><Copy text={"Please choose an available size."} /></p>}
    {error && <p className="purchase-error" role="alert"><Copy text={error} /></p>}
    <div ref={buttonRef}><Button className="purchase-button" type="submit" aria-describedby="purchase-size-hint" disabled={!available || busy || !ready}><Copy text={busy ? "Checking availability…" : commerce && !available ? "Out of stock" : added ? "Add another to bag" : "Add to bag"} />{added ? <Check size={18} strokeWidth={1.3} aria-hidden="true" /> : <Plus size={18} strokeWidth={1.3} aria-hidden="true" />}</Button></div>
  </form>;
}
