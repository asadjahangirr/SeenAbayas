"use client";

import { Pause, Play } from "lucide-react";
import { useState } from "react";

import { deliveryThreshold } from "@/config/store";

export function DeliveryAnnouncement() {
  const [isPaused, setIsPaused] = useState(false);
  const message = `Complimentary UK delivery on orders over ${deliveryThreshold}`;

  return (
    <div className="announcement" data-paused={isPaused}>
      <a className="announcement__viewport" href="/#delivery" aria-label={message}>
        <div className="announcement__track" aria-hidden="true">
          {[0, 1].map((group) => (
            <div className="announcement__group" key={group}>
              {[0, 1, 2].map((item) => (
                <span className="announcement__message" key={item}>
                  {message}
                  <span className="announcement__divider" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </a>
      <button
        type="button"
        className="announcement__control"
        aria-label={isPaused ? "Resume delivery announcement" : "Pause delivery announcement"}
        onClick={() => setIsPaused((paused) => !paused)}
      >
        {isPaused
          ? <Play size={12} strokeWidth={1.5} aria-hidden="true" />
          : <Pause size={12} strokeWidth={1.5} aria-hidden="true" />}
      </button>
    </div>
  );
}
