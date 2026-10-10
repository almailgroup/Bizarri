/**
 * Booking-flow bugs found in a review of the whole system, each reproduced
 * here before it was fixed.
 *
 *  1. A request the server refused after the code was confirmed threw an
 *     unhandled promise rejection: the error reached the screen through the
 *     mutation's state, but the call that made it was fire-and-forget.
 *  2. A confirmed address was forgotten as soon as the guest went back to
 *     change the dates -- the server would have accepted it for an hour, but
 *     the form asked for, and mailed, a new code.
 *  3. A holiday already under way was offered -- named on the Holiday card,
 *     listed on Offers -- though no part of it could be chosen.
 *  4. With chalet 1 switched off in the admin, the booking page still opened
 *     on chalet 1 (the picker hides itself when one chalet is left) and the
 *     request failed at the very end with "Unknown chalet".
 */
import { chromium } from "playwright";

const B = "http://localhost:4173/";
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

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = new Date();
today.setHours(0, 0, 0, 0);
const at = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);

const CHALETS = [
  { id: 1, slug: "b1", name_en: "Bizarri Chalet 1", name_ar: "ش١", active: true, sort_order: 1 },
  { id: 2, slug: "b2", name_en: "Bizarri Chalet 2", name_ar: "ش٢", active: true, sort_order: 2 },
];

function makeState(over = {}) {
  return {
    code: null,
    sendCount: 0,
    booked: [],
    calendarCalls: [],
    chalets: CHALETS,
    occasions: [],
    refuse: null,
    ...over,
  };
}

async function page(state) {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => {
    const u = r.request().url();
    if (!SUPA.test(u)) return r.abort();
    const raw = new URL(u).pathname;
    const path = raw.replace("/rest/v1/", "");
    let body = null;
    try {
      body = r.request().postDataJSON?.() ?? null;
    } catch {
      body = null;
    }
    const send = (d, status = 200) =>
      r.fulfill({ status, contentType: "application/json", body: JSON.stringify(d) });
    if (raw === "/functions/v1/send-email-code") {
      state.sendCount++;
      state.code = "246810";
      return send({ ok: true, emailConfigured: true });
    }
    if (raw.startsWith("/storage/v1/object/civil-ids/"))
      return send({ Key: raw.replace("/storage/v1/object/", ""), Id: "obj-1" });
    if (path === "rpc/verify_email_code") return send(String(body?.p_code ?? "") === state.code);
    if (path === "rpc/request_booking") {
      if (state.refuse) return send({ message: state.refuse, code: "P0001" }, 400);
      state.booked.push(body);
      return send({
        id: "b1",
        ref: "BZR-BUG001",
        chalet_id: body.p_chalet_id,
        start_date: body.p_start,
        end_date: body.p_end,
        days: 3,
        total: 350,
        currency: "KWD",
        package_key: "weekend",
        guest_name: "Guest",
        guest_phone: "+96599999999",
        guest_email: "guest@example.com",
        guests: 2,
        status: "pending",
        created_at: "",
        updated_at: "",
      });
    }
    if (path === "chalets") return send(state.chalets);
    if (path === "special_occasions") return send(state.occasions);
    if (path === "rates")
      return send({
        id: true,
        full_week: 600,
        weekend: 350,
        weekday: 300,
        daily_weekday: 75,
        daily_weekend: 120,
        currency: "KWD",
        min_stay_days: 1,
        updated_at: "",
        updated_by: null,
      });
    if (path === "rpc/availability_calendar") {
      state.calendarCalls.push(body);
      const out = [];
      const d = new Date(body.p_from + "T00:00:00");
      const e = new Date(body.p_to + "T00:00:00");
      for (; d <= e; d.setDate(d.getDate() + 1)) {
        const k = iso(d);
        out.push({ day: k, blocked: k < iso(today), price: 75, custom: false });
      }
      return send(out);
    }
    return send([]);
  });
  await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
  return { p, ctx, errors };
}

const path = (p) => {
  const u = new URL(p.url());
  return u.pathname + u.search;
};

/** On the booking page: the first weekend on offer, then the details. */
async function toDetails(p) {
  await p
    .getByRole("button", { name: /^Weekend/i })
    .first()
    .click();
  await p.waitForTimeout(400);
  await p
    .locator('[role="grid"] button:not([disabled]):not([aria-disabled="true"])')
    .first()
    .click();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: /^Continue$/i }).click();
  await p.waitForTimeout(700);
}

async function fillForm(p) {
  await p.getByLabel("Full Name").fill("Guest");
  await p.getByLabel("Phone Number", { exact: true }).fill("+96599999999");
  await p.locator("input[type=email]").fill("guest@example.com");
  await p.locator("input[type=file]").setInputFiles({
    name: "id.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  await p.locator("input[type=checkbox]").first().check();
}

async function submitWithCode(p, state) {
  await p.getByRole("button", { name: /submit booking request/i }).click();
  await p.waitForTimeout(900);
  if ((await p.locator('[role="dialog"]').count()) > 0) {
    await p.getByLabel(/6-digit code/i).fill(state.code ?? "");
    await p.getByRole("button", { name: /^Confirm$/i }).click();
  }
  await p.waitForTimeout(1500);
}

// ===================== 1. a refusal after the code is shown, and nothing throws
{
  const state = makeState({ refuse: "Those dates are no longer available" });
  const { p, ctx, errors } = await page(state);
  await p.goto(`${B}booking/en`, { waitUntil: "load" });
  await p.waitForTimeout(1000);
  await toDetails(p);
  await fillForm(p);
  await submitWithCode(p, state);
  ck(
    "A refusal after the code is confirmed is shown to the guest",
    await p.getByText("Those dates are no longer available").isVisible(),
  );
  ck("…on the form, where they can act on it", path(p) === "/booking/en?step=details", path(p));
  ck("…and nothing throws unhandled", errors.length === 0, errors.join(" | "));

  // ======================= 2. the confirmed address survives changing dates
  // The obvious next move after "no longer available": back to the dates.
  state.refuse = null;
  await p.getByRole("button", { name: /^Back$/i }).click();
  await p.waitForTimeout(700);
  await p
    .locator('[role="grid"] button:not([disabled]):not([aria-disabled="true"])')
    .nth(3)
    .click();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: /^Continue$/i }).click();
  await p.waitForTimeout(700);
  const sentBefore = state.sendCount;
  await p.getByRole("button", { name: /submit booking request/i }).click();
  await p.waitForTimeout(1500);
  ck(
    "Back to change the dates, the confirmed address is still confirmed",
    (await p.locator('[role="dialog"]').count()) === 0 && state.sendCount === sentBefore,
    `${state.sendCount - sentBefore} more code(s) sent`,
  );
  ck(
    "…and the request goes straight through",
    state.booked.length === 1 && (await p.getByText("BZR-BUG001").isVisible()),
  );
  await ctx.close();
}

// ========================== 3. a holiday under way is not offered as bookable
{
  const running = {
    id: "occ-running",
    name_en: "Running Holiday",
    name_ar: "عطلة جارية",
    start_date: iso(at(-1)),
    end_date: iso(at(1)),
    price: 900,
    active: true,
  };
  const state = makeState({ occasions: [running] });
  const { p, ctx } = await page(state);
  await p.goto(`${B}offers/en`, { waitUntil: "load" });
  await p.waitForTimeout(900);
  ck(
    "A holiday already under way is not listed on Offers",
    (await p.getByText("Running Holiday").count()) === 0 &&
      (await p.getByText("No offers running right now").isVisible()),
  );
  await p.goto(`${B}booking/en`, { waitUntil: "load" });
  await p.waitForTimeout(900);
  await p.getByRole("button", { name: /^Holiday/i }).click();
  await p.waitForTimeout(500);
  ck(
    "…nor named on the booking page's Holiday card",
    (await p.getByText("Running Holiday").count()) === 0,
  );
  ck(
    "…which says no holiday is open, rather than showing one that cannot be chosen",
    await p.getByText("No holiday dates are open yet").isVisible(),
  );
  await ctx.close();
}

// ================================ 4. chalet 1 switched off: chalet 2 is used
{
  // Switched off in the admin: guests no longer see it at all.
  const state = makeState({ chalets: [CHALETS[1]] });
  const { p, ctx } = await page(state);
  await p.goto(`${B}booking/en`, { waitUntil: "load" });
  await p.waitForTimeout(1200);
  const asked = [...new Set(state.calendarCalls.map((c) => c.p_chalet_id))];
  ck(
    "With chalet 1 switched off, the calendar is chalet 2's",
    asked.includes(2) && state.calendarCalls.at(-1)?.p_chalet_id === 2,
    `availability asked for chalet(s) ${asked.join(", ")}`,
  );
  await toDetails(p);
  await fillForm(p);
  await submitWithCode(p, state);
  ck(
    "…and the request is for chalet 2",
    state.booked.length === 1 && state.booked[0].p_chalet_id === 2,
    JSON.stringify(state.booked.map((x) => x.p_chalet_id)),
  );
  await ctx.close();
}

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
