"use client";
import { CmsInput } from "@/components/cms/input";

import { Copy } from "@/components/cms/content-provider";


import { ArrowUpRight, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PieceCard } from "@/components/collection/piece-card";
import { Reveal } from "@/components/ui/reveal";
import { photographDescriptions, photographTones, toneByDesign, type CollectionPiece, type PhotographTone } from "@/data/collection";
import type { StorefrontCategory } from "@/lib/storefront/model";

const colourSearchTerms: Partial<Record<PhotographTone, string[]>> = {
  Burgundy: ["red", "maroon", "wine"],
  Charcoal: ["grey", "gray"],
  Teal: ["blue", "green"],
  Olive: ["green"],
  Cream: ["ivory", "neutral", "beige"],
};

function searchWords(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("en-GB").match(/[\p{L}\p{N}]+/gu) || [];
}

export function CollectionBrowser({ pieces: collectionPieces, categories: savedCategories = [] }: { pieces: CollectionPiece[]; categories?: StorefrontCategory[] }) {
  const [tone, setTone] = useState("All");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("az");
  const searchRef = useRef<HTMLInputElement>(null);
  const terms = searchWords(query);
  const pieces = collectionPieces.filter((piece) => {
    const colour = piece.tone || toneByDesign[piece.id];
    if (tone !== "All" && colour !== tone) return false;
    if (category && piece.category !== category) return false;
    // Match word beginnings instead of incidental letters in photo captions.
    const words = searchWords([piece.visualLabel, colour || "", ...(colourSearchTerms[colour as PhotographTone] || []), piece.commerce?.description || photographDescriptions[piece.id] || ""].join(" "));
    return terms.every((term) => words.some((word) => word.startsWith(term)));
  });
  if (sort === "az") pieces.sort((a, b) => a.visualLabel.localeCompare(b.visualLabel, "en-GB"));
  if (sort === "za") pieces.sort((a, b) => b.visualLabel.localeCompare(a.visualLabel, "en-GB"));
  const filtered = tone !== "All" || query.length > 0 || Boolean(category);
  const tones = [...new Set([...photographTones,...collectionPieces.map(p=>p.tone).filter((t):t is string=>Boolean(t))])];
  const categories = [...new Map([
    ...savedCategories.map(c => [c.slug, c] as const),
    ...collectionPieces.filter(p => p.category && !savedCategories.some(c => c.slug === p.category)).map(p => [p.category!, { slug:p.category!, name:p.categoryName || p.category!.replaceAll("-"," "), description:"" }] as const),
  ]).values()];
  const categoryExists = categories.some(c => c.slug === category);
  useEffect(() => { if (category && !categoryExists) setCategory(""); }, [category, categoryExists]);

  function reset() { setTone("All"); setQuery(""); setCategory(""); }

  return (
    <section className="catalog container" aria-labelledby="browse-title">
      <div className="catalog-toolbar">
        <div className="catalog-toolbar__title"><h2 id="browse-title" className="eyebrow"><Copy text={"Explore the pieces"} /></h2><p role="status" aria-live="polite" aria-atomic="true"><Copy text={pieces.length} /> <Copy text={pieces.length === 1 ? "piece" : "pieces"} /></p></div>
        <div className="catalog-search">
          <label htmlFor="collection-search"><Copy text={"Search the collection"} /></label>
          <div><Search size={17} strokeWidth={1.3} aria-hidden="true" /><CmsInput ref={searchRef} id="collection-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} placeholder="Name, colour or detail" autoComplete="off" aria-controls="catalog-results" />{query && <button className="icon-button" type="button" aria-label="Clear search" onClick={() => { setQuery(""); searchRef.current?.focus(); }}><X size={16} aria-hidden="true" /></button>}</div>
        </div>
      </div>
      <div className="catalog-controls">
        <div className="catalog-tones" role="group" aria-label="Filter by photographed colour">
          {(["All", ...tones]).map((item) => <button key={item} type="button" aria-pressed={tone === item} aria-controls="catalog-results" onClick={() => setTone(item)}><span><Copy text={item === "All" ? "All pieces" : item} /></span><span className="catalog-tones__count" aria-hidden="true"><Copy text={item === "All" ? collectionPieces.length : collectionPieces.filter((piece) => (piece.tone || toneByDesign[piece.id]) === item).length} /></span></button>)}
        </div>
        {categories.length > 0 && <div className="catalog-sort"><label htmlFor="collection-category"><Copy text={"Category"} /></label><select id="collection-category" value={category} onChange={e=>setCategory(e.target.value)}><option value=""><Copy text={"All categories"} /></option>{categories.map(c=><option value={c.slug} key={c.slug}>{c.name}</option>)}</select></div>}<div className="catalog-sort"><label htmlFor="collection-sort"><Copy text={"Sort by"} /></label><div><select id="collection-sort" value={sort} onChange={(event) => setSort(event.target.value)} aria-controls="catalog-results"><option value="az"><Copy text={"Alphabetical: A to Z"} /></option><option value="za"><Copy text={"Alphabetical: Z to A"} /></option></select><ChevronDown size={14} strokeWidth={1.3} aria-hidden="true" /></div></div>
      </div>
      {filtered && <div className="catalog-active"><span><Copy text={tone === "All" ? "All colours" : tone} /><Copy text={query.trim() && ` · “${query.trim()}”`} /></span><button type="button" className="text-link" onClick={reset}><Copy text={"Clear filters"} /><X size={13} aria-hidden="true" /></button></div>}
      <div id="catalog-results">
        {pieces.length ? <div className="catalog-grid" key={`${tone}-${category}-${query}-${sort}`}>
          {pieces.map((piece, index) => <Reveal key={piece.id} delay={index % 3 * 65}>
            <PieceCard piece={piece} />
          </Reveal>)}
        </div> : <div className="catalog-empty"><p className="eyebrow"><Copy text={"A fresh start"} /></p><h3><Copy text={collectionPieces.length ? "No pieces match your search." : "The collection is being prepared."} /></h3><p><Copy text={collectionPieces.length ? "Try another colour or detail, or return to the complete collection." : "Please contact our team with any questions about the collection."} /></p>{collectionPieces.length > 0 && <button className="button button--primary" type="button" onClick={reset}><span className="button__content"><Copy text={"View all pieces"} /><ArrowUpRight size={17} aria-hidden="true" /></span></button>}</div>}
      </div>
    </section>
  );
}
