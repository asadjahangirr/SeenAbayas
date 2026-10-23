import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  requireAdmin,
  checkOrigin,
  readAdminBody,
  privateJson,
  adminFailure,
  AdminError,
} from "@/lib/admin/auth";
const filename = z.string().regex(/^[a-f0-9-]+\.(?:webp|jpg|png|mp4)$/);
export async function GET() {
  try {
    const { client, mainAdmin, permissions, permissionsReady } = await requireAdmin();
    if (permissionsReady && !mainAdmin && !["media","products","hero","content"].some(key => permissions.includes(key))) throw new AdminError("Media library access is not assigned to your account.", 403);
    const { data, error } = await client.storage.from("seen-media").list("", {
      limit: 1000,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error)
      throw new AdminError("Apply the media migration to enable uploads.", 503);
    return privateJson(
      data.map((f) => ({
        name: f.name,
        src: `/api/media/${f.name}`,
        size: f.metadata?.size,
        created_at: f.created_at,
        displayName: String(
          (f as typeof f & { user_metadata?: Record<string, unknown> })
            .user_metadata?.originalName ||
            f.metadata?.originalName ||
            f.name,
        ).slice(0, 180),
      })),
    );
  } catch (e) {
    return adminFailure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { client, mainAdmin, permissions, permissionsReady } = await requireAdmin();
    if (permissionsReady && !mainAdmin && !permissions.includes("media")) throw new AdminError("Media library access is not assigned to your account.", 403);
    const body = await readAdminBody(request);
    if (body.action === "sign") {
      const { type, size } = z
        .object({
          type: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4"]),
          size: z.number().int().min(1).max(26214400),
        })
        .parse(body);
      const extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "video/mp4": "mp4",
      }[type];
      const name = `${randomUUID()}.${extension}`;
      const result = await client.storage
        .from("seen-media")
        .createSignedUploadUrl(name);
      if (result.error)
        throw new AdminError(
          "Could not prepare the upload. Check storage permissions.",
          503,
        );
      return privateJson({
        name,
        src: `/api/media/${name}`,
        signedUrl: result.data.signedUrl,
        size,
      });
    }
    if (body.action === "delete") {
      const name = filename.parse(body.name);
      // Protect draft references too; Storage RLS additionally protects all published references.
      const snapshot = await client.rpc("admin_snapshot");
      if (snapshot.error)
        throw new AdminError("Could not check references.", 503);
      if (
        JSON.stringify(snapshot.data.site).includes(`/api/media/${name}`) ||
        JSON.stringify(snapshot.data.products).includes(`/api/media/${name}`)
      )
        throw new AdminError(
          "Remove this file from the site draft and products before deleting it.",
        );
      const result = await client.storage.from("seen-media").remove([name]);
      if (result.error || !result.data?.length)
        throw new AdminError(
          "The file is still in use by a draft, product or saved revision, or could not be removed.",
        );
      return privateJson({ success: true });
    }
    throw new AdminError("Unknown media action.");
  } catch (e) {
    if (e instanceof z.ZodError)
      return privateJson(
        { error: "Use a JPG, PNG, WebP or MP4 file up to 25 MB." },
        400,
      );
    return adminFailure(e);
  }
}
