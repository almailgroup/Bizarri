/**
 * The pages the owner asked to change by name: Packages and Offers as two
 * pages with Packages after Offers in the header, no maps location on the
 * Contact page, and the Facilities page in the owner's words.
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

async function page(viewport = { width: 1280, height: 900 }, mobile = false) {
  const ctx = await b.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) =>
    SUPA.test(r.request().url())
      ? r.fulfill({ status: 200, contentType: "application/json", body: "[]" })
      : r.abort(),
  );
  await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
  return { ctx, p: await ctx.newPage() };
}

// ================================================================= header
for (const lang of ["en", "ar"]) {
  const { ctx, p } = await page();
  await p.goto(`${B}${lang}`, { waitUntil: "load" });
  await p.waitForTimeout(800);
  const nav = await p.evaluate(() =>
    [...document.querySelectorAll("header nav a")].map((a) => a.getAttribute("href")),
  );
  const want = ["facilities", "photos", "offers", "packages", "booking", "contact"].map(
    (s) => `/${s}/${lang}`,
  );
  ck(
    `The header has Packages right after Offers (${lang})`,
    JSON.stringify(nav) === JSON.stringify(want),
    nav.join(" "),
  );
  // Six entries plus the reservation and language buttons must still fit on
  // one line at the narrowest width the bar is shown.
  await p.setViewportSize({ width: 1024, height: 800 });
  await p.waitForTimeout(300);
  const fit = await p.evaluate(() => {
    const links = [...document.querySelectorAll("header nav a")];
    const tops = new Set(links.map((a) => Math.round(a.getBoundingClientRect().top)));
    const header = document.querySelector("header").getBoundingClientRect();
    return {
      oneLine: tops.size === 1,
      inside: links.every((a) => {
        const r = a.getBoundingClientRect();
        return r.left >= header.left && r.right <= header.right;
      }),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      visible: links.length > 0 && links.every((a) => a.getBoundingClientRect().width > 0),
    };
  });
  ck(
    `…and they fit on one line at 1024px (${lang})`,
    fit.visible && fit.oneLine && fit.inside && fit.overflow <= 1,
    JSON.stringify(fit),
  );
  await ctx.close();
}

// The phone menu: Packages joins it, and Booking is still there.
{
  const { ctx, p } = await page({ width: 390, height: 844 }, true);
  await p.goto(`${B}en`, { waitUntil: "load" });
  await p.waitForTimeout(800);
  await p.getByRole("button", { name: /menu/i }).first().click();
  await p.waitForTimeout(400);
  const menu = await p.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"] a[href^="/"]')].map((a) =>
      a.getAttribute("href"),
    ),
  );
  ck(
    "The phone menu has Offers, then Packages, then Booking",
    menu.indexOf("/offers/en") >= 0 &&
      menu.indexOf("/packages/en") === menu.indexOf("/offers/en") + 1 &&
      menu.indexOf("/booking/en") === menu.indexOf("/packages/en") + 1,
    menu.join(" "),
  );
  await ctx.close();
}

// ================================================================ contact
for (const lang of ["en", "ar"]) {
  const { ctx, p } = await page();
  await p.goto(`${B}contact/${lang}`, { waitUntil: "load" });
  await p.waitForTimeout(800);
  const main = await p.evaluate(() => ({
    text: document.querySelector("main").innerText,
    maps: [...document.querySelectorAll("main a")].filter((a) =>
      /maps\.app\.goo\.gl|google\.[a-z.]+\/maps/.test(a.href),
    ).length,
    cards: document.querySelectorAll("main .grid > a").length,
    grid: (() => {
      const g = document.querySelector("main .grid");
      return g ? g.getBoundingClientRect().height : 0;
    })(),
  }));
  ck(
    `Contact has no maps location (${lang})`,
    main.maps === 0 && !/Open in Maps|فتح في الخرائط/.test(main.text),
    `${main.maps} maps links`,
  );
  ck(`…four contact cards, two by two (${lang})`, main.cards === 4, String(main.cards));
  ck(
    `…and the Instagram card names the account its link opens (${lang})`,
    /@bizarri_chalet/.test(main.text) && !/@bizarri\.chalet/.test(main.text),
  );
  await ctx.close();
}

// ============================================================= facilities
{
  const { ctx, p } = await page();
  await p.goto(`${B}facilities/ar`, { waitUntil: "load" });
  await p.waitForTimeout(900);
  const ar = await p.evaluate(() => document.querySelector("main").innerText);
  for (const line of [
    "تأجير شاليه بيزاري",
    "الخيران البحري، طريق 278، المرحلة الثالثة",
    "شاليه بيزاري يتكون من:",
    "7 غرف نوم تكفي لعدد 14 شخص",
    "صالة كبيرة مطلة على حمام السباحة والخور",
    "طاولة طعام تكفي لعدد 12 شخص",
    "بار وكاونتر تحضيري",
    "حمام ضيوف ومغاسل",
    "مطبخ مجهز بالكامل",
    "توفير شامبو وشاور جيل وصابون ومحارم ورقية",
    "بلكونات في غالبية الغرف",
    "مع إضافة خاصية التدفئة",
    "مصعد كهربائي",
    "جلسة خارجية على الخور مباشرة",
    "مواقف تتسع لعدد 9 سيارات أمام الشاليه",
    "منطقة ألعاب للأطفال تحتوي على ملعب كرة قدم و ديرفه وجلسة",
    "ديرفه على الخور مباشرة",
    "تنس طاولة",
    "طاولة بيبي فوت",
    "محطات تلفزيونية عربسات ونايل سات",
    "للحجز والاستفسار",
  ]) {
    if (!ar.includes(line)) ck(`Facilities (ar) has "${line}"`, false);
  }
  const items = await p.locator("main li").count();
  ck(
    "The Arabic Facilities page carries all 17 items in the owner's words",
    items === 17 && fails === 0,
    `${items} items`,
  );
  ck("…with none of the old list left", !/نسبريسو|كاليفورنيا|الجيل الخامس|منزل ذكي/.test(ar));
  ck("…and no Arabic-Indic digits, like the rest of the site", !/[٠-٩]/.test(ar));
  const wa = p.getByRole("link", { name: /WhatsApp/ });
  ck(
    "…a WhatsApp button with the one published number",
    /\+965 94040955/.test(await wa.innerText()) &&
      /wa\.me\/96594040955/.test((await wa.getAttribute("href")) ?? ""),
    await wa.innerText(),
  );
  ck(
    "…and the Instagram account",
    (await p.locator('main a[href*="instagram.com/bizarri_chalet"]').count()) === 1,
  );
  await ctx.close();
}
{
  const { ctx, p } = await page({ width: 390, height: 844 }, true);
  await p.goto(`${B}facilities/en`, { waitUntil: "load" });
  await p.waitForTimeout(900);
  const en = await p.evaluate(() => document.querySelector("main").innerText);
  ck(
    "The English Facilities page says the same",
    [
      "Bizarri Chalet for rent",
      "Al Khiran Al Bahri, Road 278, Phase 3",
      "7 bedrooms sleeping 14 guests",
      "A dining table for 12",
      "with heating",
      "An electric lift",
      "Parking for 9 cars",
      "football pitch",
      "Table tennis",
      "foosball",
      "Arabsat and Nilesat",
    ].every((t) => en.includes(t)),
  );
  ck("…with 17 items", (await p.locator("main li").count()) === 17);
  ck(
    "…and fits a phone",
    (await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1,
  );
  await ctx.close();
}

// ====================================== home highlights match the facilities
// The home page's six highlights used to describe a different chalet -- a
// smart home, 5G, a California King bed, Nespresso -- from the one the
// Facilities page now lists. Each highlight has to be something Facilities
// says too.
for (const lang of ["en", "ar"]) {
  const { ctx, p } = await page();
  await p.goto(`${B}${lang}`, { waitUntil: "load" });
  await p.waitForTimeout(900);
  const highlights = await p.evaluate(() =>
    [...document.querySelectorAll("#chalet .grid p")].map((x) => x.textContent.trim()),
  );
  const home = await p.evaluate(() => document.body.innerText);
  const meta = await p.evaluate(
    () => document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
  );
  await p.goto(`${B}facilities/${lang}`, { waitUntil: "load" });
  await p.waitForTimeout(900);
  const fac = await p.evaluate(() => document.querySelector("main").innerText);
  // The words that carry each claim, as Facilities words them.
  const facts =
    lang === "en"
      ? [
          "7 bedrooms sleeping 14 guests",
          "with heating",
          "Outdoor seating right on the lagoon",
          "fully equipped kitchen",
          "football pitch",
          "Parking for 9 cars",
        ]
      : [
          "7 غرف نوم تكفي لعدد 14 شخص",
          "خاصية التدفئة",
          "جلسة خارجية على الخور مباشرة",
          "مطبخ مجهز بالكامل",
          "ملعب كرة قدم",
          "9 سيارات",
        ];
  ck(
    `The home page has six highlights, each one on the Facilities page too (${lang})`,
    highlights.length === 6 && facts.every((f, i) => highlights[i].includes(f) && fac.includes(f)),
    highlights.join(" | "),
  );
  ck(
    `…and none of the old claims (${lang})`,
    !/smart|Nespresso|California|5G|65"|ذكي|نسبريسو|كاليفورنيا|الجيل الخامس/i.test(home + meta),
    meta,
  );
  await ctx.close();
}

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
