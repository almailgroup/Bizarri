// Almail AI — Bizarri Chalet image generation
// Restricted to Bizarri Chalet / Almail Group related imagery only.

import {
  corsHeaders,
  isOriginAllowed,
  json as jsonWithOrigin,
  rateLimit,
} from "../_shared/http.ts";

const REFUSAL_EN =
  "I can only generate images related to Bizarri Chalet or Almail Group (chalet interiors, pools, rooms, lifestyle, branding, etc.). Please refine your request.";
const REFUSAL_AR =
  "يمكنني فقط إنشاء صور تتعلق بشاليه بيزاري أو مجموعة الميل (الشاليه، المسبح، الغرف، نمط الحياة، الهوية...). يرجى تعديل الطلب.";

const CLASSIFY_PROMPT = `You are a strict classifier. Decide if an image generation prompt is related to "Bizarri Chalet" or "Almail Group".

Allowed (return YES): luxury chalets, modern minimalist black-and-white interiors, pools, bedrooms, kitchens, lounges, smart-home concepts, exterior architecture of a private chalet in Kuwait, branding/logos for Bizarri or Almail, lifestyle imagery clearly tied to a private chalet stay (e.g. coffee on a chalet terrace, towels by a chalet pool).

Not allowed (return NO): people portraits unrelated to chalet, other brands, generic landscapes (mountains, forests, oceans, deserts) without chalet, cars, food not in a chalet context, anime, memes, politics, NSFW, anything off-topic.

Respond with ONLY one word: YES or NO.`;

const MAX_PROMPT_CHARS = 600;

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const json = (body: unknown, status = 200) => jsonWithOrigin(body, status, origin);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Image generation is the most expensive call the site can make, so it gets
  // a tighter budget than chat: 5 a minute per IP.
  if (!isOriginAllowed(origin)) return json({ error: "Origin not allowed" }, 403);
  if (!rateLimit(req, 5, 60_000)) {
    return json({ error: "Too many image requests. Please wait a moment." }, 429);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid body" }, 400);
    const { prompt, lang } = body as { prompt?: unknown; lang?: unknown };
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return json({ error: "Missing prompt" }, 400);
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      return json({ error: `Prompt must be under ${MAX_PROMPT_CHARS} characters` }, 400);
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return json({ error: "Image generation unavailable" }, 503);
    }
    const refusal = lang === "ar" ? REFUSAL_AR : REFUSAL_EN;

    // 1) Classify
    const classifyRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: CLASSIFY_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!classifyRes.ok) {
      const t = await classifyRes.text();
      console.error("classify error", classifyRes.status, t);
      if (classifyRes.status === 429)
        return json({ error: "Rate limit exceeded. Try again shortly." }, 429);
      if (classifyRes.status === 402) return json({ error: "AI credits exhausted." }, 402);
      return json({ error: "Classifier error" }, 502);
    }
    const classifyData = await classifyRes.json();
    const verdict = (classifyData?.choices?.[0]?.message?.content ?? "").trim().toUpperCase();
    if (!verdict.startsWith("YES")) {
      return json({ refused: true, message: refusal });
    }

    // 2) Generate image
    const guided = `${prompt}. Style: luxury, modern, minimalist black-and-white aesthetic consistent with Bizarri Chalet branding. High-end editorial photography quality.`;
    const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: guided }],
        modalities: ["image", "text"],
      }),
    });
    if (!imgRes.ok) {
      const t = await imgRes.text();
      console.error("image error", imgRes.status, t);
      if (imgRes.status === 429)
        return json({ error: "Rate limit exceeded. Try again shortly." }, 429);
      if (imgRes.status === 402) return json({ error: "AI credits exhausted." }, 402);
      return json({ error: "Image generation error" }, 502);
    }
    const imgData = await imgRes.json();
    const url: string | undefined = imgData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) return json({ error: "No image returned" }, 500);
    return json({ imageUrl: url });
  } catch (e) {
    // Never echo the raw error: it can carry upstream detail.
    console.error("generate-image error", e);
    return json({ error: "Unexpected error" }, 500);
  }
});
