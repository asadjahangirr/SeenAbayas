"use client";
import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { requestDeadline } from "@/lib/request-deadline";
import {
  STORE_CHANNEL,
  STORE_STORAGE_KEY,
  STORE_UPDATED_EVENT,
} from "@/lib/storefront/notify";

// A tiny public revision check; full pages refresh only when published data changes.
export function StorefrontSync({ revision }: { revision: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const known = useRef(revision);
  const refreshingAt = useRef(0);
  const visited = useRef(new Map<string, string>());
  const [, startTransition] = useTransition();
  useEffect(() => {
    known.current = revision;
    refreshingAt.current = 0;
    visited.current.set(pathname, revision);
  }, [revision]);
  useEffect(() => {
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return;
    if (
      visited.current.has(pathname) &&
      visited.current.get(pathname) !== known.current
    ) {
      refreshingAt.current = Date.now();
      startTransition(() => router.refresh());
    }
    visited.current.set(pathname, known.current);
    let disposed = false;
    let checking = false;
    let requested = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    const check = async () => {
      if (disposed || document.hidden || !navigator.onLine) return;
      if (checking) {
        requested = true;
        return;
      }
      checking = true;
      clearTimeout(timer);
      controller = new AbortController();
      const deadline = requestDeadline(10000, controller.signal);
      try {
        const response = await fetch("/api/storefront/sync", {
          cache: "no-store",
          headers: { "If-None-Match": `"${known.current}"` },
          signal: deadline.signal,
        });
        if (!response.ok && response.status !== 304)
          throw new Error("Sync unavailable");
        if (response.status !== 304) {
          const state = await response.json();
          if (
            !disposed &&
            typeof state.revision === "string" &&
            state.revision !== known.current &&
            (!refreshingAt.current || Date.now() - refreshingAt.current > 10000)
          ) {
            // A failed page refresh remains retryable until Next renders it.
            refreshingAt.current = Date.now();
            startTransition(() => router.refresh());
            window.dispatchEvent(new Event(STORE_UPDATED_EVENT));
          }
        }
        failures = 0;
      } catch {
        failures = Math.min(failures + 1, 4);
      } finally {
        deadline.dispose();
        checking = false;
        if (!disposed) {
          timer = setTimeout(
            () => void check(),
            requested ? 150 : Math.min(2000 * 2 ** failures, 30000),
          );
          requested = false;
        }
      }
    };
    const wake = () => {
      void check();
    };
    const visibility = () => {
      if (document.hidden) {
        clearTimeout(timer);
        controller?.abort();
      } else wake();
    };
    const storage = (e: StorageEvent) => {
      if (e.key === STORE_STORAGE_KEY) wake();
    };
    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel(STORE_CHANNEL);
      channel.onmessage = wake;
    } catch {
      /* Optional acceleration. */
    }
    window.addEventListener("storage", storage);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", visibility);
    void check();
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      channel?.close();
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [pathname, router]);
  return null;
}
