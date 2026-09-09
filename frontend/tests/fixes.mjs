import { chromium } from "playwright";
const B = "http://localhost:4173/Bizarri/";
const SUPA = /ycfvqzcnatwacwlcmiej\.supabase\.co/;
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

async function mk(tz) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, timezoneId: tz });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) =>
    SUPA.test(r.request().url()) ? r.fallback() : r.abort(),
  );
  await ctx.route(SUPA, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/rest/v1/", "");
    const body = route.request().postDataJSON?.() ?? null;
    const send = (d) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
    if (path === "chalets")
      return send([
        {
          id: 1,
          slug: "b1",
          name_en: "Bizarri Chalet 1",
          name_ar: "١",
          active: true,
          sort_order: 1,
        },
      ]);
    if (path === "rates")
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
    if (path === "rpc/availability_calendar") {
      const out = [];
      const d = new Date(body.p_from + "T00:00:00");
      const end = new Date(body.p_to + "T00:00:00");
      for (; d <= end; d.setDate(d.getDate() + 1)) {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        out.push({ day: iso, blocked: false, price: 75, custom: false });
      }
      return send(out);
    }
    if (path === "rpc/request_booking")
      return send({
        id: "u1",
        ref: "BZR-TZ0001",
        chalet_id: 1,
        start_date: "2026-10-11",
        end_date: "2026-10-17",
        days: 7,
        total: 600,
        currency: "KWD",
        package_key: "fullWeek",
        guest_name: "T",
        guest_phone: "+9650",
        guest_email: "t@e.com",
        guests: 2,
        notes: null,
        status: "pending",
        admin_note: null,
        created_at: new Date().toISOString(),
        updated_at: "",
        decided_at: null,
        decided_by: null,
      });
    if (path === "rpc/lookup_booking") {
      if (body.p_ref === "BZR-TZ0001" && body.p_email === "t@e.com")
        return send([
          {
            ref: "BZR-TZ0001",
            status: "accepted",
            chalet_id: 1,
            start_date: "2026-10-11",
            end_date: "2026-10-17",
            days: 7,
            total: 600,
            currency: "KWD",
          },
        ]);
      return send([]);
    }
    return send([]);
  });
  await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
  const p = await ctx.newPage();
  await p.goto(B + "booking", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(700);
  return { p, ctx };
}

// ── fix 1: confirmation dates in a timezone behind UTC ──
let { p, ctx } = await mk("America/New_York");
await p.getByRole("button", { name: /book now/i }).click();
await p.waitForTimeout(900);
await p.getByRole("button", { name: "Next month" }).click();
await p.waitForTimeout(400);
const day = (n) =>
  p
    .locator(".grid.grid-cols-7 button")
    .filter({ hasText: new RegExp(`^${n}$`) })
    .first();
await day(11).click();
await p.waitForTimeout(200);
await day(17).click();
await p.waitForTimeout(400);
await p.getByRole("button", { name: /^Continue$/i }).click();
await p.waitForTimeout(400);
await p.locator("input[type=text]").first().fill("Test Guest");
await p.locator("input[type=tel]").fill("+96594040955");
await p.locator("input[type=email]").fill("t@e.com");
await p.locator("input[type=number]").fill("2");
await p.getByRole("button", { name: /submit booking request/i }).click();
await p.waitForTimeout(900);
const shown = await p.evaluate(
  () => document.body.innerText.match(/\d{4}-\d{2}-\d{2}\s*→\s*\d{4}-\d{2}-\d{2}/)?.[0] ?? "none",
);
ck(
  "Confirmation shows the dates the server stored (UTC-5 browser)",
  shown.includes("2026-10-11") && shown.includes("2026-10-17"),
  shown,
);
await ctx.close();

// ── fix 2: month horizon ──
({ p, ctx } = await mk("Asia/Kuwait"));
await p.getByRole("button", { name: /book now/i }).click();
await p.waitForTimeout(900);
let clicks = 0;
for (let i = 0; i < 20; i++) {
  const nxt = p.getByRole("button", { name: "Next month" });
  if (await nxt.isDisabled()) break;
  await nxt.click();
  await p.waitForTimeout(110);
  clicks++;
}
const label = await p.locator("p.font-display.text-2xl").first().innerText();
const stats = await p.evaluate(() => {
  const btns = [...document.querySelectorAll(".grid.grid-cols-7 button")];
  return { total: btns.length, disabled: btns.filter((x) => x.disabled).length };
});
ck(
  "Forward paging stops at the fetched window",
  clicks < 20 && clicks === 11,
  `${clicks} months, at ${label}`,
);
ck(
  "Last reachable month is still bookable",
  stats.disabled < stats.total,
  `${stats.disabled}/${stats.total} disabled`,
);
ck(
  "Horizon is explained to the guest",
  await p.getByText(/Booking opens 12 months ahead/i).isVisible(),
);
await ctx.close();

// ── fix 4: guest lookup ──
({ p, ctx } = await mk("Asia/Kuwait"));
await p.locator('input[placeholder="BZR-XXXXXX"]').fill("BZR-TZ0001");
await p.locator("input[type=email]").fill("t@e.com");
await p.getByRole("button", { name: /check status/i }).click();
await p.waitForTimeout(600);
ck("Guest lookup shows the status", await p.getByText("Accepted").first().isVisible());
ck("Guest lookup shows the stored dates", await p.getByText(/2026-10-11.*2026-10-17/).isVisible());
await p.locator('input[placeholder="BZR-XXXXXX"]').fill("BZR-WRONG1");
await p.getByRole("button", { name: /check status/i }).click();
await p.waitForTimeout(600);
ck(
  "Unknown reference reports not found",
  await p.getByText(/No request matches that reference/i).isVisible(),
);
await ctx.close();

console.log("\n" + fails + " failing");
await b.close();
process.exit(fails ? 1 : 0);
