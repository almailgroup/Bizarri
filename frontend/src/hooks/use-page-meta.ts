import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { pagePath, pageSeo } from "@/lib/seo";

const SITE = "https://bizarri.com";

function setMeta(selector: string, value: string) {
  document.head.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", value);
}

function setLink(selector: string, href: string) {
  const el = document.head.querySelector<HTMLLinkElement>(selector);
  if (el) el.href = href;
}

/**
 * The page's title, description and language links, from src/lib/seo.ts.
 *
 * The build has already written the same words into each page's HTML file;
 * this keeps the tab and the tags right as the visitor moves between pages
 * without a reload, and for a crawler that reads the page after it runs.
 */
export function usePageSeo(slug: string) {
  const { lang } = useI18n();
  useEffect(() => {
    const { title, description } = pageSeo(slug, lang);
    const previousTitle = document.title;
    document.title = title;

    if (description) {
      setMeta('meta[name="description"]', description);
      setMeta('meta[property="og:description"]', description);
      setMeta('meta[name="twitter:description"]', description);
    }
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[property="og:locale"]', lang === "ar" ? "ar_KW" : "en_US");
    setMeta('meta[property="og:locale:alternate"]', lang === "ar" ? "en_US" : "ar_KW");

    // Always the public address of the page, without a query string: the
    // booking page's ?shape= or ?doc= is the same page, not another one.
    const url = SITE + pagePath(slug, lang);
    setLink('link[rel="canonical"]', url);
    setMeta('meta[property="og:url"]', url);
    setLink('link[rel="alternate"][hreflang="en"]', SITE + pagePath(slug, "en"));
    setLink('link[rel="alternate"][hreflang="ar"]', SITE + pagePath(slug, "ar"));
    setLink('link[rel="alternate"][hreflang="x-default"]', SITE + pagePath(slug, "en"));

    return () => {
      document.title = previousTitle;
    };
  }, [slug, lang]);
}
