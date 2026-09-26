/**
 * The logo has to stay readable on every surface it sits on.
 *
 * The site has no theme toggle, but it does have dark surfaces — the homepage
 * hero, the footer, the mobile menu and the whole dashboard — plus a .dark
 * palette that is defined and could be switched on later. A single-variant
 * logo fails on half of those, so each placement is checked by measuring the
 * rendered pixels rather than by trusting which file was picked.
 */
import { chromium } from "playwright";
import { PNG } from "pngjs";

const B = "http://localhost:4173/Bizarri/";
const SUPA = /ycfvqzcnatwacwlcmiej\.supabase\.co/;
const b = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
    : {},
);
let fails = 0;
const ck = (n, c, d = "") => {
  if (!c) fails++;
  console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`);
};

const session = () => ({
  access_token: "t",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "r",
  user: {
    id: "admin-1",
    aud: "authenticated",
    role: "authenticated",
    email: "admin@example.com",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  },
});

async function newCtx(viewport = { width: 1280, height: 900 }) {
  const ctx = await b.newContext({ viewport });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => {
    const u = r.request().url();
    if (SUPA.test(u)) return r.fallback();
    if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return r.continue();
    return r.abort();
  });
  await ctx.route(SUPA, async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace("/rest/v1/", "").replace("/auth/v1/", "auth:");
    const send = (d) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
    if (p.startsWith("auth:token")) return send(session());
    if (p.startsWith("auth:user")) return send(session().user);
    if (p === "rpc/is_admin") return send(true);
    if (p === "chalets")
      return send([
        { id: 1, slug: "b1", name_en: "Bizarri Chalet 1", name_ar: "ش١", active: true, sort_order: 1 },
      ]);
    return send([]);
  });
  await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
  return ctx;
}

/**
 * Screenshot just the logo and measure it. A logo that matches its background
 * — white ink on white, dark ink on dark — collapses the luminance spread,
 * which is exactly the failure this is looking for.
 */
async function contrastOf(page, locator) {
  const buf = await locator.screenshot();
  const png = PNG.sync.read(buf);
  const lum = [];
  for (let i = 0; i < png.data.length; i += 4) {
    const [r, g, bl] = [png.data[i], png.data[i + 1], png.data[i + 2]];
    lum.push(0.2126 * r + 0.7152 * g + 0.0722 * bl);
  }
  lum.sort((x, y) => x - y);
  // Percentiles, not min/max: a single stray pixel should not decide this.
  const p = (q) => lum[Math.floor((lum.length - 1) * q)];
  const dark = p(0.05);
  const light = p(0.95);
  // WCAG contrast ratio between the two clusters.
  const rel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const ratio = (rel(light) + 0.05) / (rel(dark) + 0.05);
  return { dark: Math.round(dark), light: Math.round(light), ratio: Number(ratio.toFixed(2)) };
}

const MIN_RATIO = 4.5;

async function check(label, page, locator) {
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const box = await locator.boundingBox();
  const c = await contrastOf(page, locator);
  ck(
    `${label} is legible against its background`,
    c.ratio >= MIN_RATIO,
    `contrast ${c.ratio}:1 (ink/bg ${c.dark}–${c.light}), ${Math.round(box.width)}×${Math.round(box.height)}`,
  );
  return { ...c, box };
}

// ============================================================ light surfaces
{
  const ctx = await newCtx();
  const p = await ctx.newPage();
  // An inner page: plain white background, so the dark-ink variant must win.
  await p.goto(B + "contact", { waitUntil: "load" });
  await p.waitForTimeout(900);
  const header = p.locator("header img:visible").first();
  const c = await check("Header logo on a light page", p, header);
  ck("…and it is the dark-ink variant", c.dark < 90, `darkest ${c.dark}`);
  ck(
    "…rendered large enough to read the wordmark",
    c.box.height >= 40,
    `${Math.round(c.box.height)}px tall`,
  );
  await ctx.close();
}

// ======================================================== dark surfaces
{
  const ctx = await newCtx();
  const p = await ctx.newPage();
  await p.goto(B, { waitUntil: "load" });
  await p.waitForTimeout(1200);

  // The header sits transparently over the dark hero photo before scrolling.
  await check("Header logo over the hero photo", p, p.locator("header img:visible").first());
  // The hero wordmark itself.
  await check("Hero wordmark", p, p.locator("h1 img").first());
  // Footer, on black.
  await check("Footer logo", p, p.locator("footer img").first());

  // Once scrolled, the header takes its solid light background and must swap
  // to the dark-ink variant.
  await p.evaluate(() => window.scrollTo(0, 600));
  await p.waitForTimeout(700);
  const scrolled = await check("Header logo after scrolling onto white", p, p.locator("header img:visible").first());
  ck("…swaps to the dark-ink variant", scrolled.dark < 90, `darkest ${scrolled.dark}`);
  await ctx.close();
}

// ==================================================== mobile menu overlay
{
  const ctx = await newCtx({ width: 390, height: 844 });
  const p = await ctx.newPage();
  await p.goto(B + "contact", { waitUntil: "load" });
  await p.waitForTimeout(900);
  await p.getByRole("button", { name: /menu/i }).first().click();
  await p.waitForTimeout(500);
  await check("Logo in the full-screen menu", p, p.locator('[role="dialog"] img').first());
  await ctx.close();
}

// ============================================================== dashboard
{
  const ctx = await newCtx();
  const p = await ctx.newPage();
  await p.goto(B + "admin", { waitUntil: "load" });
  await p.waitForTimeout(900);
  await check("Logo on the admin sign-in", p, p.locator("form img").first());

  await p.locator("input[type=email]").fill("admin@example.com");
  await p.locator("input[type=password]").fill("pw");
  await p.getByRole("button", { name: /^Login$/i }).click();
  await p.waitForTimeout(1200);
  await check("Logo in the dashboard header", p, p.locator("header img:visible").first());
  await ctx.close();
}

// ================================================ forced .dark colour scheme
{
  const ctx = await newCtx();
  const p = await ctx.newPage();
  // Nothing toggles .dark today, but the palette exists; if it is ever turned
  // on, the header must not render dark ink on a dark page.
  //
  // The class is set after load, not in an init script: an init script runs
  // against the pre-parse document, and the parser then replaces <html> with
  // its own attributes, silently dropping the class — which made this whole
  // block pass against a page that was still in light mode.
  await p.goto(B + "contact", { waitUntil: "load" });
  await p.waitForTimeout(800);
  await p.evaluate(() => document.documentElement.classList.add("dark"));
  await p.waitForTimeout(600);

  ck(
    "The .dark class survives on the document",
    await p.evaluate(() => document.documentElement.classList.contains("dark")),
  );
  // Measure the colour rather than matching its text form: the computed value
  // comes back as oklch() here, so a regex for "255,255,255" never matched
  // white and the check passed on a light page.
  const bgLum = await p.evaluate(() => {
    const el = document.createElement("div");
    el.style.cssText = "width:10px;height:10px;position:fixed;top:0;left:0;z-index:-1";
    el.style.backgroundColor = getComputedStyle(document.body).backgroundColor;
    document.body.append(el);
    const c = getComputedStyle(el).backgroundColor;
    el.remove();
    const m = c.match(/\d+(\.\d+)?/g).map(Number);
    return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
  });
  ck("The .dark palette actually applies", bgLum < 60, `background luminance ${Math.round(bgLum)}`);
  const c = await check("Header logo in dark mode", p, p.locator("header img:visible").first());
  ck("…and it is the light-ink variant", c.light > 170, `lightest ${c.light}`);
  await ctx.close();
}

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
