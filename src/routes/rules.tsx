import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/rules")({ component: Rules });

const RULES_EN = `Bizarri Chalet Rentals is committed to protecting the privacy and personal information of all guests. We collect only the data necessary to confirm bookings, process payments, and deliver a safe and reliable rental experience. All personal information—such as identification details, contact information, and payment data—is stored securely and used strictly for operational and legal purposes in accordance with Kuwaiti regulations.

We do not share, sell, or disclose guest information to third parties unless required by law or essential to completing your reservation. By booking with Bizarri, guests agree to the responsible use of their information as described in this policy, ensuring a transparent and secure experience throughout their stay.`;

function Rules() {
  const { tr } = useI18n();
  return (
    <PageShell>
      <section className="max-w-3xl mx-auto px-6 py-24 md:py-32">
        <p className="text-xs tracking-[0.4em] uppercase text-muted-foreground mb-6">
          {tr("rules")}
        </p>
        <h1 className="font-display text-5xl md:text-6xl mb-12 animate-fade-up">{tr("rules")}</h1>
        <div
          className="space-y-6 text-foreground/80 leading-relaxed whitespace-pre-line animate-fade-up"
          style={{ animationDelay: "150ms" }}
        >
          {RULES_EN}
        </div>
      </section>
    </PageShell>
  );
}
