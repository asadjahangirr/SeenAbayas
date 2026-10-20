
"use client";
import { CmsAnchor } from "@/components/cms/anchor";

import { Copy, useSiteDocument } from "@/components/cms/content-provider";
import { announcementTextFor } from "@/lib/cms/model";
import type { CSSProperties } from "react";

export function DeliveryAnnouncement() {
  const document = useSiteDocument();
  const message = announcementTextFor(document);
  if (!document.announcement.enabled) return null;

  return (
    <div className="announcement" style={{ background: document.announcement.background, color: document.announcement.ink, "--announcement-duration": `${document.announcement.duration}s` } as CSSProperties}>
      <CmsAnchor className="announcement__viewport" href={document.announcement.link} aria-label={message}>
        <div className="announcement__track" aria-hidden="true">
          {[0, 1].map((group) => (
            <div className="announcement__group" key={group}>
              {[0, 1, 2].map((item) => (
                <span className="announcement__message" key={item}>
                  <Copy text={message} />
                  <span className="announcement__divider" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </CmsAnchor>
    </div>
  );
}
