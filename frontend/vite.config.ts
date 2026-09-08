import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// Static single-page-app build (client-only) for GitHub Pages.
// `base` must match the repository name so assets resolve under
// https://<user>.github.io/Bizarri/. Override with BASE_PATH for a custom domain.
const base = process.env.BASE_PATH ?? "/Bizarri/";

export default defineConfig({
  base,
  plugins: [
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
