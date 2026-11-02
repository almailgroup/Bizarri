/**
 * What each page is called in a search result: its title and description,
 * per language.
 *
 * One table, read twice: by the build (vite.config.ts), which writes it into
 * each page's HTML file so a crawler has it before any JavaScript runs, and
 * by usePageSeo, which sets the same words in the tab as the visitor moves
 * around. Relative imports only, so the build can load it without the app's
 * path aliases.
 *
 * The words are the ones people search with. The English pages lead with
 * "Bizarri Chalet Kuwait" (Bizarri, Bizarri Kuwait, Chalet Kuwait), and the
 * Arabic ones with the phrases Kuwaiti guests type: شاليه للإيجار في الخيران,
 * حجز شاليه في الخيران, شاليه بمسبح, أسعار إيجار شاليهات الخيران. Titles stay
 * near 60 characters, which is about what a result shows before it cuts off.
 */

export type SeoLang = "en" | "ar";

export type PageSeo = {
  /** The tab and the search result's headline. */
  title: string;
  /** The search result's snippet. */
  description: string;
  /** What the page is called in a list of links. */
  nav: string;
};

/** Pages that are not for search results at all. */
export const NOINDEX = new Set(["admin"]);

export const SEO: Record<string, Record<SeoLang, PageSeo>> = {
  "": {
    en: {
      title: "Bizarri Chalet Kuwait | Private Chalet for Rent in Al Khiran",
      description:
        "Bizarri Chalet is a private family chalet for rent in Al Khiran, Kuwait: 7 bedrooms for 14 guests, a heated pool, seating on the lagoon and a children's play area.",
      nav: "Home",
    },
    ar: {
      title: "شاليه بيزاري | شاليه خاص للإيجار في الخيران، الكويت",
      description:
        "شاليه بيزاري شاليه عائلي خاص للإيجار في الخيران، الكويت: 7 غرف نوم تكفي لعدد 14 شخص، مسبح مع خاصية التدفئة، جلسة على الخور ومنطقة ألعاب للأطفال. احجز أيام الأسبوع أو الويكند.",
      nav: "الرئيسية",
    },
  },
  booking: {
    en: {
      title: "Book a Chalet in Al Khiran, Kuwait | Bizarri Chalet",
      description:
        "Book Bizarri Chalet in Al Khiran for the weekdays, the weekend or a full week. See the free dates on the calendar and send your booking request online.",
      nav: "Booking",
    },
    ar: {
      title: "حجز شاليه في الخيران – أيام الأسبوع والويكند | شاليه بيزاري",
      description:
        "حجز شاليه الخيران أيام الأسبوع أو للويكند أو أسبوعاً كاملاً: شاهد الأيام المتاحة على التقويم وأرسل طلب حجز شاليه بيزاري مباشرة من الموقع.",
      nav: "الحجز",
    },
  },
  packages: {
    en: {
      title: "Chalet Rental Prices in Al Khiran | Bizarri Chalet Kuwait",
      description:
        "Prices for renting Bizarri Chalet in Al Khiran, Kuwait: the Sunday to Wednesday package, the Thursday to Saturday weekend, a full week, or a single weekday.",
      nav: "Packages",
    },
    ar: {
      title: "أسعار إيجار شاليهات الخيران | باقات شاليه بيزاري",
      description:
        "أسعار إيجار شاليه بيزاري في الخيران: باقة الأحد – الأربعاء، باقة الويكند من الخميس إلى السبت، الأسبوع الكامل، أو يوم واحد من أيام الأسبوع بالسعر اليومي.",
      nav: "الباقات",
    },
  },
  facilities: {
    en: {
      title: "Chalet with a Pool in Al Khiran | Bizarri Chalet Facilities",
      description:
        "Bizarri Chalet, Al Khiran: 7 bedrooms for 14 guests, an outdoor pool with heating, seating on the lagoon, a children's play area, parking for 9 cars and more.",
      nav: "Facilities",
    },
    ar: {
      title: "شاليه بمسبح في الخيران | مرافق شاليه بيزاري",
      description:
        "شاليه بيزاري، الخيران: 7 غرف نوم تكفي لعدد 14 شخص، حمام سباحة خارجي مع خاصية التدفئة، جلسة على الخور، منطقة ألعاب للأطفال، مواقف لـ 9 سيارات والمزيد.",
      nav: "المرافق",
    },
  },
  photos: {
    en: {
      title: "Photos of Bizarri Chalet, Al Khiran, Kuwait",
      description:
        "Photos of Bizarri Chalet in Al Khiran, Kuwait: the pool, the living rooms, the bedrooms and the lagoon.",
      nav: "Photos",
    },
    ar: {
      title: "صور شاليه بيزاري | شاليه للإيجار في الخيران",
      description:
        "صور شاليه بيزاري في الخيران، الكويت: المسبح والصالات وغرف النوم والإطلالة على الخور.",
      nav: "الصور",
    },
  },
  offers: {
    en: {
      title: "Chalet Offers in Kuwait | Bizarri Chalet, Al Khiran",
      description:
        "Special offers at Bizarri Chalet in Al Khiran, Kuwait: selected dates at one price for the whole stay.",
      nav: "Offers",
    },
    ar: {
      title: "عروض حجز شاليه في الكويت | شاليه بيزاري، الخيران",
      description:
        "عروض خاصة في شاليه بيزاري بالخيران، الكويت: تواريخ مختارة بسعر واحد للإقامة كاملة.",
      nav: "العروض",
    },
  },
  about: {
    en: {
      title: "About Bizarri Chalet | Private Family Chalet in Kuwait",
      description:
        "About Bizarri Chalet, a private family chalet by Almail Group in Al Khiran, Kuwait.",
      nav: "About",
    },
    ar: {
      title: "عن شاليه بيزاري | شاليه عائلي في الكويت",
      description: "عن شاليه بيزاري، شاليه عائلي خاص من مجموعة الميل في الخيران، الكويت.",
      nav: "عن الشاليه",
    },
  },
  contact: {
    en: {
      title: "Contact Bizarri Chalet | Chalet in Al Khiran, Kuwait",
      description:
        "Reach Bizarri Chalet in Al Khiran Al Bahri, Kuwait, by phone, WhatsApp, email or Instagram.",
      nav: "Contact Us",
    },
    ar: {
      title: "تواصل مع شاليه بيزاري | شاليه في الخيران، الكويت",
      description:
        "تواصل مع شاليه بيزاري في الخيران البحري، الكويت، عبر الهاتف أو واتساب أو البريد الإلكتروني أو إنستغرام.",
      nav: "تواصل معنا",
    },
  },
  news: {
    en: {
      title: "News | Bizarri Chalet Kuwait",
      description: "Latest news and announcements from Bizarri Chalet in Al Khiran, Kuwait.",
      nav: "News",
    },
    ar: {
      title: "الأخبار | شاليه بيزاري، الكويت",
      description: "آخر الأخبار والإعلانات من شاليه بيزاري في الخيران، الكويت.",
      nav: "الأخبار",
    },
  },
  rules: {
    en: {
      title: "Terms & Conditions | Bizarri Chalet Kuwait",
      description: "The terms and conditions for booking and staying at Bizarri Chalet.",
      nav: "Terms & Conditions",
    },
    ar: {
      title: "الشروط والأحكام | شاليه بيزاري",
      description: "الشروط والأحكام لحجز شاليه بيزاري والإقامة فيه.",
      nav: "الشروط والأحكام",
    },
  },
  cancellation: {
    en: {
      title: "Cancellation & Refund Policy | Bizarri Chalet Kuwait",
      description: "Cancellation and refund terms for bookings at Bizarri Chalet.",
      nav: "Cancellation & Refund Policy",
    },
    ar: {
      title: "سياسة الإلغاء والاسترداد | شاليه بيزاري",
      description: "شروط الإلغاء والاسترداد لحجوزات شاليه بيزاري.",
      nav: "سياسة الإلغاء والاسترداد",
    },
  },
  privacy: {
    en: {
      title: "Privacy Policy | Bizarri Chalet Kuwait",
      description: "How Bizarri Chalet handles your information.",
      nav: "Privacy Policy",
    },
    ar: {
      title: "سياسة الخصوصية | شاليه بيزاري",
      description: "كيف يتعامل شاليه بيزاري مع معلوماتك.",
      nav: "سياسة الخصوصية",
    },
  },
  reservation: {
    en: {
      title: "Your Reservation | Bizarri Chalet Kuwait",
      description: "Check the status of your Bizarri Chalet booking request.",
      nav: "Your Reservation",
    },
    ar: {
      title: "حجزك | شاليه بيزاري",
      description: "تحقق من حالة طلب حجزك في شاليه بيزاري.",
      nav: "حجزك",
    },
  },
  admin: {
    en: { title: "Admin | Bizarri Chalet", description: "", nav: "Admin" },
    ar: { title: "المسؤول | شاليه بيزاري", description: "", nav: "المسؤول" },
  },
};

/** The order pages are listed in for a crawler that does not run JavaScript. */
export const NAV_ORDER = [
  "",
  "booking",
  "packages",
  "offers",
  "facilities",
  "photos",
  "about",
  "news",
  "contact",
  "rules",
  "cancellation",
  "privacy",
];

export function pageSeo(slug: string, lang: SeoLang): PageSeo {
  const page = SEO[slug];
  if (!page) throw new Error(`No search title for the page "${slug}" — add it to src/lib/seo.ts`);
  return page[lang];
}

/** The path of a page in a language: /facilities/en, and /en for the home page. */
export function pagePath(slug: string, lang: SeoLang): string {
  return slug ? `/${slug}/${lang}` : `/${lang}`;
}
