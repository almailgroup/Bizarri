import { useEffect } from "react";

const SITE = "Bizarri Chalet";

function setMeta(selector: string, attr: "content", value: string) {
  const el = document.head.querySelector<HTMLMetaElement>(selector);
  if (el) el.setAttribute(attr, value);
}

/**
 * Per-route document title and description.
 *
 * The app is a client-rendered SPA, so this is what a visitor sees in the tab
 * and what a crawler that executes JS reads. Static crawlers still get the
 * defaults baked into index.html.
 */
export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title ? `${title} — ${SITE}` : SITE;

    if (description) {
      setMeta('meta[name="description"]', "content", description);
      setMeta('meta[property="og:description"]', "content", description);
      setMeta('meta[name="twitter:description"]', "content", description);
    }
    setMeta('meta[property="og:title"]', "content", document.title);
    setMeta('meta[name="twitter:title"]', "content", document.title);

    // Canonical follows the SPA's current location.
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = window.location.href;
    setMeta('meta[property="og:url"]', "content", window.location.href);

    return () => {
      document.title = previousTitle;
    };
  }, [title, description]);
}
