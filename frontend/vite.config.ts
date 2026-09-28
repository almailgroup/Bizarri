import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// Static single-page-app build (client-only) for GitHub Pages.
// The site is served from https://bizarri.com/, so assets resolve from the
// root. A project-page base like "/Bizarri/" would make every asset URL
// bizarri.com/Bizarri/assets/... , which 404s: nothing loads and the page is
// blank. Override with BASE_PATH to build for a sub-path again.
const base = process.env.BASE_PATH ?? "/";

const SITE = "https://bizarri.com";
const LANGS = ["en", "ar"] as const;

/** The pages, taken from the route files so this cannot drift from them. */
function pageSlugs(): string[] {
  return (
    readdirSync(resolve(__dirname, "src/routes/$lang"))
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => f.replace(/\.tsx$/, ""))
      // route.tsx is the layout and $.tsx is the catch-all; neither is a page.
      .filter((n) => n !== "route" && n !== "$")
      .map((n) => (n === "index" ? "" : n))
  );
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
 * Each copy also carries its own lang, dir and canonical, so a crawler that
 * does not run JavaScript still sees which language it is looking at.
 *
 * 404.html stays as the fallback for anything not listed here.
 */
function staticRoutes(): Plugin {
  return {
    name: "static-routes",
    closeBundle() {
      const out = resolve(__dirname, "dist");
      const shell = readFileSync(resolve(out, "index.html"), "utf8");
      writeFileSync(resolve(out, "404.html"), shell);

      for (const lang of LANGS) {
        const dir = lang === "ar" ? "rtl" : "ltr";
        for (const slug of pageSlugs()) {
          const url = `${SITE}/${lang}${slug ? `/${slug}` : ""}`;
          const html = shell
            .replace(/<html lang="[^"]*" dir="[^"]*">/, `<html lang="${lang}" dir="${dir}">`)
            .replace(
              /<link rel="canonical" href="[^"]*" \/>/,
              `<link rel="canonical" href="${url}" />`,
            )
            .replace(
              /<meta property="og:url" content="[^"]*" \/>/,
              `<meta property="og:url" content="${url}" />`,
            );
          const target = resolve(out, lang, slug);
          mkdirSync(target, { recursive: true });
          writeFileSync(resolve(target, "index.html"), html);
        }
      }
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
