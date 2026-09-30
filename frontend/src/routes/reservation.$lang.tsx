import { requireLang } from "@/lib/lang-route";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { BookingLookup } from "@/components/BookingLookup";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";

export const Route = createFileRoute("/reservation/$lang")({
  component: Reservation,
  beforeLoad: requireLang,
});

function Reservation() {
  const { tr, lang } = useI18n();
  usePageMeta(
    lang === "en" ? "Your Reservation" : "حجزك",
    lang === "en"
      ? "Check the status of your Bizarri Chalet booking request."
      : "تحقق من حالة طلب حجزك في شاليه بيزاري.",
  );

  return (
    <PageShell>
      <section className="mx-auto max-w-2xl px-6 py-10 sm:py-16 md:py-32">
        <p className="mb-6 text-xs uppercase tracking-[0.4em] text-muted-foreground">
          {tr("booking")}
        </p>
        {/* This page is a tool, not something to read: the only reason anyone
            opens it is to find out where their request stands. The heading
            keeps the size every other page uses, so it still looks like the
            same site, but the gaps around it close up on a phone -- at the
            site's normal spacing the input landed below the fold on a 360x740
            screen, so the one control on the page was out of sight on arrival. */}
        <h1 className="mb-3 font-display text-4xl sm:mb-4 sm:text-5xl md:text-6xl">
          {tr("yourReservation")}
        </h1>
        <p className="mb-6 text-base text-muted-foreground sm:mb-10 sm:text-lg">
          {tr("yourReservationIntro")}
        </p>

        <BookingLookup heading={false} />

        <p className="mt-12 border-t border-border pt-8 text-sm text-muted-foreground">
          <Link
            to="/booking/$lang"
            params={{ lang }}
            className="-my-2 inline-block py-2 underline underline-offset-4 hover:text-foreground"
          >
            {tr("startBooking")}
          </Link>
        </p>
      </section>
    </PageShell>
  );
}
