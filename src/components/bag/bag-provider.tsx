"use client";
import { Copy, useSiteDocument } from "@/components/cms/content-provider";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  BAG_STORAGE_KEY,
  emptyBag,
  MAX_BAG_LINES,
  MAX_LINE_QUANTITY,
  parseBagLines,
  summarizeBag,
  type BagQuote,
  type BagRequestLine,
} from "@/lib/bag/model";
import { BagDrawer } from "./bag-drawer";
import { STORE_UPDATED_EVENT } from "@/lib/storefront/notify";
import { requestDeadline } from "@/lib/request-deadline";
import { couponCodeSchema, type CheckoutCoupon } from "@/lib/coupons/model";

type BagContextValue = {
  couponCode: string;
  coupon: CheckoutCoupon | null;
  setCouponCode: (code:string) => void;
  setCoupon: (coupon:CheckoutCoupon | null) => void;
  quote: BagQuote;
  count: number;
  busy: boolean;
  ready: boolean;
  error: string;
  notice: string;
  isOpen: boolean;
  openBag: (trigger?: HTMLElement) => void;
  closeBag: () => void;
  returnFocus: RefObject<HTMLElement | null>;
  add: (variantId: string, trigger?: HTMLElement) => Promise<boolean>;
  changeQuantity: (variantId: string, quantity: number) => Promise<void>;
  clearSavedBag: () => "cleared" | "blocked" | "busy";
  remove: (variantId: string) => void;
  retry: () => void;
};
const BagContext = createContext<BagContextValue | null>(null);

async function fetchQuote(
  lines: BagRequestLine[],
  signal?: AbortSignal,
): Promise<BagQuote> {
  const deadline = requestDeadline(20000, signal);
  try {
    const response = await fetch("/api/bag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
      cache: "no-store",
      signal: deadline.signal,
    });
    if (!response.ok)
      throw new Error(
        "We couldn't check your bag. Please try again in a moment.",
      );
    return await response.json();
  } finally {
    deadline.dispose();
  }
}

export function BagProvider({
  children,
  development = false,
}: {
  children: ReactNode;
  development?: boolean;
}) {
  const delivery = useSiteDocument().commerce;
  const storageKey = development
    ? `${BAG_STORAGE_KEY}.development`
    : BAG_STORAGE_KEY;
  const [quote, setQuote] = useState<BagQuote>(emptyBag);
  const [couponCode, updateCouponCode] = useState("");
  const [coupon, setCoupon] = useState<CheckoutCoupon | null>(null);
  const couponKey=`${storageKey}.coupon`;
  const setCouponCode=useCallback((code:string)=>{
    const parsed=couponCodeSchema.safeParse(code);
    const next=parsed.success ? parsed.data : "";
    updateCouponCode(next);setCoupon(null);
    try{if(next)localStorage.setItem(couponKey,next);else localStorage.removeItem(couponKey);}catch{/* Shopping works without storage. */}
  },[couponKey]);
  useEffect(()=>{
    const read=()=>{try{const parsed=couponCodeSchema.safeParse(localStorage.getItem(couponKey)||"");updateCouponCode(parsed.success?parsed.data:"");setCoupon(null);}catch{/* Keep in-memory code. */}};
    read();const changed=(event:StorageEvent)=>{if(event.key===couponKey)read();};
    window.addEventListener("storage",changed);return()=>window.removeEventListener("storage",changed);
  },[couponKey]);
  const [requests, setRequests] = useState<BagRequestLine[]>([]);
  const requestsRef = useRef<BagRequestLine[]>([]);
  const quoteRef = useRef<BagQuote>(emptyBag);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const openBag = useCallback((trigger?: HTMLElement) => {
    returnFocus.current = trigger || (document.activeElement as HTMLElement);
    setIsOpen(true);
  }, []);
  const closeBag = useCallback(() => setIsOpen(false), []);

  const commit = useCallback(
    (lines: BagRequestLine[], nextQuote: BagQuote, persist = true) => {
      requestsRef.current = lines;
      quoteRef.current = nextQuote;
      setRequests(lines);
      setQuote(nextQuote);
      if (persist)
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({ version: 1, lines }),
          );
        } catch {
          /* Bag still works when storage is unavailable. */
        }
    },
    [storageKey],
  );

  const refresh = useCallback(
    async (
      lines: BagRequestLine[],
      target?: string,
      signal?: AbortSignal,
      persist = true,
    ) => {
      if (pending.current) return false;
      pending.current = true;
      setBusy(true);
      setError("");
      try {
        const next = await fetchQuote(lines, signal);
        if (signal?.aborted) return false;
        const rejected = target
          ? next.lines.find((line) => line.variantId === target)?.issue
          : null;
        if (rejected) {
          // Refresh the existing bag too, so a failed addition cannot leave stale prices/stock visible.
          const previous = requestsRef.current;
          commit(
            previous,
            previous.length ? await fetchQuote(previous, signal) : emptyBag,
            false,
          );
          setError(
            rejected === "insufficient-stock"
              ? "There isn't enough stock for that quantity. Please choose fewer pieces."
              : "This size is no longer available. Please choose another size.",
          );
          return false;
        }
        commit(lines, next, persist);
        return true;
      } catch {
        if (!signal?.aborted)
          setError("We couldn't check your bag. Please try again in a moment.");
        return false;
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [commit],
  );

  useEffect(() => {
    const controller = new AbortController();
    function restore() {
      if (pending.current) return;
      let lines: BagRequestLine[] = [];
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (saved?.version === 1) lines = parseBagLines(saved.lines) || [];
      } catch {
        /* Corrupt or inaccessible storage is treated as an empty bag. */
      }
      commit(
        lines,
        summarizeBag(
          lines.map((line) => ({
            ...line,
            piece: null,
            issue: "unavailable" as const,
          })),
        ),
        false,
      );
      if (!lines.length) {
        setReady(true);
        return;
      }
      setReady(false);
      void refresh(lines, undefined, controller.signal, false).finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });
    }
    // A deferred restore also avoids duplicate work during React's development effect replay.
    const initialRestore = window.setTimeout(restore, 0);
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) restore();
    };
    const onVisible = () => {
      if (!document.hidden && requestsRef.current.length)
        void refresh(requestsRef.current, undefined, controller.signal, false);
    };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(STORE_UPDATED_EVENT, onVisible);
    return () => {
      clearTimeout(initialRestore);
      controller.abort();
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(STORE_UPDATED_EVENT, onVisible);
    };
  }, [commit, refresh, storageKey]);

  async function add(variantId: string, trigger?: HTMLElement) {
    if (pending.current || !ready) return false;
    const current = requestsRef.current;
    const existing = current.find((line) => line.variantId === variantId);
    if (
      (existing?.quantity || 0) >= MAX_LINE_QUANTITY ||
      (!existing && current.length >= MAX_BAG_LINES)
    ) {
      setError(
        `Your bag allows up to ${MAX_LINE_QUANTITY} of each size and ${MAX_BAG_LINES} different sizes.`,
      );
      return false;
    }
    const lines = existing
      ? current.map((line) =>
          line.variantId === variantId
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        )
      : [...current, { variantId, quantity: 1 }];
    if (!(await refresh(lines, variantId))) return false;
    setNotice("Added to your bag.");
    openBag(trigger);
    return true;
  }

  async function changeQuantity(variantId: string, quantity: number) {
    if (pending.current || quantity < 1 || quantity > MAX_LINE_QUANTITY) return;
    const previous = requestsRef.current.find(
      (line) => line.variantId === variantId,
    );
    if (!previous) return;
    const lines = requestsRef.current.map((line) =>
      line.variantId === variantId ? { ...line, quantity } : line,
    );
    // A reduction may still exceed newly reduced stock. Keep the lower quantity
    // and its issue so the shopper can continue reducing it to an available amount.
    if (
      await refresh(lines, quantity > previous.quantity ? variantId : undefined)
    )
      setNotice("Bag quantity updated.");
  }

  function remove(variantId: string) {
    if (pending.current) return;
    commit(
      requestsRef.current.filter((line) => line.variantId !== variantId),
      summarizeBag(
        quoteRef.current.lines.filter((line) => line.variantId !== variantId),
        delivery,
      ),
    );
    setError("");
    setNotice("Piece removed from your bag.");
  }

  function clearSavedBag(): "cleared" | "blocked" | "busy" {
    if (pending.current) return "busy";
    commit([], emptyBag, false);
    setCouponCode("");
    setError("");
    try {
      localStorage.removeItem(BAG_STORAGE_KEY);
      localStorage.removeItem(`${BAG_STORAGE_KEY}.development`);
      localStorage.removeItem(`${BAG_STORAGE_KEY}.coupon`);
      localStorage.removeItem(`${BAG_STORAGE_KEY}.development.coupon`);
      setNotice("Your saved bag has been cleared.");
      return "cleared";
    } catch {
      setNotice("Your bag has been emptied for this visit.");
      return "blocked";
    }
  }

  return (
    <BagContext.Provider
      value={{
        couponCode,coupon,setCouponCode,setCoupon,
        quote,
        count: requests.reduce((sum, line) => sum + line.quantity, 0),
        busy,
        ready,
        error,
        notice,
        isOpen,
        openBag,
        closeBag,
        returnFocus,
        add,
        changeQuantity,
        remove,
        clearSavedBag,
        retry: () => {
          void refresh(requestsRef.current);
        },
      }}
    >
      <Copy text={children} />
      <BagDrawer />
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <Copy text={notice} />
      </span>
    </BagContext.Provider>
  );
}

export function useBag() {
  const value = useContext(BagContext);
  if (!value) throw new Error("Bag components require BagProvider.");
  return value;
}
