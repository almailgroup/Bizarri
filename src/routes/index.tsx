import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import logoWhite from "@/assets/bizarri-logo-white.png";
import heroImg from "@/assets/room-3.jpg";
import room1 from "@/assets/room-1.jpg";
import room4 from "@/assets/room-4.jpg";
import room5 from "@/assets/room-5.jpg";
import { ArrowRight, Cpu, Tv, Waves, ChefHat, Bed, Wifi, MapPin, Phone } from "lucide-react";

export const Route = createFileRoute("/")({ component: Home });

const highlights = [
  { icon: Cpu, en: "Fully automated smart home", ar: "منزل ذكي مؤتمت بالكامل" },
  { icon: Waves, en: "Private pool & beach access", ar: "مسبح خاص وإطلالة على الشاطئ" },
  { icon: Tv, en: '65" TV with 5.1 sound bar', ar: "تلفزيون ٦٥ بوصة مع ساوند بار ٥.١" },
  { icon: Bed, en: "Premium California King bed", ar: "سرير كاليفورنيا كنغ فاخر" },
  { icon: ChefHat, en: "Full kitchen with Nespresso", ar: "مطبخ متكامل مع نسبريسو" },
  { icon: Wifi, en: "5G internet throughout", ar: "إنترنت الجيل الخامس في كل مكان" },
];

function Home() {
  const { tr, lang } = useI18n();
  usePageMeta(
    "",
    lang === "en"
      ? "A premium private chalet experience in Kuwait by Almail Group — smart, private and designed for relaxation."
      : "تجربة شاليه خاص فاخر في الكويت من مجموعة الميل — ذكي وخاص ومصمم للاسترخاء.",
  );

  return (
    <PageShell>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative -mt-20 flex min-h-screen items-center justify-center overflow-hidden bg-black text-white">
        <img
          src={heroImg}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          width={1206}
          height={833}
          className="absolute inset-0 h-full w-full scale-105 object-cover opacity-70"
        />
        {/* Two-stop scrim: keeps the type legible without flattening the photo. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/45 to-black/85" />

        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <p className="animate-fade-in mb-8 text-xs uppercase tracking-[0.5em] text-white/60">
            {tr("almailGroup")} · {lang === "en" ? "Kuwait" : "الكويت"}
          </p>
          {/* The wordmark is the heading — repeating it as display type below
              the logo just said the brand name twice. */}
          <h1 className="animate-scale-in">
            <img
              src={logoWhite}
              alt={tr("brand")}
              width={609}
              height={183}
              className="mx-auto h-20 w-auto md:h-28"
            />
          </h1>
          <p
            className="animate-fade-up mx-auto mt-10 max-w-xl text-lg leading-relaxed text-white/75 md:text-xl"
            style={{ animationDelay: "200ms" }}
          >
            {tr("heroIntro")}
          </p>

          {/* One primary action, one secondary. Location and contact live in
              the header and footer rather than competing here. */}
          <div
            className="animate-fade-up mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
            style={{ animationDelay: "400ms" }}
          >
            <Link
              to="/booking"
              className="group inline-flex w-full items-center justify-center gap-2 bg-white px-10 py-4 text-sm uppercase tracking-widest text-black transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:w-auto"
            >
              {tr("bookNow")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </Link>
            <Link
              to="/facilities"
              className="inline-flex w-full items-center justify-center gap-2 px-6 py-4 text-sm uppercase tracking-widest text-white/80 underline-offset-8 transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:w-auto"
            >
              {tr("exploreChalet")}
            </Link>
          </div>
        </div>

        <a
          href="#chalet"
          className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-white/50 transition-colors hover:text-white"
        >
          <span className="mb-3 block">{tr("scroll")}</span>
          <span className="mx-auto block h-10 w-px overflow-hidden bg-white/20">
            <span
              className="block h-4 w-full bg-white/80"
              style={{ animation: "scrollCue 2s ease-in-out infinite" }}
            />
          </span>
        </a>
        <style>{`
          @keyframes scrollCue {
            0% { transform: translateY(-100%); }
            60%, 100% { transform: translateY(250%); }
          }
          @media (prefers-reduced-motion: reduce) {
            @keyframes scrollCue { 0%, 100% { transform: translateY(50%); } }
          }
        `}</style>
      </section>

      {/* ------------------------------------------------------------ The chalet */}
      <section id="chalet" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-28 md:py-36">
        <Reveal>
          <p className="mb-6 text-xs uppercase tracking-[0.4em] text-muted-foreground">
            {tr("theChalet")}
          </p>
          <h2 className="max-w-2xl text-balance font-display text-4xl md:text-5xl">
            {lang === "en" ? "Everything is already taken care of." : "كل شيء مُجهّز مسبقاً."}
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((h, i) => (
            <Reveal key={h.en} delay={i * 60}>
              <h.icon className="mb-5 h-6 w-6" strokeWidth={1.5} />
              <p className="text-lg leading-snug">{lang === "en" ? h.en : h.ar}</p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <Link
            to="/facilities"
            className="group mt-16 inline-flex items-center gap-2 border-b border-foreground/30 pb-1 text-sm uppercase tracking-widest transition-colors hover:border-foreground"
          >
            {tr("seeAllFacilities")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
          </Link>
        </Reveal>
      </section>

      {/* --------------------------------------------------------------- Gallery */}
      <section className="bg-secondary py-28 md:py-36">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal className="mb-14 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="mb-4 text-xs uppercase tracking-[0.4em] text-muted-foreground">
                {tr("photos")}
              </p>
              <h2 className="font-display text-4xl md:text-5xl">
                {lang === "en" ? "A look inside" : "نظرة من الداخل"}
              </h2>
            </div>
            <Link
              to="/photos"
              className="group inline-flex items-center gap-2 border-b border-foreground/30 pb-1 text-sm uppercase tracking-widest transition-colors hover:border-foreground"
            >
              {tr("seeAllPhotos")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </Link>
          </Reveal>

          {/* Asymmetric grid: one tall lead image, two stacked beside it. */}
          <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2">
            <Reveal className="md:col-span-2 md:row-span-2">
              <Link to="/photos" className="group block h-full overflow-hidden bg-black">
                <img
                  src={room1}
                  alt={lang === "en" ? "Bizarri Chalet interior" : "داخل شاليه بيزاري"}
                  loading="lazy"
                  width={1206}
                  height={780}
                  className="h-full min-h-[280px] w-full object-cover transition-transform duration-700 group-hover:scale-105 md:min-h-[520px]"
                />
              </Link>
            </Reveal>
            {[room4, room5].map((src, i) => (
              <Reveal key={i} delay={(i + 1) * 90}>
                <Link to="/photos" className="group block h-full overflow-hidden bg-black">
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    width={1206}
                    height={785}
                    className="h-full min-h-[200px] w-full object-cover transition-transform duration-700 group-hover:scale-105 md:min-h-[252px]"
                  />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Packages */}
      <section className="mx-auto max-w-5xl px-6 py-28 md:py-36">
        <Reveal className="text-center">
          <p className="mb-6 text-xs uppercase tracking-[0.4em] text-muted-foreground">
            {tr("ourPackages")}
          </p>
          <h2 className="font-display text-4xl md:text-5xl">{tr("stayWithUs")}</h2>
          <p className="mx-auto mt-5 max-w-md text-muted-foreground">{tr("packagesIntro")}</p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {[
            {
              label: tr("weekdayPkg"),
              nights: tr("nights3"),
              en: "Sunday → Wednesday",
              ar: "الأحد → الأربعاء",
            },
            {
              label: tr("weekendPkg"),
              nights: tr("nights2"),
              en: "Thursday → Saturday",
              ar: "الخميس → السبت",
            },
          ].map((p, i) => (
            <Reveal key={p.label} delay={i * 90}>
              <Link
                to="/booking"
                className="group flex h-full flex-col justify-between border border-border p-9 transition-colors hover:border-foreground"
              >
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {p.nights}
                  </p>
                  <p className="mt-3 font-display text-3xl">{p.label}</p>
                  <p className="mt-2 text-muted-foreground">{lang === "en" ? p.en : p.ar}</p>
                </div>
                <ArrowRight className="mt-10 h-5 w-5 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
              </Link>
            </Reveal>
          ))}
        </div>

        <Reveal delay={140} className="mt-12 text-center">
          <Link
            to="/booking"
            className="group inline-flex items-center gap-2 bg-black px-10 py-4 text-sm uppercase tracking-widest text-white transition-opacity hover:opacity-90"
          >
            {tr("startBooking")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
          </Link>
        </Reveal>
      </section>

      {/* -------------------------------------------------------- Find / contact */}
      <section className="border-t border-border">
        <div className="mx-auto grid max-w-7xl gap-px bg-border sm:grid-cols-2">
          <a
            href="https://maps.app.goo.gl/5wjw1skfpqdnDhFa6"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-5 bg-background p-10 transition-colors hover:bg-black hover:text-white"
          >
            <MapPin className="h-6 w-6 shrink-0" strokeWidth={1.5} />
            <span>
              <span className="block text-xs uppercase tracking-widest opacity-60">
                {tr("location")}
              </span>
              <span className="mt-1 block font-display text-2xl">
                {lang === "en" ? "Kuwait" : "الكويت"}
              </span>
            </span>
          </a>
          <a
            href="tel:+96594040955"
            className="group flex items-center gap-5 bg-background p-10 transition-colors hover:bg-black hover:text-white"
          >
            <Phone className="h-6 w-6 shrink-0" strokeWidth={1.5} />
            <span>
              <span className="block text-xs uppercase tracking-widest opacity-60">
                {tr("contact")}
              </span>
              <span className="mt-1 block font-display text-2xl" dir="ltr">
                +965 94040955
              </span>
            </span>
          </a>
        </div>
      </section>

      {/* ---------------------------------------------------------- Almail Group */}
      <section className="bg-black px-6 py-24 text-center text-white">
        <Reveal>
          <p className="mb-4 text-xs uppercase tracking-[0.4em] text-white/40">
            {lang === "en" ? "A member of" : "عضو في"}
          </p>
          <h2 className="mb-6 font-display text-4xl md:text-5xl">{tr("almailGroup")}</h2>
          <p className="mx-auto mb-8 max-w-xl text-white/60">{tr("tagline")}</p>
          <a
            href="https://almailgroup.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-white/30 px-8 py-4 text-sm uppercase tracking-widest transition-colors hover:bg-white hover:text-black"
          >
            {tr("visitAlmail")}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </a>
        </Reveal>
      </section>
    </PageShell>
  );
}
