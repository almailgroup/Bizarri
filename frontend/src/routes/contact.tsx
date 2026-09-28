import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useContactInfo } from "@/lib/api";
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
      value: "@bizarri.chalet",
      ltr: true,
      href: contact.instagram,
    },
    {
      icon: MapPin,
      label: tr("location"),
      value: lang === "en" ? "Open in Maps" : "فتح في الخرائط",
      ltr: false,
      href: contact.maps,
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
              // Five cards in two columns leave a sixth cell empty, and the
              // grid's own background shows through it as a grey block. The
              // last card takes the whole row instead.
              className={`group bg-background p-8 hover:bg-black hover:text-white transition-colors animate-fade-up ${
                i === items.length - 1 ? "sm:col-span-2" : ""
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

        {/* The old embed was ?q=Kuwait — a pin on the whole country, which told
            a guest nothing. Until we have the chalet's coordinates this links
            straight to the verified Maps entry instead of showing a wrong map. */}
        <a
          href={contact.maps}
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
