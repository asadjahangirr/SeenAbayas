import "server-only";
import { PaymentError } from "./model";

export function assertPaymentOrigin(request: Request) {
  try {
    const origin = new URL(request.headers.get("origin") || "");
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.host !== request.headers.get("host") ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      throw new Error();
  } catch {
    throw new PaymentError(
      "Refresh the page before continuing to payment.",
      403,
    );
  }
}
export async function readPaymentBody(
  request: Request,
  limit = 16384,
  raw = false,
) {
  if (
    !raw &&
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
      "application/json"
  )
    throw new PaymentError("Invalid payment request.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new PaymentError("Invalid payment request.", 400);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) {
      await reader.cancel();
      throw new PaymentError("Payment request is too large.", 413);
    }
    chunks.push(value);
  }
  const buffer = Buffer.concat(chunks);
  if (raw) return buffer;
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new PaymentError("Invalid payment request.", 400);
  }
}
