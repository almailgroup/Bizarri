import { requireLang } from "@/lib/lang-route";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";

export const Route = createFileRoute("/about/$lang")({ component: About, beforeLoad: requireLang });

function About() {
  const { tr, lang } = useI18n();
  usePageMeta(
    lang === "en" ? "About" : "عن الشاليه",
    lang === "en"
      ? "About Bizarri Chalet, a private retreat by Almail Group in Al Khiran, Kuwait."
      : "عن شاليه بيزاري، ملاذ خاص من مجموعة الميل في الخيران، الكويت.",
  );
  return (
    <PageShell>
      <section className="max-w-4xl mx-auto px-6 py-16 md:py-32">
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
              {/* What the chalet has, from the Facilities page's list, so the
                  two never describe different places. */}
              <p>
                Bizarri Chalet is a private retreat in Al Khiran, Kuwait, overlooking the lagoon —
                made for families and groups who want space, comfort and total privacy.
              </p>
              <p>
                It has 7 bedrooms for 14 guests, 4 of them master bedrooms; a large living room
                overlooking the swimming pool and the lagoon; a dining table for 12, a bar and
                preparation counter, and a fully equipped kitchen; an electric lift, and balconies
                in most rooms. Outside are a swimming pool with heating, seating and a swing right
                on the lagoon, and a children&apos;s play area with a football pitch — with table
                tennis and a foosball table too, and parking for 9 cars in front of the chalet.
              </p>
              <p>
                A proud member of the Almail Group, Bizarri delivers a hospitality experience that
                is unmistakably Kuwaiti in warmth and unmistakably global in standard.
              </p>
            </>
          ) : (
            <>
              <p>
                شاليه بيزاري ملاذ خاص في الخيران بالكويت، مطل على الخور، صُمّم للعائلات والمجموعات
                الباحثة عن المساحة والراحة والخصوصية التامة.
              </p>
              <p>
                يضم الشاليه 7 غرف نوم تكفي لعدد 14 شخص، منها 4 غرف ماستر، وصالة كبيرة مطلة على حمام
                السباحة والخور، وطاولة طعام تكفي لعدد 12 شخص، وبار وكاونتر تحضيري، ومطبخ مجهز
                بالكامل، ومصعد كهربائي، وبلكونات في غالبية الغرف. وفي الخارج حمام سباحة مع خاصية
                التدفئة، وجلسة وديرفه على الخور مباشرة، ومنطقة ألعاب للأطفال فيها ملعب كرة قدم، إلى
                جانب تنس الطاولة وطاولة البيبي فوت، ومواقف تتسع لعدد 9 سيارات أمام الشاليه.
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
