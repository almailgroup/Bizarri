import { copyFileSync } from "node:fs";
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

/**
 * GitHub Pages serves 404.html for any path it has no file for, so the SPA
 * shell has to be there under that name or every deep link is a real 404.
 *
 * This lives in the build rather than in the deploy workflow so the artifact
 * is the same locally as in CI — otherwise nothing can check it before it is
 * already live.
 */
function spaFallback(): Plugin {
  return {
    name: "spa-fallback",
    closeBundle() {
      const out = resolve(__dirname, "dist");
      copyFileSync(resolve(out, "index.html"), resolve(out, "404.html"));
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    spaFallback(),
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
