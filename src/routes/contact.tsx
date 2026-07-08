import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";
import { Phone, Mail, MapPin, Instagram, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/contact")({ component: Contact });

function Contact() {
  const { tr, lang } = useI18n();
  const items = [
    {
      icon: Phone,
      label: lang === "en" ? "Phone" : "هاتف",
      value: "+965 94040955",
      href: "tel:+96594040955",
    },
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: "+965 94040955",
      href: "https://wa.me/96594040955",
    },
    {
      icon: Mail,
      label: lang === "en" ? "Email" : "البريد",
      value: "sales@bizarri.com",
      href: "mailto:sales@bizarri.com",
    },
    {
      icon: Instagram,
      label: "Instagram",
      value: "@bizarri.chalet",
      href: "https://www.instagram.com/bizarri.chalet?igsh=N3Y2bDZ2ZHFnNDNz",
    },
    {
      icon: MapPin,
      label: tr("location"),
      value: lang === "en" ? "Open in Maps" : "فتح في الخرائط",
      href: "https://maps.app.goo.gl/5wjw1skfpqdnDhFa6",
    },
  ];

  return (
    <PageShell>
      <section className="max-w-5xl mx-auto px-6 py-24 md:py-32">
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
              className="group bg-background p-8 hover:bg-black hover:text-white transition-colors animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <it.icon className="w-6 h-6 mb-4" />
              <p className="text-xs uppercase tracking-widest opacity-60">{it.label}</p>
              <p className="font-display text-2xl mt-2">{it.value}</p>
            </a>
          ))}
        </div>

        <div className="mt-16">
          <iframe
            src="https://www.google.com/maps?q=Kuwait&output=embed"
            className="w-full h-[400px] grayscale border border-border"
            loading="lazy"
            title="Map"
          />
        </div>
      </section>
    </PageShell>
  );
}
