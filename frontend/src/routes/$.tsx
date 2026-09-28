import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { LANGS, preferredLang, type Lang } from "@/lib/i18n";

/**
 * Everything the named routes did not match.
 *
 * Its one real job is the shape the site briefly shipped with, /en/facilities,
 * before the language moved to the end. Those URLs were live and in a sitemap,
 * so they are turned around rather than dropped. Anything else is a genuine
 * 404, rendered inside a language so the page can speak it.
 */
export const Route = createFileRoute("/$")({
  beforeLoad: ({ params }) => {
    const parts = (params._splat ?? "").split("/").filter(Boolean);
    if (parts.length === 2 && LANGS.includes(parts[0] as Lang)) {
      // href rather than to/params: the target is built from the URL that
      // came in, not from a route this file knows the name of.
      throw redirect({
        href: `${import.meta.env.BASE_URL}${parts[1]}/${parts[0]}`,
        replace: true,
      });
    }
    // Two segments ending in a language is a page route; if we are here it did
    // not match one, so the page does not exist.
    throw notFound();
  },
});
