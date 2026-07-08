import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";
import logoWhite from "@/assets/bizarri-logo-white.png";
import { ArrowRight, MapPin, Phone, Calendar } from "lucide-react";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { tr } = useI18n();
  return (
    <PageShell>
      {/* Hero */}
      <section className="relative -mt-20 min-h-screen flex items-center justify-center bg-black text-white overflow-hidden">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_center,_oklch(0.3_0_0),_transparent_70%)]" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs tracking-[0.5em] uppercase text-white/50 mb-8 animate-fade-in">
            {tr("almailGroup")} • Kuwait
          </p>
          <img
            src={logoWhite}
            alt="Bizarri Chalet"
            className="mx-auto h-24 md:h-32 mb-10 animate-scale-in"
          />
          <h1 className="font-display text-5xl md:text-7xl font-light text-balance animate-fade-up">
            {tr("brand")}
          </h1>
          <p
            className="mt-8 text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed animate-fade-up"
            style={{ animationDelay: "200ms" }}
          >
            {tr("heroIntro")}
          </p>
          <div
            className="mt-12 flex flex-wrap items-center justify-center gap-3 animate-fade-up"
            style={{ animationDelay: "400ms" }}
          >
            <Link
              to="/booking"
              className="group inline-flex items-center gap-2 px-8 py-4 bg-white text-black text-sm tracking-widest uppercase hover:bg-white/90 transition-all"
            >
              {tr("bookNow")}{" "}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/facilities"
              className="inline-flex items-center gap-2 px-8 py-4 border border-white/30 text-sm tracking-widest uppercase hover:bg-white hover:text-black transition-all"
            >
              {tr("viewFacilities")}
            </Link>
            <a
              href="https://maps.app.goo.gl/5wjw1skfpqdnDhFa6"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 border border-white/30 text-sm tracking-widest uppercase hover:bg-white hover:text-black transition-all"
            >
              <MapPin className="w-4 h-4" /> {tr("location")}
            </a>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 border border-white/30 text-sm tracking-widest uppercase hover:bg-white hover:text-black transition-all"
            >
              {tr("contact")}
            </Link>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 text-xs tracking-[0.3em] uppercase animate-fade-in">
          Scroll
        </div>
      </section>

      {/* Quick highlights */}
      <section className="py-32 px-6 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-12">
          {[
            { icon: Calendar, t: tr("booking"), d: tr("startBooking"), to: "/booking" },
            { icon: Phone, t: tr("contact"), d: "+965 94040955", to: "/contact" },
            { icon: MapPin, t: tr("location"), d: "Kuwait", to: "/contact" },
          ].map((it, i) => (
            <Link key={i} to={it.to} className="group block border border-border p-10 hover-lift">
              <it.icon className="w-7 h-7 mb-6" />
              <h3 className="font-display text-2xl mb-2">{it.t}</h3>
              <p className="text-muted-foreground text-sm">{it.d}</p>
              <ArrowRight className="w-4 h-4 mt-6 group-hover:translate-x-1 transition-transform" />
            </Link>
          ))}
        </div>
      </section>

      {/* Almail Group */}
      <section className="bg-black text-white py-24 px-6 text-center">
        <p className="text-xs tracking-[0.4em] uppercase text-white/40 mb-4">A member of</p>
        <h2 className="font-display text-4xl md:text-5xl mb-6">{tr("almailGroup")}</h2>
        <p className="text-white/60 max-w-xl mx-auto mb-8">{tr("tagline")}</p>
        <a
          href="https://almailgroup.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-8 py-4 border border-white/30 text-sm tracking-widest uppercase hover:bg-white hover:text-black transition-all"
        >
          {tr("visitAlmail")} <ArrowRight className="w-4 h-4" />
        </a>
      </section>
    </PageShell>
  );
}
