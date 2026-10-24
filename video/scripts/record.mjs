// Playwright recorder: one real, clicked-through recording per scene -> public/recordings/<id>.mp4
//   node scripts/record.mjs garden                 # one scene
//   node scripts/record.mjs                        # all scenes in STORYBOARD order
//   node scripts/record.mjs proof --podium=12 --photo=assets/murai.jpg --base=https://kicau.xyz
// Actors (host/entrantN/owner/viewer) are persistent browser profiles in video/.profiles/<actor> so their
// Quick Play burners (and MON) survive between runs. Only the context passed `record: true` is filmed.
// Selectors are visible text/roles from the live UI on 24 Oct (post-freeze UI).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = path.join(ROOT, "public", "recordings");
const PROFILES = path.join(ROOT, ".profiles");
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const BASE = arg("base", "https://kicau.xyz");
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

const TXS = [];
/** Clicks, then waits for the status banner to show a NEW tx link (real confirmation). Retries on transient RPC errors. */
async function tx(page, label, act, tries = 3) {
  const banner = page.locator("[role=status]");
  const before = await banner.locator("a[href*='/tx/']").first().getAttribute("href", { timeout: 500 }).catch(() => null);
  await act();
  for (const t0 = Date.now(); Date.now() - t0 < 90000; await sleep(250)) {
    const href = await banner.locator("a[href*='/tx/']").first().getAttribute("href", { timeout: 500 }).catch(() => null);
    if (href && href !== before) {
      const hash = href.split("/tx/")[1];
      TXS.push(`${label} ${hash}`);
      console.log(`  tx ${label}: ${hash} | ${(await banner.first().innerText()).replace(/\n/g, " ")}`);
      await sleep(2500); // space txs
      return hash;
    }
    const err = await banner.locator(".text-clay").first().innerText({ timeout: 300 }).catch(() => "");
    if (err) {
      console.warn(`  ! ${label}: ${err.slice(0, 160)}`);
      await page.locator("[role=status] button[aria-label=Dismiss], [role=status] button[aria-label=Close]").first().click({ timeout: 2000 }).catch(() => {});
      if (tries > 1) { await sleep(4000); return tx(page, label, act, tries - 1); }
      throw new Error(`${label}: ${err}`);
    }
  }
  throw new Error(`${label}: no confirmation in 90 s`);
}

/** Burner via ⚡ Quick Play (auto-funded by the faucet). No-op if this profile already has one. */
async function quickPlay(page) {
  const btn = page.locator("button:has-text('Quick Play')").first();
  await sleep(1500);
  if (await btn.isVisible().catch(() => false)) {
    await click(page, btn);
    await page.locator("button[title='Leave Quick Play'], header span[title^='0x']").first().waitFor({ timeout: 90000 });
    await sleep(3000); // faucet tx lands
  }
}

/** Stop filming, cut [id, startMs, endMs?] segments out of the webm, convert to H.264 mp4. */
async function save(a, id, leadMs, segs) {
  const webm = await a.page.video().path();
  await a.ctx.close();
  for (const [sid, from, to] of segs ?? [[id, leadMs]]) {
    const mp4 = path.join(OUT, `${sid}.mp4`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", (from / 1000).toFixed(2), ...(to ? ["-to", (to / 1000).toFixed(2)] : []), "-i", webm, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30", "-an", mp4]);
    const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).toString().trim();
    console.log(`  -> ${path.relative(ROOT, mp4)} (${(+dur).toFixed(1)} s)`);
  }
  rmSync(a.tmp, { recursive: true, force: true });
}
/** Marks "filming starts now" after setup; returns ms since the context opened (the trim point). */
const mark = (a) => Date.now() - a.t0;

// ---------------- scene recipes (same order + ids as src/scenes.ts) ----------------
const typeSlow = async (page, loc, text) => { await click(page, loc); await page.keyboard.type(text, { delay: 60 }); };
const dialogFile = (page) => page.locator("[role=dialog] input[type=file]").first();

const SCENES = {
  // Fresh contest: host (= its judge) + 3 entrant burners off camera; the VIEWER is filmed while the judge scores
  // (contest-live), then while the host finalizes (contest-podium). Never touches contest #0.
  async "contest-live"() {
    const host = await actor("host");
    host.page.on("dialog", (d) => d.accept());
    await host.page.goto(`${BASE}/lomba`, { waitUntil: "networkidle" });
    await quickPlay(host.page);
    const name = arg("name", "Piala Murai Blitz Jogja");
    await host.page.fill("input[placeholder='Piala Kicau Jogja']", name);
    await host.page.click("button:has-text('+ Add me')");
    await tx(host.page, "createContest", () => host.page.click("button:has-text('Create contest')"));
    await host.page.waitForFunction(() => location.hash.length > 1, null, { timeout: 30000 });
    const cid = await host.page.evaluate(() => location.hash.slice(1));
    console.log(`  fresh contest #${cid}`);
    for (let i = 1; i <= 3; i++) {
      const e = await actor(`entrant${i}`);
      await e.page.goto(`${BASE}/lomba#${cid}`, { waitUntil: "networkidle" });
      await quickPlay(e.page);
      await e.page.locator("h2:has-text('Enter your bird')").waitFor({ timeout: 30000 });
      await sleep(2000);
      if (!(await e.page.locator("button:has-text('Enter ·')").count()))
        await tx(e.page, `quickRegister${i}`, () => e.page.click("button:has-text('Quick-register')"));
      await e.page.locator("button:has-text('Enter ·'):enabled").waitFor({ timeout: 30000 });
      await tx(e.page, `enter${i}`, () => e.page.click("button:has-text('Enter ·')"));
      await e.ctx.close();
    }
    await host.page.reload({ waitUntil: "networkidle" });
    await host.page.locator("button:has-text('Start judging'):enabled:not(:has-text('needs'))").waitFor({ timeout: 40000 });
    await tx(host.page, "startJudging", () => host.page.click("button:has-text('Start judging')"));
    await host.page.locator("h2:has-text('Judge panel')").waitFor({ timeout: 30000 });

    const v = await actor("viewer", { record: true });
    await v.page.goto(`${BASE}/lomba#${cid}`, { waitUntil: "networkidle" });
    await v.page.locator("h2:has-text('Live scoreboard')").waitFor({ timeout: 30000 });
    await sleep(3000);
    const lead = mark(v);
    await sleep(1200);
    await scrollTo(v.page, "h2:has-text('Live scoreboard')");
    await v.page.mouse.move(1150, 480, { steps: 25 });
    const cards = host.page.locator("section:has(h2:has-text('Judge panel')) div.border-\\[3px\\]");
    const vals = [[6, 7, 5, 6], [9, 8, 9, 10], [8, 9, 7, 8]]; // 2nd bird overtakes -> visible re-rank
    const scoreAt = [];
    for (let c = 0; c < 3; c++) {
      const r = cards.nth(c).locator("input[type=range]");
      for (let k = 0; k < 4; k++) await r.nth(k).fill(String(vals[c][k]));
      scoreAt.push(mark(v) - lead);
      await tx(host.page, `score${c}`, () => cards.nth(c).locator("button").click());
      await v.page.locator("text=updated in").waitFor({ timeout: 15000 }).catch(() => {});
      await sleep(1500);
    }
    await sleep(1500);
    const liveEnd = mark(v);
    // podium: finalize on the host, the viewer sees Results appear
    await v.page.evaluate(() => scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(800);
    const podStart = mark(v);
    await tx(host.page, "finalize", () => host.page.click("button:has-text('Finalize & pay out')"));
    await v.page.locator("h2:has-text('Results')").waitFor({ timeout: 30000 });
    await sleep(800);
    await scrollTo(v.page, "h2:has-text('Results')");
    await sleep(2000);
    const pay = v.page.locator("section:has(h2:has-text('Results')) a").first();
    const pb = await pay.boundingBox().catch(() => null);
    if (pb) await v.page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2, { steps: 25 });
    await sleep(4000);
    const podEnd = mark(v);
    console.log(`  score tx sent at (s from live start): ${scoreAt.map((x) => (x / 1000).toFixed(1)).join(", ")}; podium starts ${((podStart - lead) / 1000).toFixed(1)}`);
    await save(v, "", 0, [["contest-live", lead, liveEnd], ["contest-podium", podStart, podEnd]]);
    await host.ctx.close();
    console.log(`  CONTEST_ID=${cid} (finalized)`);
  },

  // Owner uploads a REAL bird photo -> AI species ID -> pixel sprite -> registerBird (optional fields left empty).
  async register() {
    const o = await actor("owner", { record: true });
    await o.page.goto(BASE, { waitUntil: "networkidle" });
    await quickPlay(o.page);
    await o.page.evaluate(() => scrollTo(0, 0));
    await sleep(1000);
    const lead = mark(o);
    await click(o.page, "button:has-text('Register your bird')");
    await sleep(800);
    await dialogFile(o.page).setInputFiles(path.resolve(ROOT, arg("photo", "assets/bird.jpg")));
    await o.page.locator("[role=dialog] >> text=confidence").first().waitFor({ timeout: 60000 }).catch(() => console.warn("  ! no AI species result"));
    console.log("  species:", (await o.page.locator("[role=dialog] label:has-text('Species')").first().innerText().catch(() => "?")).replace(/\n/g, " | "));
    await sleep(2500);
    await typeSlow(o.page, o.page.locator("[role=dialog] input[placeholder='Si Jambul']"), "Si Jambul");
    await sleep(500);
    await tx(o.page, "registerBird", () => click(o.page, o.page.locator("[role=dialog] button", { hasText: /^Register$/ })));
    await sleep(1500);
    await save(o, "register", lead);
  },

  // Owner view: species, Kicau Value + USD, value chart, proof timeline that re-checks itself against the contract.
  async "kicau-value"() {
    const o = await actor("owner", { record: true });
    await o.page.goto(BASE, { waitUntil: "networkidle" });
    await o.page.locator("section:has(h2:has-text('My Birds')) button:has-text('Manage')").first().waitFor({ timeout: 60000 });
    await scrollTo(o.page, "h2:has-text('My Birds')");
    await sleep(1500);
    const lead = mark(o);
    await click(o.page, o.page.locator("section:has(h2:has-text('My Birds')) button:has-text('Manage')").last());
    await o.page.locator("[role=dialog] >> text=matches contract").first().waitFor({ timeout: 60000 }).catch(() => console.warn("  ! no 'matches contract'"));
    await sleep(800);
    await o.page.mouse.move(960, 520, { steps: 30 });
    await sleep(2500);
    for (let i = 0; i < 4; i++) { await o.page.mouse.wheel(0, 180); await sleep(700); }
    await sleep(3000);
    await save(o, "kicau-value", lead);
  },

  // Viewer opens Kenari in the Kicau Garden scene, supports it (100% conservation) and adopts the NFT.
  async "sponsor-adopt"() {
    const v = await actor("fan", { record: true });
    await v.page.goto(BASE, { waitUntil: "networkidle" });
    await quickPlay(v.page);
    await scrollTo(v.page, "h2:has-text('Kicau Garden')");
    await sleep(2500);
    const lead = mark(v);
    await click(v.page, v.page.locator("button[aria-label^='Kenari']"));
    await v.page.locator("[role=dialog] button:has-text('Adopt NFT')").waitFor();
    await sleep(1200);
    await tx(v.page, "support", () => click(v.page, v.page.locator("[role=dialog] button.btn-ghost", { hasText: /MON$/ })));
    await tx(v.page, "adopt", () => click(v.page, "[role=dialog] button:has-text('Adopt NFT')"));
    await sleep(1500);
    await save(v, "sponsor-adopt", lead);
  },

  // Seeded run (startRun) -> fly -> Submit score on-chain (verified) -> Daily / Weekly / All-time boards + weekly pool.
  async flappy() {
    const v = await actor("fan", { record: true });
    await v.page.goto(BASE, { waitUntil: "networkidle" });
    const fly = v.page.locator("section:has(h2:has-text('My Birds')) button:has-text('Fly')").first();
    await fly.waitFor({ timeout: 60000 });
    await scrollTo(v.page, "h2:has-text('My Birds')");
    await sleep(1500);
    const lead = mark(v);
    await tx(v.page, "startRun", () => click(v.page, fly));
    await v.page.locator("[role=dialog] canvas").first().waitFor({ timeout: 20000 });
    await sleep(700);
    const submit = v.page.locator("[role=dialog] button:has-text('Submit score on-chain')");
    for (let i = 0; i < 60 && !(await submit.count()); i++) { await v.page.keyboard.press("Space"); await sleep(i < 2 ? 250 : 360); }
    await submit.waitFor({ timeout: 30000 });
    await sleep(1000);
    await tx(v.page, "submitRun", () => click(v.page, submit));
    await sleep(800);
    await v.page.keyboard.press("Escape");
    await scrollTo(v.page, "h2:has-text('Leaderboard')");
    await sleep(1500);
    for (const t of ["Daily", "Weekly", "All-time"]) { await click(v.page, v.page.locator(`button:text-is('${t}')`)); await sleep(1600); }
    await sleep(1000);
    await save(v, "flappy", lead);
  },

  // Open world: walk to the shelter yard, bump into a bird, its card opens. Read-only, no tx.
  async garden() {
    const v = await actor("viewer", { record: true });
    await v.page.goto(`${BASE}/taman`, { waitUntil: "networkidle" });
    await sleep(3000);
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

  // Shareable server-rendered result page of the finalized contest, then the verified mainnet contract.
  async proof() {
    const id = arg("podium", "0");
    const v = await actor("viewer", { record: true });
    await v.page.goto(`${BASE}/lomba/${id}`, { waitUntil: "networkidle" });
    await sleep(1000);
    const lead = mark(v);
    await v.page.mouse.move(960, 500, { steps: 30 });
    await sleep(2500);
    await v.page.mouse.wheel(0, 400);
    await sleep(2000);
    await v.page.goto("https://monadvision.com/address/0xdada618e564edaf7ec0af0a12575bf3c0dc8523b?tab=Contract", { waitUntil: "domcontentloaded" });
    await sleep(4500);
    await save(v, "proof", lead);
  },
  // Read-only: testnet header toggle -> same path on mainnet, home stats, then contest #0 (Judging) on mainnet.
  async mainnet() {
    const v = await actor("viewer", { record: true });
    await v.page.goto(BASE, { waitUntil: "networkidle" });
    await sleep(2000);
    const lead = mark(v);
    await v.page.mouse.move(900, 300, { steps: 20 });
    await click(v.page, v.page.locator("header a:text-is('mainnet')"));
    await v.page.waitForURL(/mainnet\.kicau\.xyz/, { timeout: 30000 });
    await v.page.waitForLoadState("networkidle").catch(() => {});
    await sleep(2500);
    await v.page.mouse.wheel(0, 500);
    await sleep(1500);
    await v.page.goto("https://mainnet.kicau.xyz/lomba/0", { waitUntil: "networkidle" });
    await v.page.mouse.move(960, 450, { steps: 25 });
    await sleep(3000);
    await save(v, "mainnet", lead);
  },

  // Off camera: owner registers a bird with a demo certificate + lineage. Filmed: /me dashboard, then its pedigree.
  async dashboard() {
    const o = await actor("owner", { record: true });
    const name = arg("pedname", "Si Silsilah");
    if (!process.argv.includes("--noreg")) {
      await o.page.goto(BASE, { waitUntil: "networkidle" });
      await quickPlay(o.page);
      await o.page.click("button:has-text('Register your bird')");
      await sleep(800);
      await dialogFile(o.page).setInputFiles(path.resolve(ROOT, arg("photo", "assets/bird.jpg")));
      await o.page.locator("[role=dialog] >> text=confidence").first().waitFor({ timeout: 60000 }).catch(() => console.warn("  ! no AI species result"));
      await o.page.fill("[role=dialog] input[placeholder='Si Jambul']", name);
      const d = o.page.locator("[role=dialog]");
      await d.locator("button:has-text('+ Add certificate')").click();
      await d.locator("input[placeholder='Penangkar / BKSDA / PBI']").fill("Penangkar Demo");
      await d.locator("input[placeholder='ring / permit no.']").fill("DEMO-001");
      await d.locator("input[type=date]").first().fill("2025-06-01");
      await d.locator("input[type=file]").nth(1).setInputFiles(path.resolve(ROOT, "assets/CREDITS.txt"));
      await d.locator("summary:has-text('Add lineage')").click();
      await d.getByLabel("Sire (father) name").fill("Demo Jantan");
      await d.getByLabel("Sire ring").fill("DEMO-S01");
      await d.getByLabel("Dam (mother) name").fill("Demo Betina");
      await d.getByLabel("Dam ring").fill("DEMO-D01");
      await d.getByLabel("Breeder (penangkar)").fill("Penangkar Demo");
      await sleep(500);
      await tx(o.page, "registerPedigree", () => d.locator("button", { hasText: /^Register$/ }).click());
      await sleep(3000);
    }
    await o.page.goto(BASE, { waitUntil: "networkidle" });
    await sleep(2500);
    const lead = mark(o);
    await click(o.page, o.page.locator("a[href='/me']"));
    await o.page.locator("h2:has-text('My registered birds')").waitFor({ timeout: 30000 });
    await sleep(3500);
    await o.page.mouse.move(700, 500, { steps: 25 });
    for (let i = 0; i < 5; i++) { await o.page.mouse.wheel(0, 260); await sleep(600); }
    await sleep(800);
    const dashEnd = mark(o);
    // pedigree
    await o.page.evaluate(() => scrollTo({ top: 0 }));
    await sleep(600);
    const pedStart = mark(o);
    const idx = await o.page.evaluate((nm) => {
      const bs = [...document.querySelectorAll("button")].filter((b) => b.textContent.includes("Open profile"));
      return Math.max(0, bs.findIndex((b) => { let e = b; for (let i = 0; i < 6 && e; i++, e = e.parentElement) if (e.textContent.includes(nm)) return !e.textContent.includes("Si Jambul"); return false; }));
    }, name);
    console.log("  open profile idx", idx);
    const target = o.page.locator("button:has-text('Open profile')").nth(idx);
    await click(o.page, target);
    await o.page.locator("[role=dialog], .fixed").first().waitFor({ timeout: 10000 }).catch(() => {});
    await sleep(1200);
    const cert = o.page.locator("text=Certificates (self-declared").first();
    await cert.evaluate((e) => e.scrollIntoView({ behavior: "smooth", block: "start" }), null, { timeout: 5000 }).catch(() => console.warn("  ! no certificates"));
    await sleep(2200);
    await o.page.locator("text=Check a document").first().evaluate((e) => e.scrollIntoView({ behavior: "smooth", block: "center" }), null, { timeout: 5000 }).catch(() => console.warn("  ! no check-a-document"));
    await sleep(3000);
    const pedEnd = mark(o);
    await save(o, "", 0, [["dashboard", lead, dashEnd], ["pedigree", pedStart, pedEnd]]);
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
console.log("TXS\n" + TXS.join("\n"));
// ponytail: each save() removes its own .raw dir; no global sweep (parallel runs share OUT)
