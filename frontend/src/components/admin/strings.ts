/**
 * Strings the dashboard alone uses.
 *
 * Kept out of the site-wide dictionary in lib/i18n.tsx: that one ships with
 * every public page, and none of these are ever shown to a guest. The admin
 * route is its own chunk, so these travel with it.
 */
import { useI18n } from "@/lib/i18n";

const s = {
  // chrome
  signedInAs: { en: "Signed in as", ar: "مسجل الدخول باسم" },
  menu: { en: "Menu", ar: "القائمة" },
  newBooking: { en: "New booking", ar: "حجز جديد" },

  // status
  pending: { en: "Pending", ar: "قيد الانتظار" },
  accepted: { en: "Accepted", ar: "مقبول" },
  rejected: { en: "Rejected", ar: "مرفوض" },
  cancelled: { en: "Cancelled", ar: "ملغى" },
  addedByAdmin: { en: "Added by admin", ar: "أضافه المسؤول" },

  // feedback
  saving: { en: "Saving…", ar: "جارٍ الحفظ…" },
  saved: { en: "Saved", ar: "تم الحفظ" },
  loading: { en: "Loading…", ar: "جارٍ التحميل…" },
  somethingWrong: { en: "Something went wrong", ar: "حدث خطأ ما" },
  dismiss: { en: "Dismiss", ar: "إغلاق" },
  retry: { en: "Try again", ar: "إعادة المحاولة" },

  // delete
  deleteBookingTitle: {
    en: "Are you sure you want to delete this booking?",
    ar: "هل أنت متأكد من حذف هذا الحجز؟",
  },
  deleteBookingBody: {
    en: "The booking and its history will be removed. This cannot be undone.",
    ar: "سيتم حذف الحجز وسجله. لا يمكن التراجع عن ذلك.",
  },
  deleteNewsTitle: {
    en: "Are you sure you want to delete this post?",
    ar: "هل أنت متأكد من حذف هذا الخبر؟",
  },
  deleteOccasionTitle: {
    en: "Are you sure you want to delete this occasion?",
    ar: "هل أنت متأكد من حذف هذه المناسبة؟",
  },
  deleteGenericBody: { en: "This cannot be undone.", ar: "لا يمكن التراجع عن ذلك." },
  yesDelete: { en: "Yes, delete", ar: "نعم، احذف" },
  deleting: { en: "Deleting…", ar: "جارٍ الحذف…" },
  deleted: { en: "Deleted", ar: "تم الحذف" },
  bookingDeleted: { en: "Booking {ref} deleted", ar: "تم حذف الحجز {ref}" },

  // overview
  welcome: { en: "Welcome back", ar: "مرحباً بعودتك" },
  todayIs: { en: "Here is where things stand today.", ar: "هذا ملخص اليوم." },
  upcomingStays: { en: "Upcoming stays", ar: "الإقامات القادمة" },
  nextArrival: { en: "Next arrival", ar: "الوصول التالي" },
  none: { en: "None", ar: "لا يوجد" },
  needsAttention: { en: "Needs your decision", ar: "بانتظار قرارك" },
  allCaughtUp: {
    en: "All caught up. No requests are waiting.",
    ar: "لا توجد طلبات بانتظار القرار.",
  },
  viewAll: { en: "View all", ar: "عرض الكل" },
  accept: { en: "Accept", ar: "قبول" },
  reject: { en: "Reject", ar: "رفض" },
  nightsOf: { en: "{n} of {total} nights", ar: "{n} من {total} ليلة" },
  confirmedRevenue: { en: "From accepted stays", ar: "من الإقامات المقبولة" },
  statusChanged: { en: "{ref} marked {status}", ar: "تم تعيين {ref} كـ {status}" },

  // requests
  all: { en: "All", ar: "الكل" },
  bookingsCount: { en: "{n} bookings", ar: "{n} حجز" },
  checkIn: { en: "Check-in", ar: "الوصول" },
  checkOut: { en: "Check-out", ar: "المغادرة" },
  days: { en: "{n} days", ar: "{n} أيام" },
  oneDay: { en: "1 day", ar: "يوم واحد" },
  submitted: { en: "Submitted {when}", ar: "أُرسل {when}" },
  changeStatus: { en: "Status", ar: "الحالة" },
  delete: { en: "Delete", ar: "حذف" },

  // calendar
  calendarTitle: { en: "Calendar", ar: "التقويم" },
  calendarHint: {
    en: "Click a day, or drag across days to select a range. Shift-click extends the selection.",
    ar: "اضغط على يوم، أو اسحب عبر الأيام لتحديد فترة. اضغط مع Shift لتمديد التحديد.",
  },
  today: { en: "Today", ar: "اليوم" },
  previousMonth: { en: "Previous month", ar: "الشهر السابق" },
  nextMonth: { en: "Next month", ar: "الشهر التالي" },
  chalet: { en: "Chalet", ar: "الشاليه" },
  available: { en: "Available", ar: "متاح" },
  unavailable: { en: "Unavailable", ar: "غير متاح" },
  booked: { en: "Booked", ar: "محجوز" },
  bookedByGuest: { en: "Booked by a guest", ar: "محجوز من ضيف" },
  pendingRequest: { en: "Pending request", ar: "طلب قيد الانتظار" },
  customPrice: { en: "Custom price", ar: "سعر مخصص" },
  past: { en: "Past", ar: "منتهٍ" },
  selection: { en: "Selection", ar: "التحديد" },
  nothingSelected: {
    en: "Select a day or a range of days to block them, open them, or price them.",
    ar: "حدد يوماً أو فترة لحظرها أو فتحها أو تسعيرها.",
  },
  from: { en: "From", ar: "من" },
  to: { en: "To", ar: "إلى" },
  clearSelection: { en: "Clear selection", ar: "مسح التحديد" },
  nAvailable: { en: "{n} available", ar: "{n} متاح" },
  nUnavailable: { en: "{n} unavailable", ar: "{n} غير متاح" },
  nBooked: { en: "{n} booked", ar: "{n} محجوز" },
  nPast: { en: "{n} past", ar: "{n} منتهٍ" },
  markNUnavailable: { en: "Mark {n} unavailable", ar: "تعيين {n} كغير متاح" },
  markOneUnavailable: { en: "Mark unavailable", ar: "تعيين كغير متاح" },
  makeNAvailable: { en: "Make {n} available", ar: "إتاحة {n}" },
  makeOneAvailable: { en: "Mark available", ar: "تعيين كمتاح" },
  priceForSelection: { en: "Custom price per day", ar: "سعر مخصص لليوم" },
  defaultRate: { en: "Default rate", ar: "السعر الافتراضي" },
  applyPrice: { en: "Apply price", ar: "تطبيق السعر" },
  clearPrice: { en: "Use default rate", ar: "استخدام السعر الافتراضي" },
  blockedN: { en: "{n} days marked unavailable", ar: "تم تعيين {n} أيام كغير متاحة" },
  blockedOne: { en: "Day marked unavailable", ar: "تم تعيين اليوم كغير متاح" },
  openedN: { en: "{n} days are available again", ar: "أصبحت {n} أيام متاحة" },
  openedOne: { en: "Day is available again", ar: "أصبح اليوم متاحاً" },
  pricedN: { en: "Price set on {n} days", ar: "تم تحديد السعر لـ {n} أيام" },
  priceClearedN: {
    en: "Default rate restored on {n} days",
    ar: "تمت استعادة السعر الافتراضي لـ {n} أيام",
  },
  invalidPrice: { en: "Enter a price of 0 or more", ar: "أدخل سعراً يساوي 0 أو أكثر" },
  coveredByBooking: {
    en: "Covered by an accepted booking. Manage it from Booking Requests.",
    ar: "ضمن حجز مقبول. يمكن إدارته من طلبات الحجز.",
  },
  bookingsInSelection: { en: "Bookings in this selection", ar: "الحجوزات ضمن التحديد" },
  pastLeftAlone: {
    en: "Past days and booked days are left unchanged.",
    ar: "الأيام المنتهية والمحجوزة لا تتغير.",
  },
  bookTheseDates: { en: "Create a booking for these dates", ar: "إنشاء حجز لهذه التواريخ" },
  openRequests: { en: "Open in Booking Requests", ar: "فتح في طلبات الحجز" },

  // new booking
  newBookingTitle: { en: "New booking", ar: "حجز جديد" },
  newBookingIntro: {
    en: "For a booking taken by phone or WhatsApp. It is priced from your rates unless you set a total.",
    ar: "لحجز تم عبر الهاتف أو واتساب. يُحسب السعر من أسعارك ما لم تحدد إجمالياً.",
  },
  stayDetails: { en: "Stay", ar: "الإقامة" },
  guestDetails: { en: "Guest", ar: "الضيف" },
  bookingOptions: { en: "Status and price", ar: "الحالة والسعر" },
  checkInDate: { en: "Check-in date", ar: "تاريخ الوصول" },
  checkOutDate: { en: "Check-out date", ar: "تاريخ المغادرة" },
  stayLine: {
    en: "{days} · in {in} at 2:00 PM · out {out} at 12:00 PM",
    ar: "{days} · الوصول {in} الساعة 2:00 م · المغادرة {out} الساعة 12:00 م",
  },
  fullName: { en: "Full name", ar: "الاسم الكامل" },
  phone: { en: "Phone", ar: "الهاتف" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  guests: { en: "Guests", ar: "عدد الضيوف" },
  status: { en: "Status", ar: "الحالة" },
  statusHintPending: {
    en: "Holds nothing yet. Accept it later from Booking Requests.",
    ar: "لا يحجز الأيام بعد. يمكن قبوله لاحقاً من طلبات الحجز.",
  },
  statusHintAccepted: {
    en: "Holds the dates now. They close on the guest calendar.",
    ar: "يحجز الأيام فوراً وتُغلق في تقويم الضيوف.",
  },
  calculatedPrice: { en: "Calculated from your rates", ar: "محسوب من أسعارك" },
  calculating: { en: "Calculating…", ar: "جارٍ الحساب…" },
  overrideTotal: { en: "Total (optional)", ar: "الإجمالي (اختياري)" },
  overrideHint: {
    en: "Leave empty to use the calculated price.",
    ar: "اتركه فارغاً لاستخدام السعر المحسوب.",
  },
  guestNotes: { en: "Guest's notes", ar: "ملاحظات الضيف" },
  internalNote: { en: "Internal note", ar: "ملاحظة داخلية" },
  internalNoteHint: {
    en: "Admins only. Never sent to the guest.",
    ar: "للمسؤولين فقط. لا تُرسل للضيف.",
  },
  emailLanguage: { en: "Email language", ar: "لغة البريد" },
  english: { en: "English", ar: "الإنجليزية" },
  arabic: { en: "Arabic", ar: "العربية" },
  emailGuest: { en: "Email the guest", ar: "إرسال بريد للضيف" },
  emailGuestHintAccepted: {
    en: "Sends the booking confirmation.",
    ar: "يرسل تأكيد الحجز.",
  },
  emailGuestHintPending: {
    en: 'Sends "we have your request".',
    ar: 'يرسل "استلمنا طلبك".',
  },
  createBooking: { en: "Create booking", ar: "إنشاء الحجز" },
  creating: { en: "Creating…", ar: "جارٍ الإنشاء…" },
  bookingCreated: { en: "Booking {ref} created", ar: "تم إنشاء الحجز {ref}" },
  fixErrors: { en: "Please fix the highlighted fields.", ar: "يرجى تصحيح الحقول المحددة." },
  errDates: { en: "Choose a check-in and a check-out date", ar: "اختر تاريخ الوصول والمغادرة" },
  errOrder: { en: "Check-out must be after check-in", ar: "يجب أن تكون المغادرة بعد الوصول" },
  errPast: { en: "Check-in cannot be in the past", ar: "لا يمكن أن يكون الوصول في الماضي" },
  errTooLong: { en: "At most 90 days", ar: "90 يوماً كحد أقصى" },
  errName: { en: "Enter the guest's full name", ar: "أدخل اسم الضيف الكامل" },
  errPhone: {
    en: "Enter a phone number with at least 8 digits",
    ar: "أدخل رقم هاتف من 8 أرقام على الأقل",
  },
  errEmail: { en: "Enter a valid email address", ar: "أدخل بريداً إلكترونياً صحيحاً" },
  errGuests: { en: "Between 1 and 20 guests", ar: "بين 1 و20 ضيفاً" },
  errTotal: { en: "Enter 0 or more, or leave empty", ar: "أدخل 0 أو أكثر، أو اتركه فارغاً" },
  clashAccepted: {
    en: "These dates overlap accepted booking {ref} ({name}).",
    ar: "هذه التواريخ تتداخل مع الحجز المقبول {ref} ({name}).",
  },
  clashBlocked: {
    en: "These dates include days marked unavailable.",
    ar: "هذه التواريخ تتضمن أياماً غير متاحة.",
  },
  clashPendingOk: {
    en: "You can still save it as pending.",
    ar: "يمكنك حفظه كطلب قيد الانتظار.",
  },
} as const;

export type AdminKey = keyof typeof s;

/** The dashboard's own translator; `{name}` placeholders are filled from vars. */
export function useAdminT() {
  const { lang } = useI18n();
  return (key: AdminKey, vars?: Record<string, string | number>) => {
    let out: string = s[key][lang];
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
    return out;
  };
}
