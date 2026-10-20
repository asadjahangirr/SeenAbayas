// Isolated test transport only. No real keys, hosted data or payment calls.
import http from "node:http";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { db, serial } from "./admin-fixture.mjs";
const stripe = new Stripe("sk_test_SEEN_LOCAL_FIXTURE_ONLY");
const sessions = new Map();
const idempotency = new Map();
let customerCount = 0;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:3108");
  const send = (value, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(value));
  };
  try {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    if (url.pathname === "/__test/reset") {
      sessions.clear();
      idempotency.clear();
      customerCount = 0;
      send({ ok: true });
      return;
    }
    if (url.pathname === "/__test/state") {
      const stock = await serial(() =>
        db.query(
          "select on_hand,reserved from seen_private.inventory i join public.product_variants v on v.id=i.variant_id join public.products p on p.id=v.product_id where p.design_reference='design-01'",
        ),
      );
      send({
        sessions: [...sessions.values()],
        stock: stock.rows,
        customers: customerCount,
      });
      return;
    }
    if (url.pathname === "/__test/event") {
      const change = JSON.parse(raw);
      const current = sessions.get(change.sessionId);
      if (!current) {
        send({ error: "Unknown test session" }, 404);
        return;
      }
      Object.assign(current, {
        status:
          change.state === "open"
            ? "open"
            : change.state === "expired"
              ? "expired"
              : "complete",
        payment_status: change.state === "paid" ? "paid" : "unpaid",
        payment_intent: "pi_test_fixture",
        ...change.overrides,
      });
      const type =
        change.type ||
        (change.state === "expired"
          ? "checkout.session.expired"
          : change.state === "failed"
            ? "checkout.session.async_payment_failed"
            : change.state === "paid"
              ? "checkout.session.async_payment_succeeded"
              : "checkout.session.completed");
      const body = JSON.stringify({
        id: change.eventId || `evt_${randomUUID().replaceAll("-", "")}`,
        object: "event",
        type,
        livemode: false,
        data: { object: current },
      });
      const signature = stripe.webhooks.generateTestHeaderString({
        payload: body,
        secret: change.badSignature
          ? "whsec_wrong"
          : "whsec_SEEN_LOCAL_FIXTURE_ONLY",
      });
      const response = await fetch(
        "http://127.0.0.1:3107/api/payments/stripe/webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Stripe-Signature": signature,
          },
          body,
        },
      );
      send({ status: response.status, result: await response.json() });
      return;
    }
    if (
      req.headers.authorization !== "Bearer sk_test_SEEN_LOCAL_FIXTURE_ONLY"
    ) {
      send({ error: { message: "Fixture credentials required" } }, 401);
      return;
    }
    const key = req.headers["idempotency-key"];
    if (key && idempotency.has(key)) {
      const previous = idempotency.get(key);
      if (previous.body !== raw) {
        send({ error: { message: "Changed idempotency parameters" } }, 400);
        return;
      }
      send(previous.value);
      return;
    }
    const body = new URLSearchParams(raw);
    let result;
    if (url.pathname === "/v1/customers" && req.method === "POST") {
      result = { id: `cus_test_${++customerCount}`, object: "customer" };
    }
    if (url.pathname === "/v1/checkout/sessions" && req.method === "POST") {
      if (
        body.getAll("allowed_payment_method_types[0]")[0] !== "card" ||
        body.get("allowed_payment_method_types[1]") !== "klarna" ||
        body.get("allowed_payment_method_types[2]") !== "afterpay_clearpay"
      )
        throw new Error("Missing payment allowlist");
      let total = Number(
        body.get(
          "shipping_options[0][shipping_rate_data][fixed_amount][amount]",
        ),
      );
      for (let i = 0; body.has(`line_items[${i}][quantity]`); i++)
        total +=
          Number(body.get(`line_items[${i}][quantity]`)) *
          Number(body.get(`line_items[${i}][price_data][unit_amount]`));
      const id = `cs_test_${randomUUID().replaceAll("-", "")}`;
      result = {
        id,
        object: "checkout.session",
        livemode: false,
        mode: "payment",
        currency: "gbp",
        amount_total: total,
        metadata: {
          order_id: body.get("metadata[order_id]"),
          request_hash: body.get("metadata[request_hash]"),
        },
        client_reference_id: body.get("client_reference_id"),
        url: `https://checkout.stripe.com/c/pay/${id}`,
        status: "open",
        payment_status: "unpaid",
        total_details: { amount_discount: 0, amount_tax: 0 },
        created: Math.floor(Date.now() / 1000),
        collected_information: {
          shipping_details: {
            name: "Test Shopper",
            address: {
              line1: "1 Example Street",
              line2: "",
              city: "London",
              postal_code: "SW1A 1AA",
              country: "GB",
            },
          },
        },
      };
      sessions.set(id, result);
    }
    if (url.pathname === "/v1/checkout/sessions" && req.method === "GET")
      result = {
        object: "list",
        data: [...sessions.values()],
        has_more: false,
      };
    const match = url.pathname.match(
      /^\/v1\/checkout\/sessions\/(cs_test_[a-z0-9]+)(\/expire)?$/,
    );
    if (match) {
      result = sessions.get(match[1]);
      if (match[2] && result?.status === "open")
        Object.assign(result, { status: "expired", url: null });
    }
    if (!result) {
      send({ error: { message: "Unknown test endpoint" } }, 404);
      return;
    }
    if (key) idempotency.set(key, { body: raw, value: result });
    send(result);
  } catch (error) {
    process.stderr.write(`Payment fixture error: ${error.message}\n`);
    send({ error: { message: "Fixture failed" } }, 500);
  }
});
server.listen(3108, "127.0.0.1", () =>
  process.stdout.write("Payment simulator ready on 3108\n"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close());
