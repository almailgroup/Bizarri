import { requireLang } from "@/lib/lang-route";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DEFAULT_RATES, fmtDate, formatMoney } from "@/lib/booking";
import { useRates, useSpecialOccasions } from "@/lib/api";

export const Route = createFileRoute("/offers/$lang")({
  component: Offers,
  beforeLoad: requireLang,
});

function Offers() {
  const { tr, lang } = useI18n();
  usePageMeta(
    lang === "en" ? "Offers" : "العروض",
    lang === "en"
      ? "Fixed-rate stay packages for Bizarri Chalet, plus per-day rates for custom dates."
      : "باقات إقامة بسعر ثابت لشاليه بيزاري، وأسعار يومية للتواريخ المخصصة.",
  );
  // Rates are admin-editable, so read them rather than hard-coding the figures.
  const { data: stored, isError: ratesFailed } = useRates();
  const rates = stored ?? DEFAULT_RATES;
  const { data: occasions } = useSpecialOccasions();
  // Past windows are noise on a price list; only what is still bookable.
  const today = fmtDate(new Date());
  const upcoming = (occasions ?? []).filter((o) => o.end >= today);

  // The offer the guest has picked, carried to the booking page so it opens
  // on that choice instead of asking for it again. A package becomes the
  // calendar shape of the same name; a special occasion becomes the Holiday
  // shape with that occasion's stay already selected.
  const [chosen, setChosen] = useState<
    | { shape: "fullWeek" | "weekday" | "weekend" | "day" }
    | { shape: "holiday"; occasion: string }
    | null
  >(null);
  const isChosen = (shape: string, occasion?: string) =>
    chosen?.shape === shape &&
    (occasion === undefined || ("occasion" in chosen && chosen.occasion === occasion));
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
          {tr("offers")}
        </p>
        <h1 className="animate-fade-up font-display text-5xl md:text-6xl">{tr("ourPackages")}</h1>
        <p className="animate-fade-up mt-5 max-w-lg text-muted-foreground">{tr("offersIntro")}</p>

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

        {upcoming.length > 0 && (
          <Reveal delay={140}>
            <div className="mt-4 border border-border p-8">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {tr("specialOccasions")}
              </p>
              <p className="mt-3 max-w-lg text-muted-foreground">{tr("occasionsPublicIntro")}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {upcoming.map((o) => {
                  const on = isChosen("holiday", o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => choose({ shape: "holiday", occasion: o.id })}
                      aria-pressed={on}
                      className={`border p-4 text-start transition-colors ${
                        on
                          ? "border-foreground bg-secondary"
                          : "border-border hover:border-foreground/50"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                        {lang === "en" ? o.nameEn : o.nameAr || o.nameEn}
                        {on && <Check className="h-4 w-4" aria-hidden="true" />}
                      </span>
                      <span className="mt-1 block font-display text-2xl">
                        {formatMoney(o.price, lang)}
                      </span>
                      <span className="block text-sm text-muted-foreground" dir="ltr">
                        {o.start} → {o.end}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Reveal>
        )}

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
