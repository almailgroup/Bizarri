import { MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useContactInfo } from "@/lib/api";
import { fmtDate } from "@/lib/booking";

/**
 * WhatsApp is how most guests here would rather talk, and the booking form
 * asks for a Civil ID up front — a real reason to drop out. This gives that
 * guest somewhere to go instead of the back button.
 */
export function WhatsAppLink({
  context,
  className,
  label,
}: {
  /** Folded into the prefilled message so we open on what they were doing. */
  context?: { chaletId?: number; start?: Date | null; end?: Date | null };
  className?: string;
  label?: string;
}) {
  const { tr, lang } = useI18n();
  const contact = useContactInfo();

  const parts: string[] = [
    lang === "en"
      ? "Hello Bizarri Chalet, I would like to ask about a booking."
      : "مرحباً شاليه بيزاري، أود الاستفسار عن الحجز.",
  ];
  if (context?.chaletId) {
    parts.push(lang === "en" ? `Chalet ${context.chaletId}` : `شاليه ${context.chaletId}`);
  }
  if (context?.start && context?.end) {
    parts.push(`${fmtDate(context.start)} → ${fmtDate(context.end)}`);
  }

  const href = `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(parts.join(" · "))}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "inline-flex items-center gap-2 border border-border px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-secondary"
      }
    >
      <MessageCircle className="h-4 w-4" />
      {label ?? tr("bookOnWhatsapp")}
    </a>
  );
}
