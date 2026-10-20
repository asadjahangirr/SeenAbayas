"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  PackageCheck,
  Truck,
} from "lucide-react";
import {
  Copy,
  useContentPreview,
  useSiteDocument,
} from "@/components/cms/content-provider";
import Image from "@/components/cms/image";
import Link from "@/components/cms/link";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { BagEmpty, BagFeedback } from "@/components/bag/bag-contents";
import { useBag } from "@/components/bag/bag-provider";
import {
  checkoutDeliveryOptions,
  checkoutDetailsSchema,
  checkoutRequestLines,
  emptyCheckoutDetails,
  type CheckoutDelivery,
  type CheckoutDetails,
  type CheckoutFieldErrors,
  type CheckoutReview,
} from "@/lib/checkout/model";
import { formatGbp } from "@/lib/money";
import { requestDeadline } from "@/lib/request-deadline";
import { browserId } from "@/lib/browser-id";

const fieldNames: Record<keyof CheckoutDetails, { label: string }> = {
  email: { label: "Email address" },
  firstName: { label: "First name" },
  lastName: { label: "Last name" },
  phone: { label: "Phone number (optional)" },
  addressLine1: { label: "Address line 1" },
  addressLine2: { label: "Address line 2 (optional)" },
  city: { label: "Town or city" },
  postcode: { label: "Postcode" },
  country: { label: "Country" },
};

export function CheckoutPageContent({
  testPayments = false,
}: {
  testPayments?: boolean;
}) {
  const { quote, ready, busy: bagBusy, error: bagError, retry } = useBag();
  const document = useSiteDocument();
  const preview = useContentPreview();
  const testMode = testPayments && !preview;
  const [openingPayment, setOpeningPayment] = useState(false);
  const paymentAttempt = useRef<{ fingerprint: string; id: string } | null>(
    null,
  );
  const paymentPending = useRef(false);
  const [details, setDetails] = useState<CheckoutDetails>({
    ...emptyCheckoutDetails,
  });
  const [method, setMethod] = useState<CheckoutDelivery["id"]>("standard");
  const [errors, setErrors] = useState<CheckoutFieldErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewState, setReviewState] = useState<{
    value: CheckoutReview;
    key: string;
  } | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const key = JSON.stringify([quote, document.commerce, document.policies]);
  const keyRef = useRef(key);
  keyRef.current = key;
  const review = reviewState?.key === key ? reviewState.value : null;
  const options = checkoutDeliveryOptions(document, quote);
  const selectedMethod = options.some((option) => option.id === method)
    ? method
    : "standard";
  const delivery =
    review?.delivery || options.find((option) => option.id === selectedMethod)!;
  const displayedBag = review?.bag || quote;
  const selectionCount = displayedBag.lines.reduce(
    (count, line) => count + line.quantity,
    0,
  );
  const hasIssues = quote.lines.some((line) => line.issue || !line.piece);
  const belowMinimum =
    quote.subtotalPence < document.commerce.minimumOrderPence;
  const estimatedTotal = review
    ? review.estimatedTotalPence
    : delivery.chargePence === null
      ? null
      : displayedBag.subtotalPence + delivery.chargePence;
  useEffect(() => () => controller.current?.abort(), []);

  function focusErrors() {
    requestAnimationFrame(() => errorRef.current?.focus());
  }
  function update(name: keyof CheckoutDetails, value: string) {
    setDetails((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setError("");
    setReviewState(null);
  }
  function field(
    name: Exclude<keyof CheckoutDetails, "country">,
    options: ComponentPropsWithoutRef<"input"> = {},
  ) {
    return (
      <TextField
        id={`checkout-${name}`}
        name={name}
        label={fieldNames[name].label}
        value={details[name]}
        onChange={(event) => update(name, event.target.value)}
        error={errors[name]}
        required={!["phone", "addressLine2"].includes(name)}
        {...options}
      />
    );
  }

  async function pay() {
    if (
      !review?.paymentAvailable ||
      !review.reviewFingerprint ||
      paymentPending.current ||
      preview
    )
      return;
    paymentPending.current = true;
    setOpeningPayment(true);
    setError("");
    if (paymentAttempt.current?.fingerprint !== review.reviewFingerprint)
      paymentAttempt.current = {
        fingerprint: review.reviewFingerprint,
        id: browserId(),
      };
    const paymentController = new AbortController();
    controller.current = paymentController;
    const deadline = requestDeadline(60000, paymentController.signal);
    try {
      const response = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: deadline.signal,
        body: JSON.stringify({
          details: review.details,
          shippingMethod: review.delivery.id,
          lines: checkoutRequestLines(review.bag),
          requestId: paymentAttempt.current.id,
          reviewFingerprint: review.reviewFingerprint,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          paymentAttempt.current = null;
          setReviewState(null);
          retry();
        }
        throw new Error(
          data.error || "We couldn't open test payment. Please try again.",
        );
      }
      const destination = new URL(data.url, window.location.origin);
      if (
        !(
          (destination.protocol === "https:" &&
            destination.hostname === "checkout.stripe.com") ||
          (destination.origin === window.location.origin &&
            destination.pathname === "/order-confirmation")
        )
      )
        throw new Error(
          "We couldn't verify the payment destination. Please try again.",
        );
      window.location.assign(destination.href);
    } catch (failure) {
      if (!paymentController.signal.aborted) {
        setError(
          failure instanceof Error &&
            !(failure instanceof TypeError) &&
            !["AbortError", "TimeoutError"].includes(failure.name)
            ? failure.message
            : "Payment took longer than expected to open. Retry to recover the same checkout; your bag is saved.",
        );
        focusErrors();
      }
    } finally {
      deadline.dispose();
      paymentPending.current = false;
      if (!paymentController.signal.aborted) setOpeningPayment(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || bagBusy || !ready || preview) return;
    setError("");
    const parsed = checkoutDetailsSchema.safeParse(details);
    if (!parsed.success) {
      const next: CheckoutFieldErrors = {};
      for (const issue of parsed.error.issues)
        next[issue.path[0] as keyof CheckoutDetails] ??= issue.message;
      setErrors(next);
      setError("Please check the highlighted details.");
      focusErrors();
      return;
    }
    if (hasIssues || belowMinimum || bagError) {
      setError("Please review your bag before continuing.");
      focusErrors();
      return;
    }
    pending.current = true;
    setBusy(true);
    setErrors({});
    const currentKey = key;
    const activeController = new AbortController();
    controller.current = activeController;
    const deadline = requestDeadline(20000, activeController.signal);
    try {
      const response = await fetch("/api/checkout/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: deadline.signal,
        body: JSON.stringify({
          details: parsed.data,
          shippingMethod: selectedMethod,
          lines: checkoutRequestLines(quote),
        }),
      });
      const result = await response.json();
      if (activeController.signal.aborted) return;
      if (!response.ok) {
        if (result.fields) setErrors(result.fields);
        if (response.status === 409) retry();
        throw new Error(
          result.error ||
            "We couldn't review your selection. Please try again.",
        );
      }
      if (currentKey !== keyRef.current)
        throw new Error(
          "Your selection changed while we were checking it. Please review again.",
        );
      setDetails(result.details);
      setReviewState({ value: result as CheckoutReview, key: currentKey });
      requestAnimationFrame(() => reviewHeading.current?.focus());
    } catch (failure) {
      if (!activeController.signal.aborted) {
        setError(
          failure instanceof Error &&
            !(failure instanceof TypeError) &&
            !["AbortError", "TimeoutError"].includes(failure.name)
            ? failure.message
            : "We couldn't check your selection. Your details are still here; please try again.",
        );
        focusErrors();
      }
    } finally {
      deadline.dispose();
      pending.current = false;
      if (!activeController.signal.aborted) setBusy(false);
    }
  }

  return (
    <div className="checkout-page container">
      <Link className="checkout-back" href="/bag">
        <ArrowLeft size={15} strokeWidth={1.3} aria-hidden="true" />
        <Copy text={"Back to your bag"} />
      </Link>
      <div className="checkout-heading">
        <div>
          <p className="eyebrow">
            <Copy text={"Your chosen pieces"} />
          </p>
          <h1>
            <Copy text={"Checkout."} />
          </h1>
        </div>
        <p>
          <Copy
            text={
              "A final look. A few details. Something beautiful to look forward to."
            }
          />
        </p>
      </div>
      <div className="checkout-preview">
        <span className="checkout-preview__label">
          <Copy text={testMode ? "Test checkout" : "Checkout preview"} />
        </span>
        <p>
          <Copy
            text={
              testMode
                ? "Test environment. No real money will be charged and no garments will be dispatched."
                : "Explore the checkout and review your details. Online payment is not available yet, and no order will be placed."
            }
          />
        </p>
      </div>
      <BagFeedback />
      {!ready ? (
        <p className="checkout-loading" role="status">
          <Copy text={"Preparing your selection…"} />
        </p>
      ) : !quote.lines.length ? (
        <BagEmpty />
      ) : (
        <>
          <ol className="checkout-progress" aria-label="Checkout progress">
            <li aria-current={!review ? "step" : undefined}>
              <span>
                {review ? <Check size={14} aria-hidden="true" /> : "01"}
              </span>
              <Copy text={"Contact & delivery"} />
            </li>
            <li aria-current={review ? "step" : undefined}>
              <span>02</span>
              <Copy text={"Review"} />
            </li>
            <li className="checkout-progress__pending">
              <span>03</span>
              <Copy text={"Payment"} />
            </li>
          </ol>
          <div className="checkout-layout">
            <div className="checkout-main">
              {(hasIssues || belowMinimum) && (
                <div className="checkout-notice" role="alert">
                  <p>
                    <Copy
                      text={
                        hasIssues
                          ? "An item in your bag is unavailable or its quantity has changed. Update your bag before continuing."
                          : "Your selection is below the minimum order value."
                      }
                    />
                    {belowMinimum && (
                      <>
                        {" "}
                        <Copy
                          text={formatGbp(document.commerce.minimumOrderPence)}
                        />
                      </>
                    )}
                  </p>
                  <Link href="/bag">
                    <Copy text={"Review your bag"} />
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              )}
              {error && (
                <div
                  className="checkout-error"
                  ref={errorRef}
                  role="alert"
                  tabIndex={-1}
                >
                  <p>
                    <Copy text={error} />
                  </p>
                  {Object.entries(errors).some(([, value]) => value) && (
                    <ul>
                      {Object.entries(errors)
                        .filter(([, value]) => value)
                        .map(([name, message]) => (
                          <li key={name}>
                            <a href={`#checkout-${name}`}>
                              <Copy
                                text={
                                  fieldNames[name as keyof CheckoutDetails]
                                    .label
                                }
                              />
                              : <Copy text={message} />
                            </a>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}
              {!review ? (
                <form
                  onSubmit={submit}
                  noValidate
                  aria-label="Contact and delivery details"
                >
                  {reviewState && (
                    <p className="checkout-stale" role="status">
                      <Copy
                        text={
                          "Your selection or store settings changed. Please review your details again."
                        }
                      />
                    </p>
                  )}
                  <fieldset
                    disabled={busy || preview}
                    className="checkout-fields"
                  >
                    <legend>
                      <Copy text={"Contact details"} />
                    </legend>
                    <p className="checkout-section-note">
                      <Copy
                        text={
                          "For your order updates and delivery information."
                        }
                      />
                    </p>
                    {field("email", {
                      type: "email",
                      autoComplete: "email",
                      inputMode: "email",
                      maxLength: 254,
                    })}
                    {field("phone", {
                      type: "tel",
                      autoComplete: "tel",
                      inputMode: "tel",
                      maxLength: 32,
                    })}
                  </fieldset>
                  <fieldset
                    disabled={busy || preview}
                    className="checkout-fields"
                  >
                    <legend>
                      <Copy text={"Delivery address"} />
                    </legend>
                    <div className="checkout-field-grid">
                      {field("firstName", {
                        autoComplete: "given-name",
                        maxLength: 80,
                      })}
                      {field("lastName", {
                        autoComplete: "family-name",
                        maxLength: 80,
                      })}
                    </div>
                    {field("addressLine1", {
                      autoComplete: "address-line1",
                      maxLength: 150,
                    })}
                    {field("addressLine2", {
                      autoComplete: "address-line2",
                      maxLength: 150,
                    })}
                    <div className="checkout-field-grid">
                      {field("city", {
                        autoComplete: "address-level2",
                        maxLength: 100,
                      })}
                      {field("postcode", {
                        autoComplete: "postal-code",
                        maxLength: 12,
                        autoCapitalize: "characters",
                      })}
                    </div>
                    <TextField
                      id="checkout-country"
                      label="Country"
                      value="United Kingdom"
                      readOnly
                      autoComplete="country-name"
                    />
                  </fieldset>
                  <fieldset
                    disabled={busy || preview}
                    className="checkout-fields checkout-delivery"
                  >
                    <legend>
                      <Copy text={"Delivery method"} />
                    </legend>
                    <p className="checkout-section-note">
                      <Copy text={"Delivered with Royal Mail."} />
                    </p>
                    {options.map((option) => (
                      <label
                        className="checkout-delivery-option"
                        key={option.id}
                      >
                        <input
                          type="radio"
                          name="deliveryMethod"
                          value={option.id}
                          checked={selectedMethod === option.id}
                          onChange={() => {
                            setMethod(option.id);
                            setReviewState(null);
                          }}
                        />
                        <span>
                          <strong>
                            <Copy text={option.label} />
                          </strong>
                          <small>
                            <Copy
                              text={
                                option.deliveryAim ||
                                "Delivery timing to be confirmed."
                              }
                            />
                          </small>
                        </span>
                        <span className="checkout-delivery-price">
                          <Copy
                            text={
                              option.chargePence === null
                                ? "To be confirmed"
                                : option.chargePence === 0
                                  ? "Complimentary"
                                  : formatGbp(option.chargePence)
                            }
                          />
                        </span>
                      </label>
                    ))}
                    {document.commerce.freeDeliveryEnabled && (
                      <p className="checkout-section-note">
                        <Copy
                          text={
                            "Complimentary standard UK delivery on orders of "
                          }
                        />
                        <Copy
                          text={formatGbp(
                            document.commerce.freeDeliveryThresholdPence,
                          )}
                        />
                        <Copy text={" or more."} />
                      </p>
                    )}
                  </fieldset>
                  <div className="checkout-form-actions">
                    <Button
                      type="submit"
                      disabled={
                        busy ||
                        bagBusy ||
                        hasIssues ||
                        belowMinimum ||
                        Boolean(bagError) ||
                        preview
                      }
                    >
                      <Copy
                        text={
                          busy
                            ? "Checking your selection…"
                            : "Review your details"
                        }
                      />
                      {busy ? (
                        <LoaderCircle
                          size={17}
                          className="checkout-spinner"
                          aria-hidden="true"
                        />
                      ) : (
                        <ArrowRight
                          size={17}
                          strokeWidth={1.3}
                          aria-hidden="true"
                        />
                      )}
                    </Button>
                    <p>
                      <Copy
                        text={
                          testMode
                            ? "Reviewing does not place an order. Continuing to test payment saves a private test order and sends the required checkout details to Stripe. Use test customer details."
                            : "Your details are used for this preview only and are not saved. Reviewing does not place an order or reserve stock."
                        }
                      />
                    </p>
                  </div>
                </form>
              ) : (
                <section
                  className="checkout-review"
                  aria-labelledby="checkout-review-title"
                >
                  <div className="checkout-review__heading">
                    <h2
                      id="checkout-review-title"
                      tabIndex={-1}
                      ref={reviewHeading}
                    >
                      <Copy text={"Everything, considered."} />
                    </h2>
                    <button
                      type="button"
                      className="checkout-edit"
                      disabled={openingPayment}
                      onClick={() => {
                        setReviewState(null);
                        requestAnimationFrame(() =>
                          window.document
                            .getElementById("checkout-email")
                            ?.focus(),
                        );
                      }}
                    >
                      <Copy text={"Edit details"} />
                    </button>
                  </div>
                  <div className="checkout-review__block">
                    <h3>
                      <Copy text={"Contact"} />
                    </h3>
                    <p>{review.details.email}</p>
                    {review.details.phone && <p>{review.details.phone}</p>}
                  </div>
                  <div className="checkout-review__block">
                    <h3>
                      <Copy text={"Deliver to"} />
                    </h3>
                    <address>
                      {review.details.firstName} {review.details.lastName}
                      <br />
                      {review.details.addressLine1}
                      <br />
                      {review.details.addressLine2 && (
                        <>
                          {review.details.addressLine2}
                          <br />
                        </>
                      )}
                      {review.details.city}
                      <br />
                      {review.details.postcode}
                      <br />
                      <Copy text={"United Kingdom"} />
                    </address>
                  </div>
                  <div className="checkout-review__block">
                    <h3>
                      <Copy text={"Delivery"} />
                    </h3>
                    <p>
                      <Copy text={review.delivery.label} /> ·{" "}
                      <Copy text={"Royal Mail"} />
                    </p>
                    <p>
                      <Copy
                        text={
                          review.delivery.deliveryAim ||
                          "Delivery timing to be confirmed."
                        }
                      />
                    </p>
                  </div>
                  <div className="checkout-payment">
                    <PackageCheck
                      size={23}
                      strokeWidth={1.2}
                      aria-hidden="true"
                    />
                    <h3>
                      <Copy
                        text={
                          review.delivery.chargePence === null
                            ? "Delivery pricing is being confirmed."
                            : review.paymentAvailable
                              ? "Your details are ready to review."
                              : "Payment is currently unavailable."
                        }
                      />
                    </h3>
                    <p>
                      <Copy
                        text={
                          review.paymentAvailable
                            ? "Continue to Stripe to test the enabled payment methods. Stock is reserved while the test checkout is open and released when it ends. No real money is charged."
                            : "Payment is not available yet. No order has been placed, no money has been taken and your pieces are not reserved."
                        }
                      />
                    </p>
                    {review.delivery.chargePence === null && (
                      <p>
                        <Copy
                          text={
                            "The delivery rate for your selection has not been set, so we cannot calculate a final total or open payment. Please contact us for delivery information."
                          }
                        />
                      </p>
                    )}
                    {review.mode === "test" && (
                      <p className="checkout-methods">
                        <Copy text={"Cards · Apple Pay · Klarna · Clearpay"} />
                        <br />
                        <Copy
                          text={
                            "Available options are shown by Stripe for the customer, device and order."
                          }
                        />
                      </p>
                    )}
                    <Button
                      disabled={!review.paymentAvailable || openingPayment}
                      onClick={() => {
                        void pay();
                      }}
                    >
                      <Copy
                        text={
                          openingPayment
                            ? "Opening Stripe…"
                            : review.paymentAvailable
                              ? "Continue to test payment"
                              : review.delivery.chargePence === null
                                ? "Delivery rate unavailable"
                                : "Payment unavailable"
                        }
                      />
                    </Button>
                    <Link href="/bag">
                      <Copy text={"Return to your bag"} />
                    </Link>
                  </div>
                </section>
              )}
            </div>
            <aside
              className="checkout-summary"
              aria-label="Order summary"
              aria-busy={busy || bagBusy}
            >
              <details className="checkout-summary__details" open>
                <summary>
                  <span>
                    <Copy text={"Your selection"} />
                  </span>
                  <span>
                    {selectionCount}{" "}
                    <Copy text={selectionCount === 1 ? "piece" : "pieces"} />
                  </span>
                </summary>
                <ul className="checkout-items">
                  {displayedBag.lines.map((line) => (
                    <li key={line.variantId}>
                      {line.piece && (
                        <>
                          <Link
                            className="checkout-item-photo"
                            href={`/collection/${line.piece.id}`}
                          >
                            <Image
                              src={line.piece.photo.src}
                              alt={line.piece.photo.alt}
                              fill
                              sizes="76px"
                            />
                          </Link>
                          <div>
                            <h3>
                              <Copy text={line.piece.name} />
                            </h3>
                            <p>
                              <Copy text={"Size "} />
                              {line.piece.size}
                              <span> · </span>
                              <Copy text={"Qty "} />
                              {line.quantity}
                            </p>
                            {line.issue && (
                              <p className="checkout-item-issue">
                                <Copy
                                  text={"Review availability in your bag."}
                                />
                              </p>
                            )}
                          </div>
                          <strong>
                            {formatGbp(line.piece.pricePence * line.quantity)}
                          </strong>
                        </>
                      )}
                      {!line.piece && (
                        <p>
                          <Copy
                            text={
                              "An unavailable piece needs checking in your bag."
                            }
                          />
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
              <dl className="checkout-totals">
                <div>
                  <dt>
                    <Copy text={"Subtotal"} />
                  </dt>
                  <dd>{formatGbp(displayedBag.subtotalPence)}</dd>
                </div>
                <div>
                  <dt>
                    <Copy text={"Delivery"} />
                  </dt>
                  <dd>
                    <Copy
                      text={
                        delivery.chargePence === null
                          ? "To be confirmed"
                          : delivery.chargePence === 0
                            ? "Complimentary"
                            : formatGbp(delivery.chargePence)
                      }
                    />
                  </dd>
                </div>
                <div>
                  <dt>
                    <Copy text={"Tax"} />
                  </dt>
                  <dd>
                    <Copy text={"To be confirmed"} />
                  </dd>
                </div>
                <div className="checkout-total">
                  <dt>
                    <Copy text={"Estimated total"} />
                    <small>GBP</small>
                  </dt>
                  <dd>
                    {estimatedTotal === null || hasIssues ? (
                      <Copy text={"To be confirmed"} />
                    ) : (
                      formatGbp(estimatedTotal)
                    )}
                  </dd>
                </div>
              </dl>
              <p className="checkout-estimate-note">
                <Copy
                  text={
                    "VAT treatment is being confirmed. Any amount shown is an estimate, not a final payable total."
                  }
                />
              </p>
              <div className="checkout-support">
                <Truck size={18} strokeWidth={1.3} aria-hidden="true" />
                <div>
                  <p>
                    <Copy text={"Thoughtful service, every step."} />
                  </p>
                  <Link href="/shipping-delivery">
                    <Copy text={"Delivery information"} />
                  </Link>
                  <Link href="/returns-exchanges">
                    <Copy text={"Returns & exchanges"} />
                  </Link>
                </div>
              </div>
              <p className="checkout-privacy">
                <Copy text={"Read our "} />
                <Link href="/privacy-policy">
                  <Copy text={"Privacy Policy"} />
                </Link>
                <Copy text={" and "} />
                <Link href="/terms-conditions">
                  <Copy text={"Terms & Conditions"} />
                </Link>
                <Copy text={"."} />
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
