/**
 * A "+" or "@" is bidi-neutral. Dropped into the Arabic page's RTL run it
 * lands at the visual end, so +96594040955 reads back as 96594040955+ and
 * @bizarri_chalet as bizarri_chalet@ — wrong numbers, on the contact page.
 *
 * Nothing in the DOM says this: textContent is correct either way. The only
 * honest check is where the glyphs actually land, so this measures the "+"
 * against the first digit.
 */
import { chromium } from "playwright";

// The language is the last segment, so a page URL is pageUrl(route).
const LANG = "ar";
const B = "http://localhost:4173/";
const pageUrl = (r) => (r ? `${B}${r}/${LANG}` : `${B}${LANG}`);
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

const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
// The language is the URL now, not a stored preference: B points at /ar/.
await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
const p = await ctx.newPage();

/** Where each character of a node's text actually sits, left to right. */
const visualOrder = async (text) =>
  p.evaluate((needle) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.includes(needle)) continue;
      const i = node.textContent.indexOf(needle);
      const boxes = [];
      for (let k = 0; k < needle.length; k++) {
        const r = document.createRange();
        r.setStart(node, i + k);
        r.setEnd(node, i + k + 1);
        const q = r.getBoundingClientRect();
        if (q.width || q.height) boxes.push({ ch: needle[k], x: q.x });
      }
      if (!boxes.length) continue;
      return boxes
        .sort((a, c) => a.x - c.x)
        .map((x) => x.ch)
        .join("");
    }
    return null;
  }, text);

await p.goto(pageUrl("contact"), { waitUntil: "load" });
await p.waitForTimeout(1200);
const dir = await p.evaluate(() => document.documentElement.dir);
ck("/contact really is the Arabic page", dir === "rtl", `dir=${dir}`);

const phone = await visualOrder("+96594040955");
ck("The phone reads +965\u2026 left to right", phone === "+96594040955", `reads "${phone}"`);

const handle = await visualOrder("@bizarri_chalet");
ck("The Instagram handle keeps its @ in front", handle === "@bizarri_chalet", `reads "${handle}"`);
const mail = await visualOrder("sales@bizarri.com");
ck("The email is not reordered either", mail === "sales@bizarri.com", `reads "${mail}"`);

// The footer is on every page, and the homepage prints the number a second
// time with a space in it, so both are worth their own measurement.
await p.goto(pageUrl(""), { waitUntil: "load" });
await p.waitForTimeout(1200);
const home = await visualOrder("+965 94040955");
ck("The homepage number reads the same way", home === "+965 94040955", `reads "${home}"`);
const foot = await p.evaluate(() => {
  const a = document.querySelector('footer a[href^="tel:"]');
  if (!a) return null;
  // Walk descendants, not direct children: the digits sit in their own span
  // so the row's direction can stay with the page.
  const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
  let t = null;
  while (!t) {
    const n = walker.nextNode();
    if (!n) break;
    if (n.textContent.includes("+")) t = n;
  }
  if (!t) return null;
  const out = [];
  for (let k = 0; k < t.textContent.length; k++) {
    const r = document.createRange();
    r.setStart(t, k);
    r.setEnd(t, k + 1);
    const q = r.getBoundingClientRect();
    if (q.width || q.height) out.push({ ch: t.textContent[k], x: q.x });
  }
  return out
    .sort((a, c) => a.x - c.x)
    .map((x) => x.ch)
    .join("");
});
ck("The footer number does too", foot === "+96594040955", `reads "${foot}"`);

// ================================= the contact rows have to share an edge
{
  // Character order is not enough. dir="ltr" on the phone row put the digits
  // in the right order and moved the whole row — icon and all — to the left,
  // while the three rows under it stayed right. Every assertion above passed.
  await p.goto(pageUrl("contact"), { waitUntil: "load" });
  await p.waitForTimeout(1200);
  const icons = await p.evaluate(() =>
    [...document.querySelectorAll("footer li a svg")].map((i) =>
      Math.round(i.getBoundingClientRect().x),
    ),
  );
  const spread = icons.length ? Math.max(...icons) - Math.min(...icons) : -1;
  ck(
    "Every footer contact row starts at the same edge",
    icons.length >= 4 && spread <= 1,
    `icons at ${icons.join(", ")}`,
  );

  // And on the right of it, this being an Arabic page.
  const half = await p.evaluate(() => window.innerWidth / 2);
  ck(
    "\u2026on the right, as the rest of the page reads",
    icons.length > 0 && icons.every((x) => x > half - 200),
    `first icon at ${icons[0]}, viewport ${half * 2}`,
  );
}

// ============================== one digit set on the Arabic page
//
// "ar-EG" numbers a date in Arabic-Indic digits, and the dictionary used to
// spell a few out the same way. Nothing else on the site could join them: a
// price is "350 د.ك", a booking reference is BZR-4K2M9X, the phone number is
// +965 94040955, and the day cells of the booking calendar are a plain 1, 2,
// 3 -- so the month heading read ٢٠٢٦ directly above a grid of Western days.
// Latin is the only digit set all of it can agree on.
{
  const SUPA = /ycfvqzcnatwacwlcmiej\.supabase\.co/;
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dctx = await b.newContext({ viewport: { width: 1200, height: 1000 } });
  await dctx.route(/^https?:\/\/(?!localhost)/, (r) => {
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
          title_en: "Hours",
          title_ar: "المواعيد",
          body_en: "x",
          body_ar: "س",
          published: true,
          published_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: "",
        },
      ]);
    if (path.startsWith("rpc/lookup_booking"))
      return send([
        {
          ref: "BZR-4K2M9X",
          status: "accepted",
          chalet_id: 1,
          start_date: "2026-10-08",
          end_date: "2026-10-10",
          days: 3,
          total: 350,
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
  await dctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
  const dp = await dctx.newPage();

  const found = [];
  for (const route of ["", "facilities", "booking", "offers", "news", "reservation", "contact"]) {
    await dp.goto(pageUrl(route), { waitUntil: "load" });
    await dp.waitForTimeout(1200);
    if (route === "reservation") {
      // The lookup result is the densest run of numbers on the site: a
      // reference, a date range, a day count and a price on four lines.
      await dp.fill("input", "BZR-4K2M9X");
      await dp.getByRole("button", { name: "عرض الحالة" }).click();
      await dp.waitForTimeout(1200);
    }
    const hits = await dp.evaluate(() => {
      const re = /[\u0660-\u0669\u06F0-\u06F9]/;
      const out = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode()))
        if (re.test(n.textContent)) out.push(n.textContent.trim().slice(0, 30));
      return [...new Set(out)];
    });
    if (hits.length) found.push(`/${route || "home"}: ${hits.join(", ")}`);
  }
  ck(
    "No Arabic page mixes Arabic-Indic digits into Latin ones",
    found.length === 0,
    found.join(" | "),
  );

  // The month heading and the grid it sits over are the pair that gave this
  // away, so they are named rather than left to the sweep above.
  await dp.goto(pageUrl("booking"), { waitUntil: "load" });
  await dp.waitForTimeout(1200);
  const cal = await dp.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    // The month title is the one short line naming a year, either way it is
    // numbered -- picking it by year rather than by position, so that moving
    // the weekday header row does not silently change what is measured.
    const heading =
      [...document.querySelectorAll("h2,h3,p,span")]
        .filter((n) => n.children.length === 0)
        .map((n) => n.textContent.trim())
        .find((t) => t.length < 30 && /(\d|[\u0660-\u0669]){4}/.test(t)) ?? "";
    const days = [...(grid?.querySelectorAll("button") ?? [])].map((x) => x.textContent.trim());
    return { heading, day: days.find((d) => /\d|[\u0660-\u0669]/.test(d)) ?? "" };
  });
  ck(
    "The calendar heading is numbered the same way as its own days",
    /[0-9]/.test(cal.heading) && /[0-9]/.test(cal.day),
    `${cal.heading} over ${cal.day}`,
  );
  await dctx.close();
}

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
