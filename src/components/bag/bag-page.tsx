"use client";
import { Copy } from "@/components/cms/content-provider";


import { BagEmpty, BagFeedback, BagLines, BagSummary } from "./bag-contents";
import { useBag } from "./bag-provider";

export function BagPageContent() {
  const { count, quote, ready } = useBag();
  return <div className="bag-page container"><div className="bag-page__heading"><p className="eyebrow"><Copy text={"Chosen with intention"} /></p><h1><Copy text={"Your shopping bag."} /><span><Copy text={count.toString().padStart(2, "0")} /></span></h1><p><Copy text={"A few considered pieces. A wardrobe that feels like you."} /></p></div><BagFeedback />{!ready ? <p className="bag-loading" role="status"><Copy text={"Unfolding your selection…"} /></p> : quote.lines.length ? <div className="bag-page__layout"><div><BagLines /><p className="bag-page__care"><Copy text={"A question about fit or styling? Our team is here to help."} /></p></div><BagSummary /></div> : <BagEmpty />}</div>;
}
