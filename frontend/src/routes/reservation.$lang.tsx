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
      <section className="mx-auto max-w-2xl px-6 py-16 md:py-32">
        <p className="mb-6 text-xs uppercase tracking-[0.4em] text-muted-foreground">
          {tr("booking")}
        </p>
        <h1 className="mb-4 font-display text-5xl md:text-6xl">{tr("yourReservation")}</h1>
        <p className="mb-10 text-lg text-muted-foreground">{tr("yourReservationIntro")}</p>

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
