/**
 * Shared HTTP helpers for the Edge Functions.
 *
 * Currently just CORS handling for notify-booking. Kept as its own module
 * rather than inlined so a second function can reuse it without copy-paste.
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
  // Echo the caller's origin only when it is on the list, never "*".
  const allow = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}
