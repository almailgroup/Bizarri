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
    // Instant, not the stylesheet's smooth scrolling, which the router would
    // otherwise inherit: a new page appeared wherever the last one had been
    // scrolled to and then slid up through itself for most of a second --
    // 3,600px of the home page going past before its hero. Smooth stays for
    // what it is for, links within a page; arriving on a page is not that.
    // Back restores the old position the same way: at once.
    scrollRestorationBehavior: "instant",
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};

/**
 * Registers the route tree with the router's types, so `to` on every Link and
 * navigate is checked against the routes that actually exist rather than
 * being any string. Without this a link to a page that moved — or to
 * /booking after everything moved under /$lang — compiles happily and 404s
 * at runtime.
 */
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
