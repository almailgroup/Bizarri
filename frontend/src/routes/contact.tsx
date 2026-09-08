import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Phone, Mail, MapPin, Instagram, MessageCircle, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/contact")({ component: Contact });

function Contact() {
  const { tr, lang } = useI18n();
  usePageMeta(
    lang === "en" ? "Contact" : "تواصل معنا",
    lang === "en"
      ? "Reach Bizarri Chalet by phone, WhatsApp or email, or find us on the map."
      : "تواصل مع شاليه بيزاري عبر الهاتف أو واتساب أو البريد الإلكتروني.",
  );
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

        {/* The old embed was ?q=Kuwait — a pin on the whole country, which told
            a guest nothing. Until we have the chalet's coordinates this links
            straight to the verified Maps entry instead of showing a wrong map. */}
        <a
          href="https://maps.app.goo.gl/5wjw1skfpqdnDhFa6"
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-16 flex flex-wrap items-center justify-between gap-6 border border-border p-10 transition-colors hover:bg-black hover:text-white"
        >
          <span className="flex items-center gap-5">
            <MapPin className="h-8 w-8 shrink-0" strokeWidth={1.25} />
            <span>
              <span className="block text-xs uppercase tracking-widest opacity-60">
                {tr("location")}
              </span>
              <span className="mt-1 block font-display text-3xl">
                {lang === "en" ? "Bizarri Chalet, Kuwait" : "شاليه بيزاري، الكويت"}
              </span>
            </span>
          </span>
          <span className="inline-flex items-center gap-2 text-sm uppercase tracking-widest">
            {lang === "en" ? "Open in Maps" : "فتح في الخرائط"}
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
          </span>
        </a>
      </section>
    </PageShell>
  );
}
