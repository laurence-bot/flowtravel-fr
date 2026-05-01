// Render pipeline tolérant au sandbox (pas d'encodeur AAC dans ffmpeg local) :
// 1) Bundle Remotion + render vidéo MUETTE (codec h264, pas d'audio).
// 2) Construire une piste audio en concaténant audio-v3/s1..s10.aac via ffmpeg
//    (concat demuxer = copy stream, aucun ré-encodage AAC nécessaire).
// 3) Muxer vidéo+audio (-c copy) → MP4 final.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compId = process.argv[2] || "main-landscape";
const out = process.argv[3] || `/tmp/${compId}-video.mp4`;
const audioDir = path.resolve(__dirname, "../public/audio-v4");

// Durées scènes (frames @30fps) — doivent rester alignées avec MainVideo.tsx (v4)
const SCENE_DURATIONS_FRAMES = [195, 242, 365, 283, 320, 209, 382, 408, 397, 429];
const FPS = 30;

const tmpDir = fs.mkdtempSync("/tmp/rem-render-");
const silentVideo = path.join(tmpDir, "silent.mp4");
const concatList = path.join(tmpDir, "concat.txt");
const audioTrack = path.join(tmpDir, "audio.aac");

console.log(`[1/3] Bundle + render muet → ${silentVideo}`);
const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (c) => c,
});

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

const composition = await selectComposition({
  serveUrl: bundled,
  id: compId,
  puppeteerInstance: browser,
});

await renderMedia({
  composition,
  serveUrl: bundled,
  codec: "h264",
  outputLocation: silentVideo,
  puppeteerInstance: browser,
  concurrency: 1,
  muted: true, // ⚠️ contournement : aucun encodeur AAC dispo dans le sandbox
});

await browser.close({ silent: false });

console.log(`[2/3] Concat audio AAC (${SCENE_DURATIONS_FRAMES.length} segments)`);
// On utilise le concat demuxer (copy bitstream) — pas besoin d'encoder.
// Si un fichier manque, on tombe en silence sur sa durée via lavfi anullsrc serait possible
// mais ici on fait simple : on suppose s1..s10.aac présents.
const lines = SCENE_DURATIONS_FRAMES.map((_, i) => {
  const f = path.join(audioDir, `s${i + 1}.aac`);
  if (!fs.existsSync(f)) throw new Error(`Audio manquant: ${f}`);
  return `file '${f}'`;
}).join("\n");
fs.writeFileSync(concatList, lines);

execSync(`ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${audioTrack}"`, {
  stdio: "inherit",
});

console.log(`[3/3] Mux vidéo + audio → ${out}`);
// -shortest pour éviter un mismatch si l'audio dépasse la vidéo de quelques ms.
execSync(
  `ffmpeg -y -i "${silentVideo}" -i "${audioTrack}" -c:v copy -c:a copy -shortest "${out}"`,
  { stdio: "inherit" },
);

console.log("✅ Done:", out);
console.log(`Taille: ${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB`);
