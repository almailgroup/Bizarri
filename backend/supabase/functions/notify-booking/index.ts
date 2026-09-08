/**
 * Emails the team when a booking request arrives.
 *
 * Wired as a Supabase Database Webhook on INSERT into public.bookings, so the
 * notification is a consequence of the row existing rather than something the
 * browser has to remember to do — a guest closing the tab cannot lose it.
 *
 * Recipients come from the `notify_emails` row in public.settings — editable
 * from the admin panel's Site Settings tab — falling back to the
 * NOTIFY_EMAILS secret if that row is empty or unreachable. SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are provided automatically to every Edge
 * Function; no extra secret is needed to read settings.
 *
 * Set RESEND_API_KEY to enable delivery. Without it the function logs the
 * request and returns 200: a missing key must not make booking look broken.
 */
import { corsHeaders, json } from "../_shared/http.ts";

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

/** Recipients from public.settings, so an admin editing them takes effect
 *  immediately without redeploying a secret. Never throws — a settings read
 *  failure falls through to the NOTIFY_EMAILS secret instead of dropping the
 *  notification. */
async function notifyEmailsFromSettings(): Promise<string[] | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/settings?key=eq.notify_emails&select=value`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { value: unknown }[];
    const value = rows[0]?.value;
    if (!Array.isArray(value)) return null;
    const emails = value.filter((v): v is string => typeof v === "string" && v.length > 0);
    return emails.length > 0 ? emails : null;
  } catch {
    return null;
  }
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

    const key = Deno.env.get("RESEND_API_KEY");
    const to =
      (await notifyEmailsFromSettings()) ??
      (Deno.env.get("NOTIFY_EMAILS") ?? "sales@bizarri.com")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const from = Deno.env.get("NOTIFY_FROM") ?? "Bizarri Chalet <onboarding@resend.dev>";

    if (!key) {
      // Booking already succeeded; this is best-effort. Log and move on.
      console.log("notify-booking: RESEND_API_KEY unset, skipping", booking.ref);
      return json({ ok: true, delivered: false, reason: "no api key" }, 200, origin);
    }

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
      return json({ ok: false, delivered: false }, 502, origin);
    }
    return json({ ok: true, delivered: true }, 200, origin);
  } catch (e) {
    console.error("notify-booking error", e);
    return json({ error: "Unexpected error" }, 500, origin);
  }
});
