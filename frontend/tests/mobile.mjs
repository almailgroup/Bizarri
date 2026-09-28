/**
 * Every public page at phone width.
 *
 * Most visitors here are on a phone, so these are not edge cases: a link that
 * is 16px tall, text at 10px, or a page a few pixels too wide to fit are the
 * normal experience of the site, not a corner of it.
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

const NEWS = [
  {
    id: "n1",
    title_en: "Summer opening hours",
    title_ar: "مواعيد الصيف",
    body_en: "We are open through the summer with extended hours for all guests.",
    body_ar: "نحن مفتوحون",
    published: true,
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: "",
  },
];

async function phone(vp) {
  const ctx = await b.newContext({
    viewport: vp,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => {
    const u = r.request().url();
    if (/fonts\.(googleapis|gstatic)/.test(u)) return r.continue();
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
          name_ar: "شاليه بيزاري ١",
          active: true,
          sort_order: 1,
        },
        {
          id: 2,
          slug: "b2",
          name_en: "Bizarri Chalet 2",
          name_ar: "شاليه بيزاري ٢",
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
        min_stay_days: 3,
        updated_at: "",
        updated_by: null,
      });
    if (path === "news") return send(NEWS);
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

// A small Android and a typical iPhone. The narrow one is where layouts break.
for (const [name, vp] of [
  ["360px", { width: 360, height: 740 }],
  ["390px", { width: 390, height: 844 }],
]) {
  const ctx = await phone(vp);
  const p = await ctx.newPage();
  const overflowed = [];
  const smallTargets = [];
  const smallText = [];

  for (const route of ROUTES) {
    await p.goto(B + route, { waitUntil: "load" });
    await p.waitForTimeout(1000);
    const r = await p.evaluate(() => {
      const winW = window.innerWidth;
      const targets = [...document.querySelectorAll("button,a,input,select,textarea")]
        .map((el) => {
          const q = el.getBoundingClientRect();
          return {
            l: (el.getAttribute("aria-label") || el.textContent || el.type || "")
              .trim()
              .slice(0, 20),
            w: Math.round(q.width),
            h: Math.round(q.height),
          };
        })
        // WCAG 2.5.8 puts the floor at 24x24 for anything you have to hit.
        .filter((t) => t.w > 0 && t.h > 0 && (t.h < 24 || t.w < 24));
      const tiny = [...document.querySelectorAll("p,span,a,li,dd,dt,label,button,h1,h2,h3")]
        .filter((el) => el.textContent?.trim() && parseFloat(getComputedStyle(el).fontSize) < 12)
        .map(
          (el) =>
            `${parseFloat(getComputedStyle(el).fontSize)}px "${el.textContent.trim().slice(0, 16)}"`,
        );
      return {
        overflow: document.documentElement.scrollWidth - winW,
        targets,
        tiny: [...new Set(tiny)],
      };
    });
    if (r.overflow > 1) overflowed.push(`/${route || "home"} +${r.overflow}px`);
    if (r.targets.length)
      smallTargets.push(
        `/${route || "home"}: ${r.targets.map((t) => `${t.l} ${t.w}x${t.h}`).join(", ")}`,
      );
    if (r.tiny.length) smallText.push(`/${route || "home"}: ${r.tiny.join(", ")}`);
  }

  ck(`No page scrolls sideways at ${name}`, overflowed.length === 0, overflowed.join(" | "));
  ck(
    `Every tap target clears 24px at ${name}`,
    smallTargets.length === 0,
    smallTargets.join(" | "),
  );
  ck(`No text under 12px at ${name}`, smallText.length === 0, smallText.join(" | "));
  await ctx.close();
}

// ============================== hover must not latch on a touch screen
{
  const ctx = await phone({ width: 390, height: 844 });
  const p = await ctx.newPage();
  await p.goto(B + "contact", { waitUntil: "load" });
  await p.waitForTimeout(900);
  // Tailwind emits .hover:x:hover unguarded by default, and a touch device
  // has no pointer to move away — so the style sticks after the tap.
  const ungated = await p.evaluate(() => {
    let inside = 0;
    let total = 0;
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      // Recurse into anything that nests rules, not just @media: most of these
      // utilities sit inside @supports blocks, and skipping those hid all but
      // one rule from an earlier version of this check.
      const walk = (list, gated, reduced) => {
        for (const rule of list) {
          // Count first, then descend: with CSS nesting a plain style rule
          // also exposes cssRules, so an else-if here skipped every selector.
          if (rule.selectorText?.includes(":hover") && !reduced) {
            total++;
            if (gated) inside++;
          }
          if (rule.cssRules?.length) {
            const cond = rule.conditionText || rule.media?.mediaText || "";
            walk(
              rule.cssRules,
              gated || /hover\s*:\s*hover/.test(cond),
              // A prefers-reduced-motion block undoes a hover effect rather
              // than applying one, so it needs no pointer guard.
              reduced || /prefers-reduced-motion/.test(cond),
            );
          }
        }
      };
      walk(rules, false, false);
    }
    return { total, inside };
  });
  ck(
    "Hover styles only apply where there is a pointer",
    ungated.total > 0 && ungated.inside === ungated.total,
    `${ungated.inside}/${ungated.total} gated behind (hover: hover)`,
  );
  await ctx.close();
}

// ================== the fastest way to book is reachable without scrolling
{
  const ctx = await phone({ width: 390, height: 844 });
  const p = await ctx.newPage();
  await p.goto(B + "booking", { waitUntil: "load" });
  await p.waitForTimeout(1400);
  const top = await p.evaluate(() => {
    const quick = [...document.querySelectorAll("button")].find((x) =>
      /this weekend|نهاية هذا الأسبوع/i.test(x.textContent || ""),
    );
    return quick ? Math.round(quick.getBoundingClientRect().top) : null;
  });
  ck(
    "The one-tap weekend is on screen without scrolling",
    top !== null && top < 780,
    `top=${top}px of 844`,
  );
  await ctx.close();
}

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
