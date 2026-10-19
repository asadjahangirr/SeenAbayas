import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const savedSource = path.resolve("assets/source/brand/seen-transparent.png");
const source = path.resolve(process.argv[2] || savedSource);
const bytes = await readFile(source);
const metadata = await sharp(bytes).metadata();
if (metadata.width !== 408 || metadata.height !== 612 || !metadata.hasAlpha) {
  throw new Error("Expected the supplied 408 × 612 transparent logo. Recheck the crop for different artwork.");
}
await mkdir(path.dirname(savedSource), { recursive: true });
if (source !== savedSource) await copyFile(source, savedSource);
await mkdir("public/images/brand", { recursive: true });
// Frame the supplied PNG inside the existing SVG brand system. The original
// pixels are preserved; the viewport excludes only the small bottom tagline.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="270" height="286" viewBox="0 0 270 286"><title>SEEN</title><image x="-70" y="-134" width="408" height="612" href="data:image/png;base64,${bytes.toString("base64")}"/></svg>`;
await writeFile("public/images/brand/seen-signature.svg", svg);
await mkdir("test-results/brand-review", { recursive: true });
const review = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="406"><rect width="390" height="406" fill="#f7f5f1"/><image x="60" y="60" width="270" height="286" href="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"/></svg>`;
await sharp(Buffer.from(review)).png().toFile("test-results/brand-review/signature.png");
console.log("Prepared the supplied emblem and SEEN signature without the bottom tagline. Original PNG preserved.");
