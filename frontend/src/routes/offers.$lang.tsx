import { requireLang } from "@/lib/lang-route";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import { fmtDate, formatMoney, formatSpan, parseDate } from "@/lib/booking";
import { useSpecialOccasions } from "@/lib/api";

export const Route = createFileRoute("/offers/$lang")({
  component: Offers,
  beforeLoad: requireLang,
});

/**
 * Holiday offers: Eid, national holidays and the like, each with its own
 * dates and one price for the whole stay, entered by the admin under Special
 * Occasions. The year-round stays are on the Packages page.
 *
 * Choosing one and pressing Start opens the booking page on the Holiday
 * shape with that stay already selected, so there is nothing left to pick.
 */
function Offers() {
  const { tr, lang } = useI18n();
  usePageMeta(
    lang === "en" ? "Offers" : "العروض",
    lang === "en"
      ? "Special prices at Bizarri Chalet for Eid, national holidays and other occasions."
      : "أسعار خاصة في شاليه بيزاري للأعياد والعطل الرسمية والمناسبات.",
  );
  const { data: occasions, isLoading } = useSpecialOccasions();
  // Past windows are noise on an offers page; only what can still be booked.
  const today = fmtDate(new Date());
  const upcoming = (occasions ?? [])
    .filter((o) => o.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start));

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
                return (
                  <Reveal key={o.id} delay={i * 80}>
                    <button
                      type="button"
                      // Tapping the chosen one again lets go of it.
                      onClick={() => setChosen(on ? null : o.id)}
                      aria-pressed={on}
                      className={`relative flex h-full w-full flex-col justify-between border p-8 text-start transition-colors ${
                        on
                          ? "border-foreground bg-secondary"
                          : "border-border hover:border-foreground/50"
                      }`}
                    >
                      {on && (
                        <span className="absolute end-4 top-4 flex items-center gap-1 text-xs uppercase tracking-widest">
                          <Check className="h-4 w-4" aria-hidden="true" /> {tr("offerChosen")}
                        </span>
                      )}
                      <span>
                        <span className="block text-xs uppercase tracking-widest text-muted-foreground">
                          {formatSpan(parseDate(o.start), parseDate(o.end), lang)}
                        </span>
                        <span className="mt-3 block font-display text-2xl">
                          {lang === "en" ? o.nameEn : o.nameAr || o.nameEn}
                        </span>
                        <span className="mt-2 block text-sm text-muted-foreground" dir="ltr">
                          {o.start} → {o.end}
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
                search={chosen ? { shape: "holiday", occasion: chosen } : {}}
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
