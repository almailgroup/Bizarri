import { chromium } from "playwright";
const B = "http://localhost:4173/Bizarri/";
const SUPA = /wpajjuavtebjzomptxcu\.supabase\.co/;
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

const state = { admin: true, user: "user-admin", isAdminCalls: 0, bookingCalls: 0 };
const session = (id) => ({
  access_token: "tok-" + id,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "r-" + id,
  user: {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: id + "@example.com",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  },
});

const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 } });
await ctx.route(/^https?:\/\/(?!localhost)/, (r) =>
  SUPA.test(r.request().url()) ? r.fallback() : r.abort(),
);
await ctx.route(SUPA, async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  const send = (d, s = 200) =>
    route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(d) });
  if (path.includes("/auth/v1/token")) return send(session(state.user));
  if (path.includes("/auth/v1/logout")) return send({});
  if (path.includes("/auth/v1/user")) return send(session(state.user).user);
  const rest = path.replace("/rest/v1/", "");
  if (rest === "rpc/is_admin") {
    state.isAdminCalls++;
    return send(state.admin);
  }
  if (rest === "chalets")
    return send([
      { id: 1, slug: "b1", name_en: "Bizarri Chalet 1", name_ar: "١", active: true, sort_order: 1 },
    ]);
  if (rest === "rates")
    return send({
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
    });
  if (rest === "bookings") {
    state.bookingCalls++;
    return send(
      state.admin
        ? [
            {
              id: "b1",
              ref: "BZR-SECRET",
              chalet_id: 1,
              start_date: "2026-10-11",
              end_date: "2026-10-17",
              days: 7,
              total: 600,
              currency: "KWD",
              package_key: "fullWeek",
              guest_name: "Confidential Guest",
              guest_phone: "+96599999999",
              guest_email: "private@example.com",
              guests: 4,
              notes: null,
              status: "pending",
              admin_note: null,
              created_at: new Date().toISOString(),
              updated_at: "",
              decided_at: null,
              decided_by: null,
            },
          ]
        : [],
    );
  }
  return send([]);
});
await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
const p = await ctx.newPage();

// 1. sign in as an admin
await p.goto(B + "admin", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(700);
await p.locator("input[type=email]").fill("admin@example.com");
await p.locator("input[type=password]").fill("pw");
await p.getByRole("button", { name: /^Login$/i }).click();
await p.waitForTimeout(1400);
ck("Admin reaches the dashboard", await p.getByText("Availability & Pricing").isVisible());
// Requests now live under their own tab rather than being mounted by default.
await p.getByRole("button", { name: "Booking Requests" }).click();
await p.waitForTimeout(400);
ck("Admin sees the booking list", await p.getByText("Confidential Guest").isVisible());

// 2. sign out
await p.getByRole("button", { name: /logout/i }).click();
await p.waitForTimeout(1000);
ck("Sign-out returns to the login screen", await p.locator("input[type=email]").isVisible());

// 3. a DIFFERENT, non-admin user signs in immediately (inside the 60s staleTime)
state.admin = false;
state.user = "user-guest";
await p.locator("input[type=email]").fill("someone@example.com");
await p.locator("input[type=password]").fill("pw");
await p.getByRole("button", { name: /^Login$/i }).click();
await p.waitForTimeout(1600);

const sawDashboard = await p
  .getByText("Availability & Pricing")
  .isVisible()
  .catch(() => false);
const sawDenied = await p
  .getByText(/does not have chalet management access/i)
  .isVisible()
  .catch(() => false);
ck(
  "Non-admin is refused, not shown a cached dashboard",
  !sawDashboard && sawDenied,
  `dashboard=${sawDashboard} denied=${sawDenied}`,
);

const leaked = await p.evaluate(() => document.body.innerText.includes("Confidential Guest"));
ck("Previous admin's guest data is not visible to the next user", !leaked);
ck(
  "is_admin was re-checked for the new user",
  state.isAdminCalls >= 2,
  `${state.isAdminCalls} calls`,
);

console.log("\n" + fails + " failing");
await b.close();
process.exit(fails ? 1 : 0);
