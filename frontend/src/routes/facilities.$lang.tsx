import { requireLang } from "@/lib/lang-route";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import { instagramHandle, useContactInfo } from "@/lib/api";
import {
  Armchair,
  Bath,
  BedDouble,
  Car,
  ChefHat,
  DoorOpen,
  Gamepad2,
  Goal,
  GlassWater,
  Instagram,
  MapPin,
  MoveVertical,
  SatelliteDish,
  Sofa,
  Sparkles,
  Sunset,
  Trophy,
  UtensilsCrossed,
  Waves,
} from "lucide-react";

export const Route = createFileRoute("/facilities/$lang")({
  component: Facilities,
  beforeLoad: requireLang,
});

/**
 * What the chalet has, in the owner's own words (supplied in Arabic, with the
 * English written from it). Numbers are in Latin digits in both languages, as
 * every other number on the site is.
 */
const SECTIONS = [
  {
    en: "Inside",
    ar: "الداخل",
    items: [
      {
        icon: BedDouble,
        en: "7 bedrooms sleeping 14 guests: 4 master bedrooms and 3 twin rooms, with a bathroom between every two rooms",
        ar: "7 غرف نوم تكفي لعدد 14 شخص، منهم 4 غرف ماستر و 3 غرف سراير دبل، بين كل غرفتين حمام",
      },
      {
        icon: Sofa,
        en: "A large living room overlooking the swimming pool and the lagoon",
        ar: "صالة كبيرة مطلة على حمام السباحة والخور",
      },
      { icon: UtensilsCrossed, en: "A dining table for 12", ar: "طاولة طعام تكفي لعدد 12 شخص" },
      { icon: GlassWater, en: "A bar and preparation counter", ar: "بار وكاونتر تحضيري" },
      { icon: Bath, en: "A guest bathroom and washbasins", ar: "حمام ضيوف ومغاسل" },
      { icon: ChefHat, en: "A fully equipped kitchen", ar: "مطبخ مجهز بالكامل" },
      {
        icon: Sparkles,
        en: "Shampoo, shower gel, soap and tissues provided",
        ar: "توفير شامبو وشاور جيل وصابون ومحارم ورقية",
      },
      { icon: DoorOpen, en: "Balconies in most rooms", ar: "بلكونات في غالبية الغرف" },
      { icon: MoveVertical, en: "An electric lift", ar: "مصعد كهربائي" },
    ],
  },
  {
    en: "Outdoors",
    ar: "في الخارج",
    items: [
      {
        icon: Waves,
        en: "An outdoor swimming pool for the warm summer evenings, with heating",
        ar: "حمام سباحة خارجي للإستمتاع بالأجواء الصيفية الدافئة مع إضافة خاصية التدفئة",
      },
      {
        icon: Armchair,
        en: "Outdoor seating right on the lagoon",
        ar: "جلسة خارجية على الخور مباشرة",
      },
      { icon: Sunset, en: "A swing right on the lagoon", ar: "ديرفه على الخور مباشرة" },
      {
        icon: Goal,
        en: "A children's play area with a football pitch, a swing and seating",
        ar: "منطقة ألعاب للأطفال تحتوي على ملعب كرة قدم و ديرفه وجلسة",
      },
      {
        icon: Car,
        en: "Parking for 9 cars in front of the chalet",
        ar: "مواقف تتسع لعدد 9 سيارات أمام الشاليه",
      },
    ],
  },
  {
    en: "Entertainment",
    ar: "الترفيه",
    items: [
      { icon: Trophy, en: "Table tennis", ar: "تنس طاولة" },
      { icon: Gamepad2, en: "A foosball table", ar: "طاولة بيبي فوت" },
      {
        icon: SatelliteDish,
        en: "Arabsat and Nilesat TV channels",
        ar: "محطات تلفزيونية عربسات ونايل سات",
      },
    ],
  },
] as const;

function Facilities() {
  const { tr, lang } = useI18n();
  const contact = useContactInfo();
  usePageMeta(
    lang === "en" ? "Facilities" : "المرافق",
    lang === "en"
      ? "Bizarri Chalet, Al Khiran: 7 bedrooms for 14 guests, a heated pool on the lagoon, a children's play area, parking for 9 cars and more."
      : "شاليه بيزاري، الخيران: 7 غرف نوم تكفي 14 شخص، حمام سباحة مع تدفئة على الخور، منطقة ألعاب للأطفال، مواقف لـ 9 سيارات والمزيد.",
  );

  let n = 0;
  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-32">
        <p className="mb-6 text-xs uppercase tracking-[0.4em] text-muted-foreground">
          {tr("facilities")}
        </p>
        <h1 className="animate-fade-up font-display text-5xl md:text-6xl">
          {lang === "en" ? "Bizarri Chalet for rent" : "تأجير شاليه بيزاري"}
        </h1>
        <p className="animate-fade-up mt-5 flex items-start gap-2 text-muted-foreground">
          <MapPin className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {lang === "en"
              ? "Al Khiran Al Bahri, Road 278, Phase 3"
              : "الخيران البحري، طريق 278، المرحلة الثالثة"}
          </span>
        </p>
        <p className="mt-10 mb-12 text-lg">
          {lang === "en" ? "Bizarri Chalet has:" : "شاليه بيزاري يتكون من:"}
        </p>

        {SECTIONS.map((section) => (
          <div key={section.en} className="mb-20">
            <h2 className="mb-8 border-b border-border pb-4 font-display text-3xl">
              {section[lang]}
            </h2>
            <ul className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((it) => (
                <li
                  key={it.en}
                  className="animate-fade-up bg-background p-8 transition-colors hover:bg-secondary"
                  style={{ animationDelay: `${n++ * 40}ms` }}
                >
                  <it.icon className="mb-4 h-6 w-6" aria-hidden="true" />
                  <p className="text-base">{it[lang]}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* "للحجز والاستفسار": the two ways in the owner's text, from the
            same settings as the footer and the Contact page. */}
        <div className="border border-border p-8 sm:p-10">
          <p className="font-display text-2xl">
            {lang === "en" ? "Bookings and enquiries" : "للحجز والاستفسار"}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <WhatsAppLink
              className="inline-flex items-center gap-2 bg-black px-6 py-3 text-sm uppercase tracking-widest text-white transition-opacity hover:opacity-90"
              label={
                <>
                  WhatsApp ·{" "}
                  {/* Its own direction: in Arabic a leading "+" is otherwise
                      laid out at the end, 94040955 965+. */}
                  <span dir="ltr">{contact.phone.replace(/^\+965\s*/, "+965 ")}</span>
                </>
              }
            />
            <a
              href={contact.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-foreground px-6 py-3 text-sm tracking-widest transition-colors hover:bg-foreground hover:text-background"
            >
              <Instagram className="h-4 w-4" aria-hidden="true" />
              <span dir="ltr">{instagramHandle(contact.instagram)}</span>
            </a>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
