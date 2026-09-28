import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { LANGS, preferredLang, type Lang } from "@/lib/i18n";

/**
 * Every page lives under its language: /en/booking, /ar/booking.
 *
 * The segment is the source of truth for which language the page is in — not
 * a stored preference — so a link to /ar/photos opens in Arabic for whoever
 * follows it, and the two versions are separately addressable for search
 * engines.
 */
export const Route = createFileRoute("/$lang")({
  beforeLoad: ({ params, location }) => {
    if (LANGS.includes(params.lang as Lang)) return;
    // This route matches any single first segment, so /booking arrives here
    // as lang="booking" — and /booking is a real URL that was published
    // before the prefix existed. Push the whole path down a level rather
    // than 404ing links that used to work. A first segment that is neither a
    // language nor a page then lands on the 404 inside a language, which at
    // least speaks to the reader.
    throw redirect({
      to: "/$lang/$",
      params: { lang: preferredLang(), _splat: location.pathname.replace(/^\//, "") },
      replace: true,
    });
  },
  component: () => <Outlet />,
});
