"use client";
import { browserId } from "@/lib/browser-id";
import { Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { mediaPages, type MediaSection } from "@/lib/cms/model";
import { MediaChoiceButton } from "./media-picker";
import type { AdminProduct } from "@/lib/admin/model";

export const mediaPageNames: Record<string, string> = {
  "/": "Home",
  "/collection": "Collection",
  "/collection/*": "Every product page",
  "/our-story": "Our Story",
  "/contact": "Contact",
  "/size-guide": "Size Guide",
  "/faqs": "FAQs",
  "/shipping-delivery": "Shipping & Delivery",
  "/returns-exchanges": "Returns & Exchanges",
  "/privacy-policy": "Privacy Policy",
  "/terms-conditions": "Terms & Conditions",
  "/cookie-policy": "Cookie Policy",
  "/bag": "Shopping Bag",
};
export function createMediaSection(src: string): MediaSection {
  return {
    id: browserId(),
    page: "/",
    position: "after",
    src,
    poster: "",
    alt: src.endsWith(".mp4") ? "SEEN campaign film" : "SEEN campaign image",
    caption: "",
    aspect: src.endsWith(".mp4") ? "landscape" : "natural",
  };
}
export function MediaSectionsEditor({
  sections,
  onChange,
  products,
}: {
  sections: MediaSection[];
  onChange: (sections: MediaSection[]) => void;
  products: AdminProduct[];
}) {
  const edit = (index: number, value: Partial<MediaSection>) =>
    onChange(
      sections.map((section, i) =>
        i === index ? { ...section, ...value } : section,
      ),
    );
  const move = (index: number, offset: number) => {
    const next = [...sections];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };
  return (
    <section className="admin-panel" id="page-media-editor">
      <div className="admin-panel__heading">
        <h2>Place images & videos on a page</h2>
        <p>
          Choose a reusable file, its page and position. Save & update store
          publishes these sections; Save draft keeps them private.
        </p>
      </div>
      {sections.map((section, index) => (
        <div className="admin-page-media-edit" key={section.id}>
          <div className="admin-page-media-preview">
            {section.src.endsWith(".mp4") ? (
              <video
                src={section.src}
                poster={section.poster || undefined}
                controls
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <img
                src={section.src}
                alt="Current media section"
                loading="lazy"
              />
            )}
          </div>
          <div className="admin-form-stack">
            <div className="admin-fields">
              <label className="admin-field">
                <span>Page for section {index + 1}</span>
                <select
                  value={section.page}
                  onChange={(e) => edit(index, { page: e.target.value })}
                >
                  {!(mediaPages as readonly string[]).includes(section.page) &&
                    !products.some(
                      (p) =>
                        `/collection/${p.design_reference}` === section.page,
                    ) && (
                      <option value={section.page}>
                        {section.page} — product removed; choose a new page
                      </option>
                    )}
                  {mediaPages.map((page) => (
                    <option value={page} key={page}>
                      {mediaPageNames[page]}
                    </option>
                  ))}
                  {products.map((p) => (
                    <option
                      value={`/collection/${p.design_reference}`}
                      key={p.id}
                    >
                      {p.name || p.design_reference} — product page
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                <span>Position for section {index + 1}</span>
                <select
                  value={section.position}
                  onChange={(e) =>
                    edit(index, {
                      position: e.target.value as MediaSection["position"],
                    })
                  }
                >
                  <option value="before">Before page content</option>
                  <option value="after">After page content</option>
                </select>
              </label>
              <label className="admin-field">
                <span>Shape for section {index + 1}</span>
                <select
                  value={section.aspect}
                  onChange={(e) =>
                    edit(index, {
                      aspect: e.target.value as MediaSection["aspect"],
                    })
                  }
                >
                  <option value="natural">Natural size</option>
                  <option value="landscape">Landscape</option>
                  <option value="portrait">Portrait</option>
                  <option value="square">Square</option>
                </select>
              </label>
            </div>
            <MediaChoiceButton
              value={section.src}
              kind="any"
              onChange={(src) => edit(index, { src })}
              label={`Choose media for section ${index + 1}`}
            />
            {section.src.endsWith(".mp4") && (
              <div className="admin-actions">
                <MediaChoiceButton
                  kind="image"
                  value={section.poster}
                  onChange={(poster) => edit(index, { poster })}
                  label={`Choose poster for section ${index + 1}`}
                />
                {section.poster && (
                  <button
                    type="button"
                    onClick={() => edit(index, { poster: "" })}
                  >
                    Remove poster
                  </button>
                )}
              </div>
            )}
            <label className="admin-field">
              <span>Description for section {index + 1}</span>
              <input
                maxLength={300}
                value={section.alt}
                onChange={(e) => edit(index, { alt: e.target.value })}
              />
            </label>
            <label className="admin-field">
              <span>Caption for section {index + 1} (optional)</span>
              <textarea
                maxLength={2000}
                value={section.caption}
                onChange={(e) => edit(index, { caption: e.target.value })}
              />
            </label>
            <div className="admin-actions">
              <button
                type="button"
                disabled={index === 0}
                aria-label={`Move section ${index + 1} up`}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                disabled={index === sections.length - 1}
                aria-label={`Move section ${index + 1} down`}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange(sections.filter((s) => s.id !== section.id))
                }
              >
                <Trash2 size={15} /> Remove section {index + 1}
              </button>
            </div>
          </div>
        </div>
      ))}
      {sections.length < 24 && (
        <MediaChoiceButton
          kind="any"
          label="Add image or video section"
          onChange={(src) => onChange([...sections, createMediaSection(src)])}
        />
      )}
      {!sections.length && (
        <p className="admin-caption">
          No extra sections yet. Choose Add image or video section to add one to
          any customer page.
        </p>
      )}
    </section>
  );
}
