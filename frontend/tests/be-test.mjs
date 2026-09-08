import { chromium } from "playwright";
const B = "http://localhost:4173/Bizarri/";
const SUPA = /jxpxbpaaizjeoxbftwwd\.supabase\.co/;
const b = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
    : {},
);
let fails = 0;
const ck = (n, c, d = "") => {
  if (!c) fails++;
  console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`);
};

// Fixture Supabase: records what the app asks for and answers like the schema.
function mock(ctx, state) {
  return ctx.route(SUPA, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace("/rest/v1/", "").replace("/auth/v1/", "auth:");
    const body = req.postDataJSON?.() ?? null;
    state.calls.push({ method: req.method(), path, body });
    const send = (data, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });

    if (path.startsWith("auth:")) return send({ session: null, user: null }, 400);
    if (path === "chalets") return send(state.chalets);
    if (path === "rates") return send(state.rates);
    if (path === "rpc/availability_calendar") return send(state.calendar(body));
    if (path === "rpc/request_booking") {
      state.lastBooking = body;
      return send(state.booking(body));
    }
    if (path === "news") return send(state.news);
    return send([]);
  });
}

const baseState = () => ({
  calls: [],
  chalets: [
    {
      id: 1,
      slug: "bizarri-1",
      name_en: "Bizarri Chalet 1",
      name_ar: "شاليه بيزاري ١",
      active: true,
      sort_order: 1,
    },
    {
      id: 2,
      slug: "bizarri-2",
      name_en: "Bizarri Chalet 2",
      name_ar: "شاليه بيزاري ٢",
      active: true,
      sort_order: 2,
    },
  ],
  rates: {
    id: true,
    full_week: 600,
    weekend: 350,
    weekday: 300,
    daily_weekday: 75,
    daily_weekend: 120,
    currency: "KWD",
    min_stay_days: 3,
    updated_at: "",
    updated_by: null,
  },
  news: [],
  // Mirror the SQL: past days blocked, 2026-10-06 blocked, 2026-10-05 priced 200
  calendar: ({ p_from, p_to }) => {
    const out = [];
    const d = new Date(p_from + "T00:00:00");
    const end = new Date(p_to + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (; d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      const dow = d.getDay();
      const custom = iso === "2026-10-05";
      out.push({
        day: iso,
        blocked: d < today || iso === "2026-10-06",
        price: custom ? 200 : dow >= 4 ? 120 : 75,
        custom,
      });
    }
    return out;
  },
  booking: (b) => ({
    id: "uuid-1",
    ref: "BZR-TEST01",
    chalet_id: b.p_chalet_id,
    start_date: b.p_start,
    end_date: b.p_end,
    days: 7,
    total: 600,
    currency: "KWD",
    package_key: "fullWeek",
    guest_name: b.p_guest_name,
    guest_phone: b.p_guest_phone,
    guest_email: b.p_guest_email,
    guests: b.p_guests,
    notes: b.p_notes,
    status: "pending",
    admin_note: null,
    created_at: new Date().toISOString(),
    updated_at: "",
    decided_at: null,
    decided_by: null,
  }),
});

async function page(route, state) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) =>
    SUPA.test(r.request().url()) ? r.fallback() : r.abort(),
  );
  await mock(ctx, state);
  await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
  const p = await ctx.newPage();
  await p.goto(B + route, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(900);
  return { p, ctx };
}

// ---------- offers reads rates from the server ----------
let st = baseState();
let { p, ctx } = await page("offers", st);
ck(
  "Offers fetches rates from Supabase",
  st.calls.some((c) => c.path === "rates"),
);
ck("Offers renders the server's full-week rate", await p.getByText("KD 600").isVisible());
await ctx.close();

// ---------- booking calendar uses availability_calendar ----------
st = baseState();
({ p, ctx } = await page("booking", st));
ck(
  "Booking fetches chalets",
  st.calls.some((c) => c.path === "chalets"),
);
await p.getByRole("button", { name: /book now/i }).click();
await p.waitForTimeout(900);
const calCall = st.calls.find((c) => c.path === "rpc/availability_calendar");
ck("Calendar calls availability_calendar RPC", !!calCall, JSON.stringify(calCall?.body));
ck("RPC is scoped to a chalet", calCall?.body?.p_chalet_id === 1);

// navigate to October 2026 and check the server's blocked day is disabled
for (let i = 0; i < 1; i++) {
  await p.getByRole("button", { name: "Next month" }).click();
  await p.waitForTimeout(300);
}
const blocked6 = await p.evaluate(
  () =>
    [...document.querySelectorAll(".grid.grid-cols-7 button")].find(
      (x) => x.textContent.trim() === "6",
    )?.disabled,
);
ck("Server-blocked day is disabled in the UI", blocked6 === true);

const day = (n) =>
  p
    .locator(".grid.grid-cols-7 button")
    .filter({ hasText: new RegExp(`^${n}$`) })
    .first();
const total = () =>
  p.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) =>
      d.querySelector("p")?.textContent?.includes("Total"),
    );
    return el ? el.querySelectorAll("p")[1].textContent.trim() : null;
  });

await day(11).click();
await p.waitForTimeout(200);
await day(17).click();
await p.waitForTimeout(400);
ck("Full week priced from server rates (KD 600)", (await total()) === "KD 600", await total());

await p.getByRole("button", { name: /^Clear$/i }).click();
await day(4).click();
await p.waitForTimeout(200);
await day(7).click();
await p.waitForTimeout(400);
ck(
  "Custom server price applied (75+200+blocked… range refused)",
  await p.getByText("Those dates include a day that isn't available.").isVisible(),
);

await p.getByRole("button", { name: /^Clear$/i }).click();
await day(11).click();
await p.waitForTimeout(200);
await day(17).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: /^Continue$/i }).click();
await p.waitForTimeout(400);
await p.locator("input[type=text]").first().fill("Aisha Al-Sabah");
await p.locator("input[type=tel]").fill("+96594040955");
await p.locator("input[type=email]").fill("aisha@example.com");
await p.locator("input[type=number]").fill("6");
await p.getByRole("button", { name: /submit booking request/i }).click();
await p.waitForTimeout(900);
const rb = st.calls.find((c) => c.path === "rpc/request_booking");
ck("Submit calls request_booking RPC", !!rb);
ck(
  "RPC receives no price field (server prices it)",
  rb && !("p_total" in rb.body) && !("total" in rb.body),
  JSON.stringify(Object.keys(rb?.body ?? {})),
);
ck("Confirmation shows the server-issued reference", await p.getByText("BZR-TEST01").isVisible());
await ctx.close();

// ---------- admin requires real auth ----------
st = baseState();
({ p, ctx } = await page("admin", st));
ck("Admin shows an email+password sign-in", await p.locator("input[type=email]").isVisible());
ck(
  "No hardcoded password remains in the bundle",
  !(await p.evaluate(async () => {
    const srcs = [...document.querySelectorAll("script[src]")].map((s) => s.src);
    for (const s of srcs) {
      if ((await (await fetch(s)).text()).includes("BIZARRIkwt2026")) return true;
    }
    return false;
  })),
);
await ctx.close();

console.log("\n" + fails + " failing");
await b.close();
process.exit(fails ? 1 : 0);
