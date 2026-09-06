/**
 * Shared HTTP concerns for the Edge Functions.
 *
 * Both AI functions run with verify_jwt = false so the public site can call
 * them without a session. That makes them an open door to a metered AI gateway,
 * so the origin allow-list and the per-IP budget below are the only things
 * standing between the site and someone else's bill.
 */

const DEFAULT_ORIGINS = [
  "https://almailgroup.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
];

/** Set ALLOWED_ORIGINS as a comma-separated list to override. */
export function allowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS");
  return raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_ORIGINS;
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = allowedOrigins();
  // Echo the caller's origin only when it is on the list. Never "*": that would
  // let any site on the internet spend the API budget.
  const allow = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function isOriginAllowed(origin: string | null): boolean {
  // Same-origin and server-to-server callers send no Origin header.
  if (!origin) return true;
  return allowedOrigins().includes(origin);
}

export function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

/**
 * In-memory sliding-window limiter, keyed by client IP.
 *
 * Per-instance, so it is a speed bump rather than a guarantee — an isolate can
 * be recycled or run in parallel. It is enough to stop a single script from
 * draining the budget; durable limiting belongs in a table if abuse persists.
 */
const hits = new Map<string, number[]>();

export function rateLimit(req: Request, limit: number, windowMs: number): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);

  // Bound the map so a long-lived isolate cannot grow it without limit.
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(key);
    }
  }
  return recent.length <= limit;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_MESSAGES = 24;
const MAX_CHARS = 4000;

/** Reject anything that is not a short, well-formed chat transcript. */
export function parseMessages(input: unknown): ChatMessage[] | { error: string } {
  if (!Array.isArray(input)) return { error: "messages must be an array" };
  if (input.length === 0) return { error: "messages must not be empty" };
  if (input.length > MAX_MESSAGES) return { error: `at most ${MAX_MESSAGES} messages` };

  const out: ChatMessage[] = [];
  let total = 0;
  for (const m of input) {
    if (typeof m !== "object" || m === null) return { error: "malformed message" };
    const { role, content } = m as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") return { error: "invalid role" };
    if (typeof content !== "string") return { error: "content must be a string" };
    total += content.length;
    if (total > MAX_CHARS) return { error: "conversation too long" };
    out.push({ role, content });
  }
  return out;
}
