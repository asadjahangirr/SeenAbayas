import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

if (!process.argv[2]) throw new Error("Usage: node scripts/prepare-hero-media.mjs <path-to-video.mp4>");
await import("./inspect-hero-video.mjs");
await mkdir("public/videos/home", { recursive: true });
await mkdir("public/images/home", { recursive: true });
const source = path.resolve(process.argv[2]);
const destination = path.resolve("public/videos/home/hero.mp4");
if (source !== destination) await copyFile(source, destination);
await sharp("test-results/hero-media/frame-1.png").webp({ quality: 88 }).toFile("public/images/home/hero-poster.webp");
const metadata = JSON.parse(await readFile("test-results/hero-media/metadata.json", "utf8"));
const bytes = await readFile(source);
await writeFile("assets/home-hero.json", JSON.stringify({
  sourceFile: path.basename(source), sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
  width: metadata.width, height: metadata.height, durationSeconds: metadata.duration,
  video: "/videos/home/hero.mp4", poster: "/images/home/hero-poster.webp",
}, null, 2) + "\n");
console.log("Prepared the permanent homepage video and poster. Source video unchanged.");
