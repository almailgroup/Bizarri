import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ar";

type Dict = Record<string, { en: string; ar: string }>;

export const t: Dict = {
  brand: { en: "Bizarri Chalet", ar: "شاليه بيزاري" },
  tagline: {
    en: "A premium private chalet experience by Almail Group.",
    ar: "تجربة شاليه خاصة فاخرة من مجموعة الميل.",
  },
  home: { en: "Home", ar: "الرئيسية" },
  about: { en: "About", ar: "عن الشاليه" },
  facilities: { en: "Facilities", ar: "المرافق" },
  photos: { en: "Photos", ar: "الصور" },
  booking: { en: "Booking", ar: "الحجز" },
  news: { en: "News", ar: "الأخبار" },
  rules: { en: "Rules & Regulations", ar: "القوانين والأحكام" },
  privacy: { en: "Privacy Policy", ar: "سياسة الخصوصية" },
  contact: { en: "Contact Us", ar: "تواصل معنا" },
  admin: { en: "Admin", ar: "المسؤول" },
  adminAccess: { en: "Admin Access", ar: "دخول المسؤول" },
  bookNow: { en: "Book Now", ar: "احجز الآن" },
  viewFacilities: { en: "View Facilities", ar: "عرض المرافق" },
  location: { en: "Location", ar: "الموقع" },
  heroIntro: {
    en: "A private modern chalet experience in Kuwait, designed for comfort, privacy, technology, and relaxation.",
    ar: "تجربة شاليه عصري خاص في الكويت، مصمم للراحة والخصوصية والتقنية والاسترخاء.",
  },
  menu: { en: "Menu", ar: "القائمة" },
  close: { en: "Close", ar: "إغلاق" },
  language: { en: "العربية", ar: "English" },
  startBooking: { en: "Start your booking request", ar: "ابدأ طلب الحجز" },
  invalidSelection: {
    en: "Invalid selection. Please pick a Sunday or Thursday — packages auto-fill.",
    ar: "اختيار غير صالح. يرجى اختيار يوم الأحد أو الخميس — تُحدد الباقات تلقائياً.",
  },
  fullName: { en: "Full Name", ar: "الاسم الكامل" },
  phone: { en: "Phone Number", ar: "رقم الهاتف" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  guests: { en: "Number of Guests", ar: "عدد الضيوف" },
  selectedDates: { en: "Selected Dates", ar: "التواريخ المحددة" },
  notes: { en: "Notes / Special Requests", ar: "ملاحظات / طلبات خاصة" },
  submit: { en: "Submit Booking Request", ar: "إرسال طلب الحجز" },
  weekdayPkg: { en: "Sun – Wed Package", ar: "باقة الأحد – الأربعاء" },
  weekendPkg: { en: "Thu – Sat Package", ar: "باقة الخميس – السبت" },
  comingSoon: { en: "Coming Soon", ar: "قريباً" },
  thankYou: {
    en: "Thank you. Your booking request has been received.",
    ar: "شكراً لك. تم استلام طلب الحجز.",
  },
  techEntertainment: { en: "Technology & Entertainment", ar: "التقنية والترفيه" },
  amenities: { en: "Amenities", ar: "المرافق والخدمات" },
  almailGroup: { en: "Almail Group", ar: "مجموعة الميل" },
  visitAlmail: { en: "Visit Almail Group", ar: "زيارة مجموعة الميل" },
  chatTitle: { en: "Almail AI", ar: "الميل الذكاء" },
  chatPlaceholder: {
    en: "Ask about Bizarri or Almail Group…",
    ar: "اسأل عن بيزاري أو مجموعة الميل…",
  },
  chatGreet: {
    en: "Hello — I'm Almail AI. Ask me anything about Bizarri Chalet or Almail Group.",
    ar: "أهلاً — أنا الميل الذكاء. اسألني عن شاليه بيزاري أو مجموعة الميل.",
  },
  password: { en: "Password", ar: "كلمة المرور" },
  login: { en: "Login", ar: "تسجيل الدخول" },
  logout: { en: "Logout", ar: "تسجيل الخروج" },
  dashboard: { en: "Admin Dashboard", ar: "لوحة التحكم" },
  pickChalet: { en: "Choose Chalet", ar: "اختر الشاليه" },
  bizarri1: { en: "Bizarri Chalet 1", ar: "شاليه بيزاري ١" },
  bizarri2: { en: "Bizarri Chalet 2", ar: "شاليه بيزاري ٢" },
  latestNews: { en: "Latest News", ar: "آخر الأخبار" },
  noNews: { en: "No news yet. Check back soon.", ar: "لا توجد أخبار بعد. عودوا قريباً." },
  imageMode: { en: "Image", ar: "صورة" },
  textMode: { en: "Chat", ar: "محادثة" },
  imageNotice: {
    en: "Image generation only works for Bizarri Chalet related prompts (interiors, pool, rooms, branding, etc.).",
    ar: "إنشاء الصور يعمل فقط مع طلبات تتعلق بشاليه بيزاري (الداخل، المسبح، الغرف، الهوية...).",
  },
  generating: { en: "Generating image…", ar: "جارٍ إنشاء الصورة…" },
  introMember: { en: "A Member of Almail Group", ar: "عضو في مجموعة الميل" },
  introTagline: { en: "A Private Luxury Experience", ar: "تجربة فاخرة خاصة" },
  skip: { en: "Skip", ar: "تخطي" },
  stayWithUs: { en: "Stay with us", ar: "أقم معنا" },
  exploreChalet: { en: "Explore the chalet", ar: "استكشف الشاليه" },
  viewGallery: { en: "View the gallery", ar: "شاهد المعرض" },
  ourPackages: { en: "Our Packages", ar: "باقاتنا" },
  packagesIntro: {
    en: "Two fixed stays, each with the whole chalet to yourself.",
    ar: "إقامتان محددتان، ولك الشاليه بالكامل في كلٍ منهما.",
  },
  nights3: { en: "3 nights", ar: "٣ ليالٍ" },
  nights2: { en: "2 nights", ar: "ليلتان" },
  theChalet: { en: "The Chalet", ar: "الشاليه" },
  seeAllFacilities: { en: "See all facilities", ar: "عرض كل المرافق" },
  seeAllPhotos: { en: "See all photos", ar: "عرض كل الصور" },
  scroll: { en: "Scroll", ar: "مرر" },

  // Offers
  offers: { en: "Offers", ar: "العروض" },
  offersIntro: {
    en: "Fixed-rate packages for the whole chalet. Custom dates are priced per day.",
    ar: "باقات بسعر ثابت للشاليه بالكامل. التواريخ المخصصة تُسعّر يومياً.",
  },
  fullWeekPkg: { en: "Full Week Package", ar: "باقة الأسبوع الكامل" },
  days7: { en: "7 days", ar: "٧ أيام" },
  days4: { en: "4 days", ar: "٤ أيام" },
  days3: { en: "3 days", ar: "٣ أيام" },
  perDayRates: { en: "Custom dates", ar: "تواريخ مخصصة" },
  perDayIntro: {
    en: "Any other stay of 3 days or more is priced per day.",
    ar: "أي إقامة أخرى من ٣ أيام فأكثر تُسعّر يومياً.",
  },
  weekdayNight: { en: "Sun – Wed, per day", ar: "الأحد – الأربعاء، لليوم" },
  weekendNight: { en: "Thu – Sat, per day", ar: "الخميس – السبت، لليوم" },

  // Booking calendar
  selectDates: { en: "Select your dates", ar: "اختر تواريخك" },
  pickStart: { en: "Tap a day to start", ar: "اضغط على يوم للبدء" },
  pickEnd: { en: "Now tap your check-out day", ar: "الآن اضغط على يوم المغادرة" },
  minStay: {
    en: "Minimum stay is 3 days.",
    ar: "الحد الأدنى للإقامة ٣ أيام.",
  },
  rangeBlocked: {
    en: "Those dates include a day that isn't available.",
    ar: "التواريخ المحددة تتضمن يوماً غير متاح.",
  },
  total: { en: "Total", ar: "الإجمالي" },
  checkIn: { en: "Check-in", ar: "الوصول" },
  checkOut: { en: "Check-out", ar: "المغادرة" },
  nightsLabel: { en: "Days", ar: "الأيام" },
  unavailableLabel: { en: "Unavailable", ar: "غير متاح" },
  selectedLabel: { en: "Selected", ar: "المحدد" },
  clear: { en: "Clear", ar: "مسح" },
  continueLabel: { en: "Continue", ar: "متابعة" },
  customPricing: { en: "Custom pricing", ar: "تسعير مخصص" },
  bookingRef: { en: "Booking reference", ar: "رقم الحجز" },

  // Admin
  availability: { en: "Availability & Pricing", ar: "التوفر والأسعار" },
  adminCalHint: {
    en: "Tap a day to block it or give it a custom price.",
    ar: "اضغط على يوم لحظره أو تحديد سعر مخصص له.",
  },
  markUnavailable: { en: "Mark unavailable", ar: "تعيين كغير متاح" },
  markAvailable: { en: "Mark available", ar: "تعيين كمتاح" },
  customPrice: { en: "Custom price", ar: "سعر مخصص" },
  save: { en: "Save", ar: "حفظ" },
  reset: { en: "Reset", ar: "إعادة تعيين" },
  packageRates: { en: "Package Rates", ar: "أسعار الباقات" },
  requests: { en: "Booking Requests", ar: "طلبات الحجز" },
  noRequests: { en: "No requests yet.", ar: "لا توجد طلبات." },
  statusPending: { en: "Pending / Waiting list", ar: "قيد الانتظار" },
  statusAccepted: { en: "Accepted", ar: "مقبول" },
  statusRejected: { en: "Rejected", ar: "مرفوض" },
  exportExcel: { en: "Export to Excel", ar: "تصدير إلى إكسل" },
  deleteRequest: { en: "Delete request", ar: "حذف الطلب" },
  deleteConfirmTitle: { en: "Delete this request?", ar: "حذف هذا الطلب؟" },
  deleteConfirmBody: {
    en: 'This cannot be undone. Type "Delete" to confirm.',
    ar: 'لا يمكن التراجع عن هذا. اكتب "Delete" للتأكيد.',
  },
  cancel: { en: "Cancel", ar: "إلغاء" },
  guestsLabel: { en: "Guests", ar: "الضيوف" },
};

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  tr: (key: keyof typeof t) => string;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("bizarri_lang") as Lang | null;
    if (saved) setLangState(saved);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("bizarri_lang", l);
  };

  const tr = (key: keyof typeof t) => t[key]?.[lang] ?? String(key);
  const dir = lang === "ar" ? "rtl" : "ltr";

  return <I18nContext.Provider value={{ lang, setLang, tr, dir }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const c = useContext(I18nContext);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}
