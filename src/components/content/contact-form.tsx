"use client";
import { requestDeadline } from "@/lib/request-deadline";
import { browserId } from "@/lib/browser-id";
import { CmsAnchor } from "@/components/cms/anchor";

import { CmsInput, CmsTextarea } from "@/components/cms/input";

import { Copy } from "@/components/cms/content-provider";

import Script from "next/script";
import Link from "@/components/cms/link";
import { ArrowRight, Check } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { contactFieldsSchema, type ContactFields } from "@/lib/contact/model";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function ContactForm({
  siteKey,
  nonce,
}: {
  siteKey?: string;
  nonce?: string;
}) {
  const enabled = Boolean(siteKey);
  const [scriptReady, setScriptReady] = useState(false);
  const [token, setToken] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [errors, setErrors] = useState<
    Partial<Record<keyof ContactFields, string>>
  >({});
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const locked = useRef(false);
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const attempt = useRef<{
    fingerprint: string;
    requestId: string;
    submittedAt: string;
  } | null>(null);

  useEffect(() => {
    if (
      !scriptReady ||
      !siteKey ||
      !widget.current ||
      !window.turnstile ||
      sent
    )
      return;
    widgetId.current = window.turnstile.render(widget.current, {
      sitekey: siteKey,
      action: "contact",
      theme: "light",
      size: "flexible",
      callback: (value: string) => {
        setToken(value);
        setSecurityError("");
      },
      "expired-callback": () => setToken(""),
      "error-callback": () => {
        setToken("");
        setSecurityError(
          "The security check couldn't load. Please try again or email our team.",
        );
      },
    });
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [scriptReady, siteKey, sent]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (sent) receiptRef.current?.focus();
  }, [sent]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || locked.current) return;
    setError("");
    const form = event.currentTarget;
    const fields = new FormData(form);
    const parsed = contactFieldsSchema.safeParse(
      Object.fromEntries(
        ["name", "email", "phone", "message"].map((name) => [
          name,
          fields.get(name),
        ]),
      ),
    );
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof ContactFields, string>> = {};
      for (const issue of parsed.error.issues)
        nextErrors[issue.path[0] as keyof ContactFields] ||= issue.message;
      setErrors(nextErrors);
      const first = form.elements.namedItem(
        parsed.error.issues[0].path[0] as string,
      );
      if (first instanceof HTMLElement) first.focus();
      return;
    }
    setErrors({});
    if (!token) {
      setError(
        "Please complete the security check before sending your message.",
      );
      return;
    }
    locked.current = true;
    setSending(true);
    const fingerprint = JSON.stringify(parsed.data);
    if (!attempt.current || attempt.current.fingerprint !== fingerprint)
      attempt.current = {
        fingerprint,
        requestId: browserId(),
        submittedAt: new Date().toISOString(),
      };
    const deadline = requestDeadline(25000);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: deadline.signal,
        body: JSON.stringify({
          ...parsed.data,
          website: fields.get("website") || "",
          verificationToken: token,
          requestId: attempt.current.requestId,
          submittedAt: attempt.current.submittedAt,
        }),
      });
      const result = await response.json();
      if (!response.ok || result?.success !== true)
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "We couldn't send your message. Please try again or email our team.",
        );
      form.reset();
      attempt.current = null;
      setSent(true);
    } catch (problem) {
      setError(
        problem instanceof Error && problem.name === "Error"
          ? problem.message
          : "We couldn't confirm your message was sent. Please retry or email our team.",
      );
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    } finally {
      deadline.dispose();
      locked.current = false;
      setSending(false);
      setToken("");
    }
  }

  if (sent)
    return (
      <div
        className="contact-receipt"
        ref={receiptRef}
        tabIndex={-1}
        role="status"
      >
        <Check size={28} strokeWidth={1} aria-hidden="true" />
        <h2>
          <Copy text={"Thank you for"} />
          <br />
          <em>
            <Copy text={"getting in touch."} />
          </em>
        </h2>
        <p>
          <Copy
            text={
              "Thank you for contacting SEEN ABAYAS. Your message has been received."
            }
          />
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setSent(false);
            setError("");
          }}
        >
          <Copy text={"Send another message"} />
          <ArrowRight size={17} strokeWidth={1.3} aria-hidden="true" />
        </Button>
      </div>
    );

  return (
    <form
      className="contact-form"
      onSubmit={submit}
      noValidate
      aria-labelledby="contact-form-title"
      aria-busy={sending}
    >
      <h2 id="contact-form-title">
        <Copy text={"A note to SEEN."} />
      </h2>
      <p className="contact-form__note">
        <Copy text={"All fields are required."} />
      </p>
      {!enabled && (
        <p className="contact-form__notice" role="status">
          <Copy
            text={"Our contact form is currently unavailable. Please email "}
          />
          <CmsAnchor href="mailto:info@seenabayas.co.uk">
            <Copy text={"info@seenabayas.co.uk"} />
          </CmsAnchor>
          <Copy text={"."} />
        </p>
      )}
      <div className="contact-form__fields">
        <div className="contact-field">
          <label htmlFor="contact-name">
            <Copy text={"Name"} />
          </label>
          <CmsInput
            id="contact-name"
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={100}
            disabled={sending}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
          />
          {errors.name && (
            <span id="contact-name-error" className="contact-field__error">
              <Copy text={errors.name} />
            </span>
          )}
        </div>
        <div className="contact-field">
          <label htmlFor="contact-email">
            <Copy text={"Email"} />
          </label>
          <CmsInput
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            disabled={sending}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
          />
          {errors.email && (
            <span id="contact-email-error" className="contact-field__error">
              <Copy text={errors.email} />
            </span>
          )}
        </div>
        <div className="contact-field contact-field--wide">
          <label htmlFor="contact-phone">
            <Copy text={"Phone number"} />
          </label>
          <CmsInput
            id="contact-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            maxLength={40}
            disabled={sending}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "contact-phone-error" : undefined}
          />
          {errors.phone && (
            <span id="contact-phone-error" className="contact-field__error">
              <Copy text={errors.phone} />
            </span>
          )}
        </div>
        <div className="contact-field contact-field--wide">
          <label htmlFor="contact-message">
            <Copy text={"Message"} />
          </label>
          <CmsTextarea
            id="contact-message"
            name="message"
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            disabled={sending}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={
              errors.message ? "contact-message-error" : undefined
            }
          />
          {errors.message && (
            <span id="contact-message-error" className="contact-field__error">
              <Copy text={errors.message} />
            </span>
          )}
        </div>
      </div>
      <div className="contact-form__trap" aria-hidden="true">
        <label htmlFor="contact-website">
          <Copy text={"Leave this field empty"} />
        </label>
        <CmsInput
          id="contact-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          maxLength={200}
        />
      </div>
      <p className="contact-form__note">
        <Copy
          text={"Your details are used to respond to your enquiry. Read our "}
        />
        <Link href="/privacy-policy" className="contact-privacy-link">
          <Copy text={"Privacy Policy"} />
        </Link>
        <Copy
          text={
            ". Please avoid including payment card details or other sensitive information."
          }
        />
      </p>
      {enabled && (
        <>
          <Script
            id="contact-turnstile"
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            nonce={nonce}
            onReady={() => setScriptReady(true)}
            onError={() =>
              setSecurityError(
                "The security check couldn't load. Please try again or email our team.",
              )
            }
          />
          <div className="contact-form__verification" ref={widget} />
          {!scriptReady && !securityError && (
            <p className="contact-form__note" role="status">
              <Copy text={"Loading security check…"} />
            </p>
          )}
          {securityError && (
            <p className="contact-form__error" role="alert">
              <Copy text={securityError} />
            </p>
          )}
        </>
      )}
      {error && (
        <p
          className="contact-form__error"
          ref={errorRef}
          tabIndex={-1}
          role="alert"
        >
          <Copy text={error} />
        </p>
      )}
      <Button type="submit" disabled={!enabled || sending}>
        <Copy text={sending ? "Sending your message…" : "Send message"} />
        <ArrowRight size={17} strokeWidth={1.3} aria-hidden="true" />
      </Button>
      <noscript>
        <p className="contact-form__note">
          <Copy
            text={
              "Please enable JavaScript to use this form, or email info@seenabayas.co.uk."
            }
          />
        </p>
      </noscript>
    </form>
  );
}
