import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";
import { LANGS, preferredLang, useI18n, type Lang } from "@/lib/i18n";
import { usePageSeo } from "@/hooks/use-page-meta";
import logoWhite from "@/assets/bizarri-logo-white.png";
import heroImg from "@/assets/banner.webp";
import heroImgPortrait from "@/assets/banner-portrait.webp";
import { photo } from "@/lib/gallery";
import { useRates } from "@/lib/api";
import { formatMoney } from "@/lib/booking";
import { pageSeo } from "@/lib/seo";

// The gallery preview: the pool at sunset to lead, then the living room and a
// bedroom -- outside, in, and where you sleep, which is the order a guest
// weighs a chalet in.
const PREVIEW_LEAD = photo("pool-01");
const PREVIEW_SIDE = [photo("living-01"), photo("rooms-01")];
import {
  ArrowRight,
  Armchair,
  BedDouble,
  Car,
  Goal,
  UtensilsCrossed,
  Waves,
  MapPin,
  Phone,
} from "lucide-react";

/**
 * The homepage, /en or /ar.
 *
 * This route matches any single segment, so it also catches /facilities —
 * a page URL from before the language suffix existed, and still out there in
 * anything already shared. Those move to /facilities/<lang> rather than 404.
 */
export const Route = createFileRoute("/$lang")({
  component: Home,
  beforeLoad: ({ params }) => {
    if (LANGS.includes(params.lang as Lang)) return;
    throw redirect({
      href: `${import.meta.env.BASE_URL}${params.lang}/${preferredLang()}`,
      replace: true,
    });
  },
});

// Six of the Facilities page's items, in the owner's words, so the two pages
// never describe different chalets. The full list is one link away.
const highlights = [
  { icon: BedDouble, en: "7 bedrooms sleeping 14 guests", ar: "7 غرف نوم تكفي لعدد 14 شخص" },
  {
    icon: Waves,
    en: "An outdoor swimming pool, with heating",
    ar: "حمام سباحة خارجي مع خاصية التدفئة",
  },
  { icon: Armchair, en: "Outdoor seating right on the lagoon", ar: "جلسة خارجية على الخور مباشرة" },
  {
    icon: UtensilsCrossed,
    en: "A fully equipped kitchen and dining for 12",
    ar: "مطبخ مجهز بالكامل وطاولة طعام تكفي لعدد 12 شخص",
  },
  {
    icon: Goal,
    en: "A children's play area with a football pitch",
    ar: "منطقة ألعاب للأطفال مع ملعب كرة قدم",
  },
  { icon: Car, en: "Parking for 9 cars", ar: "مواقف تتسع لعدد 9 سيارات" },
];

function Home() {
  const { tr, lang } = useI18n();
  usePageSeo("");

  return (
    <PageShell>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative -mt-20 flex min-h-screen items-center justify-center overflow-hidden bg-black text-white">
        <picture>
          <source media="(max-width: 640px)" srcSet={heroImgPortrait} />
          <img
            src={heroImg}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            width={2400}
            height={1350}
            className="absolute inset-0 h-full w-full scale-105 object-cover"
          />
        </picture>
        {/* The building is lit and centred, which is exactly where the type
            sits, so the scrim is strongest through the middle rather than at
            the edges — the usual top/bottom vignette would leave the wordmark
            over bright windows. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/65 to-black/80" />

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
              width={1400}
              height={510}
              className="mx-auto h-24 w-auto md:h-36"
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
              to="/booking/$lang"
              params={{ lang }}
              className="group inline-flex w-full items-center justify-center gap-2 bg-white px-10 py-4 text-sm uppercase tracking-widest text-black transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:w-auto"
            >
              {tr("bookNow")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </Link>
            <Link
              to="/facilities/$lang"
              params={{ lang }}
              className="inline-flex w-full items-center justify-center gap-2 px-6 py-4 text-sm uppercase tracking-widest text-white/80 underline-offset-8 transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:w-auto"
            >
              {tr("exploreChalet")}
            </Link>
          </div>
        </div>

        <a
          href="#chalet"
          className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-xs uppercase tracking-[0.3em] text-white/50 transition-colors hover:text-white"
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
            to="/facilities/$lang"
            params={{ lang }}
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
              to="/photos/$lang"
              params={{ lang }}
              className="group inline-flex items-center gap-2 border-b border-foreground/30 pb-1 text-sm uppercase tracking-widest transition-colors hover:border-foreground"
            >
              {tr("seeAllPhotos")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </Link>
          </Reveal>

          {/* Asymmetric grid: one tall lead image, two stacked beside it. */}
          <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2">
            <Reveal className="md:col-span-2 md:row-span-2">
              <Link
                to="/photos/$lang"
                params={{ lang }}
                className="group block h-full overflow-hidden bg-black"
              >
                <img
                  src={PREVIEW_LEAD.full}
                  alt={lang === "en" ? "The pool at Bizarri Chalet" : "المسبح في شاليه بيزاري"}
                  loading="lazy"
                  decoding="async"
                  width={2000}
                  height={1445}
                  className="h-full min-h-[280px] w-full object-cover transition-transform duration-700 group-hover:scale-105 md:min-h-[520px]"
                />
              </Link>
            </Reveal>
            {PREVIEW_SIDE.map(({ thumb: src }, i) => (
              <Reveal key={i} delay={(i + 1) * 90}>
                <Link
                  to="/photos/$lang"
                  params={{ lang }}
                  className="group block h-full overflow-hidden bg-black"
                >
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={800}
                    height={600}
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
            // Days, as the Packages page counts them. These said 3 and 2
            // nights, which the 2 PM check-in and noon check-out make 4
            // and 3: Sun 2 PM to Thu noon, Thu 2 PM to Sun noon.
            {
              shape: "weekday" as const,
              label: tr("weekdayPkg"),
              nights: tr("days4"),
              en: "Sunday → Wednesday",
              ar: "الأحد → الأربعاء",
            },
            {
              shape: "weekend" as const,
              label: tr("weekendPkg"),
              nights: tr("days3"),
              en: "Thursday → Saturday",
              ar: "الخميس → السبت",
            },
          ].map((p, i) => (
            <Reveal key={p.label} delay={i * 90}>
              {/* Straight to the booking page with this package chosen, as
                  the Packages page does. */}
              <Link
                to="/booking/$lang"
                params={{ lang }}
                search={{ shape: p.shape }}
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
            to="/booking/$lang"
            params={{ lang }}
            className="group inline-flex items-center gap-2 bg-black px-10 py-4 text-sm uppercase tracking-widest text-white transition-opacity hover:opacity-90"
          >
            {tr("startBooking")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
          </Link>
        </Reveal>
      </section>

      <Questions />

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
                {lang === "en" ? "Al Khiran, Kuwait" : "الخيران، الكويت"}
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

/**
 * What guests ask before they book, answered on the page.
 *
 * Also what someone types into a search box -- a chalet for rent in Kuwait,
 * booking Al Khiran on weekdays or for the weekend, a chalet with a pool,
 * the prices -- so the homepage says those things in those words. The
 * prices come from the rates the owner sets in the dashboard; until they
 * load (or if they cannot), the answer points to the Packages page instead
 * of quoting figures that may be out of date.
 */
function Questions() {
  const { lang } = useI18n();
  const { data: rates } = useRates();
  const en = lang === "en";
  const m = (n: number) => formatMoney(n, lang);

  const prices = rates
    ? en
      ? `The Sunday to Wednesday package is ${m(rates.weekday)}, the Thursday to Saturday weekend is ${m(rates.weekend)}, and a full week is ${m(rates.fullWeek)}. A single weekday is ${m(rates.dailyWeekday)}. Holidays such as Eid are priced on their own, and current deals are on the Offers page.`
      : `باقة الأحد – الأربعاء بسعر ${m(rates.weekday)}، وباقة الويكند من الخميس إلى السبت بسعر ${m(rates.weekend)}، والأسبوع الكامل بسعر ${m(rates.fullWeek)}، ويوم واحد من أيام الأسبوع بسعر ${m(rates.dailyWeekday)}. أسعار المناسبات مثل العيد مختلفة، وأحدث العروض في صفحة العروض.`
    : en
      ? "The prices of the Sunday to Wednesday package, the weekend and a full week are on the Packages page, and current deals are on the Offers page."
      : "أسعار باقة الأحد – الأربعاء وباقة الويكند والأسبوع الكامل في صفحة الباقات، وأحدث العروض في صفحة العروض.";

  const items = en
    ? [
        [
          "Where is Bizarri Chalet?",
          "In Al Khiran Al Bahri, Kuwait (Road 278, Phase 3), with outdoor seating right on the lagoon.",
        ],
        ["How much does it cost to rent the chalet?", prices],
        [
          "Can I book weekdays, or only the weekend?",
          "Either. Book Sunday to Wednesday, the weekend from Thursday to Saturday, a full week, or a single weekday. Check-in is at 2:00 PM and check-out at 12:00 PM (noon).",
        ],
        [
          "Does the chalet have a pool?",
          "Yes: an outdoor swimming pool with heating, beside outdoor seating on the lagoon. The whole chalet is yours alone for the stay.",
        ],
        [
          "Is it suitable for families?",
          "It is a private family chalet: 7 bedrooms sleeping 14 guests, a fully equipped kitchen and dining for 12, a children's play area with a football pitch, and parking for 9 cars.",
        ],
        [
          "How do I book?",
          "Choose your dates on the booking page and send a request. We confirm it with you, and you can reach us by phone or WhatsApp with any question.",
        ],
      ]
    : [
        [
          "أين يقع شاليه بيزاري؟",
          "في الخيران البحري بالكويت (طريق 278، المرحلة الثالثة)، مع جلسة خارجية على الخور مباشرة.",
        ],
        ["كم أسعار إيجار الشاليه في الخيران؟", prices],
        [
          "هل يمكن حجز شاليه الخيران أيام الأسبوع أو للويكند؟",
          "نعم، الاثنان. احجز من الأحد إلى الأربعاء، أو الويكند من الخميس إلى السبت، أو أسبوعاً كاملاً، أو يوماً واحداً من أيام الأسبوع. الدخول الساعة 2:00 مساءً والخروج الساعة 12:00 ظهراً.",
        ],
        [
          "هل في الشاليه مسبح؟",
          "نعم، حمام سباحة خارجي مع خاصية التدفئة بجانب جلسة خارجية على الخور، والشاليه بالكامل لك وحدك طوال الإقامة.",
        ],
        [
          "هل الشاليه مناسب للعائلات؟",
          "شاليه عائلي خاص: 7 غرف نوم تكفي لعدد 14 شخص، ومطبخ مجهز بالكامل وطاولة طعام تكفي لعدد 12 شخص، ومنطقة ألعاب للأطفال مع ملعب كرة قدم، ومواقف تتسع لعدد 9 سيارات.",
        ],
        [
          "كيف أحجز الشاليه؟",
          "اختر التواريخ في صفحة الحجز وأرسل طلبك، وسنؤكد الحجز معك. ولأي سؤال تواصل معنا بالهاتف أو واتساب.",
        ],
      ];

  // Real links rather than words in the answers: each one a full-size target.
  const links = [
    { to: "/booking/$lang", slug: "booking" },
    { to: "/packages/$lang", slug: "packages" },
    { to: "/offers/$lang", slug: "offers" },
    { to: "/contact/$lang", slug: "contact" },
  ] as const;

  return (
    <section className="border-t border-border bg-secondary">
      <div className="mx-auto max-w-6xl px-6 py-28 md:py-36" data-testid="home-questions">
        <Reveal>
          <p className="mb-6 text-xs uppercase tracking-[0.4em] text-muted-foreground">
            {en ? "Good to know" : "معلومات تهمك"}
          </p>
          <h2 className="font-display text-4xl md:text-5xl">
            {en ? "Renting a chalet in Al Khiran" : "حجز شاليه في الخيران"}
          </h2>
          <p className="mt-5 max-w-xl text-muted-foreground">
            {en
              ? "Looking for a chalet in Kuwait? These are the questions guests ask before they book Bizarri."
              : "تبحث عن شاليه للتأجير في الكويت؟ إليك أكثر ما يسأل عنه الضيوف قبل حجز شاليه بيزاري."}
          </p>
        </Reveal>

        <dl className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {items.map(([q, a], i) => (
            <Reveal key={q} delay={(i % 2) * 60}>
              <dt className="text-lg font-semibold leading-snug">{q}</dt>
              <dd className="mt-3 leading-relaxed text-muted-foreground">{a}</dd>
            </Reveal>
          ))}
        </dl>

        <div className="mt-14 flex flex-wrap gap-3">
          {links.map((l) => (
            <Link
              key={l.slug}
              to={l.to}
              params={{ lang }}
              className="inline-flex min-h-11 items-center gap-2 border border-foreground/30 px-5 text-sm uppercase tracking-widest transition-colors hover:border-foreground"
            >
              {pageSeo(l.slug, lang).nav}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
