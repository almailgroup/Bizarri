import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

export type Lang = "en" | "ar";

export const LANGS: Lang[] = ["en", "ar"];

const STORE_KEY = "bizarri_lang";

/**
 * Which language to send someone to when the URL does not say.
 *
 * Only used for the bare domain and for old unprefixed links. Once there is a
 * prefix it wins outright, so a shared /ar link opens in Arabic even for a
 * reader whose last visit was in English.
 */
export function preferredLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved === "en" || saved === "ar") return saved;
  } catch {
    // Private browsing and blocked site data both throw; fall through to the
    // browser's own preference.
  }
  return navigator.languages?.some((l) => l.toLowerCase().startsWith("ar")) ? "ar" : "en";
}

/**
 * The language segment of a path, or null if it has none.
 *
 * It is the LAST segment: pages are /facilities/en and the homepage is /en,
 * so the end of the path is the one place both of them have it.
 */
export function langFromPath(pathname: string, base = "/"): Lang | null {
  const rest = pathname.startsWith(base)
    ? pathname.slice(base.length)
    : pathname.replace(/^\//, "");
  const parts = rest.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  return last === "en" || last === "ar" ? last : null;
}

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
    ar: "تجربة شاليه عصري خاص في الكويت، مصمم ليوفر لك الراحة والخصوصية والتقنيات الحديثة والاسترخاء.",
  },
  menu: { en: "Menu", ar: "القائمة" },
  close: { en: "Close", ar: "إغلاق" },
  language: { en: "العربية", ar: "English" },
  startBooking: { en: "Start your booking request", ar: "ابدأ طلب الحجز" },
  choosePackageHint: {
    en: "Choose an offer, then start your request — it will be picked for you on the booking page.",
    ar: "اختر عرضاً ثم ابدأ طلبك — سيتم تحديده لك تلقائياً في صفحة الحجز.",
  },
  offerChosen: { en: "Selected", ar: "تم الاختيار" },
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
  // Thu–Sat is one product at one price, so a stay may not take a slice of it.
  weekendWhole: {
    en: "A weekend is booked Thursday to Saturday. Please include all three days.",
    ar: "نهاية الأسبوع تُحجز من الخميس إلى السبت. يرجى اختيار الأيام الثلاثة كاملة.",
  },
  // The three shapes a stay can be. There is no free-form option, so this is
  // a choice of product rather than a filter over a calendar.
  codeBeforeSubmit: {
    en: "One last step. We have emailed a six-digit code to confirm your address — enter it to send your request.",
    ar: "خطوة أخيرة. أرسلنا رمزاً من 6 أرقام لتأكيد بريدك — أدخله لإرسال طلبك.",
  },
  priceFrom: { en: "From {price}", ar: "من {price}" },
  pickShape: { en: "Choose your stay", ar: "اختر نوع الإقامة" },
  pickChalet: { en: "Choose Chalet", ar: "اختر الشاليه" },
  // Nothing used to say that the choice does anything. The calendar, the
  // prices and the quick picks underneath all reload when it changes, and a
  // guest had to notice that for themselves.
  pickChaletNote: {
    en: "Dates and prices below are for the chalet you choose.",
    ar: "التواريخ والأسعار بالأسفل تخص الشاليه الذي تختاره.",
  },
  bizarri1: { en: "Bizarri Chalet 1", ar: "شاليه بيزاري 1" },
  bizarri2: { en: "Bizarri Chalet 2", ar: "شاليه بيزاري 2" },
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
  nights3: { en: "3 nights", ar: "3 ليالٍ" },
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
  days7: { en: "7 days", ar: "7 أيام" },
  days4: { en: "4 days", ar: "4 أيام" },
  days3: { en: "3 days", ar: "3 أيام" },
  perDayRates: { en: "Custom dates", ar: "تواريخ مخصصة" },
  perDayIntro: {
    en: "Any other stay of 3 days or more is priced per day.",
    ar: "أي إقامة أخرى من 3 أيام فأكثر تُسعّر يومياً.",
  },
  weekdayNight: { en: "Sun – Wed, per day", ar: "الأحد – الأربعاء، لليوم" },
  weekendNight: { en: "Thu – Sat, per day", ar: "الخميس – السبت، لليوم" },

  // Booking calendar
  selectDates: { en: "Select your dates", ar: "اختر تواريخك" },
  pickStart: { en: "Tap a day to start", ar: "اضغط على يوم للبدء" },
  minStay: {
    en: "Minimum stay is {n} days.",
    ar: "الحد الأدنى للإقامة {n} أيام.",
  },
  total: { en: "Total", ar: "الإجمالي" },
  checkIn: { en: "Check-in", ar: "الوصول" },
  checkOut: { en: "Check-out", ar: "المغادرة" },
  // Never stands alone -- every use is after a number ("3 days", "(3 days)"),
  // so it is not a label being capitalised, it is a word mid-sentence. The
  // Arabic was the definite "the days", which after a numeral is simply wrong.
  nightsLabel: { en: "days", ar: "أيام" },
  unavailableLabel: { en: "Unavailable", ar: "غير متاح" },
  selectedLabel: { en: "Selected", ar: "المحدد" },
  clear: { en: "Clear", ar: "مسح" },
  continueLabel: { en: "Continue", ar: "متابعة" },
  customPricing: { en: "Custom pricing", ar: "تسعير مخصص" },
  bookingRef: { en: "Booking reference", ar: "رقم الحجز" },
  reservedLabel: { en: "Reserved", ar: "محجوز" },
  filterByDay: { en: "By day", ar: "بالأيام" },
  // Sun-Wed, not "one day at a time": a single day can only be a weekday now,
  // because Thu-Sat is sold whole. Saying which days saves a guest tapping a
  // Friday and finding nothing happens.
  filterByDayNote: { en: "Sun – Wed · one day", ar: "الأحد – الأربعاء · يوم واحد" },
  filterFullWeek: { en: "Full week", ar: "أسبوع كامل" },
  filterFullWeekNote: { en: "Sun – Sat · 7 days", ar: "الأحد – السبت · 7 أيام" },
  filterWeekday: { en: "Weekday", ar: "أيام الأسبوع" },
  filterWeekdayNote: { en: "Sun – Wed · 4 days", ar: "الأحد – الأربعاء · 4 أيام" },
  // The card only appears when an occasion is coming up, and names it; the
  // note is the fallback for the moment before the occasions have loaded.
  filterHoliday: { en: "Holiday", ar: "العطلات" },
  filterHolidayNote: { en: "Eid & public holidays", ar: "الأعياد والعطل الرسمية" },
  noHolidaysTitle: {
    en: "No holiday dates are open yet",
    ar: "لا توجد مواعيد عطلات متاحة للحجز حالياً",
  },
  noHolidaysBody: {
    en: "Holiday stays open for booking as each holiday is announced, each at its own price. Message us on WhatsApp and we will tell you as soon as the next one opens.",
    ar: "تُفتح إقامات العطلات للحجز عند الإعلان عن كل عطلة، ولكل منها سعرها الخاص. راسلنا عبر واتساب وسنبلغك فور فتح الحجز للعطلة القادمة.",
  },
  askAboutHolidays: { en: "Ask about holidays", ar: "اسأل عن العطلات" },
  filterWeekend: { en: "Weekend", ar: "نهاية الأسبوع" },
  filterWeekendNote: { en: "Thu – Sat · 3 days", ar: "الخميس – السبت · 3 أيام" },
  filterHint: {
    en: "Tap any highlighted day and the whole stay is selected for you.",
    ar: "اضغط على أي يوم مميّز وسيتم تحديد الإقامة كاملة تلقائياً.",
  },
  filterDayHint: {
    en: "Tap any highlighted day to book just that day.",
    ar: "اضغط على أي يوم مميّز لحجز ذلك اليوم فقط.",
  },
  filterNoneLeft: {
    en: "No complete stay of this type is left in this month.",
    ar: "لا توجد إقامة كاملة من هذا النوع متبقية في هذا الشهر.",
  },
  specialPkg: { en: "Special occasion", ar: "مناسبة خاصة" },
  specialOccasions: { en: "Special Occasions", ar: "المناسبات الخاصة" },
  occasionsHint: {
    en: "Premium windows such as Eid. The price is a flat total for the whole window, and it replaces the normal package rate.",
    ar: "فترات مميزة مثل الأعياد. السعر إجمالي ثابت للفترة كاملة، ويحل محل سعر الباقة المعتاد.",
  },
  occasionsPublicIntro: {
    en: "Eid and other peak dates are priced as a flat rate for the whole window.",
    ar: "تُسعَّر الأعياد والمواسم المميزة بسعر ثابت للفترة كاملة.",
  },
  occasionName: { en: "Occasion", ar: "المناسبة" },
  occasionNameAr: { en: "Occasion (Arabic)", ar: "المناسبة (بالعربية)" },
  addOccasion: { en: "Add occasion", ar: "إضافة مناسبة" },
  noOccasions: { en: "No special occasions yet.", ar: "لا توجد مناسبات خاصة بعد." },
  occasionOverlaps: {
    en: "Those dates overlap another active occasion. Adjust the dates or deactivate the other one.",
    ar: "هذه التواريخ تتداخل مع مناسبة أخرى مفعّلة. عدّل التواريخ أو عطّل الأخرى.",
  },
  activeLabel: { en: "Active", ar: "مفعّل" },
  startDate: { en: "Start", ar: "من" },
  endDate: { en: "End", ar: "إلى" },
  priceLabel: { en: "Price", ar: "السعر" },

  // Checkout requirements
  civilId: { en: "Civil ID image", ar: "صورة البطاقة المدنية" },
  civilIdHint: {
    en: "Required to confirm your stay. JPG, PNG or PDF, up to 5 MB.",
    ar: "مطلوبة لتأكيد إقامتك. JPG أو PNG أو PDF، بحد أقصى 5 ميجابايت.",
  },
  civilIdChoose: { en: "Choose file", ar: "اختر ملفاً" },
  civilIdMissing: {
    en: "Please attach your Civil ID image.",
    ar: "يرجى إرفاق صورة البطاقة المدنية.",
  },
  civilIdTooBig: { en: "That file is larger than 5 MB.", ar: "حجم الملف يتجاوز 5 ميجابايت." },
  civilIdWrongType: {
    en: "Please attach a JPG, PNG or PDF.",
    ar: "يرجى إرفاق ملف JPG أو PNG أو PDF.",
  },
  civilIdUploading: { en: "Uploading…", ar: "جارٍ الرفع…" },
  viewCivilId: { en: "View Civil ID", ar: "عرض البطاقة المدنية" },
  noCivilId: { en: "No Civil ID on file", ar: "لا توجد بطاقة مدنية" },
  acceptTerms: {
    en: "I have read and accept the terms and regulations.",
    ar: "لقد قرأت وأوافق على الشروط والأحكام.",
  },
  acceptTermsRequired: {
    en: "You must accept the terms and regulations.",
    ar: "يجب الموافقة على الشروط والأحكام.",
  },
  readTerms: { en: "Read them here", ar: "اقرأها هنا" },

  // Booking flow guidance
  checkAvailability: { en: "Check availability", ar: "عرض التواريخ المتاحة" },
  bookOnWhatsapp: { en: "Book on WhatsApp", ar: "احجز عبر واتساب" },
  welcomeBack: {
    en: "We filled in your details from your last booking on this device.",
    ar: "تمت تعبئة بياناتك من حجزك السابق على هذا الجهاز.",
  },
  whatsappAlt: {
    en: "Prefer to arrange it by message? Talk to us on WhatsApp.",
    ar: "تفضل الترتيب عبر الرسائل؟ تحدث إلينا على واتساب.",
  },
  whatsappHelp: {
    en: "Questions before you send this? Message us on WhatsApp.",
    ar: "لديك أسئلة قبل الإرسال؟ راسلنا على واتساب.",
  },
  newsUnavailable: {
    en: "We could not load the news just now — this is a connection problem, not an empty page.",
    ar: "تعذر تحميل الأخبار الآن — هذه مشكلة في الاتصال وليست صفحة فارغة.",
  },
  ratesIndicative: {
    en: "Live rates could not be loaded, so these are our standard prices. We confirm the exact total when you request your dates.",
    ar: "تعذر تحميل الأسعار المحدثة، لذا هذه أسعارنا المعتادة. نؤكد الإجمالي الدقيق عند طلب التواريخ.",
  },
  tryAgain: { en: "Try again", ar: "إعادة المحاولة" },
  stepDates: { en: "Dates", ar: "التواريخ" },
  stepDetails: { en: "Your details", ar: "بياناتك" },
  stepDone: { en: "Confirmed", ar: "التأكيد" },
  stepOf: { en: "Step", ar: "الخطوة" },
  changeChalet: { en: "Change chalet", ar: "تغيير الشاليه" },
  ratesAtAGlance: { en: "Rates at a glance", ar: "الأسعار باختصار" },
  noPaymentNow: {
    en: "No payment now — this is a request, not a charge.",
    ar: "لا يوجد دفع الآن — هذا طلب حجز وليس عملية دفع.",
  },
  weReplyIn: {
    en: "We confirm most requests within 24 hours.",
    ar: "نؤكد معظم الطلبات خلال 24 ساعة.",
  },
  whyCivilId: {
    en: "Kuwait chalet rentals require ID on file. It is stored privately and seen only by our team.",
    ar: "يتطلب تأجير الشاليهات في الكويت حفظ إثبات الهوية. تُحفظ بشكل خاص ولا يطّلع عليها سوى فريقنا.",
  },
  whatHappensNext: { en: "What happens next", ar: "الخطوات التالية" },
  nextStep1: {
    en: "We check the dates and confirm by phone or email.",
    ar: "نتحقق من التواريخ ونؤكد عبر الهاتف أو البريد الإلكتروني.",
  },
  nextStep2: {
    en: "Payment is arranged once your dates are confirmed.",
    ar: "يتم ترتيب الدفع بعد تأكيد التواريخ.",
  },
  nextStep3: {
    en: "Track your request any time from Your Reservation.",
    ar: "تابع طلبك في أي وقت من صفحة حجزك.",
  },
  noneThisMonth: {
    en: "Nothing free this month — showing the next month with availability.",
    ar: "لا يوجد متاح هذا الشهر — نعرض الشهر التالي المتاح.",
  },
  minStayNote: {
    en: "Minimum stay {n} days.",
    ar: "الحد الأدنى للإقامة {n} أيام.",
  },
  daysSelected: { en: "{n} days selected", ar: "{n} أيام محددة" },
  oneDaySelected: { en: "1 day selected", ar: "يوم واحد محدد" },
  pickEndHint: { en: "Tap another day to extend your stay", ar: "اضغط على يوم آخر لتمديد إقامتك" },
  yourStay: { en: "Your stay", ar: "إقامتك" },
  optionalLabel: { en: "Optional", ar: "اختياري" },
  requiredLabel: { en: "Required", ar: "مطلوب" },

  // Reservation shortcut
  yourReservation: { en: "Your Reservation", ar: "حجزك" },
  yourReservationIntro: {
    en: "Already requested a stay? Look it up with your reference, your email address, or the phone number you booked with.",
    ar: "هل طلبت إقامة بالفعل؟ تتبعها برقم الحجز أو بالبريد الإلكتروني أو برقم الهاتف الذي حجزت به.",
  },
  savedRefNote: {
    en: "We filled in the reference from your last request on this device.",
    ar: "تمت تعبئة رقم الحجز من طلبك الأخير على هذا الجهاز.",
  },

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
    ar: "الحجز متاح حتى 12 شهراً مقدماً. للتواريخ الأبعد، يرجى التواصل معنا.",
  },
  quickLinks: { en: "Links", ar: "روابط" },
  viewSite: { en: "View site", ar: "عرض الموقع" },
  backToSite: { en: "Back to the website", ar: "العودة إلى الموقع" },

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

  // Looking a booking up two ways
  // Two forms of each: the short one is what the tab shows, the full one is
  // its accessible name. Three full phrases could only stack one per row on a
  // phone, which cost about 110px above the fold on the one page whose whole
  // job is a single field. The hint under the tabs says which is which
  // anyway ("Enter the reference from your confirmation email"), so nothing
  // is lost by the tab itself being one word.
  lookupByRef: { en: "Booking reference", ar: "رقم الحجز" },
  lookupByEmail: { en: "Email address", ar: "البريد الإلكتروني" },
  lookupByPhone: { en: "Phone number", ar: "رقم الهاتف" },
  lookupByRefShort: { en: "Reference", ar: "الرقم" },
  lookupByEmailShort: { en: "Email", ar: "البريد" },
  lookupByPhoneShort: { en: "Phone", ar: "الهاتف" },
  checkByRefHint: {
    en: "Enter the reference from your confirmation email.",
    ar: "أدخل رقم الحجز من رسالة التأكيد.",
  },
  checkByEmailHint: {
    en: "Enter the email address you booked with.",
    ar: "أدخل البريد الإلكتروني الذي حجزت به.",
  },
  bookingNotFoundRef: {
    en: "No request matches that reference.",
    ar: "لا يوجد طلب مطابق لهذا الرقم.",
  },
  bookingNotFoundEmail: {
    en: "No request matches that email address.",
    ar: "لا يوجد طلب مطابق لهذا البريد الإلكتروني.",
  },
  lookupHow: { en: "How would you like to find your booking?", ar: "كيف تريد البحث عن حجزك؟" },
  // The lookup result names the chalet. It read "Chalet 1" on the Arabic page
  // too, because the number was glued to an English word in the component.
  chaletNo: { en: "Chalet", ar: "شاليه" },
  lookupSearching: { en: "Checking\u2026", ar: "جارٍ البحث\u2026" },
  lookupOne: { en: "One booking found", ar: "تم العثور على حجز واحد" },
  lookupMany: { en: "{n} bookings found", ar: "تم العثور على {n} حجوزات" },
  checkByPhoneHint: {
    en: "Enter the phone number you booked with.",
    ar: "أدخل رقم الهاتف الذي حجزت به.",
  },
  bookingNotFoundPhone: {
    en: "No request matches that phone number.",
    ar: "لا يوجد طلب مطابق لرقم الهاتف هذا.",
  },
  moreThanOne: { en: "We found more than one request.", ar: "وجدنا أكثر من طلب واحد." },

  // Confirming the email address with a one-time code
  verifyEmail: { en: "Confirm your email", ar: "تأكيد بريدك الإلكتروني" },
  verifyEmailHint: {
    en: "We will email you a 6-digit code, so your booking confirmation reaches you.",
    ar: "سنرسل إليك رمزاً من 6 أرقام، حتى يصلك تأكيد الحجز.",
  },
  sendCode: { en: "Send code", ar: "إرسال الرمز" },
  resendCode: { en: "Send a new code", ar: "إرسال رمز جديد" },
  sendingCode: { en: "Sending…", ar: "جارٍ الإرسال…" },
  codeSent: {
    en: "We sent a code to {email}. It expires in 10 minutes.",
    ar: "أرسلنا رمزاً إلى {email}. ينتهي خلال 10 دقائق.",
  },
  enterCode: { en: "6-digit code", ar: "الرمز المكوّن من 6 أرقام" },
  checkSpam: {
    en: "Not arrived? Check your spam or junk folder.",
    ar: "لم يصلك الرمز؟ تحقق من مجلد الرسائل غير المرغوب فيها (Spam / Junk).",
  },
  verifyCode: { en: "Confirm", ar: "تأكيد" },
  codeWrong: { en: "That code is not correct.", ar: "هذا الرمز غير صحيح." },
  emailConfirmed: { en: "Email confirmed", ar: "تم تأكيد البريد الإلكتروني" },
  emailNeedsConfirming: {
    en: "Please confirm your email address before sending the request.",
    ar: "يرجى تأكيد بريدك الإلكتروني قبل إرسال الطلب.",
  },
  emailNotConfigured: {
    en: "We cannot send codes right now. Please contact us on WhatsApp to book.",
    ar: "لا يمكننا إرسال الرموز حالياً. يرجى التواصل معنا عبر واتساب للحجز.",
  },
  changeEmail: { en: "Use a different address", ar: "استخدام بريد آخر" },

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
    en: 'Each number needs its own one-time setup with the free CallMeBot service: add its WhatsApp contact, send it "I allow callmebot to send me messages", and it replies with an API key to enter below. Full steps: backend/supabase/README.md.',
    ar: 'كل رقم يحتاج إعداداً لمرة واحدة مع خدمة CallMeBot المجانية: أضف جهة اتصال واتساب الخاصة بها، أرسل لها "I allow callmebot to send me messages"، وسترد بمفتاح API لإدخاله أدناه. الخطوات كاملة في backend/supabase/README.md.',
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

/** Every string the dictionary knows, for anything that stores a key. */
export type TrKey = keyof typeof t;

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  tr: (key: keyof typeof t) => string;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Read from the URL rather than held in state: the address bar is what a
  // reader shares, bookmarks and lands on, so it has to be the thing that
  // decides. A path with no prefix is on its way to one via a redirect; show
  // the preference in the meantime rather than flashing the wrong language.
  const lang = langFromPath(pathname, import.meta.env.BASE_URL) ?? preferredLang();

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = (l: Lang) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORE_KEY, l);
      } catch {
        // Remembering the choice is a convenience; the URL still carries it.
      }
    }
    // Stay on the page, change its language. "." is the current route with
    // new params, so /ar/photos is reached from /en/photos without this
    // having to know what the route was or how to spell it. The query string
    // comes too: it is where a page keeps its place -- the booking step, the
    // admin tab -- and dropping it sent a guest halfway through the booking
    // form back to the dates for asking to read it in Arabic.
    navigate({
      to: ".",
      params: (prev: Record<string, string>) => ({ ...prev, lang: l }),
      search: true,
    });
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
