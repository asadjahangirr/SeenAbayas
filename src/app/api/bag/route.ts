import { NextResponse, type NextRequest } from "next/server";
import { parseBagLines } from "@/lib/bag/model";
import { getBagState } from "@/lib/bag/server";
import { environment } from "@/lib/environment";

const responseHeaders = { "Cache-Control": "private, no-store" };
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: responseHeaders });

export async function POST(request: NextRequest) {
  // Same-origin, read-only endpoint. No cookie session or privileged key is used.
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return reply({ error: "Please refresh the page and try again." }, 403);
  const origin = request.headers.get("origin");
  // Next can normalize nextUrl's hostname to localhost. Compare the incoming host,
  // including its port, rather than that internal URL. No forwarded headers are trusted.
  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      if (
        !["http:", "https:"].includes(parsedOrigin.protocol) ||
        parsedOrigin.host !== request.headers.get("host")
      )
        return reply({ error: "Please refresh the page and try again." }, 403);
    } catch {
      return reply({ error: "Please refresh the page and try again." }, 403);
    }
  }
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    return reply({ error: "Invalid bag request." }, 415);
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
      if (bytes > 4096) {
        await reader.cancel();
        return reply({ error: "Invalid bag request." }, 413);
      }
      chunks.push(value);
    }
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return reply({ error: "Invalid bag request." }, 400);
    }
    if (
      !body ||
      typeof body !== "object" ||
      Object.keys(body).length !== 1 ||
      !("lines" in body)
    )
      return reply({ error: "Invalid bag request." }, 400);
    const lines = parseBagLines(body.lines);
    if (!lines) return reply({ error: "Invalid bag request." }, 400);
    if (lines.length && environment.catalog.source === "preview")
      return reply(
        {
          error:
            "This collection is not available to add to your bag yet. Please contact customer care.",
        },
        409,
      );
    return reply((await getBagState(lines)).quote);
  } catch {
    return reply(
      { error: "We couldn't check your bag. Please try again in a moment." },
      503,
    );
  }
}
