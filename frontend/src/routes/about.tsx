import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";

export const Route = createFileRoute("/about")({ component: About });

function About() {
  const { tr, lang } = useI18n();
  usePageMeta(
    lang === "en" ? "About" : "عن الشاليه",
    lang === "en"
      ? "About Bizarri Chalet, a private retreat by Almail Group in Kuwait."
      : "عن شاليه بيزاري، ملاذ خاص من مجموعة الميل في الكويت.",
  );
  return (
    <PageShell>
      <section className="max-w-4xl mx-auto px-6 py-24 md:py-32">
        <p className="text-xs tracking-[0.4em] uppercase text-muted-foreground mb-6">
          {tr("about")}
        </p>
        <h1 className="font-display text-5xl md:text-6xl mb-10 animate-fade-up">{tr("brand")}</h1>
        <div
          className="space-y-6 text-lg leading-relaxed text-foreground/80 animate-fade-up"
          style={{ animationDelay: "150ms" }}
        >
          {lang === "en" ? (
            <>
              <p>
                Bizarri Chalet is a private modern retreat in Kuwait, conceived for travelers who
                appreciate discreet luxury, intelligent design, and the rare comfort of total
                privacy.
              </p>
              <p>
                Every detail — from the fully automated smart home and 5G connectivity to the
                premium California King mattress and curated entertainment library — has been
                considered to make each stay seamless, restful, and effortlessly elevated.
              </p>
              <p>
                A proud member of the Almail Group, Bizarri delivers a hospitality experience that
                is unmistakably Kuwaiti in warmth and unmistakably global in standard.
              </p>
            </>
          ) : (
            <>
              <p>
                شاليه بيزاري هو ملاذ عصري خاص في الكويت، صُمّم لعشاق الفخامة الهادئة والتصميم الذكي
                والخصوصية التامة.
              </p>
              <p>
                كل تفصيل — من نظام المنزل الذكي وشبكة الجيل الخامس إلى فراش كاليفورنيا كنغ ومكتبة
                الترفيه المختارة بعناية — تم اختياره ليجعل إقامتكم سلسة ومريحة وفاخرة.
              </p>
              <p>
                شاليه بيزاري عضو فخور في مجموعة الميل، نقدم تجربة ضيافة كويتية الطابع بمعايير
                عالمية.
              </p>
            </>
          )}
        </div>
      </section>
    </PageShell>
  );
}
