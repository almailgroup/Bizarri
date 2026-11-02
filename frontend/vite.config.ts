import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { NAV_ORDER, NOINDEX, pagePath, pageSeo, type SeoLang } from "./src/lib/seo";

// Static single-page-app build (client-only) for GitHub Pages.
// The site is served from https://bizarri.com/, so assets resolve from the
// root. A project-page base like "/Bizarri/" would make every asset URL
// bizarri.com/Bizarri/assets/... , which 404s: nothing loads and the page is
// blank. Override with BASE_PATH to build for a sub-path again.
const base = process.env.BASE_PATH ?? "/";

const SITE = "https://bizarri.com";
const LANGS = ["en", "ar"] as const;

/**
 * The pages, taken from the route files so this cannot drift from them.
 * A page is <slug>.$lang.tsx; the homepage is $lang.tsx and has no slug.
 */
function pageSlugs(): string[] {
  const slugs = readdirSync(resolve(__dirname, "src/routes"))
    .filter((f) => f.endsWith(".$lang.tsx"))
    .map((f) => f.replace(/\.\$lang\.tsx$/, ""));
  return ["", ...slugs];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * One replacement in the shell, which must find what it replaces. If
 * index.html changes shape, the build stops here rather than shipping every
 * page with the home page's title.
 */
function swap(html: string, find: RegExp, to: string, what: string): string {
  if (!find.test(html)) throw new Error(`static-routes: index.html has no ${what}`);
  return html.replace(find, to);
}

const metaTag = (attr: "name" | "property", key: string) =>
  new RegExp(`<meta ${attr}="${key}" content="[^"]*" />`);

/**
 * What a crawler that does not run JavaScript finds in the page body: the
 * page's own name and summary, and links to the rest of the site in the same
 * language. In <noscript>, so a visitor whose browser ran the app never sees
 * it.
 */
function noscriptFor(slug: string, lang: SeoLang): string {
  const { title, description } = pageSeo(slug, lang);
  const other: SeoLang = lang === "en" ? "ar" : "en";
  const links = NAV_ORDER.map(
    (s) => `<li><a href="${pagePath(s, lang)}">${esc(pageSeo(s, lang).nav)}</a></li>`,
  ).join("\n        ");
  return `<noscript>
      <h1>${esc(title)}</h1>
      <p>${esc(description)}</p>
      <ul>
        ${links}
      </ul>
      <p><a href="${pagePath(slug, other)}" hreflang="${other}">${other === "ar" ? "العربية" : "English"}</a></p>
    </noscript>`;
}

/**
 * Writes a real HTML file for every page in every language.
 *
 * Without this the only file in the build is index.html at the root, and
 * GitHub Pages answers /en/booking with 404.html — which renders correctly,
 * because the router takes over, but carries an HTTP 404. Visitors would
 * never notice; crawlers would drop every page on the site. A file at the
 * path makes the status 200.
 *
 * Each copy carries its own lang and dir, canonical, title and description
 * (from src/lib/seo.ts), and links to its other-language twin, so a crawler
 * that does not run JavaScript still sees what the page is, in which
 * language, and where its translation is. The admin page is marked noindex.
 *
 * The sitemap is written from the same list of pages, so a new page is in it
 * without anyone remembering to add it. 404.html stays as the fallback for
 * anything not listed here.
 */
function staticRoutes(): Plugin {
  return {
    name: "static-routes",
    closeBundle() {
      const out = resolve(__dirname, "dist");
      const shell = readFileSync(resolve(out, "index.html"), "utf8");
      writeFileSync(resolve(out, "404.html"), shell);
      const slugs = pageSlugs();

      for (const lang of LANGS) {
        const dir = lang === "ar" ? "rtl" : "ltr";
        for (const slug of slugs) {
          const { title, description } = pageSeo(slug, lang);
          const path = pagePath(slug, lang);
          const url = SITE + path;
          let html = shell;
          html = swap(
            html,
            /<html lang="[^"]*" dir="[^"]*">/,
            `<html lang="${lang}" dir="${dir}">`,
            "<html lang dir>",
          );
          html = swap(html, /<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`, "<title>");
          for (const [attr, key] of [
            ["property", "og:title"],
            ["name", "twitter:title"],
          ] as const) {
            html = swap(
              html,
              metaTag(attr, key),
              `<meta ${attr}="${key}" content="${esc(title)}" />`,
              key,
            );
          }
          if (description) {
            for (const [attr, key] of [
              ["name", "description"],
              ["property", "og:description"],
              ["name", "twitter:description"],
            ] as const) {
              html = swap(
                html,
                metaTag(attr, key),
                `<meta ${attr}="${key}" content="${esc(description)}" />`,
                key,
              );
            }
          }
          html = swap(
            html,
            /<link rel="canonical" href="[^"]*" \/>/,
            `<link rel="canonical" href="${url}" />`,
            "canonical",
          );
          html = swap(
            html,
            metaTag("property", "og:url"),
            `<meta property="og:url" content="${url}" />`,
            "og:url",
          );
          for (const [hreflang, target] of [
            ["en", "en"],
            ["ar", "ar"],
            ["x-default", "en"],
          ] as const) {
            html = swap(
              html,
              new RegExp(`<link rel="alternate" hreflang="${hreflang}" href="[^"]*" />`),
              `<link rel="alternate" hreflang="${hreflang}" href="${SITE}${pagePath(slug, target)}" />`,
              `hreflang ${hreflang}`,
            );
          }
          const [locale, alternate] = lang === "ar" ? ["ar_KW", "en_US"] : ["en_US", "ar_KW"];
          html = swap(
            html,
            metaTag("property", "og:locale"),
            `<meta property="og:locale" content="${locale}" />`,
            "og:locale",
          );
          html = swap(
            html,
            metaTag("property", "og:locale:alternate"),
            `<meta property="og:locale:alternate" content="${alternate}" />`,
            "og:locale:alternate",
          );
          if (NOINDEX.has(slug)) {
            html = swap(
              html,
              metaTag("name", "robots"),
              `<meta name="robots" content="noindex, nofollow" />`,
              "robots",
            );
          }
          // Anchored to the start of a line, so the word in a comment is
          // never taken for the tag.
          html = swap(
            html,
            /^ *<noscript>[\s\S]*?<\/noscript>/m,
            `    ${noscriptFor(slug, lang)}`,
            "<noscript>",
          );

          const target = resolve(out, path.slice(1));
          mkdirSync(target, { recursive: true });
          writeFileSync(resolve(target, "index.html"), html);
        }
      }

      // The sitemap: every page but the admin, each naming its twin.
      const listed = [
        ...NAV_ORDER.filter((s) => slugs.includes(s)),
        ...slugs.filter((s) => !NAV_ORDER.includes(s)),
      ].filter((s) => !NOINDEX.has(s));
      const urls = listed.flatMap((slug) =>
        LANGS.map(
          (lang) => `  <url>
    <loc>${SITE}${pagePath(slug, lang)}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${pagePath(slug, "en")}" />
    <xhtml:link rel="alternate" hreflang="ar" href="${SITE}${pagePath(slug, "ar")}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${pagePath(slug, "en")}" />
  </url>`,
        ),
      );
      writeFileSync(
        resolve(out, "sitemap.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>
<!-- Written by the build (vite.config.ts) from the pages in src/routes. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`,
      );
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    staticRoutes(),
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
