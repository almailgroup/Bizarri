/**
 * Every page opens at its top, however it is reached, and none of them
 * breaks.
 *
 * Rather than a list of links someone remembered to check, this collects
 * every internal link on every page -- header, footer, the phone menu, and
 * the links inside each page -- scrolls the page down, follows the link, and
 * checks the next page starts at the top. A link at the foot of a long page
 * landing the guest halfway down the next one is the bug this exists for: it
 * happened on the Offers page, from a cause nobody would have looked for.
 *
 * It also records anything a page throws while being opened, in either
 * language, so "works" means no errors as well as the right scroll.
 */
import { chromium } from "playwright";

const B = "http://localhost:4173/";
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

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = new Date();
today.setHours(0, 0, 0, 0);

const ROUTES = [
  "",
  "facilities",
  "photos",
  "offers",
  "booking",
  "reservation",
  "news",
  "contact",
  "rules",
  "about",
  "privacy",
];

async function context(viewport, mobile = false) {
  const ctx = await b.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => {
    const u = r.request().url();
    if (!SUPA.test(u)) return r.abort();
    const path = new URL(u).pathname.replace("/rest/v1/", "");
    let body = null;
    try {
      body = r.request().postDataJSON?.() ?? null;
    } catch {
      body = null;
    }
    const send = (d) =>
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
    if (path === "chalets")
      return send([
        {
          id: 1,
          slug: "b1",
          name_en: "Bizarri Chalet 1",
          name_ar: "شاليه بيزاري 1",
          active: true,
          sort_order: 1,
        },
        {
          id: 2,
          slug: "b2",
          name_en: "Bizarri Chalet 2",
          name_ar: "شاليه بيزاري 2",
          active: true,
          sort_order: 2,
        },
      ]);
    if (path === "rates")
      return send({
        id: true,
        full_week: 600,
        weekend: 350,
        weekday: 300,
        daily_weekday: 75,
        daily_weekend: 120,
        currency: "KWD",
        min_stay_days: 1,
        updated_at: "",
        updated_by: null,
      });
    if (path === "news")
      return send([
        {
          id: "n1",
          title_en: "Summer opening hours",
          title_ar: "مواعيد الصيف",
          body_en: "We are open through the summer.",
          body_ar: "نحن مفتوحون",
          published: true,
          published_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: "",
        },
      ]);
    if (path === "rpc/availability_calendar") {
      const out = [];
      const d = new Date(body.p_from + "T00:00:00");
      const e = new Date(body.p_to + "T00:00:00");
      for (; d <= e; d.setDate(d.getDate() + 1)) {
        const k = iso(d);
        out.push({ day: k, blocked: k < iso(today), price: 75, custom: false });
      }
      return send(out);
    }
    return send([]);
  });
  await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
  return ctx;
}

const pageUrl = (route, lang) => (route ? `${B}${route}/${lang}` : `${B}${lang}`);
const where = (u) => {
  const x = new URL(u);
  return x.pathname + x.search;
};

/** Every distinct internal link on a page, by href, with where it sits. */
async function linksOn(p) {
  return p.evaluate(() => {
    const out = new Map();
    for (const a of document.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/") || a.target === "_blank") continue;
      const r = a.getBoundingClientRect();
      if (!r.width || !r.height) continue; // not on screen at this width
      const zone = a.closest("header") ? "header" : a.closest("footer") ? "footer" : "page";
      const key = `${zone} ${href}`;
      if (!out.has(key))
        out.set(key, {
          href,
          zone,
          text: (a.textContent || a.getAttribute("aria-label") || "").trim().slice(0, 30),
        });
    }
    return [...out.values()];
  });
}

/**
 * Open `route`, scroll well down, follow the link to `href` found in `zone`,
 * and report where the next page started.
 */
async function follow(ctx, route, lang, link, viaMenu = false) {
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
  try {
    await p.goto(pageUrl(route, lang), { waitUntil: "load" });
    await p.waitForTimeout(700);
    await p.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }),
    );
    await p.waitForTimeout(250);
    if (viaMenu) {
      await p
        .getByRole("button", { name: /menu|القائمة/i })
        .first()
        .click();
      await p.waitForTimeout(400);
    }
    const scope = viaMenu
      ? p.locator('[role="dialog"]')
      : link.zone === "header"
        ? p.locator("header")
        : link.zone === "footer"
          ? p.locator("footer")
          : p.locator("main");
    const a = scope.locator(`a[href="${link.href}"]`).first();
    await a.scrollIntoViewIfNeeded();
    const before = await p.evaluate(() => Math.round(window.scrollY));
    const from = where(p.url());
    await a.click();
    await p.waitForTimeout(1100);
    const after = await p.evaluate(() => Math.round(window.scrollY));
    return { before, after, from, to: where(p.url()), errors };
  } finally {
    await p.close();
  }
}

/** Run the jobs a few at a time: one page each, so they cannot interfere. */
async function pool(jobs, n) {
  const results = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < jobs.length) {
        const job = jobs[i++];
        results.push(await job());
      }
    }),
  );
  return results;
}

// ======================================== every page loads, in both languages
{
  const ctx = await context({ width: 1280, height: 900 });
  const broken = [];
  for (const lang of ["en", "ar"]) {
    for (const route of ROUTES) {
      const p = await ctx.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
      await p.goto(pageUrl(route, lang), { waitUntil: "load" });
      await p.waitForTimeout(900);
      const ok = await p.evaluate(
        () =>
          !!document.querySelector("main h1, h1") &&
          !/not found|404/i.test(document.querySelector("h1")?.textContent ?? ""),
      );
      if (!ok || errors.length)
        broken.push(`/${route}/${lang}${errors.length ? ": " + errors[0] : ": no heading"}`);
      await p.close();
    }
  }
  ck("All 22 pages open with a heading and no errors", broken.length === 0, broken.join(" | "));
  await ctx.close();
}

// ============================ every link, from a scrolled-down page, desktop
for (const lang of ["en", "ar"]) {
  const ctx = await context({ width: 1280, height: 900 });
  const jobs = [];
  for (const route of ROUTES) {
    const p = await ctx.newPage();
    await p.goto(pageUrl(route, lang), { waitUntil: "load" });
    await p.waitForTimeout(700);
    const links = await linksOn(p);
    await p.close();
    // Header and footer are the same on every page: check them from a few
    // long pages, and every page's own links from that page.
    const longPage = ["", "photos", "booking", "offers"].includes(route);
    for (const link of links) {
      if (link.zone !== "page" && !longPage) continue;
      jobs.push(() => follow(ctx, route, lang, link).then((r) => ({ route, link, ...r })));
    }
  }
  const results = await pool(jobs, 6);
  const moved = results.filter((r) => r.to !== r.from);
  const notTop = moved.filter((r) => r.after !== 0);
  const errored = results.filter((r) => r.errors.length);
  const scrolledFirst = moved.filter((r) => r.before > 0).length;
  ck(
    `Desktop (${lang}): every link opens the next page at the top`,
    moved.length > 40 && notTop.length === 0,
    notTop.length
      ? notTop.map((r) => `${r.from} → ${r.to} (${r.link.zone}) at ${r.after}px`).join(" | ")
      : `${moved.length} links, ${scrolledFirst} of them clicked from part-way down a page`,
  );
  ck(
    `…with no errors on the way (${lang})`,
    errored.length === 0,
    errored.map((r) => `${r.from} → ${r.link.href}: ${r.errors[0]}`).join(" | "),
  );
  await ctx.close();
}

// ======================================================= phone, and its menu
for (const lang of ["en", "ar"]) {
  const ctx = await context({ width: 390, height: 844 }, true);
  const jobs = [];
  // The menu's links, from the foot of the home page.
  {
    const p = await ctx.newPage();
    await p.goto(pageUrl("", lang), { waitUntil: "load" });
    await p.waitForTimeout(700);
    await p
      .getByRole("button", { name: /menu|القائمة/i })
      .first()
      .click();
    await p.waitForTimeout(400);
    const menu = await p.evaluate(() =>
      [...document.querySelectorAll('[role="dialog"] a[href^="/"]')].map((a) =>
        a.getAttribute("href"),
      ),
    );
    await p.close();
    for (const href of [...new Set(menu)])
      jobs.push(() =>
        follow(ctx, "", lang, { href, zone: "menu" }, true).then((r) => ({
          route: "",
          link: { href, zone: "menu" },
          ...r,
        })),
      );
  }
  // Each page's own links, at phone width.
  for (const route of ROUTES) {
    const p = await ctx.newPage();
    await p.goto(pageUrl(route, lang), { waitUntil: "load" });
    await p.waitForTimeout(700);
    const links = (await linksOn(p)).filter((l) => l.zone === "page");
    await p.close();
    for (const link of links)
      jobs.push(() => follow(ctx, route, lang, link).then((r) => ({ route, link, ...r })));
  }
  const results = await pool(jobs, 6);
  const moved = results.filter((r) => r.to !== r.from);
  const notTop = moved.filter((r) => r.after !== 0);
  ck(
    `Phone (${lang}): the menu and every page's links open at the top`,
    moved.length >= 14 && notTop.length === 0,
    notTop.length
      ? notTop.map((r) => `${r.from} → ${r.to} (${r.link.zone}) at ${r.after}px`).join(" | ")
      : `${moved.length} links, ${moved.filter((r) => r.before > 0).length} clicked from part-way down`,
  );
  const errored = results.filter((r) => r.errors.length);
  ck(
    `…with no errors on the way (${lang}, phone)`,
    errored.length === 0,
    errored.map((r) => r.errors[0]).join(" | "),
  );
  await ctx.close();
}

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
