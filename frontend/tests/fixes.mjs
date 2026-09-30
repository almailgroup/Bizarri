import { chromium } from "playwright";
// The language is the last segment, so a page URL is pageUrl(route).
const LANG = "en";
const B = "http://localhost:4173/";
const pageUrl = (r) => (r ? `${B}${r}/${LANG}` : `${B}${LANG}`);
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

// Stands in for the guest's inbox: the code is minted server-side, so the
// test can only know it because the mocked function tells it.
const state = { code: "" };

async function mk(tz) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, timezoneId: tz });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) =>
    SUPA.test(r.request().url()) ? r.fallback() : r.abort(),
  );
  await ctx.route(SUPA, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/rest/v1/", "");
    // The Civil ID upload is multipart, and postDataJSON throws on it. Every
    // other suite guards this; this one had never sent a file before.
    let body = null;
    try {
      body = route.request().postDataJSON?.() ?? null;
    } catch {
      body = null;
    }
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
    // Checkout needs a confirmed address and a Civil ID. Without these the
    // form simply refuses to submit, and the assertion below lands on the
    // form's own summary rather than the confirmation -- which is how it
    // came to be checking the browser's dates instead of the server's.
    if (url.pathname === "/functions/v1/send-email-code") {
      state.code = "135790";
      return send({ ok: true, emailConfigured: true });
    }
    if (path === "rpc/verify_email_code") return send(String(body?.p_code ?? "") === state.code);
    if (url.pathname.startsWith("/storage/v1/object/civil-ids/"))
      return send({ Key: url.pathname.replace("/storage/v1/object/", ""), Id: "obj-1" });

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
    if (path === "rpc/lookup_booking_by_ref") {
      if (String(body.p_ref ?? "").toUpperCase() === "BZR-TZ0001")
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
  await p.goto(pageUrl("booking"), { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(700);
  return { p, ctx };
}

// ── fix 1: confirmation dates in a timezone behind UTC ──
let { p, ctx } = await mk("America/New_York");
await p.waitForTimeout(900);
await p.getByRole("button", { name: "Next month" }).click();
await p.waitForTimeout(400);
const day = (n) =>
  p
    .locator(".grid.grid-cols-7 button")
    .filter({ hasText: new RegExp(`^${n}$`) })
    .first();
// Sun 11 - Wed 14 in one tap. The mocked server answers with 11 - 17
// whatever was chosen, which is the point: the confirmation has to show the
// dates the server stored rather than the ones the browser picked, and now
// that the two deliberately differ it can only pass by reading the response.
await p
  .getByRole("button", { name: /^Weekday/i })
  .first()
  .click();
await p.waitForTimeout(400);
await day(11).click();
await p.waitForTimeout(400);
await p.getByRole("button", { name: /^Continue$/i }).click();
await p.waitForTimeout(400);
await p.locator("input[type=text]").first().fill("Test Guest");
await p.locator("input[type=tel]").fill("+96594040955");
await p.locator("input[type=email]").fill("t@e.com");
await p.getByRole("button", { name: /^Send code$/i }).click();
await p.waitForTimeout(400);
await p.getByLabel(/6-digit code/i).fill(state.code);
await p.getByRole("button", { name: /^Confirm$/i }).click();
await p.waitForTimeout(400);
await p.locator("input[type=number]").fill("2");
await p.locator("input[type=file]").setInputFiles({
  name: "civil-id.png",
  mimeType: "image/png",
  buffer: Buffer.from("89504e470d0a1a0a", "hex"),
});
await p.waitForTimeout(500);
await p.locator('input[type="checkbox"]').first().check();
await p.getByRole("button", { name: /submit booking request/i }).click();
await p.waitForTimeout(1200);
// Assert we are actually on the confirmation. The dates live beside the
// reference there; anywhere else on the page they are the browser's own.
ck("The request goes through to a confirmation", (await p.getByText("BZR-TZ0001").count()) > 0);
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
await p.waitForTimeout(900);
let clicks = 0;
for (let i = 0; i < 20; i++) {
  const nxt = p.getByRole("button", { name: "Next month" });
  if (await nxt.isDisabled()) break;
  await nxt.click();
  await p.waitForTimeout(110);
  clicks++;
}
// The grid labels itself with the month. Reading it from a Tailwind class
// tied the test to a text size, and it broke the day that size changed.
const label = await p.locator('[role="grid"]').first().getAttribute("aria-label");
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
// The panel used to sit at the foot of the booking page, duplicating both the
// header shortcut and /reservation. It now lives only on /reservation.
({ p, ctx } = await mk("Asia/Kuwait"));
await p.goto(pageUrl("reservation"), { waitUntil: "domcontentloaded" });
await p.waitForTimeout(600);
// The reference stands on its own now; there is no second field to fill.
await p.locator('input[placeholder="BZR-XXXXXX"]').fill("BZR-TZ0001");
await p.getByRole("button", { name: /check status/i }).click();
await p.waitForTimeout(600);
ck("Guest lookup shows the status", await p.getByText("Accepted").first().isVisible());
// The stay is shown in words now rather than as the ISO row, but the point of
// checking it under a named timezone is unchanged: 2026-10-11 must read as the
// 11th, a Sunday, in Kuwait as anywhere. Parsing the string as UTC and
// formatting it locally is what silently moves a stay a day earlier.
ck(
  "Guest lookup shows the stored dates, unshifted by the timezone",
  await p.getByText(/Sun\s*11\s*–\s*Sat\s*17\s*Oct/).isVisible(),
);
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
