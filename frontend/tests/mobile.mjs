/**
 * Every public page at phone width.
 *
 * Most visitors here are on a phone, so these are not edge cases: a link that
 * is 16px tall, text at 10px, or a page a few pixels too wide to fit are the
 * normal experience of the site, not a corner of it.
 */
import { chromium } from "playwright";

// The language is the last segment, so a page URL is pageUrl(route).
const LANG = "en";
const B = "http://localhost:4173/";
const pageUrl = (r) => (r ? `${B}${r}/${LANG}` : `${B}${LANG}`);
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

// An address or a number can carry more than one stay, and the two statuses
// are the two a guest actually sees.
const FOUND = [
  {
    ref: "BZR-4K2M9X",
    status: "accepted",
    chalet_id: 1,
    start_date: "2026-10-08",
    end_date: "2026-10-10",
    days: 3,
    total: 350,
  },
  {
    ref: "BZR-7Q1P3D",
    status: "pending",
    chalet_id: 1,
    start_date: "2026-11-12",
    end_date: "2026-11-18",
    days: 7,
    total: 600,
  },
];

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
    if (path.startsWith("rpc/lookup_booking")) return send(FOUND);
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
    await p.goto(pageUrl(route), { waitUntil: "load" });
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
  await p.goto(pageUrl("contact"), { waitUntil: "load" });
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

// ======================= the calendar is the page, so it has to fit the phone
for (const [name, vp] of [
  ["360px", { width: 360, height: 740 }],
  ["390px", { width: 390, height: 844 }],
]) {
  const ctx = await phone(vp);
  const p = await ctx.newPage();
  await p.goto(B + "booking/en", { waitUntil: "load" });
  await p.waitForTimeout(1400);

  const cell = await p.locator('[role="grid"] button').nth(20).boundingBox();
  // Above the 24px floor everything must clear, because this is the control
  // the page exists for and it is tapped over and over.
  ck(
    `Day cells are thumb-sized at ${name}`,
    !!cell && cell.width >= 40 && cell.height >= 40,
    cell ? `${Math.round(cell.width)}x${Math.round(cell.height)}` : "no cell",
  );

  // "September 2026" wrapped to two lines at 360px and pushed the arrows out
  // of line with each other.
  const month = await p.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    const label = grid?.getAttribute("aria-label") ?? "";
    const el = [...document.querySelectorAll("p")].find(
      (n) => n.textContent.trim() === label && label !== "",
    );
    if (!el) return null;
    const line = parseFloat(getComputedStyle(el).lineHeight) || 0;
    return { h: Math.round(el.getBoundingClientRect().height), line: Math.round(line) };
  });
  ck(
    `The month sits on one line at ${name}`,
    !!month && month.line > 0 && month.h <= month.line + 2,
    month ? `${month.h}px tall, one line is ${month.line}px` : "no month label",
  );

  // The grid must not be wider than the box drawn around it.
  const fits = await p.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    if (!grid) return null;
    return Math.round(grid.getBoundingClientRect().right - document.documentElement.clientWidth);
  });
  ck(
    `The calendar stays inside the screen at ${name}`,
    fits !== null && fits <= 0,
    `${fits}px past the edge`,
  );

  await ctx.close();
}

// ============================ what a phone actually has to download
{
  // A budget, not a measurement. Page weight creeps back one asset at a
  // time, and nothing else here would notice: the layout of a 2 MB page is
  // identical to the layout of a 400 KB one.
  //
  // Sizes are over the wire, so text is counted gzipped the way the host
  // serves it. A decoded byte count reads roughly three times too high for
  // JavaScript and would send you optimising the wrong thing.
  const BUDGET = { en: 450, "booking/en": 330, "photos/en": 600 };
  const ctx = await phone({ width: 390, height: 844 });

  for (const [route, kb] of Object.entries(BUDGET)) {
    const p = await ctx.newPage();
    const pending = [];
    p.on("response", (r) => {
      if (!r.url().startsWith(B)) return;
      pending.push(
        r
          .request()
          .sizes()
          .then((z) => ({ wire: z.responseBodySize, type: r.request().resourceType() }))
          .catch(() => null),
      );
    });
    await p.goto(B + route, { waitUntil: "load" });
    await p.waitForTimeout(2200);
    const rows = (await Promise.all(pending)).filter(Boolean);
    const total = rows.reduce((a, x) => a + x.wire, 0) / 1024;
    ck(
      `/${route} stays inside its weight budget`,
      total <= kb,
      `${total.toFixed(0)} KB of ${kb} KB`,
    );

    // One oversized image undoes the whole budget on its own.
    const worst = Math.max(0, ...rows.filter((x) => x.type === "image").map((x) => x.wire)) / 1024;
    ck(`…with no single image over 260 KB on /${route}`, worst <= 260, `${worst.toFixed(0)} KB`);
    await p.close();
  }
  await ctx.close();
}

// ================== the fastest way to book is reachable without scrolling
{
  const ctx = await phone({ width: 390, height: 844 });
  const p = await ctx.newPage();
  await p.goto(pageUrl("booking"), { waitUntil: "load" });
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

// ===================================== the reservation page, on a phone
//
// This page is one control and one answer. Both used to be in the wrong place
// on a 360px screen: the input sat below the fold on arrival, and the answer
// rendered under it, so tapping Check status appeared to do nothing at all.
{
  const ctx = await phone({ width: 360, height: 740 });
  const p = await ctx.newPage();
  await p.goto(pageUrl("reservation"), { waitUntil: "load" });
  await p.waitForTimeout(900);

  const form = await p.evaluate(() => {
    const input = document.querySelector("input");
    const submit = [...document.querySelectorAll("button[type=submit]")][0];
    return {
      inputBottom: Math.round(input.getBoundingClientRect().bottom),
      submitBottom: Math.round(submit.getBoundingClientRect().bottom),
      vh: innerHeight,
    };
  });
  // Not against the full viewport: Playwright's 740px is all glass, while a
  // real phone spends 90-110px of it on the URL bar. Something that clears
  // the fold by six pixels here is below it on the device.
  const fold = form.vh - 110;
  ck(
    "The field you came to fill is on screen without scrolling",
    form.inputBottom <= fold,
    `input ends at ${form.inputBottom}px, fold at ${fold}`,
  );
  ck(
    "…and so is the button that submits it",
    form.submitBottom <= fold,
    `button ends at ${form.submitBottom}px, fold at ${fold}`,
  );

  await p.fill("input", "BZR-4K2M9X");
  await p.getByRole("button", { name: /check status/i }).click();
  await p.waitForTimeout(1500);

  const answer = await p.evaluate(() => {
    const card = document.querySelector("[aria-live] > div");
    if (!card) return null;
    const r = card.getBoundingClientRect();
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      vh: innerHeight,
      scrolled: Math.round(scrollY),
    };
  });
  ck("An answer is rendered", answer !== null);
  // The whole card, not just its top edge: one that starts on screen and ends
  // past the fold shows the reference and the status and cuts the dates and
  // the price, which is the half the guest came for.
  ck(
    "…and the page brings all of it into view, not just its top edge",
    answer && answer.top >= 0 && answer.bottom <= answer.vh,
    answer &&
      `card spans ${answer.top}-${answer.bottom}px of ${answer.vh}, page scrolled ${answer.scrolled}px`,
  );
  // A screen reader has no card to look at, so the result has to be spoken.
  ck("…and is announced, not just drawn", (await p.locator("[aria-live]").count()) > 0);

  const card = await p.evaluate(() => {
    const c = document.querySelector("[aria-live] > div");
    return c?.innerText.replace(/\n+/g, " ") ?? "";
  });
  // "2026-10-08 → 2026-10-10" is the stored row, not an answer to "when is my
  // stay?". The calendar offered it as "Thu 8 – Sat 10 Oct"; so does this.
  ck("The stay is given in words, not as stored", /Thu\s*8\s*–\s*Sat\s*10\s*Oct/.test(card), card);
  ck("…and not as ISO dates", !/\d{4}-\d{2}-\d{2}/.test(card), card);

  // Accepted and pending are the whole point of looking; they must not read
  // the same at a glance.
  const chips = await p.evaluate(() =>
    [...document.querySelectorAll("[aria-live] > div")].map((c) => {
      const el = [...c.querySelectorAll("span")].find((s) => s.className.includes("uppercase"));
      return el ? getComputedStyle(el).backgroundColor : null;
    }),
  );
  ck(
    "Accepted and pending do not look alike",
    chips.length === 2 && chips[0] && chips[1] && chips[0] !== chips[1],
    chips.join(" vs "),
  );
  await ctx.close();
}

// The reference is Latin in an Arabic card. Setting dir on its paragraph also
// left-aligns it, which leaves it hanging off the side of a card whose every
// other line is right-aligned -- the same trap as the footer phone number.
{
  const ctx = await phone({ width: 390, height: 844 });
  const p = await ctx.newPage();
  await p.goto(`${B}reservation/ar`, { waitUntil: "load" });
  await p.waitForTimeout(900);
  await p.fill("input", "BZR-4K2M9X");
  await p.getByRole("button", { name: "عرض الحالة" }).click();
  await p.waitForTimeout(1500);

  const sides = await p.evaluate(() => {
    const card = document.querySelector("[aria-live] > div");
    if (!card) return null;
    const box = card.getBoundingClientRect();
    const ref = [...card.querySelectorAll("p")].find((n) => /BZR-/.test(n.textContent));
    const meta = [...card.querySelectorAll("p")].find((n) => /·/.test(n.textContent));
    const gapEnd = (el) => {
      const r = el.getBoundingClientRect();
      return Math.round(box.right - r.right);
    };
    return { ref: gapEnd(ref), meta: gapEnd(meta) };
  });
  ck("The Arabic card shows the reference", sides !== null, JSON.stringify(sides));
  ck(
    "…on the same side as everything else in it",
    sides && Math.abs(sides.ref - sides.meta) < 4,
    sides && `reference ${sides.ref}px from the end, the rest ${sides.meta}px`,
  );
  await ctx.close();
}

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
