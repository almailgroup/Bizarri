import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";

export const Route = createFileRoute("/news")({ component: News });

export interface NewsItem {
  id: string;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  date: string; // ISO
}

function News() {
  const { tr, lang } = useI18n();
  usePageMeta(
    lang === "en" ? "News" : "الأخبار",
    lang === "en"
      ? "Latest news and announcements from Bizarri Chalet."
      : "آخر الأخبار والإعلانات من شاليه بيزاري.",
  );
  const [items, setItems] = useState<NewsItem[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("bizarri_news") || "[]");
      setItems(stored);
    } catch {
      /* ignore malformed localStorage */
    }
  }, []);

  const sorted = [...items].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <PageShell>
      <section className="max-w-4xl mx-auto px-6 py-24 md:py-32">
        <p className="text-xs tracking-[0.4em] uppercase text-muted-foreground mb-6">
          {tr("news")}
        </p>
        <h1 className="font-display text-5xl md:text-6xl mb-12">{tr("latestNews")}</h1>

        {sorted.length === 0 && (
          <div className="border border-border p-16 text-center">
            <Newspaper className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">{tr("noNews")}</p>
          </div>
        )}

        <div className="space-y-8">
          {sorted.map((it) => (
            <article key={it.id} className="border border-border p-8 hover-lift animate-fade-up">
              <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">
                {new Date(it.date).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
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
