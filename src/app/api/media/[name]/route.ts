import { createClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/admin/auth";
import { environment } from "@/lib/environment";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!/^[a-f0-9-]+\.(?:webp|jpg|png|mp4)$/.test(name))
    return new Response(null, { status: 404 });
  try {
    const url = environment.catalog.supabase?.url;
    const key = environment.catalog.supabase?.publishableKey;
    if (!url || !key) return new Response(null, { status: 404 });
    const publicClient = createClient(url, key, {
      auth: { persistSession: false },
    });
    const published = await publicClient.rpc("is_published_seen_media", {
      object_name: name,
    });
    const client = published.data === true ? publicClient : await adminClient();
    // Only published media or an authenticated administrator can obtain a signed URL.
    const signed = await client.storage
      .from("seen-media")
      .createSignedUrl(name, 60);
    if (signed.error || !signed.data)
      return new Response(null, {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      });
    const range = request.headers.get("range");
    if (range && !/^bytes=\d*-\d*$/.test(range))
      return new Response(null, { status: 416 });
    const media = await fetch(signed.data.signedUrl, {
      headers: range ? { Range: range } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!media.ok)
      return new Response(null, { status: media.status === 416 ? 416 : 404 });
    const extension = name.split(".").pop()!;
    const types: Record<string, string> = {
      jpg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      mp4: "video/mp4",
    };
    const headers = new Headers({
      "Content-Type": types[extension],
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Accept-Ranges": "bytes",
      "Content-Disposition": `inline; filename="${name}"`,
    });
    for (const h of ["content-length", "content-range"])
      if (media.headers.has(h)) headers.set(h, media.headers.get(h)!);
    return new Response(media.body, { status: media.status, headers });
  } catch {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
