"use client";

import { ArrowUpRight, ChevronDown, Search, X } from "lucide-react";
import { useRef, useState } from "react";

import { PieceCard } from "@/components/collection/piece-card";
import { PhotoGallery, type PhotoGalleryHandle } from "@/components/collection/photo-gallery";
import { Reveal } from "@/components/ui/reveal";
import { photographTones, toneByDesign, type CollectionPiece, type PhotographTone } from "@/data/collection";

export function CollectionBrowser({ pieces: collectionPieces }: { pieces: CollectionPiece[] }) {
  const [tone, setTone] = useState<PhotographTone | "All">("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("edit");
  const searchRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<PhotoGalleryHandle>(null);
  const search = query.trim().toLocaleLowerCase("en-GB");
  const pieces = collectionPieces.filter((piece) =>
    (tone === "All" || toneByDesign[piece.id] === tone) &&
    search.split(/\s+/).every((term) => `${piece.visualLabel} ${piece.commerce?.description || ""} ${toneByDesign[piece.id] || ""} ${piece.photos.map((photo) => photo.alt).join(" ")}`.toLocaleLowerCase("en-GB").includes(term)),
  );
  if (sort === "az") pieces.sort((a, b) => a.visualLabel.localeCompare(b.visualLabel, "en-GB"));
  if (sort === "za") pieces.sort((a, b) => b.visualLabel.localeCompare(a.visualLabel, "en-GB"));
  const filtered = tone !== "All" || query.length > 0;

  function reset() { setTone("All"); setQuery(""); }

  return (
    <section className="catalog container" aria-labelledby="browse-title">
      <div className="catalog-toolbar">
        <div className="catalog-toolbar__title"><h2 id="browse-title" className="eyebrow">Explore the pieces</h2><p role="status" aria-live="polite" aria-atomic="true">{pieces.length} {pieces.length === 1 ? "piece" : "pieces"}</p></div>
        <div className="catalog-search">
          <label htmlFor="collection-search">Search the photographs</label>
          <div><Search size={17} strokeWidth={1.3} aria-hidden="true" /><input ref={searchRef} id="collection-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} placeholder="Colour or detail" autoComplete="off" aria-controls="catalog-results" />{query && <button className="icon-button" type="button" aria-label="Clear search" onClick={() => { setQuery(""); searchRef.current?.focus(); }}><X size={16} aria-hidden="true" /></button>}</div>
        </div>
      </div>
      <div className="catalog-controls">
        <div className="catalog-tones" role="group" aria-label="Filter by photographed colour">
          {(["All", ...photographTones] as const).map((item) => <button key={item} type="button" aria-pressed={tone === item} aria-controls="catalog-results" onClick={() => setTone(item)}><span>{item === "All" ? "All pieces" : item}</span><span className="catalog-tones__count" aria-hidden="true">{item === "All" ? collectionPieces.length : collectionPieces.filter((piece) => toneByDesign[piece.id] === item).length}</span></button>)}
        </div>
        <div className="catalog-sort"><label htmlFor="collection-sort">Sort by</label><div><select id="collection-sort" value={sort} onChange={(event) => setSort(event.target.value)} aria-controls="catalog-results"><option value="edit">The SEEN edit</option><option value="az">Alphabetical: A to Z</option><option value="za">Alphabetical: Z to A</option></select><ChevronDown size={14} strokeWidth={1.3} aria-hidden="true" /></div></div>
      </div>
      {filtered && <div className="catalog-active"><span>{tone === "All" ? "All colours" : tone}{query.trim() && ` · “${query.trim()}”`}</span><button type="button" className="text-link" onClick={reset}>Clear filters<X size={13} aria-hidden="true" /></button></div>}
      <div id="catalog-results">
        {pieces.length ? <div className="catalog-grid" key={`${tone}-${query}-${sort}`}>
          {pieces.map((piece, index) => <Reveal key={piece.id} delay={index % 3 * 65}>
            <PieceCard piece={piece} onQuickView={(item, trigger) => galleryRef.current?.open(item, trigger)} />
          </Reveal>)}
        </div> : <div className="catalog-empty"><p className="eyebrow">A fresh start</p><h3>{collectionPieces.length ? "No pieces match your search." : "The collection is being prepared."}</h3><p>{collectionPieces.length ? "Try another colour or detail, or return to the complete collection." : "Please contact our team with any questions about the collection."}</p>{collectionPieces.length > 0 && <button className="button button--primary" type="button" onClick={reset}><span className="button__content">View all pieces<ArrowUpRight size={17} aria-hidden="true" /></span></button>}</div>}
      </div>
      <PhotoGallery ref={galleryRef} />
    </section>
  );
}
