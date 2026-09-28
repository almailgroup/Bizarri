/**
 * The shape of what gets published.
 *
 * A wrong Vite `base` does not fail the build, does not fail a type check and
 * does not fail any test that drives the app — it produces a perfectly valid
 * page whose every asset URL 404s. The browser shows white. That is what
 * happened when bizarri.com was connected while the build still targeted
 * /Bizarri/, so these assertions are about the published files rather than
 * the app's behaviour.
 */
import { readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";

// The language is the last segment, so a page URL is pageUrl(route).
const LANG = "en";
const B = "http://localhost:4173/";
const pageUrl = (r) => (r ? `${B}${r}/${LANG}` : `${B}${LANG}`);
const dist = new URL("../dist/", import.meta.url).pathname;
let fails = 0;
const ck = (n, c, d = "") => {
  if (!c) fails++;
  console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`);
};

const html = readFileSync(dist + "index.html", "utf8");

// ------------------------------------------------- the domain it is built for
ck("A CNAME ships with the build, so Pages keeps the domain", existsSync(dist + "CNAME"));
const domain = existsSync(dist + "CNAME") ? readFileSync(dist + "CNAME", "utf8").trim() : "";
ck("…naming exactly one host", /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain), domain);

// ------------------------------------------------------ assets resolve at all
const refs = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((m) => m[1]);
ck("The page references local assets", refs.length > 0, `${refs.length} refs`);

const missing = refs.filter((r) => !existsSync(dist + r.replace(/^\//, "").split("?")[0]));
ck(
  "Every asset the page asks for is actually in the build",
  missing.length === 0,
  missing.join(", "),
);

// The specific mistake: a project-page base left behind on a custom domain.
const subPath = refs.filter((r) => /^\/Bizarri\//i.test(r));
ck("No asset is left under the old project-page path", subPath.length === 0, subPath.join(", "));

// ------------------------------------------------------------- the SPA shell
ck("404.html exists, so deep links boot the app", existsSync(dist + "404.html"));
if (existsSync(dist + "404.html")) {
  ck(
    "…and it is the same shell, not a stale copy",
    readFileSync(dist + "404.html", "utf8") === html,
  );
}

// --------------------------------------------- what search engines are told
const meta = (re) => (html.match(re) ?? [])[1] ?? "";
const canonical = meta(/<link rel="canonical" href="([^"]+)"/);
const ogUrl = meta(/<meta property="og:url" content="([^"]+)"/);
const ogImg = meta(/<meta property="og:image" content="([^"]+)"/);
const onDomain = (u) => domain !== "" && u.startsWith(`https://${domain}/`);
ck("The canonical URL is the domain the site is served from", onDomain(canonical), canonical);
ck("…so is og:url", onDomain(ogUrl), ogUrl);
ck("…and the share image", onDomain(ogImg), ogImg);

const robots = readFileSync(dist + "robots.txt", "utf8");
ck(
  "robots.txt points at a sitemap on this domain",
  robots.includes(`https://${domain}/sitemap.xml`),
);
ck(
  "…and still hides the admin route, in both languages",
  /^Disallow: \/admin\/en\s*$/m.test(robots) && /^Disallow: \/admin\/ar\s*$/m.test(robots),
  robots.trim().replace(/\n/g, " | "),
);
const sitemap = readFileSync(dist + "sitemap.xml", "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
ck(
  "Every sitemap URL is on this domain",
  locs.length > 0 && locs.every(onDomain),
  locs.filter((l) => !onDomain(l)).join(", ") || `${locs.length} urls`,
);

// ------------------------------------------- and finally: does it come up?
{
  const b = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  );
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  const p = await ctx.newPage();
  const broken = [];
  p.on("response", (r) => {
    if (r.url().startsWith(B) && r.status() >= 400) broken.push(`${r.status()} ${r.url()}`);
  });

  await p.goto(pageUrl(""), { waitUntil: "load" });
  await p.waitForTimeout(1500);

  ck("Nothing the page asks for 404s", broken.length === 0, broken.slice(0, 3).join(" | "));
  // The blank-screen check proper: the shell always parses, so the question is
  // whether any of it rendered.
  const mounted = await p.evaluate(() => {
    const root = document.getElementById("root");
    return { children: root?.children.length ?? 0, text: (document.body.innerText || "").length };
  });
  ck("The app mounts into #root", mounted.children > 0, `${mounted.children} children`);
  ck("…and the page has visible text on it", mounted.text > 50, `${mounted.text} chars`);

  // A deep link is served by 404.html, which is where a base-path mistake
  // shows up second.
  const deep = [];
  p.on("response", (r) => {
    if (r.url().startsWith(B) && r.status() >= 400) deep.push(r.url());
  });
  await p.goto(pageUrl("booking"), { waitUntil: "load" });
  await p.waitForTimeout(1500);
  const deepMounted = await p.evaluate(() => document.getElementById("root")?.children.length ?? 0);
  ck("A deep link boots the app too", deepMounted > 0, `${deepMounted} children`);

  await b.close();
}

console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
