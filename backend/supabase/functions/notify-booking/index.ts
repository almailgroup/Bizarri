/**
 * Every email the booking flow sends after the request exists.
 *
 * On INSERT: the team is told a request arrived, by email and by WhatsApp via
 * CallMeBot, and the guest gets their own copy with the reference.
 *
 * On UPDATE: if the status changed to accepted, rejected or cancelled, the
 * guest is told what was decided. Any other update — an edited phone number,
 * an internal note — sends nothing, or every keystroke in the admin panel
 * would be an email.
 *
 * Wired as Supabase Database Webhooks on public.bookings, so a notification is
 * a consequence of the row changing rather than something a browser has to
 * remember to do — closing the tab cannot lose it.
 *
 * Recipients for both channels come from public.settings — editable from the
 * admin panel's Site Settings tab — falling back to secrets if the relevant
 * row is empty or unreachable. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
 * provided automatically to every Edge Function; no extra secret is needed
 * to read settings.
 *
 * Email needs RESEND_API_KEY. WhatsApp needs each recipient to have already
 * opted in with CallMeBot (message their number, get an API key back) —
 * see backend/supabase/README.md for the exact steps. Either channel being
 * unconfigured just skips that channel; it never blocks the other, and a
 * booking having already succeeded is never put at risk by a notification
 * failing.
 */
import { corsHeaders, json } from "../_shared/http.ts";

interface WhatsAppRecipient {
  phone: string;
  apikey: string;
}

interface BookingRecord {
  ref: string;
  chalet_id: number;
  start_date: string;
  end_date: string;
  days: number;
  total: number;
  currency: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  guests: number;
  notes: string | null;
  status?: string | null;
  /** The language the guest booked in, for their copy of the email. */
  lang?: string | null;
}

interface WebhookPayload {
  type?: string;
  record?: BookingRecord;
  old_record?: BookingRecord | null;
}

/**
 * The statuses worth telling a guest about.
 *
 * "pending" is in here for the move *back* — an admin who accepted and then
 * reconsidered leaves the guest holding a confirmation that is no longer
 * true, which is worse than never having been told. A new request is also
 * pending, but that arrives as an INSERT and is handled before this is read.
 */
const NOTIFIED_STATUSES = ["accepted", "rejected", "cancelled", "pending"];

/**
 * What one webhook delivery should cause.
 *
 * Pure and exported so it can be tested without a Deno runtime — the routing
 * is the part with the edge cases, and an UPDATE hook fires on every column,
 * not just the one that matters.
 */
export function classify(payload: WebhookPayload | null): {
  action: "new" | "decision" | "ignore";
  reason?: string;
} {
  const record = payload?.record;
  if (!record?.ref) return { action: "ignore", reason: "no booking in payload" };

  // A direct call (no webhook envelope) is treated as a new request, which is
  // how this function was invoked before there was anything else to do.
  if (payload?.type === "INSERT" || !payload?.type) return { action: "new" };

  if (payload.type === "UPDATE") {
    // Without the previous row there is no evidence anything changed, and
    // "probably a decision" is not good enough to mail a guest about.
    if (!payload.old_record) return { action: "ignore", reason: "no previous row" };
    const before = payload.old_record.status ?? null;
    const after = record.status ?? null;
    if (before === after) return { action: "ignore", reason: "status unchanged" };
    if (!after || !NOTIFIED_STATUSES.includes(after)) {
      return { action: "ignore", reason: `status ${after} is not worth an email` };
    }
    return { action: "decision" };
  }

  return { action: "ignore", reason: `unhandled event ${payload.type}` };
}

/** One row from public.settings, or null on any failure — never throws, so a
 *  settings read failure falls through to the secret-based default instead
 *  of dropping the notification. */
async function readSetting(key: string): Promise<unknown> {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return null;
  try {
    const res = await fetch(`${url}/rest/v1/settings?key=eq.${key}&select=value`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { value: unknown }[];
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * The public WhatsApp number, digits only, for the link in a guest's email.
 *
 * Guests are not sent WhatsApp messages — that needs a WhatsApp Business API
 * and Meta-approved templates, and the site deliberately does not use one —
 * but a guest starting the conversation needs no approval at all. So the
 * emails carry a tappable link rather than a number to copy out by hand.
 */
async function guestWhatsAppNumber(): Promise<string> {
  const contact = await readSetting("contact");
  const raw =
    contact && typeof contact === "object"
      ? ((contact as Record<string, unknown>).whatsapp ?? "")
      : "";
  const digits = String(raw).replace(/\D/g, "");
  return digits || (Deno.env.get("CONTACT_WHATSAPP") ?? "96594040955");
}

/** A WhatsApp button, or nothing when there is no number to point it at. */
function whatsAppButton(number: string, label: string): string {
  if (!number) return "";
  return `<p style="margin:24px 0 0">
      <a href="https://wa.me/${esc(number)}"
         style="display:inline-block;border:1px solid #ddd;padding:10px 18px;
                font-size:13px;color:#111;text-decoration:none">${esc(label)}</a>
    </p>`;
}

/** Editable from Site Settings, so an admin can change recipients without a
 *  redeploy. */
async function notifyEmailsFromSettings(): Promise<string[] | null> {
  const value = await readSetting("notify_emails");
  if (!Array.isArray(value)) return null;
  const emails = value.filter((v): v is string => typeof v === "string" && v.length > 0);
  return emails.length > 0 ? emails : null;
}

/** Same idea, for WhatsApp: each recipient needs their own CallMeBot API key
 *  (it's issued per phone number, not per account), so this is a list of
 *  {phone, apikey} pairs rather than a plain list of numbers. */
async function notifyWhatsAppFromSettings(): Promise<WhatsAppRecipient[] | null> {
  const value = await readSetting("notify_whatsapp");
  if (!Array.isArray(value)) return null;
  const recipients = value.filter(
    (v): v is WhatsAppRecipient =>
      !!v &&
      typeof v === "object" &&
      typeof (v as WhatsAppRecipient).phone === "string" &&
      typeof (v as WhatsAppRecipient).apikey === "string" &&
      (v as WhatsAppRecipient).phone.length > 0 &&
      (v as WhatsAppRecipient).apikey.length > 0,
  );
  return recipients.length > 0 ? recipients : null;
}

function esc(s: string): string {
  return s.replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string,
  );
}

function render(b: BookingRecord): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#666">${label}</td>` +
    `<td style="padding:6px 0;font-weight:500">${esc(value)}</td></tr>`;
  return `
    <div style="font-family:system-ui,sans-serif;max-width:520px">
      <p style="letter-spacing:.3em;text-transform:uppercase;font-size:11px;color:#888">
        Bizarri Chalet</p>
      <h2 style="font-weight:400;margin:4px 0 20px">New booking request</h2>
      <p style="font-family:monospace;font-size:18px;margin:0 0 20px">${esc(b.ref)}</p>
      <table style="border-collapse:collapse;font-size:14px">
        ${row("Chalet", `Bizarri Chalet ${b.chalet_id}`)}
        ${row("Dates", `${b.start_date} → ${b.end_date} (${b.days} days)`)}
        ${row("Total", `${b.currency} ${b.total}`)}
        ${row("Guest", b.guest_name)}
        ${row("Phone", b.guest_phone)}
        ${row("Email", b.guest_email)}
        ${row("Guests", String(b.guests))}
        ${b.notes ? row("Notes", b.notes) : ""}
      </table>
      <p style="margin-top:24px;font-size:13px;color:#888">
        Accept or reject this request in the admin dashboard.</p>
    </div>`;
}

/**
 * The guest's own copy. Deliberately a different message from the team's: it
 * leads with the reference, because that is the one thing they need to keep,
 * and it says the request is not yet confirmed so nobody turns up on the
 * strength of this email alone.
 */
function renderGuest(b: BookingRecord, lang: "en" | "ar", whatsapp = ""): string {
  const ar = lang === "ar";
  const t = ar
    ? {
        title: "استلمنا طلب حجزك",
        ref: "رقم الحجز",
        chalet: "الشاليه",
        dates: "التواريخ",
        total: "الإجمالي",
        guests: "عدد الضيوف",
        pending: "طلبك قيد المراجعة. سنتواصل معك قريباً لتأكيد الحجز.",
        keep: "احتفظ برقم الحجز للاستعلام عن حالته في أي وقت.",
        chat: "تواصل معنا عبر واتساب",
      }
    : {
        title: "We have your booking request",
        ref: "Booking reference",
        chalet: "Chalet",
        dates: "Dates",
        total: "Total",
        guests: "Guests",
        pending: "Your request is being reviewed. We will contact you shortly to confirm.",
        keep: "Keep this reference to check the status of your booking at any time.",
        chat: "Message us on WhatsApp",
      };
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#666">${esc(label)}</td>` +
    `<td style="padding:6px 0;font-weight:500">${esc(value)}</td></tr>`;
  return `
    <div style="font-family:system-ui,sans-serif;max-width:520px" ${ar ? 'dir="rtl"' : ""}>
      <p style="letter-spacing:.3em;text-transform:uppercase;font-size:11px;color:#888">
        Bizarri Chalet</p>
      <h2 style="font-weight:400;margin:4px 0 8px">${esc(t.title)}</h2>
      <p style="font-size:15px;color:#333;margin:0 0 20px">${esc(t.pending)}</p>
      <p style="text-transform:uppercase;letter-spacing:.2em;font-size:11px;color:#888;margin:0">
        ${esc(t.ref)}</p>
      <p style="font-family:monospace;font-size:26px;margin:4px 0 24px" dir="ltr">${esc(b.ref)}</p>
      <table style="border-collapse:collapse;font-size:14px">
        ${row(t.chalet, `Bizarri Chalet ${b.chalet_id}`)}
        ${row(t.dates, `${b.start_date} \u2192 ${b.end_date} (${b.days})`)}
        ${row(t.total, `${b.currency} ${b.total}`)}
        ${row(t.guests, String(b.guests))}
      </table>
      <p style="margin-top:24px;font-size:13px;color:#888">${esc(t.keep)}</p>
      ${whatsAppButton(whatsapp, t.chat)}
    </div>`;
}

/**
 * What the guest is told once a decision is made.
 *
 * Three different messages, because "rejected" needs to read as an apology
 * with a way forward rather than as a status code. The internal admin note is
 * deliberately not included: the admin panel labels it internal and an admin
 * writing "haggled, gave discount" there does not expect the guest to read it.
 */
export function renderDecision(b: BookingRecord, lang: "en" | "ar", whatsapp = ""): string {
  const ar = lang === "ar";
  const status = b.status ?? "";
  const copy = ar
    ? {
        accepted: {
          title: "تم تأكيد حجزك",
          body: "يسعدنا تأكيد إقامتك. نتطلع لاستقبالك.",
        },
        rejected: {
          title: "لم نتمكن من تأكيد حجزك",
          body: "نأسف، هذه التواريخ غير متاحة. تواصل معنا عبر واتساب وسنساعدك في إيجاد موعد آخر.",
        },
        cancelled: { title: "تم إلغاء حجزك", body: "تم إلغاء هذا الحجز. إذا لم تطلب ذلك، يرجى التواصل معنا." },
        pending: {
          title: "حجزك قيد المراجعة",
          body: "أعدنا طلبك إلى قائمة الانتظار بينما نراجع التفاصيل. سنتواصل معك قريباً بالتأكيد النهائي.",
        },
        ref: "رقم الحجز",
        chalet: "الشاليه",
        dates: "التواريخ",
        total: "الإجمالي",
        guests: "عدد الضيوف",
        contact: "لأي استفسار، تواصل معنا.",
        chat: "تواصل معنا عبر واتساب",
      }
    : {
        accepted: {
          title: "Your booking is confirmed",
          body: "We are glad to confirm your stay. We look forward to welcoming you.",
        },
        rejected: {
          title: "We could not confirm your booking",
          body: "We are sorry \u2014 these dates are not available. Message us on WhatsApp and we will help you find another date.",
        },
        cancelled: {
          title: "Your booking has been cancelled",
          body: "This booking has been cancelled. If you did not ask for this, please get in touch.",
        },
        pending: {
          title: "Your booking is back under review",
          body: "We have put your request back on the waiting list while we check the details. We will be in touch shortly to confirm.",
        },
        ref: "Booking reference",
        chalet: "Chalet",
        dates: "Dates",
        total: "Total",
        guests: "Guests",
        contact: "Any questions, just get in touch.",
        chat: "Message us on WhatsApp",
      };
  const t = (copy as Record<string, { title: string; body: string }>)[status] ?? copy.accepted;

  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#666">${esc(label)}</td>` +
    `<td style="padding:6px 0;font-weight:500">${esc(value)}</td></tr>`;

  // The stay is shown while it might still happen. A refusal or a
  // cancellation does not need the price of something that is not.
  const details =
    status === "accepted" || status === "pending"
      ? `<table style="border-collapse:collapse;font-size:14px">
        ${row(copy.chalet, `Bizarri Chalet ${b.chalet_id}`)}
        ${row(copy.dates, `${b.start_date} \u2192 ${b.end_date} (${b.days})`)}
        ${row(copy.total, `${b.currency} ${b.total}`)}
        ${row(copy.guests, String(b.guests))}
      </table>`
      : "";

  return `
    <div style="font-family:system-ui,sans-serif;max-width:520px" ${ar ? 'dir="rtl"' : ""}>
      <p style="letter-spacing:.3em;text-transform:uppercase;font-size:11px;color:#888">
        Bizarri Chalet</p>
      <h2 style="font-weight:400;margin:4px 0 8px">${esc(t.title)}</h2>
      <p style="font-size:15px;color:#333;margin:0 0 20px">${esc(t.body)}</p>
      <p style="text-transform:uppercase;letter-spacing:.2em;font-size:11px;color:#888;margin:0">
        ${esc(copy.ref)}</p>
      <p style="font-family:monospace;font-size:26px;margin:4px 0 24px" dir="ltr">${esc(b.ref)}</p>
      ${details}
      <p style="margin-top:24px;font-size:13px;color:#888" dir="${ar ? "rtl" : "ltr"}">
        ${esc(copy.contact)}</p>
      ${whatsAppButton(whatsapp, copy.chat)}
    </div>`;
}

/** Plain-text with WhatsApp's own emphasis markup (*bold*), not HTML. */
function renderWhatsApp(b: BookingRecord): string {
  const lines = [
    `*New booking request*`,
    `Ref: ${b.ref}`,
    `Chalet: Bizarri Chalet ${b.chalet_id}`,
    `Dates: ${b.start_date} → ${b.end_date} (${b.days} days)`,
    `Total: ${b.currency} ${b.total}`,
    `Guest: ${b.guest_name}`,
    `Phone: ${b.guest_phone}`,
    `Email: ${b.guest_email}`,
    `Guests: ${b.guests}`,
  ];
  if (b.notes) lines.push(`Notes: ${b.notes}`);
  return lines.join("\n");
}

/**
 * Send one WhatsApp message via CallMeBot. CallMeBot only delivers to the
 * number that generated the apikey — there is no way to message an arbitrary
 * number with one shared key, which is why recipients are {phone, apikey}
 * pairs rather than a plain phone list.
 */
async function sendWhatsApp(recipient: WhatsAppRecipient, text: string): Promise<boolean> {
  try {
    const url =
      `https://api.callmebot.com/whatsapp.php` +
      `?phone=${encodeURIComponent(recipient.phone)}` +
      `&text=${encodeURIComponent(text)}` +
      `&apikey=${encodeURIComponent(recipient.apikey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error("notify-booking: callmebot failed", recipient.phone, res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("notify-booking: callmebot error", recipient.phone, e);
    return false;
  }
}

interface DeliveryResult {
  attempted: boolean;
  delivered: boolean;
  reason?: string;
}

async function sendEmail(booking: BookingRecord): Promise<DeliveryResult> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    console.log("notify-booking: RESEND_API_KEY unset, skipping email", booking.ref);
    return { attempted: false, delivered: false, reason: "no api key" };
  }

  const to =
    (await notifyEmailsFromSettings()) ??
    (Deno.env.get("NOTIFY_EMAILS") ?? "admin@almailgroup.com")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const from = Deno.env.get("NOTIFY_FROM") ?? "Bizarri Chalet <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: `New booking ${booking.ref} — Chalet ${booking.chalet_id}`,
      html: render(booking),
      reply_to: booking.guest_email,
    }),
  });

  if (!res.ok) {
    console.error("notify-booking: resend failed", res.status, await res.text());
    return { attempted: true, delivered: false };
  }
  return { attempted: true, delivered: true };
}

/**
 * The guest's copy. Failing to reach the guest must never look like the
 * booking failed \u2014 the row already exists by the time this runs \u2014 so this
 * reports its own outcome and never throws.
 */
async function sendGuestEmail(booking: BookingRecord): Promise<DeliveryResult> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { attempted: false, delivered: false, reason: "no api key" };
  if (!booking.guest_email) return { attempted: false, delivered: false, reason: "no address" };

  const lang: "en" | "ar" = booking.lang === "ar" ? "ar" : "en";
  const from = Deno.env.get("NOTIFY_FROM") ?? "Bizarri Chalet <onboarding@resend.dev>";
  const replyTo = (await notifyEmailsFromSettings())?.[0] ?? Deno.env.get("NOTIFY_EMAILS");
  const whatsapp = await guestWhatsAppNumber();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [booking.guest_email],
        subject:
          lang === "ar"
            ? `\u0637\u0644\u0628 \u0627\u0644\u062d\u062c\u0632 ${booking.ref} \u2014 \u0634\u0627\u0644\u064a\u0647 \u0628\u064a\u0632\u0627\u0631\u064a`
            : `Your booking request ${booking.ref} \u2014 Bizarri Chalet`,
        html: renderGuest(booking, lang, whatsapp),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error("notify-booking: guest email failed", res.status, await res.text());
      return { attempted: true, delivered: false };
    }
    return { attempted: true, delivered: true };
  } catch (e) {
    console.error("notify-booking: guest email error", e);
    return { attempted: true, delivered: false };
  }
}

/** The decision, to the guest. Never throws, for the same reason as above. */
async function sendDecisionEmail(booking: BookingRecord): Promise<DeliveryResult> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { attempted: false, delivered: false, reason: "no api key" };
  if (!booking.guest_email) return { attempted: false, delivered: false, reason: "no address" };

  const lang: "en" | "ar" = booking.lang === "ar" ? "ar" : "en";
  const from = Deno.env.get("NOTIFY_FROM") ?? "Bizarri Chalet <onboarding@resend.dev>";
  const replyTo = (await notifyEmailsFromSettings())?.[0] ?? Deno.env.get("NOTIFY_EMAILS");
  const confirmed = booking.status === "accepted";
  const whatsapp = await guestWhatsAppNumber();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [booking.guest_email],
        subject:
          lang === "ar"
            ? `${confirmed ? "\u062a\u0645 \u062a\u0623\u0643\u064a\u062f \u062d\u062c\u0632\u0643" : "\u062a\u062d\u062f\u064a\u062b \u0639\u0644\u0649 \u062d\u062c\u0632\u0643"} ${booking.ref}`
            : `${confirmed ? "Confirmed" : "Update"}: booking ${booking.ref} \u2014 Bizarri Chalet`,
        html: renderDecision(booking, lang, whatsapp),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error("notify-booking: decision email failed", res.status, await res.text());
      return { attempted: true, delivered: false };
    }
    return { attempted: true, delivered: true };
  } catch (e) {
    console.error("notify-booking: decision email error", e);
    return { attempted: true, delivered: false };
  }
}

async function sendAllWhatsApp(booking: BookingRecord): Promise<DeliveryResult> {
  const configured = await notifyWhatsAppFromSettings();
  const envPhone = Deno.env.get("CALLMEBOT_PHONE");
  const envKey = Deno.env.get("CALLMEBOT_APIKEY");
  const recipients = configured ?? (envPhone && envKey ? [{ phone: envPhone, apikey: envKey }] : null);

  if (!recipients) {
    console.log("notify-booking: no WhatsApp recipients configured, skipping", booking.ref);
    return { attempted: false, delivered: false, reason: "no recipients" };
  }

  const text = renderWhatsApp(booking);
  const results = await Promise.all(recipients.map((r) => sendWhatsApp(r, text)));
  return { attempted: true, delivered: results.some(Boolean) };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  try {
    const raw = await req.json().catch(() => null);
    // Database Webhooks post { type, table, record, old_record }; a direct
    // call may post the record itself.
    const payload: WebhookPayload | null = raw?.record
      ? (raw as WebhookPayload)
      : raw?.ref
        ? { record: raw as BookingRecord }
        : null;

    const { action, reason } = classify(payload);
    if (action === "ignore") {
      // 200, not an error: an update this function has nothing to say about is
      // a normal event, and a failing webhook would be retried forever.
      console.log("notify-booking: ignoring delivery -", reason);
      return json({ ok: true, action, reason }, 200, origin);
    }

    const booking = payload!.record!;

    if (action === "decision") {
      const guestEmail = await sendDecisionEmail(booking);
      return json({ ok: true, action, guestEmail }, 200, origin);
    }

    // The three sends are independent: one being unconfigured or failing
    // never stops the others from being attempted.
    const [email, guestEmail, whatsapp] = await Promise.all([
      sendEmail(booking),
      sendGuestEmail(booking),
      sendAllWhatsApp(booking),
    ]);

    return json({ ok: true, action, email, guestEmail, whatsapp }, 200, origin);
  } catch (e) {
    console.error("notify-booking error", e);
    return json({ error: "Unexpected error" }, 500, origin);
  }
});
