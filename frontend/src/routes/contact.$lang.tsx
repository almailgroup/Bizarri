import { requireLang } from "@/lib/lang-route";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import { instagramHandle, useContactInfo } from "@/lib/api";
import { Phone, Mail, Instagram, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/contact/$lang")({
  component: Contact,
  beforeLoad: requireLang,
});

function Contact() {
  const { tr, lang } = useI18n();
  usePageMeta(
    lang === "en" ? "Contact" : "تواصل معنا",
    lang === "en"
      ? "Reach Bizarri Chalet by phone, WhatsApp, email or Instagram."
      : "تواصل مع شاليه بيزاري عبر الهاتف أو واتساب أو البريد الإلكتروني أو إنستغرام.",
  );
  const contact = useContactInfo();
  // `ltr` marks a value that is Latin or numeric rather than prose. On the
  // Arabic page the surrounding direction is RTL, and a leading "+" or "@" is
  // bidi-neutral, so it gets laid out at the end of the run: +96594040955
  // reads back as 96594040955+. The value needs its own direction.
  const items = [
    {
      icon: Phone,
      label: lang === "en" ? "Phone" : "هاتف",
      value: contact.phone,
      ltr: true,
      href: `tel:${contact.phone}`,
    },
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: contact.phone,
      ltr: true,
      href: `https://wa.me/${contact.whatsapp}`,
    },
    {
      icon: Mail,
      label: lang === "en" ? "Email" : "البريد",
      value: contact.email,
      ltr: true,
      href: `mailto:${contact.email}`,
    },
    {
      icon: Instagram,
      label: "Instagram",
      value: instagramHandle(contact.instagram),
      ltr: true,
      href: contact.instagram,
    },
  ];

  return (
    <PageShell>
      <section className="max-w-5xl mx-auto px-6 py-16 md:py-32">
        <p className="text-xs tracking-[0.4em] uppercase text-muted-foreground mb-6">
          {tr("contact")}
        </p>
        <h1 className="font-display text-5xl md:text-6xl mb-12 animate-fade-up">
          {lang === "en" ? "Get in touch" : "تواصل معنا"}
        </h1>

        <div className="grid sm:grid-cols-2 gap-px bg-border">
          {items.map((it, i) => (
            <a
              key={i}
              href={it.href}
              target={it.href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              // An odd number of cards in two columns leaves a cell empty, and
              // the grid's own background shows through it as a grey block;
              // then the last card takes the whole row instead.
              className={`group bg-background p-8 hover:bg-black hover:text-white transition-colors animate-fade-up ${
                items.length % 2 === 1 && i === items.length - 1 ? "sm:col-span-2" : ""
              }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <it.icon className="w-6 h-6 mb-4" />
              <p className="text-xs uppercase tracking-widest opacity-60">{it.label}</p>
              <p className="font-display text-2xl mt-2">
                {/* The direction goes on an inline run, not the paragraph:
                    dir on the block would also left-align it, pulling the
                    value out from under its right-aligned Arabic label. */}
                {it.ltr ? <span dir="ltr">{it.value}</span> : it.value}
              </p>
            </a>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
