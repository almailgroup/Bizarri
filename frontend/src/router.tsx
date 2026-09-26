import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // React Query's default is three retries with exponential backoff,
        // which leaves a guest looking at an empty page for about seven
        // seconds before anything explains itself. One quick retry covers a
        // blip; past that, say so and offer to try again.
        retry: 1,
        retryDelay: 800,
      },
    },
  });

  const router = createRouter({
    routeTree,
    // Keep the router base path in sync with Vite's `base` (see vite.config.ts),
    // e.g. "/Bizarri/" when served from GitHub Pages.
    basepath: import.meta.env.BASE_URL,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
