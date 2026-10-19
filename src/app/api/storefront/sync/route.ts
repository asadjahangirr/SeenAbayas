import { NextResponse } from "next/server";
import { getStorefrontState } from "@/lib/storefront/server";

export async function GET(request: Request) {
  try {
    const { revision } = await getStorefrontState();
    const headers = {
      "Cache-Control": "private, no-store",
      ETag: `"${revision}"`,
    };
    if (request.headers.get("if-none-match") === headers.ETag)
      return new Response(null, { status: 304, headers });
    return NextResponse.json({ revision }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Store sync is temporarily unavailable." },
      {
        status: 503,
        headers: { "Cache-Control": "private, no-store", "Retry-After": "5" },
      },
    );
  }
}
