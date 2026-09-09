/**
 * Notifies the team when a booking request arrives — by email, and by
 * WhatsApp via CallMeBot.
 *
 * Wired as a Supabase Database Webhook on INSERT into public.bookings, so the
 * notification is a consequence of the row existing rather than something the
 * browser has to remember to do — a guest closing the tab cannot lose it.
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
    const payload = await req.json().catch(() => null);
    // Database Webhooks post { type, table, record, old_record }; a direct
    // call may post the record itself.
    const booking: BookingRecord | null =
      (payload?.record as BookingRecord) ?? (payload?.ref ? (payload as BookingRecord) : null);

    if (!booking?.ref) return json({ error: "No booking in payload" }, 400, origin);

    // The two channels are independent: one being unconfigured or failing
    // never stops the other from being attempted.
    const [email, whatsapp] = await Promise.all([
      sendEmail(booking),
      sendAllWhatsApp(booking),
    ]);

    return json({ ok: true, email, whatsapp }, 200, origin);
  } catch (e) {
    console.error("notify-booking error", e);
    return json({ error: "Unexpected error" }, 500, origin);
  }
});
