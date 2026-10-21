import { requireLang } from "@/lib/lang-route";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { LegalDoc } from "@/components/LegalDoc";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import { TERMS } from "@/lib/legal";

export const Route = createFileRoute("/rules/$lang")({ component: Rules, beforeLoad: requireLang });

/**
 * The Terms & Conditions every guest accepts at booking. At /rules, where the
 * footer, the menu and the booking form have always pointed, so no link
 * already shared stops working.
 */
function Rules() {
  const { tr, lang } = useI18n();
  usePageMeta(
    tr("rules"),
    lang === "en"
      ? "The terms and conditions for booking and staying at Bizarri Chalet."
      : "الشروط والأحكام لحجز شاليه بيزاري والإقامة فيه.",
  );
  return (
    <PageShell>
      <LegalDoc
        label={tr("rules")}
        doc={TERMS[lang]}
        footer={
          <Link
            to="/cancellation/$lang"
            params={{ lang }}
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:opacity-70"
          >
            {tr("cancellationPolicy")}
          </Link>
        }
      />
    </PageShell>
  );
}
