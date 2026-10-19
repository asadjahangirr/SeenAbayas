"use client";
import { usePathname } from "next/navigation";
import { useContentPreview, useSiteDocument } from "./content-provider";
import { replaceCopy, replaceMedia } from "@/lib/cms/model";
import "./media-sections.css";

export function PageMediaSections({
  position,
}: {
  position: "before" | "after";
}) {
  const pathname = usePathname();
  const preview = useContentPreview();
  const document = useSiteDocument();
  const page = preview
    ? pathname.replace(/^\/admin\/preview/, "") || "/"
    : pathname;
  const sections = document.sections.filter(
    (section) =>
      section.position === position &&
      (section.page === page ||
        (section.page === "/collection/*" &&
          /^\/collection\/design-[0-9]{2,4}$/.test(page))),
  );
  return sections.map((section) => (
    <figure
      key={section.id}
      className="cms-media-section container"
      data-media-section={section.id}
      data-aspect={section.aspect}
    >
      <div className="cms-media-frame">
        {section.src.endsWith(".mp4") ? (
          <video
            controls
            muted
            playsInline
            preload="none"
            src={section.src}
            poster={section.poster || undefined}
            aria-label={section.alt}
          />
        ) : (
          <img
            src={replaceMedia(section.src, document)}
            alt={replaceCopy(section.alt, document)}
            loading="lazy"
            decoding="async"
          />
        )}
      </div>
      {section.caption && <figcaption>{section.caption}</figcaption>}
    </figure>
  ));
}
