"use client";
import { deliveryThresholdFor } from "@/lib/cms/model";

import { Copy, useSiteDocument } from "@/components/cms/content-provider";


import { ArrowUpRight, Minus, Plus } from "lucide-react";
import Image from "@/components/cms/image";
import Link from "@/components/cms/link";
import { ButtonLink } from "@/components/ui/button";
import { store } from "@/config/store";
import { MAX_LINE_QUANTITY } from "@/lib/bag/model";
import { formatGbp } from "@/lib/money";
import { useBag } from "./bag-provider";
import { BagIcon } from "./bag-trigger";

export function BagFeedback() {
  const { error, retry, busy } = useBag();
  return error ? <div className="bag-feedback" role="alert"><p><Copy text={error} /></p><button type="button" onClick={retry} disabled={busy}><Copy text={"Check bag again"} /></button></div> : null;
}

export function BagEmpty({ close }: { close?: () => void }) {
  return <div className="bag-empty"><BagIcon /><p className="eyebrow"><Copy text={"Room for something timeless"} /></p><h2><Copy text={"Your next favourite"} /><br /><em><Copy text={"starts here."} /></em></h2><p><Copy text={"Explore the collection and find a piece that feels like you."} /></p><ButtonLink href="/collection" onClick={close}><Copy text={"Discover the collection"} /><ArrowUpRight size={17} strokeWidth={1.3} aria-hidden="true" /></ButtonLink></div>;
}

export function BagLines({ close }: { close?: () => void }) {
  const { quote, busy, ready, changeQuantity, remove } = useBag();
  return <ul className="bag-lines" aria-label="Pieces in your bag" aria-busy={busy || !ready}>{quote.lines.map((line) => <li className="bag-line" key={line.variantId}>
    {line.piece ? <Link className="bag-line__photo" href={`/collection/${line.piece.id}`} onClick={close}><Image src={line.piece.photo.src} alt={line.piece.photo.alt} fill sizes="(min-width: 768px) 120px, 88px" /></Link> : <div className="bag-line__photo bag-line__placeholder" aria-hidden="true"><BagIcon /></div>}
    <div className="bag-line__information">
      <div className="bag-line__heading"><h3>{line.piece ? <Link href={`/collection/${line.piece.id}`} onClick={close}><Copy text={line.piece.name} /></Link> : <Copy text={"Unavailable piece"} />}</h3>{line.piece && <p><Copy text={formatGbp(line.piece.pricePence * line.quantity)} /></p>}</div>
      {line.piece && <p className="bag-line__size"><Copy text={"Size "} /><Copy text={line.piece.size} /><span><Copy text={formatGbp(line.piece.pricePence)} /><Copy text={" each"} /></span></p>}
      {line.issue && <p className="bag-line__issue"><Copy text={!ready ? "Checking your saved selection…" : line.issue === "insufficient-stock" ? "Please reduce the quantity; stock has changed." : "This size is currently unavailable."} /></p>}
      <div className="bag-line__controls"><div className="bag-quantity" role="group" aria-label={`Quantity for ${line.piece?.name || "unavailable piece"}${line.piece ? `, size ${line.piece.size}` : ""}`}>
        <button type="button" disabled={busy || !ready || line.quantity <= 1} onClick={() => { void changeQuantity(line.variantId, line.quantity - 1); }} aria-label="Decrease quantity"><Minus size={13} strokeWidth={1.3} aria-hidden="true" /></button>
        <span aria-label={`Quantity ${line.quantity}`}><Copy text={line.quantity} /></span>
        <button type="button" disabled={busy || !ready || line.quantity >= MAX_LINE_QUANTITY || line.issue === "unavailable"} onClick={() => { void changeQuantity(line.variantId, line.quantity + 1); }} aria-label="Increase quantity"><Plus size={13} strokeWidth={1.3} aria-hidden="true" /></button>
      </div><button type="button" className="bag-remove" disabled={busy} onClick={() => remove(line.variantId)} aria-label={`Remove ${line.piece?.name || "unavailable piece"}${line.piece ? `, size ${line.piece.size}` : ""}`}><Copy text={"Remove"} /></button></div>
    </div>
  </li>)}</ul>;
}

export function BagDelivery() {
  const { quote } = useBag();
  const document = useSiteDocument();
  const deliveryThreshold = deliveryThresholdFor(document);
  const threshold = document.commerce.freeDeliveryThresholdPence;
  if (!document.commerce.freeDeliveryEnabled) return null;
  const remaining = threshold + 1 - quote.subtotalPence;
  return <div className="bag-delivery"><p>{quote.freeDelivery ? <Copy text={"Your selection qualifies for complimentary standard UK delivery."} /> : <><Copy text={"Add "} /><Copy text={formatGbp(remaining)} /><Copy text={" for complimentary standard UK delivery."} /></>}</p><progress aria-label="Progress towards complimentary UK delivery" max={threshold + 1} value={Math.min(quote.subtotalPence, threshold + 1)} /><span><Copy text={"Complimentary on orders over "} /><Copy text={deliveryThreshold} /><Copy text={"."} /></span></div>;
}

export function BagSummary({ drawer = false, close }: { drawer?: boolean; close?: () => void }) {
  const { quote, busy } = useBag();
  const hasIssues = quote.lines.some((line) => line.issue);
  const enquiry = `mailto:${store.supportEmail}?subject=${encodeURIComponent("SEEN shopping bag enquiry")}&body=${encodeURIComponent(quote.lines.map((line) => line.piece ? `${line.piece.name} (${line.piece.id}), size ${line.piece.size}, quantity ${line.quantity}, ${formatGbp(line.piece.pricePence)} each${line.issue ? " — availability needs checking" : ""}` : "An unavailable piece needs checking.").join("\n"))}`;
  return <div className="bag-summary" aria-busy={busy}>
    {!drawer && <h2><Copy text={"Your selection"} /></h2>}
    <BagDelivery />
    <div className="bag-subtotal"><span><Copy text={hasIssues ? "Available items subtotal" : "Subtotal"} /></span><strong key={quote.subtotalPence}><Copy text={formatGbp(quote.subtotalPence)} /></strong></div>
    <p className="bag-summary__note"><Copy text={"Items in your bag are not reserved."} /></p>
    <ButtonLink href={drawer ? "/bag" : enquiry} onClick={close}><Copy text={drawer ? "View shopping bag" : "Enquire about your bag"} /><ArrowUpRight size={17} strokeWidth={1.3} aria-hidden="true" /></ButtonLink>
    <Link className="bag-continue" href="/collection" onClick={close}><Copy text={"Continue exploring"} /></Link>
  </div>;
}
