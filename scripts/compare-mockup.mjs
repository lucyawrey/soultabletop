// Screenshots a mockup and the built page at the same sizes and puts each pair
// side by side, for checking UI work against an approved mockup (see
// `.claude/ui-mockups.md`, step 6). Needs `playwright-core` on NODE_PATH and a
// cached Chromium (`.claude/running-commands.md`, "Browser checks"):
//
//   NODE_PATH=<scratchpad>/node_modules node scripts/compare-mockup.mjs \
//     --mockup .claude/mockups/ui-redesign/frozen.html \
//     --mockup-click '[data-ctl="page"] [data-v="detail"]' --mockup-target .frame \
//     --site http://localhost:3005/systems/<id> --cookie "<Cookie header>" \
//     --size 1238x641 --size 390x844 --out <scratchpad>/compare --name system-detail
//
// --mockup-click may repeat (clicked in order); --mockup-target screenshots just
// that element of the mockup (e.g. the frozen redesign's `.frame`); --site-click
// does the same on the site; --cookie is a Cookie header value (`withSmokeUser`
// hands one out); --size repeats (default 1280x800 and 390x844); --full takes
// full-page screenshots. Writes <name>-<size>-mockup.png, -site.png, and
// -compare.png (the two side by side, labeled) to --out, and prints any console
// errors from either page.
import { createRequire } from "node:module";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  console.error("compare-mockup: playwright-core not found; install it in a scratchpad and set NODE_PATH (see .claude/running-commands.md).");
  process.exit(1);
}

const options = { mockupClick: [], siteClick: [], size: [] };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const key = args[i].replace(/^--/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  if (key === "full") options.full = true;
  else if (Array.isArray(options[key])) options[key].push(args[++i]);
  else options[key] = args[++i];
}
if (!options.mockup || !options.site || !options.out) {
  console.error("compare-mockup: --mockup, --site, and --out are required (see the header comment).");
  process.exit(1);
}
const mockupPath = resolve(options.mockup);
if (!existsSync(mockupPath)) {
  console.error(`compare-mockup: no mockup at ${mockupPath}`);
  process.exit(1);
}
const sizes = (options.size.length ? options.size : ["1280x800", "390x844"]).map((size) => {
  const [width, height] = size.split("x").map(Number);
  if (!width || !height) throw new Error(`compare-mockup: bad --size ${size} (use WIDTHxHEIGHT)`);
  return { label: size, width, height };
});
const name = options.name ?? "page";
mkdirSync(options.out, { recursive: true });

const browser = await chromium.launch();
const errors = [];

async function capture({ url, clicks, target, size, file, cookie }) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height } });
  if (cookie)
    await context.addCookies(
      cookie.split(/;\s*/).filter(Boolean).map((pair) => {
        const at = pair.indexOf("=");
        return { name: pair.slice(0, at), value: pair.slice(at + 1), url };
      }),
    );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`${file}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${file}: ${message.text()}`);
  });
  await page.goto(url, { waitUntil: "networkidle" });
  for (const selector of clicks) {
    await page.click(selector);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(400);
  const path = join(options.out, file);
  if (target) await page.locator(target).screenshot({ path });
  else await page.screenshot({ path, fullPage: !!options.full });
  await context.close();
  return path;
}

for (const size of sizes) {
  const base = `${name}-${size.label}`;
  const mockup = await capture({
    url: pathToFileURL(mockupPath).href,
    clicks: options.mockupClick,
    target: options.mockupTarget,
    size,
    file: `${base}-mockup.png`,
  });
  const site = await capture({
    url: options.site,
    clicks: options.siteClick,
    target: options.siteTarget,
    size,
    file: `${base}-site.png`,
    cookie: options.cookie,
  });
  // The pair side by side, each under its label, on a neutral background.
  // Inlined: a page made with setContent can't load file:// images.
  const inline = (path) => `data:image/png;base64,${readFileSync(path).toString("base64")}`;
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  await page.setContent(`<!doctype html><style>
    body { margin: 0; padding: 16px; background: #d9d6d0; font: 600 14px system-ui, sans-serif; color: #26231f; display: flex; gap: 16px; align-items: start; width: max-content; }
    figure { margin: 0; display: grid; gap: 6px; } img { display: block; outline: 1px solid #9a948a; }
  </style>
  <figure><figcaption>Mockup · ${size.label}</figcaption><img src="${inline(mockup)}"></figure>
  <figure><figcaption>Site · ${size.label}</figcaption><img src="${inline(site)}"></figure>`);
  await page.waitForLoadState("load");
  await page.screenshot({ path: join(options.out, `${base}-compare.png`), fullPage: true });
  await page.close();
  console.log(`compare-mockup: ${join(options.out, `${base}-compare.png`)}`);
}
await browser.close();
if (errors.length) console.log(`console errors:\n${[...new Set(errors)].join("\n")}`);
