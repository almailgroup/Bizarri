import { requireLang } from "@/lib/lang-route";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { LegalDoc } from "@/components/LegalDoc";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import { CANCELLATION_POLICY } from "@/lib/legal";

export const Route = createFileRoute("/cancellation/$lang")({
  component: Cancellation,
  beforeLoad: requireLang,
});

/** The cancellation and refund terms on their own: sections 3 and 7 of the terms. */
function Cancellation() {
  const { tr, lang } = useI18n();
  usePageMeta(
    tr("cancellationPolicy"),
    lang === "en"
      ? "Cancellation and refund terms for bookings at Bizarri Chalet."
      : "شروط الإلغاء والاسترداد لحجوزات شاليه بيزاري.",
  );
  return (
    <PageShell>
      <LegalDoc
        label={tr("cancellationPolicy")}
        doc={CANCELLATION_POLICY[lang]}
        numbered={false}
        footer={
          <Link
            to="/rules/$lang"
            params={{ lang }}
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:opacity-70"
          >
            {tr("readFullTerms")}
          </Link>
        }
      />
    </PageShell>
  );
}
