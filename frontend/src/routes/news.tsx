import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";
import { usePublishedNews } from "@/lib/api";
import { usePageMeta } from "@/hooks/use-page-meta";

import { AlertCircle, Newspaper } from "lucide-react";

export const Route = createFileRoute("/news")({ component: News });

function News() {
  const { tr, lang } = useI18n();
  usePageMeta(
    lang === "en" ? "News" : "الأخبار",
    lang === "en"
      ? "Latest news and announcements from Bizarri Chalet."
      : "آخر الأخبار والإعلانات من شاليه بيزاري.",
  );
  const { data: items, isError, isLoading, refetch } = usePublishedNews();
  const sorted = items ?? [];

  return (
    <PageShell>
      <section className="max-w-4xl mx-auto px-6 py-24 md:py-32">
        <p className="text-xs tracking-[0.4em] uppercase text-muted-foreground mb-6">
          {tr("news")}
        </p>
        <h1 className="font-display text-5xl md:text-6xl mb-12">{tr("latestNews")}</h1>

        {isLoading && (
          <p className="text-sm text-muted-foreground">
            {lang === "en" ? "Loading…" : "جارٍ التحميل…"}
          </p>
        )}

        {isError && (
          <div className="border border-destructive p-16 text-center">
            <AlertCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
            <p className="text-muted-foreground">{tr("newsUnavailable")}</p>
            <button
              onClick={() => refetch()}
              className="mt-6 border border-border px-6 py-3 text-xs uppercase tracking-widest hover:bg-secondary"
            >
              {tr("tryAgain")}
            </button>
          </div>
        )}

        {!isError && !isLoading && sorted.length === 0 && (
          <div className="border border-border p-16 text-center">
            <Newspaper className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">{tr("noNews")}</p>
          </div>
        )}

        <div className="space-y-8">
          {sorted.map((it) => (
            <article key={it.id} className="border border-border p-8 hover-lift animate-fade-up">
              <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">
                {new Date(it.published_at ?? it.created_at).toLocaleDateString(
                  lang === "ar" ? "ar-EG" : "en-US",
                  {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  },
                )}
              </p>
              <h2 className="font-display text-3xl md:text-4xl mb-4">
                {lang === "ar" ? it.title_ar || it.title_en : it.title_en || it.title_ar}
              </h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {lang === "ar" ? it.body_ar || it.body_en : it.body_en || it.body_ar}
              </p>
            </article>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
