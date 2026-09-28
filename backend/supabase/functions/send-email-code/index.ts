/**
 * Mails a one-time code to the address a guest typed into the booking form,
 * so a typo is caught before the booking exists rather than after the
 * confirmation bounces.
 *
 * The code itself is minted by public.start_email_verification(), which is
 * granted to service_role and nothing else. Only the salted hash is stored;
 * the plaintext lives in this function's memory long enough to be put in an
 * email. That is the reason this indirection exists at all — if the browser
 * could ask for a code and read the response, verifying an address you do not
 * own would be a single request.
 *
 * Needs RESEND_API_KEY. Without it the function reports emailConfigured:false
 * rather than pretending it sent something, and the form says so instead of
 * asking for a code that will never arrive.
 */
import { corsHeaders, json } from "../_shared/http.ts";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

function esc(s: string): string {
  return s.replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string,
  );
}

function render(code: string, lang: string): string {
  const ar = lang === "ar";
  const title = ar ? "رمز التأكيد" : "Your confirmation code";
  const intro = ar
    ? "أدخل هذا الرمز في صفحة الحجز لتأكيد بريدك الإلكتروني."
    : "Enter this code on the booking page to confirm your email address.";
  const expiry = ar
    ? "ينتهي هذا الرمز خلال ١٠ دقائق. إذا لم تطلبه، يمكنك تجاهل هذه الرسالة."
    : "This code expires in 10 minutes. If you did not ask for it, you can ignore this email.";
  return `
    <div style="font-family:system-ui,sans-serif;max-width:480px" ${ar ? 'dir="rtl"' : ""}>
      <p style="letter-spacing:.3em;text-transform:uppercase;font-size:11px;color:#888">
        Bizarri Chalet</p>
      <h2 style="font-weight:400;margin:4px 0 20px">${esc(title)}</h2>
      <p style="font-size:15px;color:#333;margin:0 0 20px">${esc(intro)}</p>
      <p style="font-family:monospace;font-size:34px;letter-spacing:.3em;margin:0 0 24px"
         dir="ltr">${esc(code)}</p>
      <p style="font-size:13px;color:#888;margin:0">${esc(expiry)}</p>
    </div>`;
}

/** Ask the database for a code. It enforces its own rate limit, so a caller
 *  cannot turn this endpoint into a mail cannon aimed at one address. */
async function mintCode(email: string): Promise<{ code?: string; error?: string }> {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return { error: "Server is not configured" };

  const res = await fetch(`${url}/rest/v1/rpc/start_email_verification`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_email: email }),
  });

  if (!res.ok) {
    const body = await res.text();
    // The rate limit and the format check are both raised as P0001 with a
    // message meant for the guest; pass it through rather than flattening
    // every failure into "something went wrong".
    try {
      const parsed = JSON.parse(body) as { message?: string };
      if (parsed.message) return { error: parsed.message };
    } catch {
      // Not JSON — fall through to the generic message below.
    }
    console.error("send-email-code: rpc failed", res.status, body);
    return { error: "Could not send a code right now" };
  }
  return { code: (await res.json()) as string };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  try {
    const payload = (await req.json().catch(() => null)) as {
      email?: string;
      lang?: string;
    } | null;
    const email = (payload?.email ?? "").trim().toLowerCase();
    const lang = payload?.lang === "ar" ? "ar" : "en";

    if (!EMAIL_RE.test(email)) {
      return json({ error: "Please enter a valid email address" }, 400, origin);
    }

    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) {
      // Say so plainly. Minting a code we cannot deliver would leave the
      // guest staring at an input box waiting for mail that is not coming.
      console.log("send-email-code: RESEND_API_KEY unset");
      return json({ ok: false, emailConfigured: false }, 200, origin);
    }

    const { code, error } = await mintCode(email);
    if (error || !code) return json({ error: error ?? "Could not send a code" }, 429, origin);

    const from = Deno.env.get("NOTIFY_FROM") ?? "Bizarri Chalet <onboarding@resend.dev>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: lang === "ar" ? `رمز التأكيد: ${code}` : `Your Bizarri code: ${code}`,
        html: render(code, lang),
      }),
    });

    if (!res.ok) {
      console.error("send-email-code: resend failed", res.status, await res.text());
      return json({ error: "Could not send the code. Please try again." }, 502, origin);
    }

    return json({ ok: true, emailConfigured: true }, 200, origin);
  } catch (e) {
    console.error("send-email-code error", e);
    return json({ error: "Unexpected error" }, 500, origin);
  }
});
