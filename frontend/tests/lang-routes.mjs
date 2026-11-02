/**
 * The language lives in the URL: /en/booking, /ar/booking.
 *
 * Two things here are easy to get wrong and invisible when you do. A stored
 * preference silently overriding the prefix means a shared /ar link opens in
 * English for half the people who click it. And on a static host a path with
 * no file behind it renders perfectly while answering HTTP 404, which no
 * visitor notices and every crawler does.
 */
import { readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";

const B = "http://localhost:4173";
const dist = new URL("../dist/", import.meta.url).pathname;
let fails = 0;
const ck = (n, c, d = "") => {
  if (!c) fails++;
  console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`);
};

const b = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
    : {},
);
const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
const p = await ctx.newPage();

const state = () =>
  p.evaluate(() => ({
    path: location.pathname,
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    canonical: document.querySelector('link[rel="canonical"]')?.href ?? "",
    mounted: (document.getElementById("root")?.children.length ?? 0) > 0,
  }));

const visit = async (url) => {
  await p.goto(B + url, { waitUntil: "load" });
  await p.waitForTimeout(1200);
  return state();
};

// ========================================================== the two languages
{
  const en = await visit("/en");
  ck("/en is English, left to right", en.lang === "en" && en.dir === "ltr", `${en.lang}/${en.dir}`);
  ck("…and it renders", en.mounted);

  const ar = await visit("/ar");
  ck("/ar is Arabic, right to left", ar.lang === "ar" && ar.dir === "rtl", `${ar.lang}/${ar.dir}`);
  ck("…and it renders", ar.mounted);

  const arPage = await visit("/photos/ar");
  ck("An inner page keeps its language", arPage.lang === "ar", arPage.path);
  ck(
    "…and says so in its canonical URL",
    arPage.canonical.endsWith("/photos/ar"),
    arPage.canonical,
  );
}

// ================================================ the URL beats the preference
{
  // Someone whose last visit was English follows a link to /ar. The link has
  // to win, or half the people who are sent one see the wrong language.
  await p.goto(B + "/en", { waitUntil: "load" });
  await p.waitForTimeout(800);
  await p.evaluate(() => localStorage.setItem("bizarri_lang", "en"));
  const ar = await visit("/contact/ar");
  ck("A shared /ar link opens in Arabic despite an English preference", ar.lang === "ar", ar.lang);
}

// ============================================================= the bare domain
{
  await p.goto(B + "/en", { waitUntil: "load" });
  await p.waitForTimeout(600);
  await p.evaluate(() => localStorage.setItem("bizarri_lang", "ar"));
  const home = await visit("/");
  ck("The bare domain picks a language and goes there", home.path === "/ar", home.path);
  ck("…the remembered one", home.lang === "ar", home.lang);
  await p.evaluate(() => localStorage.removeItem("bizarri_lang"));
}

// ================================================ links published before this
{
  const old = await visit("/booking");
  ck("An old unprefixed link still lands on the page", old.path.startsWith("/booking"), old.path);
  ck("…under a language", /\/(en|ar)$/.test(old.path), old.path);
  ck("…and renders rather than 404ing", old.mounted);
}

// The prefix shape shipped for one deploy and went into a sitemap, so those
// URLs are turned around rather than dropped.
{
  const flipped = await visit("/en/facilities");
  ck(
    "A URL from the brief prefix era is turned around",
    flipped.path === "/facilities/en",
    flipped.path,
  );
  ck("…and renders", flipped.mounted);

  const flippedAr = await visit("/ar/photos");
  ck("…in either language", flippedAr.path === "/photos/ar", flippedAr.path);
}

// ===================================================== switching, in place
{
  await p.goto(B + "/photos/en", { waitUntil: "load" });
  await p.waitForTimeout(1200);
  await p
    .getByRole("button", { name: /العربية/ })
    .first()
    .click();
  await p.waitForTimeout(900);
  const ar = await state();
  ck("Switching language stays on the same page", ar.path === "/photos/ar", ar.path);
  ck("…and actually switches it", ar.lang === "ar" && ar.dir === "rtl", `${ar.lang}/${ar.dir}`);

  await p
    .getByRole("button", { name: /English/ })
    .first()
    .click();
  await p.waitForTimeout(900);
  const en = await state();
  ck("…and back again", en.path === "/photos/en" && en.lang === "en", en.path);

  // Navigating on from there must not drop the language.
  await p
    .getByRole("link", { name: /^BOOKING$/i })
    .first()
    .click();
  await p.waitForTimeout(900);
  const next = await state();
  ck("Following a link keeps the language in the URL", next.path === "/booking/en", next.path);
}

{
  await p.goto(B + "/ar", { waitUntil: "load" });
  await p.waitForTimeout(1200);
  await p.getByRole("link", { name: /الحجز/ }).first().click();
  await p.waitForTimeout(900);
  const next = await state();
  ck("…in Arabic too", next.path === "/booking/ar" && next.lang === "ar", next.path);
}

// ============================== no internal link may drop the language
{
  // The nav was built from an array, so neither the transform nor the type
  // checker noticed it still pointed at /booking. Every one of those links
  // worked — they just sent Arabic readers to the English page. Checking one
  // link would not have found it; sweeping the rendered page does.
  const stray = [];
  for (const lang of ["en", "ar"]) {
    for (const page of [
      "",
      "/photos",
      "/booking",
      "/offers",
      "/packages",
      "/contact",
      "/reservation",
    ]) {
      await p.goto(`${B}/${page ? `${page}/` : ""}${lang}`, { waitUntil: "load" });
      await p.waitForTimeout(900);
      const bad = await p.evaluate(
        (l) =>
          [...document.querySelectorAll("a[href]")]
            .map((a) => a.getAttribute("href"))
            .filter((h) => h.startsWith("/") && !h.startsWith("//"))
            // The path carries the language; a query after it (a package
            // chosen ahead, ?shape=weekend) is not part of that question.
            .map((h) => h.split("?")[0])
            .filter((h) => h !== `/${l}` && !h.endsWith(`/${l}`)),
        lang,
      );
      for (const h of new Set(bad)) stray.push(`/${page || ""}/${lang} -> ${h}`);
    }
  }
  ck(
    "Every internal link on every page carries the language",
    stray.length === 0,
    stray.slice(0, 6).join(" | "),
  );
}

// ================================================== a path that is not a page
{
  // exact, and checked against a real page too: the contact number is
  // 94040955, which contains "404", so a loose match calls every page a 404.
  const is404 = () => p.getByText("404", { exact: true }).first().isVisible();

  const missing = await visit("/not-a-page/en");
  ck("An unknown page is a 404", await is404(), missing.path);
  ck("…written in the language it was asked for", missing.lang === "en", missing.lang);

  await visit("/facilities/en");
  ck("…and a page that exists is not", !(await is404()));

  const badLang = await visit("/facilities/fr");
  ck("A language we do not speak is a 404, not a fallback", await is404(), badLang.path);
}

await b.close();

// ===================== the published files, which is where the status code is
{
  const pages = ["", "booking", "photos", "contact", "reservation", "rules", "cancellation"];
  const missing = [];
  for (const lang of ["en", "ar"]) {
    for (const slug of pages) {
      const f = `${dist}${slug ? `${slug}/` : ""}${lang}/index.html`;
      if (!existsSync(f)) missing.push(f.replace(dist, ""));
    }
  }
  // Without a file here GitHub Pages falls through to 404.html: the page
  // renders, the status is 404, and search engines drop it.
  ck(
    "Every page has a real file, so the host answers 200",
    missing.length === 0,
    missing.join(", "),
  );

  const ar = readFileSync(`${dist}booking/ar/index.html`, "utf8");
  ck(
    "…and that file declares its own language before any JavaScript runs",
    /<html lang="ar" dir="rtl">/.test(ar),
    (ar.match(/<html[^>]*>/) ?? [])[0],
  );
  ck("…and its own canonical URL", ar.includes('href="https://bizarri.com/booking/ar"'));

  const shell = readFileSync(`${dist}index.html`, "utf8");
  for (const tag of ['hreflang="en"', 'hreflang="ar"', 'hreflang="x-default"']) {
    ck(`The shell tells crawlers about ${tag}`, shell.includes(tag));
  }

  const sitemap = readFileSync(`${dist}sitemap.xml`, "utf8");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  ck(
    "The sitemap lists both languages",
    locs.some((l) => l.endsWith("/en")) && locs.some((l) => l.endsWith("/ar")),
    `${locs.length} urls`,
  );
  ck(
    "…and every URL carries a language",
    locs.every((l) => /bizarri\.com\/(.*\/)?(en|ar)$/.test(l)),
    locs.filter((l) => !/bizarri\.com\/(.*\/)?(en|ar)$/.test(l)).join(", "),
  );
  ck(
    "…and leaves the admin out",
    !locs.some((l) => l.includes("/admin/")),
    locs.filter((l) => l.includes("/admin/")).join(", "),
  );

  // What a search result shows, read from the file before any JavaScript:
  // every page its own title and description, in its own language, linked
  // to its twin in the other one.
  const file = (slug, lang) =>
    readFileSync(`${dist}${slug ? `${slug}/` : ""}${lang}/index.html`, "utf8");
  const tag = (html, re) => (html.match(re) ?? [])[1] ?? "";
  const titles = new Set();
  const descriptions = new Set();
  const wrong = [];
  for (const lang of ["en", "ar"]) {
    for (const slug of ["", "booking", "packages", "facilities", "photos", "offers", "contact"]) {
      const html = file(slug, lang);
      titles.add(tag(html, /<title>([^<]*)<\/title>/));
      descriptions.add(tag(html, /<meta name="description" content="([^"]*)"/));
      const path = slug ? `${slug}/` : "";
      if (!html.includes(`hreflang="en" href="https://bizarri.com/${path}en"`))
        wrong.push(`${slug}/${lang} en`);
      if (!html.includes(`hreflang="ar" href="https://bizarri.com/${path}ar"`))
        wrong.push(`${slug}/${lang} ar`);
      const ar = /[؀-ۿ]/.test(tag(html, /<title>([^<]*)<\/title>/));
      if (ar !== (lang === "ar")) wrong.push(`${slug}/${lang} title language`);
      if (!html.includes(`og:locale" content="${lang === "ar" ? "ar_KW" : "en_US"}"`))
        wrong.push(`${slug}/${lang} og:locale`);
    }
  }
  ck("Every page has its own title in its file", titles.size === 14, [...titles].join(" | "));
  ck("…and its own description", descriptions.size === 14, `${descriptions.size} of 14`);
  ck("…in its own language, linked to its twin", wrong.length === 0, wrong.join(", "));

  // The searches the owner asked to be found for.
  const homeEn = tag(file("", "en"), /<title>([^<]*)<\/title>/);
  const homeAr = tag(file("", "ar"), /<title>([^<]*)<\/title>/);
  ck(
    "The English home page's title says Bizarri, Chalet and Kuwait",
    /Bizarri/.test(homeEn) && /Chalet/.test(homeEn) && /Kuwait/.test(homeEn),
    homeEn,
  );
  ck(
    "…the Arabic one, a chalet for rent in Al Khiran",
    homeAr.includes("شاليه بيزاري") && homeAr.includes("للإيجار في الخيران"),
    homeAr,
  );
  ck(
    "…booking, weekdays and the weekend",
    /حجز شاليه في الخيران/.test(tag(file("booking", "ar"), /<title>([^<]*)<\/title>/)) &&
      /الويكند/.test(tag(file("booking", "ar"), /<title>([^<]*)<\/title>/)),
  );
  ck(
    "…a chalet with a pool, and the prices",
    tag(file("facilities", "ar"), /<title>([^<]*)<\/title>/).includes("شاليه بمسبح في الخيران") &&
      tag(file("packages", "ar"), /<title>([^<]*)<\/title>/).includes(
        "أسعار إيجار شاليهات الخيران",
      ),
  );

  const admin = file("admin", "en");
  ck("The admin page asks not to be indexed", admin.includes('name="robots" content="noindex'));

  // The noscript block is the page's own, in its language, with links in.
  const noscript = tag(file("packages", "ar"), /<noscript>([\s\S]*?)<\/noscript>/);
  ck(
    "Without JavaScript a page still names itself and links to the rest",
    noscript.includes("<h1>أسعار إيجار شاليهات الخيران") &&
      noscript.includes('href="/booking/ar"') &&
      noscript.includes('href="/packages/en"'),
  );
  // The comment in the shell mentions noscript too; it must still be a comment.
  ck(
    "…and the app's own script is still there",
    /<script type="module"[^>]*src="\/assets\//.test(file("packages", "ar")),
  );

  // The business, as Google reads it: the names people search, and where.
  const ld = JSON.parse(tag(shell, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/));
  ck(
    "The structured data names Bizarri, Bizarri Kuwait and بيزاري",
    ["Bizarri", "Bizarri Kuwait", "بيزاري"].every((n) => ld.alternateName.includes(n)),
    JSON.stringify(ld.alternateName),
  );
  ck(
    "…and puts it in Al Khiran",
    ld.address?.addressLocality === "Al Khiran Al Bahri" && ld.address?.addressCountry === "KW",
    JSON.stringify(ld.address),
  );
  ck("…and gives the site a name", /"@type": "WebSite"/.test(shell));
}

// ================================ the homepage answers what people search
{
  const b2 = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  );
  const ctx = await b2.newContext();
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) =>
    r.request().url().includes("/rest/v1/rates")
      ? r.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            full_week: 600,
            weekend: 250,
            weekday: 200,
            daily_weekday: 75,
            daily_weekend: 100,
            currency: "KWD",
            min_stay_days: 3,
          }),
        })
      : r.abort(),
  );
  await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
  const p = await ctx.newPage();
  for (const lang of ["en", "ar"]) {
    await p.goto(`http://localhost:4173/${lang}`, { waitUntil: "load" });
    await p.waitForTimeout(1200);
    const qa = await p.locator('[data-testid="home-questions"]').innerText();
    ck(
      `The homepage answers the questions people search (${lang})`,
      lang === "en"
        ? /Renting a chalet in Al Khiran/.test(qa) && /chalet in Kuwait/.test(qa)
        : qa.includes("حجز شاليه في الخيران") && qa.includes("شاليه للتأجير في الكويت"),
    );
    ck(
      `…with the prices the owner set (${lang})`,
      /200/.test(qa) && /250/.test(qa) && /600/.test(qa),
      qa.slice(0, 120),
    );
    ck(
      `…and the tab carries the page's title (${lang})`,
      (await p.title()) ===
        (lang === "en"
          ? "Bizarri Chalet Kuwait | Private Chalet for Rent in Al Khiran"
          : "شاليه بيزاري | شاليه خاص للإيجار في الخيران، الكويت"),
      await p.title(),
    );
  }
  // Moving within the app keeps the tags with the page, without a reload.
  await p.getByRole("link", { name: "الباقات" }).last().click();
  await p.waitForTimeout(800);
  ck(
    "A page reached without a reload has its own title and links",
    (await p.title()).startsWith("أسعار إيجار شاليهات الخيران") &&
      (await p.evaluate(() => document.querySelector('link[rel="canonical"]').href)) ===
        "https://bizarri.com/packages/ar" &&
      (await p.evaluate(
        () => document.querySelector('link[rel="alternate"][hreflang="en"]').href,
      )) === "https://bizarri.com/packages/en",
  );
  await b2.close();
}

console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
