import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { z } from "zod";

const root = fileURLToPath(new URL("../", import.meta.url));
const id = z.string().regex(/^design-[0-9]{2,4}$/);
const manifest = z.object({
  brand: z.literal("brand/logo.jpeg"),
  expectedDesignCount: z.number().int().positive(),
  heroIds: z.array(id),
  featuredIds: z.array(id),
  pieces: z.array(z.object({
    id,
    visualLabel: z.string().min(1),
    images: z.array(z.object({
      file: z.string().regex(/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.(?:jpe?g|png)$/i),
      view: z.enum(["front", "back", "detail", "alternate", "styled"]),
      label: z.string().min(1),
      alt: z.string().min(1),
    })).min(1),
  })).min(1),
}).parse(JSON.parse(await readFile(path.join(root, "assets/manifest.json"), "utf8")));

function within(relativePath) {
  const absolute = path.resolve(root, relativePath);
  if (!absolute.startsWith(root.endsWith(path.sep) ? root : root + path.sep)) {
    throw new Error("Media path must stay inside the project.");
  }
  return absolute;
}

const ids = manifest.pieces.map((piece) => piece.id);
if (new Set(ids).size !== ids.length) throw new Error("Duplicate design IDs in media manifest.");
for (const selected of [...manifest.heroIds, ...manifest.featuredIds]) {
  if (!ids.includes(selected)) throw new Error(`Unknown selected design: ${selected}`);
}

const inventory = [];
let originalBytes = 0;
let preparedBytes = 0;

async function prepare(source, destination, quality) {
  const input = await readFile(within(source));
  const output = within(destination);
  await mkdir(path.dirname(output), { recursive: true });
  // Preserve the originals. Public copies are oriented, sized for the web, and
  // encoded without EXIF/location metadata; no retouching or visual filters.
  const prepared = await sharp(input)
    .rotate()
    .resize({ width: 1800, height: 2200, fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
  const metadata = await sharp(prepared).metadata();
  if (metadata.exif || metadata.xmp) throw new Error("Public image still contains source metadata.");
  await writeFile(output, prepared);
  originalBytes += input.length;
  preparedBytes += prepared.length;
  inventory.push({
    source,
    sourceSha256: createHash("sha256").update(input).digest("hex"),
    output: destination,
    width: metadata.width,
    height: metadata.height,
    bytes: prepared.length,
  });
}

await prepare(`assets/source/${manifest.brand}`, "public/images/brand/logo.webp", 95);
const pieces = [];
for (const piece of manifest.pieces) {
  const photos = [];
  const views = new Set();
  for (const image of piece.images) {
    if (views.has(image.view)) throw new Error(`Duplicate view in ${piece.id}`);
    views.add(image.view);
    const src = `/images/products/${piece.id}/${image.view}.webp`;
    await prepare(`assets/source/products/${piece.id}/${image.file}`, `public${src}`, 88);
    photos.push({ src, label: image.label, alt: image.alt });
  }
  pieces.push({ id: piece.id, visualLabel: piece.visualLabel, photos });
}

await mkdir(within("src/data"), { recursive: true });
await writeFile(within("src/data/media.generated.json"), JSON.stringify({
  heroIds: manifest.heroIds,
  featuredIds: manifest.featuredIds,
  pieces,
}, null, 2) + "\n");
await writeFile(within("assets/media-inventory.json"), JSON.stringify({
  expectedDesignCount: manifest.expectedDesignCount,
  photographedDesignCount: pieces.length,
  images: inventory,
}, null, 2) + "\n");
console.log(`Prepared ${inventory.length} images across ${pieces.length} photographed designs.`);
console.log(`Public image bytes: ${preparedBytes}; source bytes: ${originalBytes}.`);
