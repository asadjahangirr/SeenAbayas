import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { parseBagLines, summarizeBag } from "@/lib/bag/model";
import { createCatalogClient, getStorefrontCatalog } from "@/lib/catalog/server";
import { environment } from "@/lib/environment";
import { checkDevelopmentAvailability } from "@/lib/catalog/development";
import { getSiteDocument } from "@/lib/cms/server";

const responseHeaders = { "Cache-Control": "private, no-store" };
const availabilitySchema = z.array(z.object({ variant_id: z.uuid(), can_fulfil: z.boolean() }).strict());
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: responseHeaders });

export async function POST(request: NextRequest) {
  // Same-origin, read-only endpoint. No cookie session or privileged key is used.
  if (request.headers.get("sec-fetch-site") === "cross-site") return reply({ error: "Please refresh the page and try again." }, 403);
  const origin = request.headers.get("origin");
  // Next can normalize nextUrl's hostname to localhost. Compare the incoming host,
  // including its port, rather than that internal URL. No forwarded headers are trusted.
  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      if (!["http:", "https:"].includes(parsedOrigin.protocol) || parsedOrigin.host !== request.headers.get("host")) return reply({ error: "Please refresh the page and try again." }, 403);
    } catch { return reply({ error: "Please refresh the page and try again." }, 403); }
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply({ error: "Invalid bag request." }, 415);
  try {
    // Bound the streamed body as well as Content-Length to avoid unbounded JSON parsing.
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Invalid bag request." }, 400);
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) { await reader.cancel(); return reply({ error: "Invalid bag request." }, 413); }
      chunks.push(value);
    }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return reply({ error: "Invalid bag request." }, 400); }
    if (!body || typeof body !== "object" || Object.keys(body).length !== 1 || !("lines" in body)) return reply({ error: "Invalid bag request." }, 400);
    const lines = parseBagLines(body.lines);
    if (!lines) return reply({ error: "Invalid bag request." }, 400);
    const delivery = (await getSiteDocument()).commerce;
    if (lines.length === 0) return reply(summarizeBag([], delivery));
    if (environment.catalog.source === "preview") return reply({ error: "This collection is not available to add to your bag yet. Please contact customer care." }, 409);
    const pieces = await getStorefrontCatalog();
    const { data, error } = environment.catalog.source === "development"
      ? { data: checkDevelopmentAvailability(lines), error: null }
      : await createCatalogClient().rpc("check_bag_availability", {
      requested_lines: lines.map((line) => ({ variant_id: line.variantId, quantity: line.quantity })),
    });
    const parsed = availabilitySchema.safeParse(data);
    if (error || !parsed.success || parsed.data.length !== lines.length) throw new Error("Bag unavailable");
    const availability = new Map(parsed.data.map((row) => [row.variant_id, row.can_fulfil]));
    if (availability.size !== lines.length || lines.some((line) => !availability.has(line.variantId))) throw new Error("Bag unavailable");
    return reply(summarizeBag(lines.map((line) => {
      const piece = pieces.find((item) => item.commerce?.variants.some((variant) => variant.id === line.variantId));
      const variant = piece?.commerce?.variants.find((item) => item.id === line.variantId);
      if (!piece?.commerce || !variant) return { ...line, piece: null, issue: "unavailable" as const };
      return { ...line, piece: { id: piece.id, name: piece.visualLabel, size: variant.sizeLabel, pricePence: piece.commerce.pricePence, photo: piece.photos[0] },
        issue: !variant.available ? "unavailable" as const : !availability.get(line.variantId) ? "insufficient-stock" as const : null };
    }), delivery));
  } catch {
    return reply({ error: "We couldn't check your bag. Please try again in a moment." }, 503);
  }
}
