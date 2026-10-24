// node scripts/render.mjs          -> out/kicau-demo.mp4 + out/kicau-teaser.mp4
// node scripts/render.mjs --draft  -> out/kicau-demo-draft.mp4 (placeholders for missing recordings)
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("..", import.meta.url));
const draft = process.argv.includes("--draft");
if (!existsSync(`${cwd}public/audio/music-garden.wav`)) execFileSync("node", ["scripts/make-audio.mjs"], { cwd, stdio: "inherit" });

const jobs = draft ? [["KicauDemo", "out/kicau-demo-draft.mp4"]] : [["KicauDemo", "out/kicau-demo.mp4"], ["KicauTeaser", "out/kicau-teaser.mp4"]];
for (const [comp, out] of jobs) {
  // H.264 + yuv420p plays everywhere (X, WhatsApp, QuickTime). CRF 23 keeps ~2 min well under 50 MB.
  execFileSync("npx", ["remotion", "render", "src/Root.tsx", comp, out, "--codec=h264", "--pixel-format=yuv420p", "--crf=23", "--color-space=bt709", "--audio-codec=aac", "--concurrency=50%"], { cwd, stdio: "inherit", shell: true });
  const mb = statSync(cwd + out).size / 1e6;
  const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", cwd + out]).toString().trim();
  console.log(`${out}: ${(+dur).toFixed(1)} s, ${mb.toFixed(1)} MB${mb > 50 ? "  !! over 50 MB: raise --crf" : ""}`);
}
