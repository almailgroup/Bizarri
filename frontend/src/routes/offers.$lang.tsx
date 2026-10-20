import { requireLang } from "@/lib/lang-route";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import { daysBetween, eachDay, fmtDate, formatMoney, formatSpan, parseDate } from "@/lib/booking";
import { useAvailabilityFor, useChalets, useOffers } from "@/lib/api";

export const Route = createFileRoute("/offers/$lang")({
  component: Offers,
  beforeLoad: requireLang,
});

/**
 * Offers: dates the admin has picked and priced, one price for the whole
 * stay, entered under Offers in the dashboard. Special occasions (Eid and the
 * like) are not here; they are booked under Special Occasions on the booking
 * page. The year-round stays are on the Packages page.
 *
 * Choosing one and pressing Start opens the booking page with that stay
 * already selected, on its chalet, so there is nothing left to pick. One
 * whose dates are already taken on every chalet it covers says so and
 * cannot be chosen.
 */
function Offers() {
  const { tr, lang } = useI18n();
  usePageMeta(
    lang === "en" ? "Offers" : "العروض",
    lang === "en"
      ? "Special offers at Bizarri Chalet: selected dates at one price for the whole stay."
      : "عروض خاصة في شاليه بيزاري: تواريخ مختارة بسعر واحد للإقامة كاملة.",
  );
  const { data: offers, isLoading } = useOffers();
  const { data: chalets } = useChalets();
  // Only what can still be booked: an offer is sold whole, so one that has
  // already begun is gone, not "on"; and one for a chalet that has been
  // switched off is for nothing a guest can book.
  const today = fmtDate(new Date());
  const upcoming = useMemo(
    () =>
      (offers ?? [])
        .filter((o) => o.start >= today)
        .filter((o) => !chalets || o.chaletId === null || chalets.some((c) => c.id === o.chaletId))
        .sort((a, b) => a.start.localeCompare(b.start) || a.price - b.price),
    [offers, chalets, today],
  );

  // Whether each offer's dates are still free on a chalet it covers, from the
  // same calendar the booking page reads. Until that is known, it is offered.
  const chaletIds = (chalets ?? []).map((c) => c.id);
  const from = upcoming.reduce((m, o) => (!m || o.start < m ? o.start : m), "");
  const to = upcoming.reduce((m, o) => (o.end > m ? o.end : m), "");
  const calendars = useAvailabilityFor(chaletIds, from, to);
  const taken = (o: (typeof upcoming)[number]) => {
    const ids = o.chaletId === null ? chaletIds : [o.chaletId];
    const days = eachDay(parseDate(o.start), parseDate(o.end)).map(fmtDate);
    return ids.every((id) => {
      const data = calendars[chaletIds.indexOf(id)]?.data;
      if (!data) return false;
      const blocked = new Map(data.map((d) => [d.day, d.blocked]));
      return days.some((d) => blocked.get(d) !== false);
    });
  };
  const chaletName = (id: number) => {
    const c = (chalets ?? []).find((x) => x.id === id);
    return c ? (lang === "en" ? c.name_en : c.name_ar) : "";
  };

  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <PageShell>
      <section className="mx-auto max-w-5xl px-6 py-16 md:py-32">
        <p className="mb-6 text-xs uppercase tracking-[0.4em] text-muted-foreground">
          {tr("offers")}
        </p>
        <h1 className="animate-fade-up font-display text-5xl md:text-6xl">{tr("specialOffers")}</h1>
        <p className="animate-fade-up mt-5 max-w-lg text-muted-foreground">
          {tr("offersPageIntro")}
        </p>

        {upcoming.length > 0 ? (
          <>
            <p className="mt-16 text-sm text-muted-foreground">{tr("chooseOfferHint")}</p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {upcoming.map((o, i) => {
                const on = chosen === o.id;
                const gone = taken(o);
                const n = daysBetween(parseDate(o.start), parseDate(o.end));
                const title =
                  (lang === "en" ? o.titleEn : o.titleAr || o.titleEn) || tr("specialOffer");
                return (
                  <Reveal key={o.id} delay={i * 80}>
                    <button
                      type="button"
                      // Tapping the chosen one again lets go of it.
                      onClick={() => setChosen(on ? null : o.id)}
                      disabled={gone}
                      aria-pressed={on}
                      className={`relative flex h-full w-full flex-col justify-between border p-8 text-start transition-colors ${
                        on
                          ? "border-foreground bg-secondary"
                          : gone
                            ? "cursor-not-allowed border-border text-muted-foreground"
                            : "border-border hover:border-foreground/50"
                      }`}
                    >
                      {(on || gone) && (
                        <span className="absolute end-4 top-4 flex items-center gap-1 text-xs uppercase tracking-widest">
                          {on ? (
                            <>
                              <Check className="h-4 w-4" aria-hidden="true" /> {tr("offerChosen")}
                            </>
                          ) : (
                            tr("offerBooked")
                          )}
                        </span>
                      )}
                      <span>
                        <span className="block text-xs uppercase tracking-widest text-muted-foreground">
                          {formatSpan(parseDate(o.start), parseDate(o.end), lang)}
                        </span>
                        <span className="mt-3 block font-display text-2xl">{title}</span>
                        <span className="mt-2 block text-sm text-muted-foreground" dir="ltr">
                          {o.start} → {o.end}
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {n === 1 ? tr("oneDayShort") : tr("nDaysShort").replace("{n}", String(n))}
                          {o.chaletId !== null &&
                            chaletName(o.chaletId) &&
                            ` · ${tr("offerOnlyChalet").replace("{chalet}", chaletName(o.chaletId))}`}
                        </span>
                      </span>
                      <span className="mt-10 block font-display text-4xl">
                        {formatMoney(o.price, lang)}
                      </span>
                    </button>
                  </Reveal>
                );
              })}
            </div>

            <Reveal delay={160}>
              <Link
                to="/booking/$lang"
                params={{ lang }}
                search={chosen ? { offer: chosen } : {}}
                className="group mt-12 inline-flex items-center gap-2 bg-black px-10 py-4 text-sm uppercase tracking-widest text-white transition-opacity hover:opacity-90"
              >
                {tr("startBooking")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
              </Link>
            </Reveal>
          </>
        ) : (
          !isLoading && (
            // Nothing running: say so, and point to what is always available
            // rather than leaving an empty page.
            <div className="mt-16 border border-border p-8 sm:p-10" role="status">
              <p className="font-display text-2xl">{tr("noOffersTitle")}</p>
              <p className="mt-3 max-w-prose text-sm text-muted-foreground">{tr("noOffersBody")}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <WhatsAppLink
                  label={tr("askAboutOffers")}
                  className="inline-flex items-center gap-2 border border-foreground px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-foreground hover:text-background"
                />
                <Link
                  to="/packages/$lang"
                  params={{ lang }}
                  className="group inline-flex items-center gap-2 bg-black px-6 py-3 text-sm uppercase tracking-widest text-white transition-opacity hover:opacity-90"
                >
                  {tr("seePackages")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
                </Link>
              </div>
            </div>
          )
        )}
      </section>
    </PageShell>
  );
}
