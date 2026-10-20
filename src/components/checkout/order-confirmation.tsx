"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clock3, ArrowRight, LoaderCircle } from "lucide-react";
import { Copy } from "@/components/cms/content-provider";
import Image from "@/components/cms/image";
import Link from "@/components/cms/link";
import { Button } from "@/components/ui/button";
import { requestDeadline } from "@/lib/request-deadline";
import { formatGbp } from "@/lib/money";
import type { CustomerOrder } from "@/lib/payments/model";

const messages = {
  creating: {
    title: "Checking your payment.",
    text: "We are checking whether Stripe opened your test checkout. Please check again shortly.",
  },
  open: {
    title: "Your checkout is still open.",
    text: "Payment has not been completed. You can return to Stripe using your browser, or cancel this test checkout to release its reservation.",
  },
  pending: {
    title: "Awaiting confirmation.",
    text: "Stripe is still confirming your test payment. Please wait before attempting another payment. Your pieces remain reserved.",
  },
  paid: {
    title: "Test payment complete.",
    text: "Stripe has confirmed this sandbox payment. No real money was charged and no garments will be dispatched.",
  },
  failed: {
    title: "Payment was not completed.",
    text: "This test checkout has ended and its stock reservation has been released. You can return to your bag to try again.",
  },
  expired: {
    title: "Your checkout has ended.",
    text: "Stripe confirmed this test checkout is closed. Its reservation has been released and your saved bag is ready to review again.",
  },
  attention: {
    title: "Your payment needs review.",
    text: "We received a payment update that needs checking. Please contact customer care with the reference below before trying another payment.",
  },
};

export function OrderConfirmation({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const pending = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const attempts = useRef(0);
  const load = useCallback(
    async (cancel = false) => {
      if (pending.current) return;
      if (!/^[a-f0-9-]{36}$/i.test(orderId)) {
        setError(
          "This checkout link is unavailable. Please return to your bag.",
        );
        return;
      }
      pending.current = true;
      setBusy(true);
      setError("");
      const controller = new AbortController();
      abort.current = controller;
      const deadline = requestDeadline(30000, controller.signal);
      try {
        const response = await fetch(
          cancel
            ? "/api/checkout/cancel"
            : `/api/checkout/status?order=${encodeURIComponent(orderId)}`,
          {
            method: cancel ? "POST" : "GET",
            cache: "no-store",
            signal: deadline.signal,
            ...(cancel
              ? {
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ orderId }),
                }
              : {}),
          },
        );
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error || "Payment status is unavailable. Please try again.",
          );
        setOrder(body.order);
        setChecking(Boolean(body.checking));
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(
            deadline.signal.aborted
              ? "Payment status took too long to load. Please try again."
              : reason instanceof Error
                ? reason.message
                : "Payment status is unavailable. Please try again.",
          );
      } finally {
        deadline.dispose();
        pending.current = false;
        setBusy(false);
      }
    },
    [orderId],
  );
  useEffect(() => {
    void load();
    return () => abort.current?.abort();
  }, [load]);
  useEffect(() => {
    if (!order || !["creating", "open", "pending"].includes(order.state))
      return;
    const interval = window.setInterval(() => {
      if (
        attempts.current >= 12 ||
        document.hidden ||
        !navigator.onLine ||
        pending.current
      )
        return;
      attempts.current++;
      void load();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [order, load]);
  const message = order ? messages[order.state] : null;
  return (
    <div className="container confirmation-page">
      <p className="eyebrow">
        <Copy text={"SEEN ABAYAS · Payment status"} />
      </p>
      <div className="confirmation-intro" aria-live="polite" aria-atomic="true">
        <span className="confirmation-mark" aria-hidden="true">
          {order?.state === "paid" ? (
            <Check strokeWidth={1} size={30} />
          ) : busy ? (
            <LoaderCircle
              className="checkout-spinner"
              strokeWidth={1}
              size={28}
            />
          ) : (
            <Clock3 strokeWidth={1} size={28} />
          )}
        </span>
        <h1>
          <Copy
            text={
              message?.title ||
              (error ? "Let’s check your checkout." : "Checking your payment.")
            }
          />
        </h1>
        <p>
          <Copy
            text={
              message?.text ||
              "Your payment status is checked securely with Stripe."
            }
          />
        </p>
      </div>
      {error && (
        <div className="checkout-error" role="alert">
          <Copy text={error} />
        </div>
      )}
      {checking && (
        <p className="confirmation-note" role="status">
          <Copy
            text={
              "We could not refresh Stripe just now. The last saved status is shown; please check again shortly."
            }
          />
        </p>
      )}
      {order && (
        <div className="confirmation-layout">
          <section
            className="confirmation-details"
            aria-label="Checkout details"
          >
            <div className="confirmation-reference">
              <span>
                <Copy text={"Test reference"} />
              </span>
              <strong>{order.number}</strong>
            </div>
            <div className="checkout-review__block">
              <h2>
                <Copy text={"Contact & delivery"} />
              </h2>
              <p>{order.details.email}</p>
              <address>
                {order.details.recipientName ||
                  `${order.details.firstName} ${order.details.lastName}`}
                <br />
                {order.details.addressLine1}
                <br />
                {order.details.addressLine2 && (
                  <>
                    {order.details.addressLine2}
                    <br />
                  </>
                )}
                {order.details.city}
                <br />
                {order.details.postcode}
                <br />
                <Copy text={"United Kingdom"} />
              </address>
            </div>
            <div className="checkout-review__block">
              <h2>
                <Copy text={"Delivery method"} />
              </h2>
              <p>
                {order.delivery.carrier} · <Copy text={order.delivery.label} />
              </p>
            </div>
            <p className="confirmation-note">
              <Copy
                text={
                  "This is a test order. Your bag has been kept so you can test another payment method. Physical inventory is not sold by sandbox payments."
                }
              />
            </p>
          </section>
          <section
            className="checkout-summary confirmation-summary"
            aria-label="Test order summary"
          >
            <h2>
              <Copy text={"Your selection"} />
            </h2>
            <ul className="checkout-items">
              {order.items.map((item) => (
                <li key={item.variant_id}>
                  {item.photo && (
                    <Link
                      className="checkout-item-photo"
                      href={`/collection/${item.design_reference}`}
                    >
                      <Image
                        src={item.photo.src}
                        alt={item.photo.alt}
                        fill
                        sizes="76px"
                      />
                    </Link>
                  )}
                  <div>
                    <h3>{item.name}</h3>
                    <p>
                      <Copy text={"Size "} />
                      {item.size} · <Copy text={"Qty "} />
                      {item.quantity}
                    </p>
                  </div>
                  <strong>
                    {formatGbp(item.unit_price_pence * item.quantity)}
                  </strong>
                </li>
              ))}
            </ul>
            <dl className="checkout-totals">
              <div>
                <dt>
                  <Copy text={"Subtotal"} />
                </dt>
                <dd>{formatGbp(order.subtotalPence)}</dd>
              </div>
              <div>
                <dt>
                  <Copy text={"Delivery"} />
                </dt>
                <dd>
                  {order.deliveryPence === 0 ? (
                    <Copy text={"Complimentary"} />
                  ) : (
                    formatGbp(order.deliveryPence)
                  )}
                </dd>
              </div>
              <div className="checkout-total">
                <dt>
                  <Copy text={"Test total"} />
                  <small>GBP</small>
                </dt>
                <dd>{formatGbp(order.totalPence)}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
      <div className="confirmation-actions">
        {(!order ||
          ["creating", "open", "pending"].includes(order.state) ||
          checking) && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              void load();
            }}
          >
            <Copy text={busy ? "Checking payment…" : "Check payment status"} />
          </Button>
        )}
        {order?.canCancel && (
          <button
            className="checkout-edit"
            disabled={busy}
            onClick={() => {
              void load(true);
            }}
          >
            <Copy text={"Cancel this test checkout"} />
          </button>
        )}
        <Link className="confirmation-bag" href="/bag">
          <Copy text={"Return to your bag"} />
          <ArrowRight size={16} strokeWidth={1.3} aria-hidden="true" />
        </Link>
        <Link href="/contact">
          <Copy text={"Contact customer care"} />
        </Link>
      </div>
    </div>
  );
}
