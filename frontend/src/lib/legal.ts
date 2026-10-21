/**
 * The Terms & Conditions and the Cancellation & Refund Policy, in both
 * languages, from the owner's text.
 *
 * One source for both pages: the cancellation policy is sections 3 and 7 of
 * the terms, and holding them once means the two pages cannot drift apart.
 *
 * Check-in and check-out are the site's own hours (2:00 PM and 12:00 PM), the
 * ones the booking page, the confirmation and the emails give; the owner
 * chose these over the 10:00 AM / 2:00 PM of the text they supplied.
 */

export interface LegalSection {
  title: string;
  items: string[];
}

export interface LegalDocument {
  title: string;
  intro: string;
  sections: LegalSection[];
}

type Lang = "en" | "ar";

/** When the wording last changed, for the line under each title. */
export const LEGAL_UPDATED = "2026-10-21";

const CANCELLATION: Record<Lang, LegalSection> = {
  en: {
    title: "Advance Payments, Cancellation and No-show",
    items: [
      "If the Tenant leaves the chalet before the end of the contract, they remain liable for the full rental value of the agreed period.",
      "For cancellations made less than one (1) week before check-in, 50% of the total amount paid will be deducted.",
      "For cancellations made two (2) weeks or more before check-in, 30% of the total amount paid will be deducted.",
      "If only a down payment was made and the balance is not paid ten (10) days before check-in, the down payment is forfeited in full (100%).",
      "The Tenant must notify the Owner immediately of any malfunction or defect in the sanitary or electrical equipment so that it can be repaired.",
    ],
  },
  ar: {
    title: "الدفعات المقدمة والإلغاء وعدم الحضور",
    items: [
      "إذا غادر المستأجر الشاليه قبل انتهاء مدة العقد، يبقى ملزماً بكامل قيمة الإيجار عن المدة المتفق عليها.",
      "في حال الإلغاء قبل أقل من أسبوع (1) من موعد الدخول، يُخصم 50% من إجمالي المبلغ المدفوع.",
      "في حال الإلغاء قبل أسبوعين (2) أو أكثر من موعد الدخول، يُخصم 30% من إجمالي المبلغ المدفوع.",
      "إذا دُفع العربون فقط ولم يُسدَّد المبلغ المتبقي قبل عشرة (10) أيام من موعد الدخول، يُصادَر العربون كاملاً (100%).",
      "يجب على المستأجر إبلاغ المالك فوراً بأي عطل أو خلل في التمديدات الصحية أو الكهربائية لإصلاحه.",
    ],
  },
};

const FORCE_MAJEURE: Record<Lang, LegalSection> = {
  en: {
    title: "Force Majeure Cancellations",
    items: [
      "The Tenant may only cancel in the event of a death (God forbid), provided that official proof is submitted. In this case, the booking may be postponed to a later available date, without a refund.",
      "For cancellations for any other reason, no refund will be given, whether a down payment or the full amount was paid.",
      "The Tenant releases the Company from any responsibility regarding refunds, and acknowledges that refunds are only possible in the cases set out above, and only in the form of rescheduling.",
    ],
  },
  ar: {
    title: "الإلغاء بسبب القوة القاهرة",
    items: [
      "لا يجوز للمستأجر الإلغاء إلا في حالة الوفاة (لا قدّر الله)، بشرط تقديم إثبات رسمي. وفي هذه الحالة يمكن تأجيل الحجز إلى موعد لاحق متاح، دون استرداد المبلغ.",
      "في حال الإلغاء لأي سبب آخر، لا تُسترد أي مبالغ، سواء دُفع العربون أو المبلغ كاملاً.",
      "يُخلي المستأجر مسؤولية الشركة عن أي مطالبة بالاسترداد، ويُقرّ بأن الاسترداد لا يكون إلا في الحالات المذكورة أعلاه، وفي صورة إعادة جدولة الحجز فقط.",
    ],
  },
};

export const TERMS: Record<Lang, LegalDocument> = {
  en: {
    title: "Terms and Conditions for Chalet Booking and Use",
    intro:
      "These terms apply to every booking at Bizarri Chalet. In them, “the Tenant” is the guest who makes the booking, and “the Owner” is Bizarri Chalet, the lessor, also referred to as “the Company”.",
    sections: [
      {
        title: "Check-in and Check-out",
        items: [
          "The Tenant declares that they are over twenty-one (21) years of age at the time of receiving the chalet.",
          "The chalet is rented for family use only. Young men (males) who are not accompanied by their families are strictly not permitted to enter. In case of violation, the Owner has the right to refuse entry and cancel the booking without refunding any amounts paid or the security deposit.",
          "The contract is valid from the check-in date until the check-out date. Check-in is at 2:00 PM and check-out is at 12:00 PM (noon).",
        ],
      },
      {
        title: "Commitment to Check-out Time",
        items: [
          "The Tenant must vacate the chalet no later than 12:00 PM (noon) on the check-out date. In case of delay, a penalty of twenty-five Kuwaiti Dinars (KWD 25) per hour will be applied and deducted directly from the security deposit.",
          "The Tenant shall return the chalet and all its contents (facilities, furniture, appliances, etc.) in the same condition in which they were received.",
          "The Tenant acknowledges having inspected the chalet upon delivery, confirming its condition and suitability for use, and having received the swimming pool clean.",
        ],
      },
      CANCELLATION.en,
      {
        title: "General Conditions of Use",
        items: [
          "Storing any illegal or flammable materials inside the chalet is prohibited. Only officially approved decorative materials may be used.",
          "The Tenant is fully liable for any fire or damage occurring inside the chalet, for any reason.",
          "No animals or birds, whether domestic or wild, are allowed inside the chalet or its facilities.",
          "Parties or gatherings exceeding the chalet's capacity are strictly prohibited. A violation results in the automatic termination of the contract without notice.",
          "Neighbours must be respected; noise and disturbance are prohibited.",
          "The Tenant is responsible for cleanliness and safety, and for any damage caused by them or by the people accompanying them.",
          "The Tenant bears full responsibility for any accidents, injuries or deaths (God forbid) inside the swimming pool or resulting from its use. The Owner is fully released from any liability.",
          "This contract is governed by Law No. 35 of 1978 on real estate leasing and its amendments. Rental disputes fall under the jurisdiction of the Kuwaiti Rent Courts.",
          "The contract is automatically terminated, without warning, if the Tenant breaches any of these conditions.",
        ],
      },
      {
        title: "Security Deposit",
        items: [
          "The Tenant shall pay the security deposit stated in the booking invoice. It must be paid ten (10) days before check-in, and the contract is not valid until full payment has been made.",
          "The deposit will be refunded within three (3) to fourteen (14) days after check-out, after deducting any amounts for damages or losses during the stay.",
        ],
      },
      {
        title: "Additional Obligations of the Tenant",
        items: [
          "The Tenant shall keep the chalet and all its belongings clean.",
          "The Tenant shall respect the privacy and comfort of the neighbours, and bears full legal responsibility for any complaints, with no liability on the Owner.",
          "The Tenant shall keep the peace and comply with all the laws and regulations of the State of Kuwait. The Company has the right to evict the Tenant, using legal force if necessary, without refunding any amounts, even if the rental period has not been completed.",
          "Gatherings or parties exceeding the chalet's capacity, or in violation of public health regulations, are strictly prohibited. A violation results in immediate eviction, without liability on the Company.",
          "The chalet is rented for family use only; any other use contrary to the policies of Bizarri Chalet is prohibited.",
        ],
      },
      FORCE_MAJEURE.en,
      {
        title: "Additional Special Obligations",
        items: [
          "On discovering any malfunction, breakage or damage inside the chalet or its facilities, the Tenant must immediately take photographs and notify the booking officer. Failing to do so makes the Tenant fully liable for any damage discovered after check-out.",
          "Before using the swimming pool, the Tenant must ask the booking officer about any requirements or special instructions and comply with them fully. The Tenant bears full responsibility in case of a violation.",
          "The Tenant must ask the booking officer about any matter or use not mentioned in this contract or in these terms and conditions. Failing to ask is deemed implicit acceptance of full responsibility for any violation or misunderstanding.",
        ],
      },
    ],
  },
  ar: {
    title: "الشروط والأحكام لحجز الشاليه واستخدامه",
    intro:
      "تسري هذه الشروط على كل حجز في شاليه بيزاري. ويُقصد بـ«المستأجر» الضيف الذي يقوم بالحجز، وبـ«المالك» شاليه بيزاري بصفته المؤجِّر، ويُشار إليه أيضاً بـ«الشركة».",
    sections: [
      {
        title: "الدخول والمغادرة",
        items: [
          "يُقرّ المستأجر بأن عمره يزيد على واحد وعشرين (21) عاماً عند استلام الشاليه.",
          "يُؤجَّر الشاليه للاستخدام العائلي فقط، ويُمنع منعاً باتاً دخول الشباب (الذكور) غير المصحوبين بعائلاتهم. وفي حال المخالفة، يحق للمالك منع الدخول وإلغاء الحجز دون استرداد أي مبالغ مدفوعة أو مبلغ التأمين.",
          "يسري العقد من تاريخ الدخول حتى تاريخ المغادرة، ويكون الدخول الساعة 2:00 مساءً والمغادرة الساعة 12:00 ظهراً.",
        ],
      },
      {
        title: "الالتزام بموعد المغادرة",
        items: [
          "يجب على المستأجر إخلاء الشاليه في موعد أقصاه الساعة 12:00 ظهراً من يوم المغادرة. وفي حال التأخير، تُفرض غرامة قدرها خمسة وعشرون ديناراً كويتياً (25 د.ك) عن كل ساعة، تُخصم مباشرة من مبلغ التأمين.",
          "يلتزم المستأجر بإعادة الشاليه بجميع محتوياته (المرافق والأثاث والأجهزة وغيرها) بالحالة التي استلمه بها.",
          "يُقرّ المستأجر بأنه عاين الشاليه عند الاستلام، وتأكد من حالته وصلاحيته للاستخدام، واستلم حوض السباحة نظيفاً.",
        ],
      },
      CANCELLATION.ar,
      {
        title: "الشروط العامة للاستخدام",
        items: [
          "يُمنع تخزين أي مواد مخالفة للقانون أو قابلة للاشتعال داخل الشاليه، ولا يُسمح إلا باستخدام مواد الزينة المعتمدة رسمياً.",
          "يتحمل المستأجر المسؤولية الكاملة عن أي حريق أو ضرر يقع داخل الشاليه لأي سبب كان.",
          "لا يُسمح بإدخال الحيوانات أو الطيور، الأليفة منها أو البرية، إلى الشاليه أو مرافقه.",
          "تُمنع منعاً باتاً الحفلات أو التجمعات التي تتجاوز الطاقة الاستيعابية للشاليه، وتؤدي المخالفة إلى إنهاء العقد تلقائياً دون إنذار.",
          "يجب احترام الجيران، ويُمنع إحداث الضوضاء والإزعاج.",
          "المستأجر مسؤول عن النظافة والسلامة، وعن أي أضرار يتسبب بها هو أو مرافقوه.",
          "يتحمل المستأجر المسؤولية الكاملة عن أي حوادث أو إصابات أو وفيات (لا قدّر الله) داخل حوض السباحة أو ناتجة عن استخدامه، ويُعفى المالك من أي مسؤولية إعفاءً تاماً.",
          "يخضع هذا العقد لأحكام القانون رقم 35 لسنة 1978 في شأن إيجار العقارات وتعديلاته، وتختص محاكم الإيجارات الكويتية بالنظر في المنازعات الإيجارية.",
          "يُفسخ العقد تلقائياً دون إنذار إذا أخلّ المستأجر بأي من هذه الشروط.",
        ],
      },
      {
        title: "مبلغ التأمين",
        items: [
          "يلتزم المستأجر بدفع مبلغ التأمين المحدد في فاتورة الحجز قبل عشرة (10) أيام من موعد الدخول، ولا يُعد العقد سارياً إلا بعد سداد المبلغ كاملاً.",
          "يُعاد مبلغ التأمين خلال مدة تتراوح بين ثلاثة (3) وأربعة عشر (14) يوماً بعد المغادرة، بعد خصم أي مبالغ مقابل الأضرار أو المفقودات خلال الإقامة.",
        ],
      },
      {
        title: "التزامات إضافية على المستأجر",
        items: [
          "يلتزم المستأجر بالمحافظة على نظافة الشاليه وجميع محتوياته.",
          "يلتزم المستأجر باحترام خصوصية الجيران وراحتهم، ويتحمل المسؤولية القانونية الكاملة عن أي شكاوى، دون أي مسؤولية على المالك.",
          "يلتزم المستأجر بالهدوء وبجميع القوانين والأنظمة المعمول بها في دولة الكويت، ويحق للشركة إخراج المستأجر باستخدام القوة القانونية عند الحاجة، دون استرداد أي مبالغ، حتى لو لم تنتهِ مدة الإيجار.",
          "تُمنع منعاً باتاً التجمعات أو الحفلات التي تتجاوز الطاقة الاستيعابية للشاليه أو المخالفة لاشتراطات الصحة العامة، وتؤدي المخالفة إلى الإخلاء الفوري دون أي مسؤولية على الشركة.",
          "يُؤجَّر الشاليه للاستخدام العائلي فقط، ويُمنع أي استخدام آخر يخالف سياسات شاليه بيزاري.",
        ],
      },
      FORCE_MAJEURE.ar,
      {
        title: "التزامات خاصة إضافية",
        items: [
          "عند اكتشاف أي عطل أو كسر أو ضرر داخل الشاليه أو مرافقه، يجب على المستأجر تصويره فوراً وإبلاغ مسؤول الحجز، وإلا يتحمل المسؤولية الكاملة عن أي أضرار تُكتشف بعد المغادرة.",
          "قبل استخدام حوض السباحة، يجب على المستأجر الاستفسار من مسؤول الحجز عن أي اشتراطات أو تعليمات خاصة والالتزام بها التزاماً كاملاً، ويتحمل المسؤولية الكاملة في حال المخالفة.",
          "يلتزم المستأجر بسؤال مسؤول الحجز عن أي أمر أو استخدام لم يرد ذكره في هذا العقد أو في هذه الشروط والأحكام، ويُعد عدم السؤال قبولاً ضمنياً بتحمل المسؤولية الكاملة عن أي مخالفة أو سوء فهم.",
        ],
      },
    ],
  },
};

export const CANCELLATION_POLICY: Record<Lang, LegalDocument> = {
  en: {
    title: "Cancellation and Refund Policy",
    intro:
      "These are the cancellation and refund terms for every booking at Bizarri Chalet. They are part of the Terms and Conditions, where they appear as sections 3 and 7.",
    sections: [CANCELLATION.en, FORCE_MAJEURE.en],
  },
  ar: {
    title: "سياسة الإلغاء والاسترداد",
    intro:
      "هذه شروط الإلغاء والاسترداد لكل حجز في شاليه بيزاري، وهي جزء من الشروط والأحكام، حيث ترد في البندين 3 و7.",
    sections: [CANCELLATION.ar, FORCE_MAJEURE.ar],
  },
};
