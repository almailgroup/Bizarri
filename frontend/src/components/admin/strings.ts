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
  deleteOfferTitle: {
    en: "Are you sure you want to delete this offer?",
    ar: "هل أنت متأكد من حذف هذا العرض؟",
  },
  deleteCodeTitle: {
    en: "Are you sure you want to delete this code?",
    ar: "هل أنت متأكد من حذف هذا الرمز؟",
  },
  deleteCodeBody: {
    en: "Guests can no longer use it. Bookings already made with it keep their discount.",
    ar: "لن يتمكن الضيوف من استخدامه بعد الآن. تحتفظ الحجوزات التي تمت به بخصمها.",
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

  // editing what is already there
  edit: { en: "Edit", ar: "تعديل" },
  editOccasion: { en: "Edit special occasion", ar: "تعديل المناسبة الخاصة" },
  editNews: { en: "Edit news post", ar: "تعديل الخبر" },
  errOccasionName: { en: "Give it an English name", ar: "أدخل الاسم بالإنجليزية" },
  bookingMoved: { en: "Booking {ref} updated", ar: "تم تحديث الحجز {ref}" },
  priceAndNotes: { en: "Price and notes", ar: "السعر والملاحظات" },
  offers: { en: "Offers", ar: "العروض" },
  offersHint: {
    en: "Dates you sell at one price for the whole stay. Each offer is listed on the Offers page, and booking exactly its dates costs the offer's price, whatever the rates, a custom day price or a special occasion would make it.",
    ar: "تواريخ تبيعها بسعر واحد للإقامة كاملة. يظهر كل عرض في صفحة العروض، وحجز تواريخه نفسها يكلّف سعر العرض، مهما كانت الأسعار أو السعر المخصص لليوم أو المناسبة الخاصة.",
  },
  newOffer: { en: "New offer", ar: "عرض جديد" },
  createOffer: { en: "Create offer", ar: "إنشاء العرض" },
  editOffer: { en: "Edit offer", ar: "تعديل العرض" },
  makeOffer: { en: "Make these dates an offer", ar: "اجعل هذه التواريخ عرضاً" },
  offerTitleEn: { en: "Title (English)", ar: "العنوان (إنجليزي)" },
  offerTitleAr: { en: "Title (Arabic)", ar: "العنوان (عربي)" },
  offerTitleHint: {
    en: "Optional. Left empty, the Offers page calls it “Special offer”.",
    ar: "اختياري. إذا تُرك فارغاً تسمّيه صفحة العروض «عرض خاص».",
  },
  offerFirstDay: { en: "First day", ar: "اليوم الأول" },
  offerLastDay: { en: "Last day", ar: "اليوم الأخير" },
  offerPrice: { en: "Price for the whole stay", ar: "السعر للإقامة كاملة" },
  bothChalets: { en: "Both chalets", ar: "كلا الشاليهين" },
  untitledOffer: { en: "Special offer", ar: "عرض خاص" },
  offerEnded: { en: "Ended", ar: "انتهى" },
  offerOff: { en: "Off", ar: "متوقف" },
  noOffers: {
    en: "No offers yet. Make one here, or select dates on the calendar under Availability & Pricing.",
    ar: "لا توجد عروض بعد. أنشئ عرضاً هنا، أو حدّد التواريخ في التقويم ضمن التوفر والأسعار.",
  },
  errOfferDates: { en: "Choose the first and the last day", ar: "اختر اليوم الأول واليوم الأخير" },
  errOfferOrder: {
    en: "The last day must be on or after the first",
    ar: "يجب أن يكون اليوم الأخير في اليوم الأول أو بعده",
  },
  errOfferWeekend: {
    en: "Thu – Sat is sold whole: include all three days, or none of them",
    ar: "الخميس – السبت يُباع كاملاً: اشمل الأيام الثلاثة أو لا شيء منها",
  },
  offerSaved: { en: "Offer saved", ar: "تم حفظ العرض" },
  discountCodes: { en: "Discount codes", ar: "رموز الخصم" },
  discountsHint: {
    en: "Codes a guest enters at booking for money off the stay. With any code the insurance deposit is not charged, so the guest pays for the chalet only. A use is given back if its booking is rejected or cancelled.",
    ar: "رموز يُدخلها الضيف عند الحجز للحصول على خصم من قيمة الإقامة. مع أي رمز لا يُحتسب مبلغ التأمين، فيدفع الضيف قيمة الشاليه فقط. يُستعاد الاستخدام إذا رُفض الحجز أو أُلغي.",
  },
  newCode: { en: "New code", ar: "رمز جديد" },
  editCode: { en: "Edit code", ar: "تعديل الرمز" },
  createCode: { en: "Create code", ar: "إنشاء الرمز" },
  codeLabel: { en: "Code", ar: "الرمز" },
  generateCode: { en: "Generate", ar: "إنشاء تلقائي" },
  codeHint: {
    en: "Letters, numbers, - and _, 3 to 32 characters. Guests can type it in capitals or not.",
    ar: "حروف إنجليزية وأرقام و - و _، من 3 إلى 32 حرفاً. يمكن للضيف كتابته بأحرف كبيرة أو صغيرة.",
  },
  discountKind: { en: "Discount", ar: "الخصم" },
  kindPercent: { en: "Percentage", ar: "نسبة مئوية" },
  kindAmount: { en: "Fixed amount", ar: "مبلغ ثابت" },
  percentValue: { en: "Percentage off", ar: "نسبة الخصم" },
  amountValue: { en: "Amount off (KWD)", ar: "مبلغ الخصم (د.ك)" },
  percentZeroHint: {
    en: "0% takes nothing off, and still waives the deposit.",
    ar: "0% لا يخصم شيئاً، لكنه يُلغي مبلغ التأمين.",
  },
  usesLabel: { en: "How many times it can be used", ar: "عدد مرات الاستخدام" },
  usesOnce: { en: "One time", ar: "مرة واحدة" },
  usesLimited: { en: "Limited", ar: "عدد محدد" },
  usesUnlimited: { en: "Unlimited", ar: "غير محدود" },
  maxUses: { en: "Number of uses", ar: "عدد الاستخدامات" },
  expiresOn: { en: "Last day it can be used", ar: "آخر يوم للاستخدام" },
  expiresHint: {
    en: "Optional. Leave empty for no end date.",
    ar: "اختياري. اتركه فارغاً بلا تاريخ انتهاء.",
  },
  codeNote: { en: "Note (only you see it)", ar: "ملاحظة (تظهر لك فقط)" },
  noCodes: {
    en: "No discount codes yet. Create one, then give it to a guest.",
    ar: "لا توجد رموز خصم بعد. أنشئ رمزاً ثم أعطه للضيف.",
  },
  percentOffShort: { en: "{n}% off", ar: "خصم {n}%" },
  amountOffShort: { en: "{amount} off", ar: "خصم {amount}" },
  usesOf: { en: "{n} of {max} used", ar: "استُخدم {n} من {max}" },
  usesNoLimit: { en: "{n} used · no limit", ar: "استُخدم {n} · بلا حد" },
  usedUp: { en: "Used up", ar: "استُنفد" },
  codeExpired: { en: "Expired", ar: "منتهي" },
  codeUntil: { en: "until {date}", ar: "حتى {date}" },
  codeSaved: { en: "Code saved", ar: "تم حفظ الرمز" },
  copyCode: { en: "Copy {code}", ar: "نسخ {code}" },
  copied: { en: "Copied {code}", ar: "تم نسخ {code}" },
  errCodeFormat: {
    en: "Use 3 to 32 letters, numbers, - or _",
    ar: "استخدم من 3 إلى 32 حرفاً إنجليزياً أو رقماً أو - أو _",
  },
  errCodeTaken: { en: "That code already exists", ar: "هذا الرمز موجود مسبقاً" },
  errPercent: { en: "Between 0 and 100", ar: "بين 0 و 100" },
  errUses: { en: "At least 1", ar: "1 على الأقل" },
  bookedWithCode: { en: "Code {code} · −{amount}", ar: "الرمز {code} · −{amount}" },
  bookedWithCodeLong: {
    en: "Booked with code {code}: {amount} off, and no insurance deposit.",
    ar: "حُجز بالرمز {code}: خصم {amount}، ودون مبلغ تأمين.",
  },
  repriceNew: { en: "Price the new dates from the rates", ar: "تسعير التواريخ الجديدة من الأسعار" },
  repriceTo: { en: "The total becomes {amount}.", ar: "يصبح الإجمالي {amount}." },
  repriceKeep: { en: "Off: the total stays {amount}.", ar: "عند الإيقاف: يبقى الإجمالي {amount}." },
  repriceSetsTotal: {
    en: "Set from the rates when you save.",
    ar: "يُحدَّد من الأسعار عند الحفظ.",
  },
  minStayTitle: { en: "Minimum stay", ar: "الحد الأدنى للإقامة" },
  minStayHint: {
    en: "The shortest booking a guest can make, in days. Shapes shorter than this are not offered on the booking page.",
    ar: "أقصر حجز يمكن للضيف إجراؤه، بالأيام. لا تُعرض في صفحة الحجز الخيارات الأقصر من ذلك.",
  },
  minStayDays: { en: "days", ar: "أيام" },
  errMinStay: { en: "Between 1 and 7 days", ar: "بين 1 و7 أيام" },
  emailGateTitle: { en: "Email confirmation code", ar: "رمز تأكيد البريد الإلكتروني" },
  emailGateHint: {
    en: "Guests confirm their email with a 6-digit code before a request is sent. Turn this off only if emails are not arriving, so the site keeps taking requests.",
    ar: "يؤكد الضيوف بريدهم برمز من 6 أرقام قبل إرسال الطلب. أوقفه فقط إذا لم تكن الرسائل تصل، حتى يستمر الموقع في استقبال الطلبات.",
  },
  emailGateOn: { en: "Required", ar: "مطلوب" },

  // deposit
  deposit: { en: "Refundable deposit", ar: "التأمين المسترد" },
  plusDeposit: { en: "+ {amount} refundable deposit", ar: "+ تأمين مسترد {amount}" },
  totalDue: { en: "Guest pays", ar: "يدفع الضيف" },
  depositSetting: { en: "Refundable insurance deposit", ar: "التأمين المسترد" },
  depositSettingHint: {
    en: "Added on top of every new booking and refunded after the stay. Existing bookings keep the amount they were made with.",
    ar: "يُضاف إلى كل حجز جديد ويُعاد بعد الإقامة. الحجوزات الحالية تحتفظ بالمبلغ الذي أُنشئت به.",
  },
  depositWaiveHint: {
    en: "Set to 0 to waive it for this booking.",
    ar: "اجعله 0 لإعفاء هذا الحجز منه.",
  },

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
