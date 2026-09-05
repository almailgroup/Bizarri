import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import {
  Wifi,
  Tv,
  Cpu,
  Plug,
  Radio,
  Film,
  Bed,
  Sofa,
  Sparkles,
  WashingMachine,
  ChefHat,
  Coffee,
  Moon,
  Waves,
} from "lucide-react";

export const Route = createFileRoute("/facilities")({ component: Facilities });

function Facilities() {
  const { tr, lang } = useI18n();
  usePageMeta(
    lang === "en" ? "Facilities" : "المرافق",
    lang === "en"
      ? "Smart home automation, private pool, full kitchen, 5G internet and more."
      : "منزل ذكي ومسبح خاص ومطبخ متكامل وإنترنت الجيل الخامس والمزيد.",
  );

  const tech = [
    { icon: Wifi, en: "5G Internet", ar: "إنترنت الجيل الخامس" },
    { icon: Radio, en: "WIFI 2.4Ghz / 5Ghz", ar: "واي فاي ٢.٤ / ٥ جيجاهرتز" },
    { icon: Plug, en: "Outlets & USB ports throughout", ar: "منافذ كهرباء و USB في كل مكان" },
    { icon: Cpu, en: "Fully automated Smart Home", ar: "منزل ذكي مؤتمت بالكامل" },
    { icon: Tv, en: '65" TV with 5.1 Sound Bar', ar: "تلفزيون ٦٥ بوصة مع ساوند بار ٥.١" },
    { icon: Radio, en: "Live TV Channels", ar: "قنوات تلفزيونية مباشرة" },
    { icon: Film, en: "Huge library of movies & TV shows", ar: "مكتبة ضخمة من الأفلام والمسلسلات" },
  ];

  const amenities = [
    { icon: Bed, en: "Premium California King Mattress", ar: "فراش كاليفورنيا كنغ فاخر" },
    { icon: Sofa, en: "Spacious & Comfortable Couch", ar: "أريكة واسعة ومريحة" },
    { icon: Sparkles, en: "Fresh linens, towels & soaps", ar: "مفارش ومناشف وصابون طازج" },
    { icon: WashingMachine, en: "Washer & Dryer", ar: "غسالة ونشافة" },
    { icon: ChefHat, en: "Full Kitchen", ar: "مطبخ متكامل" },
    { icon: Coffee, en: "Nespresso Machine with pods", ar: "ماكينة نسبريسو مع كبسولات" },
    { icon: Moon, en: "Blackout Curtains", ar: "ستائر معتمة" },
    { icon: Waves, en: "Beach Towels", ar: "مناشف بحر" },
  ];

  return (
    <PageShell>
      <section className="max-w-6xl mx-auto px-6 py-24 md:py-32">
        <p className="text-xs tracking-[0.4em] uppercase text-muted-foreground mb-6">
          {tr("facilities")}
        </p>
        <h1 className="font-display text-5xl md:text-6xl mb-16 animate-fade-up">
          {lang === "en" ? "Designed for the modern guest" : "مصمم للضيف العصري"}
        </h1>

        <div className="mb-20">
          <h2 className="font-display text-3xl mb-8 border-b border-border pb-4">
            {tr("techEntertainment")}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {tech.map((it, i) => (
              <div
                key={i}
                className="bg-background p-8 hover:bg-secondary transition-colors animate-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <it.icon className="w-6 h-6 mb-4" />
                <p className="text-base">{it[lang]}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-display text-3xl mb-8 border-b border-border pb-4">
            {tr("amenities")}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {amenities.map((it, i) => (
              <div
                key={i}
                className="bg-background p-8 hover:bg-secondary transition-colors animate-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <it.icon className="w-6 h-6 mb-4" />
                <p className="text-base">{it[lang]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
