import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

if (!process.argv[2]) throw new Error("Usage: node scripts/inspect-hero-video.mjs <path-to-video.mp4>");
const source = path.resolve(process.argv[2]);
const output = path.resolve("test-results/hero-media");
await mkdir(output, { recursive: true });
const bytes = await readFile(source);
const browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chromium" });
try {
  const page = await browser.newPage();
  await page.route("http://127.0.0.1:3199/**", async (route) => {
    if (new URL(route.request().url()).pathname === "/clip.mp4") {
      const range = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
      const start = range ? Number(range[1]) : 0;
      const end = range?.[2] ? Number(range[2]) : bytes.length - 1;
      await route.fulfill({ status: range ? 206 : 200, headers: { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", ...(range ? { "Content-Range": `bytes ${start}-${end}/${bytes.length}` } : {}) }, body: bytes.subarray(start, end + 1) });
    } else await route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="en"><title>Local film inspection</title><body><video muted playsinline preload="auto"></video></body></html>' });
  });
  await page.goto("http://127.0.0.1:3199/");
  const metadata = await page.evaluate(async (url) => {
    const video = document.querySelector("video");
    video.muted = true;
    await new Promise((resolve, reject) => {
      video.onloadeddata = resolve;
      video.onerror = () => reject(new Error(`Video decode failed: ${video.error?.code}`));
      video.src = url;
    });
    return { width: video.videoWidth, height: video.videoHeight, duration: video.duration };
  }, "http://127.0.0.1:3199/clip.mp4");
  for (const [index, fraction] of [0.02, 0.27, 0.52, 0.77].entries()) {
    const dataUrl = await page.evaluate(async (time) => {
      const video = document.querySelector("video");
      await new Promise((resolve) => { video.onseeked = resolve; video.currentTime = time; });
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1100 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    }, metadata.duration * fraction);
    await writeFile(path.join(output, `frame-${index + 1}.png`), Buffer.from(dataUrl.split(",")[1], "base64"));
  }
  const audioTrack = bytes.includes(Buffer.from("soun"));
  const result = { ...metadata, bytes: bytes.length, possibleAudioTrack: audioTrack };
  await writeFile(path.join(output, "metadata.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
