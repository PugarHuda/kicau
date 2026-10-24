// Playwright recorder: one real, clicked-through recording per scene -> public/recordings/<id>.mp4
//   node scripts/record.mjs garden                 # one scene
//   node scripts/record.mjs                        # all scenes in STORYBOARD order
//   node scripts/record.mjs contest-podium --podium=12 --bird=7 --photo=assets/murai.jpg --base=https://kicau-theta.vercel.app
// Actors (host/judge/owner/viewer) are persistent browser profiles in video/.profiles/<actor> so their
// Quick Play burners (and MON) survive between runs. Only the context passed `record: true` is filmed.
// Selectors are visible text/roles from the live UI on 24 Oct; re-check after the feature freeze.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = path.join(ROOT, "public", "recordings");
const PROFILES = path.join(ROOT, ".profiles");
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const BASE = arg("base", "https://kicau-theta.vercel.app");
const HEADED = process.argv.includes("--headed");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

// Visible cursor dot + click ripple (Playwright's mouse is invisible on video).
const CURSOR = `(() => {
  const css = document.createElement("style");
  css.textContent = "#__cur{position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border:3px solid #1e2a1f;background:#e8a33d;pointer-events:none;box-shadow:3px 3px 0 #1e2a1f;transition:transform .08s}" +
    ".__rip{position:fixed;z-index:2147483646;width:16px;height:16px;margin:-8px 0 0 -8px;border:4px solid #b5532a;pointer-events:none;animation:__r .5s ease-out forwards}" +
    "@keyframes __r{to{transform:scale(4);opacity:0}}";
  const dot = document.createElement("div"); dot.id = "__cur"; dot.style.left = "-50px";
  addEventListener("DOMContentLoaded", () => { document.head.append(css); document.body.append(dot); });
  addEventListener("mousemove", (e) => { dot.style.left = e.clientX + "px"; dot.style.top = e.clientY + "px"; }, true);
  addEventListener("mousedown", (e) => {
    dot.style.transform = "scale(.7)";
    const r = document.createElement("div"); r.className = "__rip"; r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px";
    document.body.append(r); setTimeout(() => r.remove(), 600);
  }, true);
  addEventListener("mouseup", () => (dot.style.transform = ""), true);
})();`;

const browsers = [];
/** Persistent context per actor. `record` films it at 1920x1080. */
async function actor(name, { record = false } = {}) {
  const tmp = path.join(OUT, `.raw-${name}`);
  if (record) rmSync(tmp, { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(path.join(PROFILES, name), {
    headless: !HEADED,
    viewport: { width: 1920, height: 1080 },
    ...(record && { recordVideo: { dir: tmp, size: { width: 1920, height: 1080 } } }),
  });
  browsers.push(ctx);
  await ctx.addInitScript(CURSOR);
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const t0 = Date.now();
  page.on("pageerror", (e) => console.warn(`[${name}] pageerror`, e.message));
  return { ctx, page, tmp, t0 };
}

/** Glide the visible cursor to the element, then click it. */
async function click(page, locator) {
  const el = typeof locator === "string" ? page.locator(locator).first() : locator.first();
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  if (!b) return el.click();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 25 });
  await sleep(150);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
const scrollTo = (page, sel) => page.locator(sel).first().evaluate((e) => e.scrollIntoView({ behavior: "smooth", block: "start" }));

/** Clicks, then waits for the status banner to show a NEW tx link (real confirmation). */
async function tx(page, label, act) {
  const banner = page.locator("[role=status]");
  const before = await banner.locator("a").first().getAttribute("href").catch(() => null);
  await act();
  for (const t0 = Date.now(); Date.now() - t0 < 60000; await sleep(250)) {
    const href = await banner.locator("a").first().getAttribute("href").catch(() => null);
    if (href && href !== before) return console.log(`  tx ${label}: ${href.split("/tx/")[1]} | ${(await banner.innerText()).replace(/\n/g, " ")}`);
  }
  throw new Error(`${label}: no confirmation in 60 s`);
}

/** Burner via ⚡ Quick Play (auto-funded by the faucet). No-op if this profile already has one. */
async function quickPlay(page) {
  const btn = page.locator("button:has-text('Quick Play')");
  if (await btn.count()) {
    await click(page, btn);
    await page.locator("header span[title^='0x']").waitFor({ timeout: 60000 });
  }
}

/** Stop filming, trim the page-load lead-in, convert webm -> H.264 mp4. */
async function save(a, id, leadMs) {
  const webm = await a.page.video().path();
  await a.ctx.close();
  const mp4 = path.join(OUT, `${id}.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", (leadMs / 1000).toFixed(2), "-i", webm, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30", "-an", mp4]);
  rmSync(a.tmp, { recursive: true, force: true });
  const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).toString().trim();
  console.log(`  -> ${path.relative(ROOT, mp4)} (${(+dur).toFixed(1)} s)`);
}
/** Marks "filming starts now" after setup; returns ms since the context opened (the trim point). */
const mark = (a) => Date.now() - a.t0;

// ---------------- scene recipes (same order + ids as src/scenes.ts) ----------------
const SCENES = {
  // Host (= judge) prepares a contest off-camera; the VIEWER context is filmed while the judge scores.
  async "contest-live"() {
    const host = await actor("host");
    await host.page.goto(`${BASE}/lomba`, { waitUntil: "networkidle" });
    await quickPlay(host.page);
    const name = `Piala Kicau Jogja ${new Date().toTimeString().slice(0, 5)}`;
    await host.page.fill("input[placeholder='Piala Kicau Jogja']", name);
    await host.page.fill("input[placeholder='Murai Batu']", "Murai Batu");
    await host.page.click("button:has-text('+ Add me')"); // host is the judge
    await tx(host.page, "createContest", () => host.page.click("button:has-text('Create contest')"));
    await host.page.locator("h1", { hasText: name }).waitFor({ timeout: 20000 });
    const cid = await host.page.evaluate(() => location.hash.slice(1));
    for (let i = 0; i < 3; i++) {
      await tx(host.page, `registerBird${i}`, () => host.page.click("button:has-text('Quick-register')"));
      await sleep(2000);
      await host.page.locator("button:has-text('Enter ·')").waitFor({ timeout: 20000 });
      await tx(host.page, `enter${i}`, () => host.page.click("button:has-text('Enter ·')"));
      await sleep(2000);
    }
    await tx(host.page, "startJudging", () => host.page.click("button:has-text('Start judging')"));
    await host.page.locator("h2:has-text('Judge panel')").waitFor({ timeout: 20000 });

    const v = await actor("viewer", { record: true });
    await v.page.goto(`${BASE}/lomba#${cid}`, { waitUntil: "networkidle" });
    await v.page.locator("h2:has-text('Live scoreboard')").waitFor({ timeout: 30000 });
    const lead = mark(v);
    await sleep(1500);
    await scrollTo(v.page, "h2:has-text('Live scoreboard')");
    await v.page.mouse.move(1400, 500, { steps: 20 });
    const cards = host.page.locator("section:has(h2:has-text('Judge panel')) div.border-\\[3px\\]");
    const vals = [[9, 8, 9, 10], [6, 7, 5, 6], [8, 9, 7, 8]];
    for (let c = 0; c < 3; c++) {
      const r = cards.nth(c).locator("input[type=range]");
      for (let k = 0; k < 4; k++) await r.nth(k).fill(String(vals[c][k]));
      await tx(host.page, `score${c}`, () => cards.nth(c).locator("button").click());
      await v.page.locator("text=updated in").waitFor({ timeout: 15000 }).catch(() => {});
      await sleep(3000); // let the viewer's board visibly re-rank
    }
    await sleep(2000);
    await save(v, "contest-live", lead);
    await host.ctx.close();
    console.log(`  contest #${cid} left in judging: finalize it LIVE on stage`);
  },

  // An already-finalized contest: share page with podium, prizes paid, attested titles.
  async "contest-podium"() {
    const id = arg("podium", "0");
    const v = await actor("viewer", { record: true });
    await v.page.goto(`${BASE}/lomba/${id}`, { waitUntil: "networkidle" });
    const lead = mark(v);
    await sleep(2500);
    await v.page.mouse.move(960, 500, { steps: 30 });
    await v.page.mouse.wheel(0, 500);
    await sleep(3500);
    const link = v.page.locator("a[href*='/tx/']").first();
    const lb = (await link.count()) && (await link.boundingBox());
    if (lb) await v.page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2, { steps: 25 });
    await sleep(4000);
    await save(v, "contest-podium", lead);
  },

  // Owner uploads a REAL bird photo -> AI species ID -> pixel sprite -> registerBird.
  async register() {
    const o = await actor("owner", { record: true });
    await o.page.goto(BASE, { waitUntil: "networkidle" });
    await quickPlay(o.page);
    const lead = mark(o);
    await click(o.page, "button:has-text('Register your real bird')");
    await o.page.locator("[role=dialog] input[type=file]").setInputFiles(path.resolve(ROOT, arg("photo", "assets/bird.jpg")));
    await o.page.locator("text=Identifying species with AI…").waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
    await sleep(2500); // hold on the species verdict + pixel sprite
    await o.page.locator("[role=dialog] input[placeholder='Si Jambul']").fill("Si Jambul");
    await tx(o.page, "registerBird", () => click(o.page, o.page.locator("[role=dialog] button", { hasText: /^Register$/ })));
    await sleep(2500);
    await save(o, "register", lead);
  },

  // Kicau Value chart + proof timeline that re-checks itself against the contract.
  async "kicau-value"() {
    const o = await actor("owner", { record: true });
    await o.page.goto(`${BASE}/lomba`, { waitUntil: "networkidle" });
    const lead = mark(o);
    await click(o.page, "button:has-text('Proof & dashboard')");
    await o.page.locator("[role=dialog] >> text=matches contract").waitFor({ timeout: 60000 }).catch(() => {});
    await o.page.mouse.move(900, 500, { steps: 30 });
    await sleep(3000);
    await o.page.mouse.wheel(0, 400);
    await sleep(4000);
    await save(o, "kicau-value", lead);
  },

  // Viewer sponsors a community bird (70/30) then adopts a species (30% conservation); LIVE KICAU in frame.
  async "sponsor-adopt"() {
    const v = await actor("viewer", { record: true });
    await v.page.goto(BASE, { waitUntil: "networkidle" });
    await quickPlay(v.page);
    const lead = mark(v);
    await click(v.page, v.page.locator("section:has(h2:has-text('Community Birds')) button"));
    await v.page.locator("[role=dialog] >> text=Support this bird").waitFor();
    await tx(v.page, "supportBird", () => click(v.page, v.page.locator("[role=dialog] button.btn-ghost", { hasText: "MON" })));
    await sleep(2000);
    await v.page.keyboard.press("Escape");
    await click(v.page, v.page.locator("section:has(h2:has-text('Shelter')) [role=button], section:has(h2:has-text('Shelter')) button"));
    await tx(v.page, "buy", () => click(v.page, "[role=dialog] button:has-text('Adopt NFT')"));
    await sleep(3000);
    await save(v, "sponsor-adopt", lead);
  },

  // Seeded run (startRun) -> fly -> Submit verified score -> daily/weekly boards + weekly pool.
  async flappy() {
    const v = await actor("viewer", { record: true });
    await v.page.goto(BASE, { waitUntil: "networkidle" });
    await quickPlay(v.page);
    const lead = mark(v);
    await click(v.page, "button:has-text('Fly')");
    await v.page.locator("canvas").first().waitFor({ timeout: 20000 });
    await sleep(800);
    await v.page.keyboard.press("Space");
    for (let i = 0; i < 18; i++) { await sleep(330); await v.page.keyboard.press("Space"); }
    await tx(v.page, "submitRun", async () => {
      await v.page.locator("button:has-text('Submit verified score')").waitFor({ timeout: 30000 });
      await click(v.page, "button:has-text('Submit verified score')");
    });
    await scrollTo(v.page, "h2:has-text('Leaderboard')");
    await sleep(1500);
    await click(v.page, "button:has-text('Daily')");
    await sleep(1500);
    await click(v.page, "button:has-text('Weekly')");
    await sleep(2500);
    await save(v, "flappy", lead);
  },

  // Open world: walk to the shelter yard, bump into a bird, its card opens. Read-only, no tx (dry-run scene).
  async garden() {
    const v = await actor("viewer", { record: true });
    await v.page.goto(`${BASE}/taman`, { waitUntil: "networkidle" });
    await sleep(3000); // tiles + sprites load (trimmed)
    const lead = mark(v);
    const hold = async (k, ms) => { await v.page.keyboard.down(k); await sleep(ms); await v.page.keyboard.up(k); };
    await hold("ArrowLeft", 1800);
    await hold("ArrowUp", 2200);
    outer: for (const d of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) {
      await v.page.keyboard.down(d);
      for (let t = 0; t < 6; t++) {
        await sleep(150);
        await v.page.keyboard.press("e");
        if (await v.page.locator("[role=dialog]").count()) { await v.page.keyboard.up(d); break outer; }
      }
      await v.page.keyboard.up(d);
    }
    await sleep(2500);
    await save(v, "garden", lead);
  },

  // x402 certificate (gasless USDC via Monad facilitator) then the verified mainnet contract.
  async proof() {
    const o = await actor("owner", { record: true });
    await o.page.goto(`${BASE}/lomba`, { waitUntil: "networkidle" });
    await quickPlay(o.page);
    const lead = mark(o);
    const [cert] = await Promise.all([
      o.ctx.waitForEvent("page", { timeout: 30000 }).catch(() => null),
      click(o.page, "button:has-text('Certificate')"),
    ]); // ponytail: burner needs testnet USDC for the $0.01 x402 payment; fund it once before recording
    if (cert) { await cert.waitForLoadState("networkidle"); await cert.bringToFront(); await sleep(3000); await cert.close(); }
    else await sleep(3000);
    await o.page.goto("https://monadvision.com/address/0xdada618e564edaf7ec0af0a12575bf3c0dc8523b?tab=Contract", { waitUntil: "domcontentloaded" });
    await sleep(3500);
    await save(o, "proof", lead);
  },
};

const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
for (const id of ids.length ? ids : Object.keys(SCENES)) {
  if (!SCENES[id]) throw new Error(`unknown scene ${id}; have: ${Object.keys(SCENES).join(", ")}`);
  console.log(`● ${id}`);
  try {
    await SCENES[id]();
  } catch (e) {
    console.error(`  ✗ ${id}: ${e.message}`);
    process.exitCode = 1;
  }
  for (const c of browsers.splice(0)) await c.close().catch(() => {});
}
for (const d of readdirSync(OUT)) if (d.startsWith(".raw-")) rmSync(path.join(OUT, d), { recursive: true, force: true });
