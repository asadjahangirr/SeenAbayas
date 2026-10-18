// Local browser-test HTTP fixture, not a Supabase replacement or application API.
// All synthetic merchandise stays in tests; it is never included in seed.sql.
import { createServer } from "node:http";

const rows = [
  {
    product_id: "10000000-0000-4000-8000-000000000001", design_reference: "design-01",
    name: "TEST ONLY Burgundy", description: "TEST ONLY confirmed description.", price_pence: 12345, currency: "GBP",
    variants: [
      { id: "20000000-0000-4000-8000-000000000001", size_label: "TEST S", available: true },
      { id: "20000000-0000-4000-8000-000000000002", size_label: "TEST M", available: false },
    ],
  },
  {
    product_id: "10000000-0000-4000-8000-000000000002", design_reference: "design-02",
    name: "TEST ONLY Botanical", description: "TEST ONLY second confirmed description.", price_pence: 9876, currency: "GBP",
    variants: [{ id: "20000000-0000-4000-8000-000000000003", size_label: "TEST L", available: true }],
  },
];
let state = "ready";
const server = createServer(async (request, response) => {
  const json = (status, value) => { response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); response.end(JSON.stringify(value)); };
  if (request.url === "/health") return json(200, { ready: true });
  if (request.headers.apikey !== "sb_publishable_TEST_ONLY") return json(403, {});
  if (request.method === "POST" && request.url === "/__test/state") {
    let body = "";
    for await (const chunk of request) { body += chunk; if (body.length > 200) return json(413, {}); }
    const value = JSON.parse(body).state;
    if (!["ready", "empty", "failure", "invalid"].includes(value)) return json(400, {});
    state = value;
    return json(200, { state });
  }
  if (request.method !== "POST" || request.url !== "/rest/v1/rpc/get_storefront_catalog") return json(404, {});
  if (state === "failure") return json(500, { message: "TEST ONLY private diagnostic DO NOT DISCLOSE" });
  if (state === "invalid") return json(200, [{ ...rows[0], on_hand: 999 }]);
  return json(200, state === "empty" ? [] : rows);
});
server.listen(3101, "127.0.0.1");
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close(() => process.exit(0)));
