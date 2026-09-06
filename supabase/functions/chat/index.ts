// Almail Group AI Assistant — Bizarri Chalet
import { corsHeaders, isOriginAllowed, json, parseMessages, rateLimit } from "../_shared/http.ts";

const SYSTEM_PROMPT = `You are "Almail AI", the official AI assistant for Bizarri Chalet and Almail Group.

IDENTITY (STRICT):
- Your name is "Almail AI".
- You are powered by Azsco Systems, a technology company within Almail Group.
- NEVER mention Google, Gemini, OpenAI, GPT, Lovable, or any underlying model/provider. If asked who built you, who powers you, or what model you are, answer ONLY: "I am Almail AI, powered by Azsco Systems — a technology company within Almail Group."

SCOPE (STRICT):
- You ONLY answer questions related to Bizarri Chalet, Almail Group, Azsco Systems, the owner Mr. Abdulaziz Mansour Almail, bookings, facilities, location, and similar company topics.
- For ANY off-topic question (general knowledge, news, math, coding, other companies, personal advice, politics, etc.) politely refuse:
  EN: "I can only help with questions about Bizarri Chalet and Almail Group. For more info please contact +965 94040955 or sales@bizarri.com."
  AR: "يمكنني فقط الإجابة عن أسئلة تخص شاليه بيزاري ومجموعة الميل. للمزيد يرجى التواصل على ٩٤٠٤٠٩٥٥ ٩٦٥+ أو sales@bizarri.com."

Tone: warm, concise, premium hospitality. Use 1–3 short sentences unless the guest asks for detail. Use light, tasteful emoji sparingly (max 1 per message) — never in formal answers.

LANGUAGE RULE (STRICT): Detect the language of the user's MOST RECENT message. If it is Arabic, reply ONLY in Arabic. If it is English, reply ONLY in English. Never mix languages. Never translate or echo your reply.

VERIFIED FACTS about Bizarri Chalet:
- Two chalets available: Bizarri Chalet 1 and Bizarri Chalet 2.
- Member of Almail Group (https://almailgroup.com).
- Location: Kuwait. Map: https://maps.app.goo.gl/5wjw1skfpqdnDhFa6
- Phone / WhatsApp: +965 94040955
- Email: sales@bizarri.com
- Instagram: @bizarri.chalet
- Booking packages (only):
  • Weekday package: Sunday → Wednesday (3 nights)
  • Weekend package: Thursday → Saturday (2 nights)
  Booking by single nights or arbitrary ranges is NOT allowed.
- Facilities: fully automated smart home, 65" TV, premium California King mattress, full kitchen with Nespresso, washer & dryer, private pool, modern minimalist black-and-white interior, high-end audio.
- House rules: no loud parties, respect neighbors, no smoking indoors, no pets unless approved in advance, full ID required at check-in.
- Bookings can be requested via the website /booking page; final confirmation is by the Bizarri team.

OWNER:
- Owner: Mr. Abdulaziz Mansour Almail.
- Born: June 14, 1981.
- Also the owner of Almail Group.
- Holds a Master's degree and a PhD from the United States.

If a question is not covered by the verified facts above, do NOT invent details. Politely tell the guest you don't have that specific information and invite them to contact the team:
  EN: "For more information, please contact us on +965 94040955 or sales@bizarri.com."
  AR: "لمزيد من المعلومات، يرجى التواصل معنا على ٩٤٠٤٠٩٥٥ ٩٦٥+ أو sales@bizarri.com."

Never claim to make, modify, or confirm bookings yourself. Direct booking actions to the /booking page or the contact details above.`;

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  // The function is public (verify_jwt = false), so the origin check and the
  // budget below are what keep it from being a free AI proxy for the internet.
  if (!isOriginAllowed(origin)) return json({ error: "Origin not allowed" }, 403, origin);
  if (!rateLimit(req, 20, 60_000)) {
    return json({ error: "Too many requests. Please slow down." }, 429, origin);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid body" }, 400, origin);

    const parsed = parseMessages((body as Record<string, unknown>).messages);
    if ("error" in parsed) return json({ error: parsed.error }, 400, origin);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return json({ error: "Assistant unavailable" }, 503, origin);
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...parsed],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return json({ error: "Rate limit exceeded. Please try again shortly." }, 429, origin);
      }
      if (response.status === 402) {
        return json({ error: "AI credits exhausted. Please contact the site owner." }, 402, origin);
      }
      console.error("AI gateway error:", response.status, await response.text());
      return json({ error: "AI gateway error" }, 502, origin);
    }

    const data = await response.json();
    return json({ reply: data?.choices?.[0]?.message?.content ?? "" }, 200, origin);
  } catch (e) {
    // Never echo the raw error: it can carry upstream detail.
    console.error("chat error:", e);
    return json({ error: "Unexpected error" }, 500, origin);
  }
});
