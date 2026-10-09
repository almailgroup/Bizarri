import { requireLang } from "@/lib/lang-route";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DEFAULT_RATES, formatMoney } from "@/lib/booking";
import { useRates } from "@/lib/api";

export const Route = createFileRoute("/packages/$lang")({
  component: Packages,
  beforeLoad: requireLang,
});

/**
 * The stays sold all year: the three fixed packages and a weekday by the day.
 * Holiday prices are on the Offers page, which is about dates rather than
 * shapes; the two were one page until the owner asked for them apart.
 */
function Packages() {
  const { tr, lang } = useI18n();
  usePageMeta(
    lang === "en" ? "Packages" : "الباقات",
    lang === "en"
      ? "Fixed-rate stay packages for Bizarri Chalet, or a single weekday at the daily rate."
      : "باقات إقامة بسعر ثابت لشاليه بيزاري، أو يوم واحد من أيام الأسبوع بالسعر اليومي.",
  );
  // Rates are admin-editable, so read them rather than hard-coding the figures.
  const { data: stored, isError: ratesFailed } = useRates();
  const rates = stored ?? DEFAULT_RATES;

  // The package the guest has picked, carried to the booking page so it
  // opens on that choice instead of asking for it again: each package is the
  // calendar shape of the same name, and By the day is "day".
  const [chosen, setChosen] = useState<{
    shape: "fullWeek" | "weekday" | "weekend" | "day";
  } | null>(null);
  const isChosen = (shape: string) => chosen?.shape === shape;
  // Tapping the chosen one again lets go of it, as a toggle should.
  const choose = (next: NonNullable<typeof chosen>) =>
    setChosen((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? null : next));

  const packages = [
    {
      key: "fullWeek" as const,
      name: tr("fullWeekPkg"),
      length: tr("days7"),
      span: lang === "en" ? "Sunday → Saturday" : "الأحد → السبت",
      price: rates.fullWeek,
      feature: true,
    },
    {
      key: "weekday" as const,
      name: tr("weekdayPkg"),
      length: tr("days4"),
      span: lang === "en" ? "Sunday → Wednesday" : "الأحد → الأربعاء",
      price: rates.weekday,
      feature: false,
    },
    {
      key: "weekend" as const,
      name: tr("weekendPkg"),
      length: tr("days3"),
      span: lang === "en" ? "Thursday → Saturday" : "الخميس → السبت",
      price: rates.weekend,
      feature: false,
    },
  ];

  return (
    <PageShell>
      <section className="mx-auto max-w-5xl px-6 py-16 md:py-32">
        <p className="mb-6 text-xs uppercase tracking-[0.4em] text-muted-foreground">
          {tr("packages")}
        </p>
        <h1 className="animate-fade-up font-display text-5xl md:text-6xl">{tr("ourPackages")}</h1>
        <p className="animate-fade-up mt-5 max-w-lg text-muted-foreground">
          {tr("packagesPageIntro")}
        </p>

        {ratesFailed && (
          <p className="mt-10 border border-border bg-secondary p-4 text-sm text-muted-foreground">
            {tr("ratesIndicative")}
          </p>
        )}

        <p className="mt-16 text-sm text-muted-foreground">{tr("choosePackageHint")}</p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {packages.map((p, i) => {
            const on = isChosen(p.key);
            return (
              <Reveal key={p.key} delay={i * 80}>
                {/* A choice, not a poster: the chosen card turns light grey
                  with a dark border and a tick -- grey rather than black,
                  which read as heavy on a phone. The featured package keeps a
                  heavier border, so it stands out without looking picked. */}
                <button
                  type="button"
                  onClick={() => choose({ shape: p.key })}
                  aria-pressed={on}
                  className={`relative flex h-full w-full flex-col justify-between border p-8 text-start transition-colors ${
                    on
                      ? "border-foreground bg-secondary"
                      : p.feature
                        ? "border-2 border-foreground hover:bg-secondary/50"
                        : "border-border hover:border-foreground/50"
                  }`}
                >
                  {on && (
                    <span className="absolute end-4 top-4 flex items-center gap-1 text-xs uppercase tracking-widest">
                      <Check className="h-4 w-4" aria-hidden="true" /> {tr("offerChosen")}
                    </span>
                  )}
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      {p.length}
                    </p>
                    <h2 className="mt-3 font-display text-2xl">{p.name}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{p.span}</p>
                  </div>
                  <p className="mt-10 font-display text-4xl">{formatMoney(p.price, lang)}</p>
                </button>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={120}>
          <button
            type="button"
            onClick={() => choose({ shape: "day" })}
            aria-pressed={isChosen("day")}
            className={`relative mt-4 block w-full border p-8 text-start transition-colors ${
              isChosen("day")
                ? "border-foreground bg-secondary"
                : "border-border hover:border-foreground/50"
            }`}
          >
            {isChosen("day") && (
              <span className="absolute end-4 top-4 flex items-center gap-1 text-xs uppercase tracking-widest">
                <Check className="h-4 w-4" aria-hidden="true" /> {tr("offerChosen")}
              </span>
            )}
            <span className="block text-xs uppercase tracking-widest text-muted-foreground">
              {tr("perDayRates")}
            </span>
            <span className="mt-3 block max-w-lg text-muted-foreground">{tr("perDayIntro")}</span>
            <span className="mt-6 flex flex-wrap gap-x-14 gap-y-4">
              <span>
                <span className="block text-xs uppercase tracking-widest text-muted-foreground">
                  {tr("weekdayNight")}
                </span>
                <span className="mt-1 block font-display text-2xl">
                  {formatMoney(rates.dailyWeekday, lang)}
                </span>
              </span>
            </span>
          </button>
        </Reveal>

        <Reveal delay={160}>
          <Link
            to="/booking/$lang"
            params={{ lang }}
            search={chosen ?? {}}
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
