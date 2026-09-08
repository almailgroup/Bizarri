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
  password: { en: "Password", ar: "كلمة المرور" },
  login: { en: "Login", ar: "تسجيل الدخول" },
  logout: { en: "Logout", ar: "تسجيل الخروج" },
  dashboard: { en: "Admin Dashboard", ar: "لوحة التحكم" },
  pickChalet: { en: "Choose Chalet", ar: "اختر الشاليه" },
  bizarri1: { en: "Bizarri Chalet 1", ar: "شاليه بيزاري ١" },
  bizarri2: { en: "Bizarri Chalet 2", ar: "شاليه بيزاري ٢" },
  latestNews: { en: "Latest News", ar: "آخر الأخبار" },
  noNews: { en: "No news yet. Check back soon.", ar: "لا توجد أخبار بعد. عودوا قريباً." },
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
  horizonNote: {
    en: "Booking opens 12 months ahead. For later dates, please contact us.",
    ar: "الحجز متاح حتى ١٢ شهراً مقدماً. للتواريخ الأبعد، يرجى التواصل معنا.",
  },
  checkBooking: { en: "Check an existing request", ar: "تتبع طلب حجز" },
  checkBookingHint: {
    en: "Enter the reference from your confirmation and the email you used.",
    ar: "أدخل رقم الحجز من رسالة التأكيد والبريد الإلكتروني الذي استخدمته.",
  },
  checkStatus: { en: "Check status", ar: "عرض الحالة" },
  bookingNotFound: {
    en: "No request matches that reference and email.",
    ar: "لا يوجد طلب مطابق لهذا الرقم والبريد الإلكتروني.",
  },

  // Admin: navigation & new panels
  overview: { en: "Overview", ar: "نظرة عامة" },
  chaletsMgmt: { en: "Chalets", ar: "الشاليهات" },
  activityLog: { en: "Activity Log", ar: "سجل النشاط" },
  siteSettings: { en: "Site Settings", ar: "إعدادات الموقع" },
  pendingRequests: { en: "Pending Requests", ar: "طلبات قيد الانتظار" },
  upcomingCheckins: { en: "Upcoming Check-ins", ar: "الوصول القادم" },
  revenueThisMonth: { en: "This Month's Revenue", ar: "إيرادات هذا الشهر" },
  occupancyThisMonth: { en: "Occupancy This Month", ar: "الإشغال هذا الشهر" },
  noUpcoming: { en: "Nothing on the calendar yet.", ar: "لا توجد إقامات قادمة بعد." },
  searchRequests: {
    en: "Search by name, phone, email or reference",
    ar: "ابحث بالاسم أو الهاتف أو البريد أو رقم الحجز",
  },
  noMatches: { en: "No requests match your search.", ar: "لا توجد طلبات مطابقة للبحث." },
  editDetails: { en: "Edit details", ar: "تعديل التفاصيل" },
  internalNote: { en: "Internal note", ar: "ملاحظة داخلية" },
  internalNoteHint: {
    en: "Visible to admins only — never shown to the guest.",
    ar: "تظهر للمسؤولين فقط — لا تظهر أبداً للضيف.",
  },
  saveChanges: { en: "Save changes", ar: "حفظ التغييرات" },
  displayNameEn: { en: "Display name (English)", ar: "الاسم المعروض (إنجليزي)" },
  displayNameAr: { en: "Display name (Arabic)", ar: "الاسم المعروض (عربي)" },
  chaletActive: { en: "Bookable on the site", ar: "قابل للحجز على الموقع" },
  chaletInactive: {
    en: "Hidden from guests — existing requests are unaffected.",
    ar: "مخفي عن الضيوف — الطلبات الحالية غير متأثرة.",
  },
  contactPhone: { en: "Phone", ar: "الهاتف" },
  contactWhatsapp: { en: "WhatsApp number", ar: "رقم واتساب" },
  contactEmail: { en: "Contact email", ar: "البريد الإلكتروني" },
  contactInstagram: { en: "Instagram URL", ar: "رابط إنستغرام" },
  contactMaps: { en: "Maps link", ar: "رابط الخريطة" },
  notifyEmails: { en: "Booking notification emails", ar: "بريد إشعارات الحجوزات" },
  notifyEmailsHint: {
    en: "Comma-separated. Sent an email whenever a new booking request arrives.",
    ar: "افصل بينها بفواصل. يُرسل بريد عند وصول طلب حجز جديد.",
  },
  savedTick: { en: "Saved", ar: "تم الحفظ" },
  noActivity: { en: "No activity yet.", ar: "لا يوجد نشاط بعد." },
  notifyWhatsapp: { en: "WhatsApp notifications", ar: "إشعارات واتساب" },
  notifyWhatsappHint: {
    en: "Sent alongside the email notification whenever a new booking request arrives.",
    ar: "تُرسل إلى جانب إشعار البريد الإلكتروني عند وصول طلب حجز جديد.",
  },
  callmebotSteps: {
    en: 'Each number needs its own one-time setup: save +34 644 59 71 07 as a contact, send it "I allow callmebot to send me messages" on WhatsApp, and it replies with an API key to enter below.',
    ar: 'كل رقم يحتاج إعداداً لمرة واحدة: احفظ +34 644 59 71 07 كجهة اتصال، أرسل له عبر واتساب "I allow callmebot to send me messages"، وسيردّ بمفتاح API لإدخاله أدناه.',
  },
  whatsappPhoneLabel: {
    en: "Phone (with country code, digits only)",
    ar: "الهاتف (مع رمز الدولة، أرقام فقط)",
  },
  whatsappApikeyLabel: { en: "CallMeBot API key", ar: "مفتاح CallMeBot" },
  addNumber: { en: "Add number", ar: "إضافة رقم" },
  noWhatsappNumbers: {
    en: "No WhatsApp numbers added yet.",
    ar: "لم تتم إضافة أي رقم واتساب بعد.",
  },
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
