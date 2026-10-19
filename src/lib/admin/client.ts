"use client";
import { notifyStorefront } from "@/lib/storefront/notify";

export type LibraryFile = {
  name: string;
  src: string;
  size: number;
  created_at: string;
  displayName?: string;
};
export async function adminRequest(body: unknown, path = "/api/admin") {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== "/api/admin/auth")
      window.location.assign("/admin/login");
    throw new Error(result.error || "Request failed.");
  }
  if (path === "/api/admin") {
    const action = body as { action?: string; input?: { publish?: boolean } };
    if (
      action.action !== "restore" &&
      (action.action !== "site" || action.input?.publish)
    )
      notifyStorefront();
  }
  return result;
}
export async function uploadAdminFile(file: File) {
  if (!file.size || file.size > 25 * 1024 * 1024)
    throw new Error("Choose a file up to 25 MB.");
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const type = file.type;
  const valid =
    (type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216) ||
    (type === "image/png" && bytes[0] === 137 && bytes[1] === 80) ||
    (type === "image/webp" &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") ||
    (type === "video/mp4" &&
      String.fromCharCode(...bytes.slice(4, 8)) === "ftyp");
  if (!valid) throw new Error("Choose a valid JPG, PNG, WebP or MP4 file.");
  const signed = await adminRequest(
    { action: "sign", type, size: file.size },
    "/api/admin/media",
  );
  const metadata = new TextEncoder().encode(
    JSON.stringify({ originalName: file.name.slice(0, 180) }),
  );
  const response = await fetch(signed.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": type,
      "x-upsert": "false",
      "cache-control": "3600",
      "x-metadata": btoa(String.fromCharCode(...metadata)),
    },
    body: file,
  });
  if (!response.ok)
    throw new Error(
      "Upload failed. Check the 25 MB file limit and storage permissions.",
    );
  return signed.src as string;
}
