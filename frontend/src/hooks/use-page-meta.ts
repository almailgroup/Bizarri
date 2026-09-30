import { useEffect } from "react";

/**
 * Both names, always, because both are the name.
 *
 * It is what the tab says, what a search result links, and what someone sees
 * when the page is shared. An Arabic speaker searching شاليه بيزاري should
 * find the same title an English speaker does rather than a translation of
 * it, so the site carries one bilingual name in both languages instead of a
 * different one each way.
 */
const SITE = "Bizarri Chalet | شاليه بيزاري";

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
