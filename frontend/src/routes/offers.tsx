import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DEFAULT_RATES, formatMoney } from "@/lib/booking";
import { useRates } from "@/lib/api";

export const Route = createFileRoute("/offers")({ component: Offers });

function Offers() {
  const { tr, lang } = useI18n();
  usePageMeta(
    lang === "en" ? "Offers" : "العروض",
    lang === "en"
      ? "Fixed-rate stay packages for Bizarri Chalet, plus per-day rates for custom dates."
      : "باقات إقامة بسعر ثابت لشاليه بيزاري، وأسعار يومية للتواريخ المخصصة.",
  );
  // Rates are admin-editable, so read them rather than hard-coding the figures.
  const { data: stored } = useRates();
  const rates = stored ?? DEFAULT_RATES;

  const packages = [
    {
      key: "fullWeek",
      name: tr("fullWeekPkg"),
      length: tr("days7"),
      span: lang === "en" ? "Sunday → Saturday" : "الأحد → السبت",
      price: rates.fullWeek,
      feature: true,
    },
    {
      key: "weekday",
      name: tr("weekdayPkg"),
      length: tr("days4"),
      span: lang === "en" ? "Sunday → Wednesday" : "الأحد → الأربعاء",
      price: rates.weekday,
      feature: false,
    },
    {
      key: "weekend",
      name: tr("weekendPkg"),
      length: tr("days3"),
      span: lang === "en" ? "Thursday → Saturday" : "الخميس → السبت",
      price: rates.weekend,
      feature: false,
    },
  ];

  return (
    <PageShell>
      <section className="mx-auto max-w-5xl px-6 py-24 md:py-32">
        <p className="mb-6 text-xs uppercase tracking-[0.4em] text-muted-foreground">
          {tr("offers")}
        </p>
        <h1 className="animate-fade-up font-display text-5xl md:text-6xl">{tr("ourPackages")}</h1>
        <p className="animate-fade-up mt-5 max-w-lg text-muted-foreground">{tr("offersIntro")}</p>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {packages.map((p, i) => (
            <Reveal key={p.key} delay={i * 80}>
              <div
                className={`flex h-full flex-col justify-between border p-8 ${
                  p.feature ? "border-foreground bg-foreground text-background" : "border-border"
                }`}
              >
                <div>
                  <p
                    className={`text-xs uppercase tracking-widest ${
                      p.feature ? "opacity-70" : "text-muted-foreground"
                    }`}
                  >
                    {p.length}
                  </p>
                  <h2 className="mt-3 font-display text-2xl">{p.name}</h2>
                  <p
                    className={`mt-2 text-sm ${p.feature ? "opacity-70" : "text-muted-foreground"}`}
                  >
                    {p.span}
                  </p>
                </div>
                <p className="mt-10 font-display text-4xl">{formatMoney(p.price, lang)}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <div className="mt-4 border border-border p-8">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {tr("perDayRates")}
            </p>
            <p className="mt-3 max-w-lg text-muted-foreground">{tr("perDayIntro")}</p>
            <dl className="mt-6 flex flex-wrap gap-x-14 gap-y-4">
              <div>
                <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                  {tr("weekdayNight")}
                </dt>
                <dd className="mt-1 font-display text-2xl">
                  {formatMoney(rates.dailyWeekday, lang)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                  {tr("weekendNight")}
                </dt>
                <dd className="mt-1 font-display text-2xl">
                  {formatMoney(rates.dailyWeekend, lang)}
                </dd>
              </div>
            </dl>
          </div>
        </Reveal>

        <Reveal delay={160}>
          <Link
            to="/booking"
            className="group mt-12 inline-flex items-center gap-2 bg-black px-10 py-4 text-sm uppercase tracking-widest text-white transition-opacity hover:opacity-90"
          >
            {tr("startBooking")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
          </Link>
        </Reveal>
      </section>
    </PageShell>
  );
}
