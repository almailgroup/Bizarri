/**
 * The booking flow's money and its moves.
 *
 *  1. Guest Information adds the refundable insurance deposit to the total,
 *     names it, and says it comes back -- in the amount the settings hold.
 *  2. Back and Next move one step at a time and keep what was chosen: the
 *     dates, the shape, what was typed. A reload keeps them too.
 *  3. On a phone every way forward and back is a comfortable target, and the
 *     details step keeps both in reach at the foot of the screen.
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
const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
const firstDow = (from, dow) => {
  const d = new Date(from);
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
  return d;
};
const thu = firstDow(nextMonth, 4);
const sat = new Date(thu.getFullYear(), thu.getMonth(), thu.getDate() + 2);

const NOTE =
  "A refundable insurance deposit of 100 KD is included in the total and will be fully refunded upon completion of your stay at the Chalet.";

function makeState(over = {}) {
  return { code: null, booked: [], deposit: 100, blocked: [], checks: [], ...over };
}

// The codes the mock database holds, as check_discount_code() answers.
const CODES = {
  SUMMER10: {
    valid: true,
    reason: null,
    code: "SUMMER10",
    kind: "percent",
    value: 10,
    waives_deposit: true,
  },
  // Set by the admin to take money off but keep the deposit.
  KEEP10: {
    valid: true,
    reason: null,
    code: "KEEP10",
    kind: "percent",
    value: 10,
    waives_deposit: false,
  },
  // As a database answers before it knew the setting: no such field.
  OLDDB10: { valid: true, reason: null, code: "OLDDB10", kind: "percent", value: 10 },
  EXPIRED: { valid: false, reason: "expired", code: "EXPIRED", kind: null, value: null },
  USEDUP: { valid: false, reason: "used", code: "USEDUP", kind: null, value: null },
};

async function page(state, { lang = "en", phone = false } = {}) {
  const ctx = await b.newContext(
    phone
      ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
      : { viewport: { width: 1280, height: 900 } },
  );
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
      state.code = "246810";
      return send({ ok: true, emailConfigured: true });
    }
    if (raw.startsWith("/storage/v1/object/civil-ids/"))
      return send({ Key: raw.replace("/storage/v1/object/", ""), Id: "obj-1" });
    if (path === "rpc/verify_email_code") return send(String(body?.p_code ?? "") === state.code);
    if (path === "rpc/check_discount_code") {
      state.checks.push(body.p_code);
      const key = String(body.p_code ?? "")
        .trim()
        .toUpperCase();
      return send([
        CODES[key] ?? { valid: false, reason: "invalid", code: null, kind: null, value: null },
      ]);
    }
    if (path === "rpc/request_booking") {
      state.booked.push(body);
      // What the database does: the stay priced, the deposit from settings,
      // and with a code the discount taken off and no deposit at all.
      const code = CODES[String(body.p_discount_code ?? "").toUpperCase()];
      const discount = code?.valid ? (350 * code.value) / 100 : 0;
      return send({
        discount,
        discount_code: code?.valid ? code.code : null,
        id: "b1",
        ref: "BZR-FLOW01",
        chalet_id: 1,
        start_date: body.p_start,
        end_date: body.p_end,
        days: 3,
        total: 350 - discount,
        deposit: code?.valid && code.waives_deposit !== false ? 0 : state.deposit,
        currency: "KWD",
        package_key: "weekend",
        guest_name: body.p_guest_name,
        guest_phone: body.p_guest_phone,
        guest_email: body.p_guest_email,
        guests: body.p_guests,
        status: "pending",
        created_at: "",
        updated_at: "",
      });
    }
    if (path === "settings")
      return send(
        state.deposit === undefined
          ? []
          : [{ key: "insurance_deposit", value: state.deposit, updated_at: "", updated_by: null }],
      );
    if (path === "chalets")
      return send([
        {
          id: 1,
          slug: "b1",
          name_en: "Bizarri Chalet 1",
          name_ar: "شاليه 1",
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
        min_stay_days: 1,
        updated_at: "",
        updated_by: null,
      });
    if (path === "rpc/availability_calendar") {
      const out = [];
      const d = new Date(body.p_from + "T00:00:00");
      const e = new Date(body.p_to + "T00:00:00");
      for (; d <= e; d.setDate(d.getDate() + 1)) {
        const k = iso(d);
        out.push({
          day: k,
          blocked: k < iso(today) || state.blocked.includes(k),
          price: 75,
          custom: false,
        });
      }
      return send(out);
    }
    return send([]);
  });
  await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
  const p = await ctx.newPage();
  await p.goto(`${B}booking/${lang}`, { waitUntil: "load" });
  await p.waitForTimeout(1000);
  return { p, ctx };
}

async function chooseWeekend(p, lang = "en") {
  await p
    .getByRole("button", { name: lang === "en" ? /^Weekend/i : /نهاية الأسبوع/ })
    .first()
    .click();
  await p.waitForTimeout(350);
  for (let i = 0; i < 6; i++) {
    if (await p.locator(`[data-day="${iso(thu)}"]`).count()) break;
    await p.getByRole("button", { name: lang === "en" ? /Next month/i : /الشهر التالي/ }).click();
    await p.waitForTimeout(300);
  }
  await p.locator(`[data-day="${iso(thu)}"]`).click();
  await p.waitForTimeout(350);
}

const next = (p) => p.getByRole("button", { name: /^Next$/i }).first();
const back = (p) => p.getByRole("button", { name: /^Back$/i });
const onDates = async (p) =>
  (await p.getByRole("heading", { name: /Select your dates/i }).count()) > 0;
const onDetails = async (p) =>
  (await p.getByRole("heading", { name: /Guest Information/i }).count()) > 0;
// The calendar marks a stay's first and last day as pressed, the days
// between as within it; a weekend is therefore two pressed days.
const selected = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll('[data-day][aria-pressed="true"]')].map((el) => el.dataset.day),
  );
const text = (p, testid) => p.locator(`[data-testid="${testid}"]`).innerText();

// ======================================================= the deposit, step 2
{
  const state = makeState();
  const { p, ctx } = await page(state);
  await chooseWeekend(p);
  ck(
    "The dates step says a deposit is coming, before the guest moves on",
    (await text(p, "deposit-next-step")).includes("100 KD"),
    await text(p, "deposit-next-step"),
  );
  await next(p).click();
  await p.waitForTimeout(700);
  ck("Next opens Guest Information", await onDetails(p));
  ck(
    "The subtotal is the stay",
    (await text(p, "subtotal")) === "KD 350",
    await text(p, "subtotal"),
  );
  ck(
    "…the deposit is added and named",
    (await text(p, "deposit")) === "+ KD 100",
    await text(p, "deposit"),
  );
  ck(
    "…and the total is the two together",
    (await text(p, "total")) === "KD 450",
    await text(p, "total"),
  );
  ck(
    "The note says it in so many words",
    (await text(p, "deposit-note")) === NOTE,
    await text(p, "deposit-note"),
  );
  ck(
    "…right beside the total",
    (await p.locator('[data-testid="price-breakdown"] [data-testid="deposit-note"]').count()) === 1,
  );
  await ctx.close();
}

// ================================ the amount is the one the settings hold
{
  const state = makeState({ deposit: 150 });
  const { p, ctx } = await page(state);
  await chooseWeekend(p);
  await next(p).click();
  await p.waitForTimeout(700);
  ck(
    "A different deposit in settings changes the total with it",
    (await text(p, "deposit")) === "+ KD 150" && (await text(p, "total")) === "KD 500",
    `${await text(p, "deposit")} / ${await text(p, "total")}`,
  );
  ck("…and the sentence names it", (await text(p, "deposit-note")).includes("150 KD"));
  await ctx.close();
}
{
  const state = makeState({ deposit: 0 });
  const { p, ctx } = await page(state);
  await chooseWeekend(p);
  await next(p).click();
  await p.waitForTimeout(700);
  ck(
    "With no deposit set, the total is the stay alone and nothing claims otherwise",
    (await text(p, "total")) === "KD 350" &&
      (await p.locator('[data-testid="deposit"], [data-testid="deposit-note"]').count()) === 0,
  );
  await ctx.close();
}
{
  // Settings not loaded (or the row missing): the database's own default.
  const state = makeState({ deposit: undefined });
  const { p, ctx } = await page(state);
  await chooseWeekend(p);
  await next(p).click();
  await p.waitForTimeout(700);
  ck(
    "No setting means the default 100 KD",
    (await text(p, "total")) === "KD 450",
    await text(p, "total"),
  );
  await ctx.close();
}

// ============================================ Back keeps what was chosen
{
  const state = makeState();
  const { p, ctx } = await page(state);
  await chooseWeekend(p);
  const chosen = await selected(p);
  await next(p).click();
  await p.waitForTimeout(700);
  await p.getByLabel("Full Name").fill("Fatima Al-Sabah");
  await p.getByLabel("Phone Number", { exact: true }).fill("+96599990000");

  await back(p).click();
  await p.waitForTimeout(700);
  ck("Back returns to the dates", await onDates(p));
  ck(
    "…with the same stay still selected",
    JSON.stringify(await selected(p)) === JSON.stringify(chosen) && chosen.length === 2,
    JSON.stringify(await selected(p)),
  );
  ck(
    "…on the same shape",
    (await p
      .getByRole("button", { name: /^Weekend/i })
      .first()
      .getAttribute("aria-pressed")) === "true",
  );
  ck("…ready to go straight on", await next(p).isEnabled());

  await next(p).click();
  await p.waitForTimeout(700);
  ck(
    "Next again finds the details as they were left",
    (await p.getByLabel("Full Name").inputValue()) === "Fatima Al-Sabah" &&
      (await p.getByLabel("Phone Number", { exact: true }).inputValue()) === "+96599990000",
  );

  // The step indicator is a way back too.
  await p.getByRole("button", { name: "Back to Dates" }).click();
  await p.waitForTimeout(700);
  ck(
    "The Dates step in the indicator goes back, keeping the stay",
    (await onDates(p)) && JSON.stringify(await selected(p)) === JSON.stringify(chosen),
  );

  // The browser's own Back as well.
  await next(p).click();
  await p.waitForTimeout(700);
  await p.goBack();
  await p.waitForTimeout(700);
  ck(
    "So does the browser's Back",
    (await onDates(p)) && JSON.stringify(await selected(p)) === JSON.stringify(chosen),
  );
  await ctx.close();
}

// ==================================== Submit points at what needs fixing
{
  const state = makeState();
  const { p, ctx } = await page(state);
  await chooseWeekend(p);
  await next(p).click();
  await p.waitForTimeout(700);
  await p.getByLabel("Full Name").fill("");
  await p.getByRole("button", { name: /submit booking request/i }).click();
  await p.waitForTimeout(400);
  const focus = await p.evaluate(() => ({
    label: document.activeElement?.closest("label")?.innerText.split("\n")[0] ?? "",
    invalid: document.activeElement?.getAttribute("aria-invalid"),
  }));
  ck(
    "A Submit with gaps focuses the first one",
    /Full Name/i.test(focus.label) && focus.invalid === "true",
    JSON.stringify(focus),
  );
  ck("…and sends nothing", state.booked.length === 0);
  await ctx.close();
}

// =============================== the confirmation shows what was agreed
{
  const state = makeState();
  const { p, ctx } = await page(state);
  await chooseWeekend(p);
  await next(p).click();
  await p.waitForTimeout(700);
  await p.getByLabel("Full Name").fill("Guest");
  await p.getByLabel("Phone Number", { exact: true }).fill("+96599999999");
  await p.locator("input[type=email]").fill("guest@example.com");
  await p.locator("input[type=file]").setInputFiles({
    name: "id.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  await p.locator("input[type=checkbox]").first().check();
  await p.getByRole("button", { name: /submit booking request/i }).click();
  await p.waitForTimeout(800);
  await p.getByLabel(/6-digit code/i).fill(state.code ?? "");
  await p.getByRole("button", { name: /^Confirm$/i }).click();
  await p.waitForTimeout(1200);
  ck("The request goes", state.booked.length === 1);
  ck(
    "…without naming a discount code it does not have",
    state.booked[0] && !("p_discount_code" in state.booked[0]),
  );
  ck(
    "…and sends no price of its own: the server prices it, deposit and all",
    state.booked[0] && !("p_total" in state.booked[0]) && !("p_deposit" in state.booked[0]),
    JSON.stringify(Object.keys(state.booked[0] ?? {})),
  );
  ck(
    "The confirmation repeats the breakdown",
    (await text(p, "subtotal")) === "KD 350" &&
      (await text(p, "deposit")) === "+ KD 100" &&
      (await text(p, "total")) === "KD 450" &&
      (await text(p, "deposit-note")) === NOTE,
  );
  await p.getByRole("button", { name: "Book another stay" }).click();
  await p.waitForTimeout(800);
  ck(
    "Book another stay starts again from clear dates",
    (await onDates(p)) && (await selected(p)).length === 0,
  );
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(1200);
  ck(
    "…and a sent booking is not brought back by a reload",
    (await onDates(p)) && (await selected(p)).length === 0,
  );
  await ctx.close();
}

// ============================================ a discount code, step 2
// A code comes off the stay, and with one the insurance deposit is not
// charged: the guest pays for the chalet alone.
{
  const state = makeState();
  const { p, ctx } = await page(state);
  await chooseWeekend(p);
  await next(p).click();
  await p.waitForTimeout(700);
  const link = p.getByRole("button", { name: "Have a discount code?" });
  ck("Guest Information offers a discount code, folded away", await link.isVisible());
  await link.click();
  const box = p.getByLabel("Discount code");
  const apply = p.getByRole("button", { name: "Apply", exact: true });

  await box.fill("nope");
  await apply.click();
  await p.waitForTimeout(500);
  ck("A code that does not exist says so", await p.getByText("That code isn't valid.").isVisible());
  ck(
    "…and changes nothing",
    (await text(p, "total")) === "KD 450" && (await text(p, "deposit")) === "+ KD 100",
  );
  await box.fill("usedup");
  await apply.click();
  await p.waitForTimeout(500);
  ck("One already used says so", await p.getByText("That code has already been used.").isVisible());
  await box.fill("expired");
  await apply.click();
  await p.waitForTimeout(500);
  ck("One past its date says so", await p.getByText("That code has expired.").isVisible());

  // Enter applies the code; it must not send the booking.
  await box.fill("summer10");
  await box.press("Enter");
  await p.waitForTimeout(600);
  ck("Enter applies a code without sending anything", state.booked.length === 0);
  ck(
    "A valid code is shown as applied",
    /SUMMER10/.test(await text(p, "discount-applied")) &&
      /10% off/.test(await text(p, "discount-applied")),
    await text(p, "discount-applied"),
  );
  ck(
    "…taken off the stay",
    (await text(p, "subtotal")) === "KD 350" && (await text(p, "discount")) === "− KD 35",
    `${await text(p, "subtotal")} / ${await text(p, "discount")}`,
  );
  ck(
    "…with no insurance deposit",
    (await text(p, "deposit-waived")) === "Not charged" &&
      (await p.locator('[data-testid="deposit"], [data-testid="deposit-note"]').count()) === 0,
  );
  ck(
    "…so the total is the chalet alone, less the discount",
    (await text(p, "total")) === "KD 315",
    await text(p, "total"),
  );
  ck(
    "…and the guest is told why",
    /no insurance deposit is charged/.test(await text(p, "deposit-waived-note")),
  );

  await p.getByRole("button", { name: "Remove", exact: true }).click();
  await p.waitForTimeout(300);
  ck(
    "Removing it puts the deposit back",
    (await text(p, "total")) === "KD 450" && (await text(p, "deposit")) === "+ KD 100",
  );

  // Applied again, it survives going back to change the dates.
  await p.getByRole("button", { name: "Have a discount code?" }).click();
  await p.getByLabel("Discount code").fill("SUMMER10");
  await p.getByRole("button", { name: "Apply", exact: true }).click();
  await p.waitForTimeout(500);
  await back(p).click();
  await p.waitForTimeout(700);
  ck(
    "Back on the dates, the deposit is no longer promised",
    (await onDates(p)) && (await p.locator('[data-testid="deposit-next-step"]').count()) === 0,
  );
  await next(p).click();
  await p.waitForTimeout(700);
  ck("…and the code is still applied", (await text(p, "total")) === "KD 315");

  await p.getByLabel("Full Name").fill("Code Guest");
  await p.getByLabel("Phone Number", { exact: true }).fill("+96599999999");
  await p.locator("input[type=email]").fill("code@example.com");
  await p.locator("input[type=file]").setInputFiles({
    name: "id.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  await p.locator('input[type=checkbox]:not([role="switch"])').first().check();
  await p.getByRole("button", { name: /submit booking request/i }).click();
  await p.waitForTimeout(800);
  await p.getByLabel(/6-digit code/i).fill(state.code ?? "");
  await p.getByRole("button", { name: /^Confirm$/i }).click();
  await p.waitForTimeout(1200);
  ck(
    "The request carries the code, for the server to check again",
    state.booked[0]?.p_discount_code === "SUMMER10",
    JSON.stringify(state.booked[0]?.p_discount_code),
  );
  ck(
    "The confirmation shows the discount and no deposit",
    (await text(p, "discount")) === "− KD 35" &&
      (await text(p, "deposit-waived")) === "Not charged" &&
      (await text(p, "total")) === "KD 315",
    `${await text(p, "discount")} / ${await text(p, "total")}`,
  );
  await ctx.close();
}

// =========================== a code the admin set to keep the deposit
{
  const state = makeState();
  const { p, ctx } = await page(state);
  await chooseWeekend(p);
  await next(p).click();
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: "Have a discount code?" }).click();
  await p.getByLabel("Discount code").fill("KEEP10");
  await p.getByRole("button", { name: "Apply", exact: true }).click();
  await p.waitForTimeout(600);
  ck(
    "A code that keeps the deposit takes its discount",
    (await text(p, "discount")) === "− KD 35",
    await text(p, "discount"),
  );
  ck(
    "…and the deposit stays, with its sentence",
    (await text(p, "deposit")) === "+ KD 100" &&
      (await text(p, "deposit-note")) === NOTE &&
      (await p
        .locator('[data-testid="deposit-waived"], [data-testid="deposit-waived-note"]')
        .count()) === 0,
  );
  ck(
    "…so the total is the discounted stay plus the deposit",
    (await text(p, "total")) === "KD 415",
    await text(p, "total"),
  );
  await back(p).click();
  await p.waitForTimeout(700);
  ck(
    "Back on the dates, the deposit is still promised",
    (await text(p, "deposit-next-step")).includes("100 KD"),
  );
  await ctx.close();
}
{
  // Before the database knew the setting, every code waived the deposit.
  const state = makeState();
  const { p, ctx } = await page(state);
  await chooseWeekend(p);
  await next(p).click();
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: "Have a discount code?" }).click();
  await p.getByLabel("Discount code").fill("OLDDB10");
  await p.getByRole("button", { name: "Apply", exact: true }).click();
  await p.waitForTimeout(600);
  ck(
    "A code from a database without the setting waives the deposit, as that database does",
    (await text(p, "total")) === "KD 315" && (await text(p, "deposit-waived")) === "Not charged",
  );
  await ctx.close();
}

// ================== the terms and the cancellation policy open in a popup
{
  const state = makeState();
  const { p, ctx } = await page(state);
  await chooseWeekend(p);
  await next(p).click();
  await p.waitForTimeout(700);
  await p.getByLabel("Full Name").fill("Popup Guest");
  const box = p.locator('input[type=checkbox]:not([role="switch"])').first();
  const where = () => new URL(p.url()).pathname + new URL(p.url()).search;

  await p.locator("form").getByRole("link", { name: "Terms & Conditions" }).click();
  await p.waitForTimeout(500);
  const dialog = p.getByRole("dialog", { name: "Terms and Conditions for Chalet Booking and Use" });
  ck("The terms open in a popup", await dialog.isVisible());
  ck("…not in another tab", ctx.pages().length === 1, `${ctx.pages().length} tabs`);
  ck(
    "…over the form, which stays where it was",
    where() === "/booking/en?step=details&doc=terms",
    where(),
  );
  ck(
    "…with the whole text, numbered",
    (await dialog.getByRole("heading", { level: 3 }).count()) === 8 &&
      /Check-in is at 2:00 PM/.test(await dialog.innerText()),
  );
  ck("Following the link does not tick the box", !(await box.isChecked()));
  ck(
    "The close button has the focus",
    (await p.evaluate(() => document.activeElement?.getAttribute("aria-label"))) === "Close",
  );
  await p.keyboard.press("Escape");
  await p.waitForTimeout(500);
  ck(
    "Escape closes it, back to the form as it was",
    (await dialog.count()) === 0 &&
      where() === "/booking/en?step=details" &&
      (await p.getByLabel("Full Name").inputValue()) === "Popup Guest",
    where(),
  );

  await p.locator("form").getByRole("link", { name: "Cancellation & Refund Policy" }).click();
  await p.waitForTimeout(500);
  const policy = p.getByRole("dialog", { name: "Cancellation and Refund Policy" });
  ck(
    "The cancellation policy opens in a popup too",
    (await policy.isVisible()) && ctx.pages().length === 1,
  );
  await policy.getByRole("button", { name: "Close", exact: true }).last().click();
  await p.waitForTimeout(500);
  ck(
    "Its Close button closes it",
    (await policy.count()) === 0 && where() === "/booking/en?step=details",
    where(),
  );

  await p.locator("form").getByRole("link", { name: "Terms & Conditions" }).click();
  await p.waitForTimeout(500);
  await p.goBack();
  await p.waitForTimeout(600);
  ck(
    "On a phone's Back the popup closes, not the form",
    (await dialog.count()) === 0 && (await onDetails(p)),
    where(),
  );
  await ctx.close();
}

// ======================================= a reload keeps the booking going
{
  const state = makeState();
  const { p, ctx } = await page(state);
  await chooseWeekend(p);
  const chosen = await selected(p);
  await next(p).click();
  await p.waitForTimeout(700);
  await p.getByLabel("Full Name").fill("Reload Guest");
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(1500);
  ck("A reload on Guest Information stays there", await onDetails(p));
  ck(
    "…with the stay and the total",
    (await text(p, "total")) === "KD 450" && (await text(p, "subtotal")) === "KD 350",
  );
  ck("…and what was typed", (await p.getByLabel("Full Name").inputValue()) === "Reload Guest");
  await back(p).click();
  await p.waitForTimeout(700);
  ck(
    "…and Back from there still has the dates",
    (await onDates(p)) && JSON.stringify(await selected(p)) === JSON.stringify(chosen),
  );

  // Taken by someone else while the guest was away: not put back.
  state.blocked = [iso(thu)];
  await p.goto(`${B}booking/en?step=details`, { waitUntil: "load" });
  await p.waitForTimeout(1500);
  ck(
    "A stay booked by someone else in the meantime is not restored",
    (await onDates(p)) && (await selected(p)).length === 0,
    new URL(p.url()).search,
  );
  await ctx.close();
}

// ============================================================= on a phone
{
  const state = makeState();
  const { p, ctx } = await page(state, { phone: true });
  await chooseWeekend(p);
  const size = async (loc) => {
    const r = await loc.boundingBox();
    return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null;
  };
  const nexts = p.getByRole("button", { name: /^Next$/i });
  const nextSizes = [];
  for (let i = 0; i < (await nexts.count()); i++) {
    if (await nexts.nth(i).isVisible()) nextSizes.push(await size(nexts.nth(i)));
  }
  ck(
    "Every Next on the dates is at least 48px tall and 44px wide",
    nextSizes.length > 0 && nextSizes.every((s) => s.h >= 48 && s.w >= 44),
    JSON.stringify(nextSizes),
  );
  await p
    .locator(".fixed.inset-x-0.bottom-0")
    .getByRole("button", { name: /^Next$/i })
    .tap();
  await p.waitForTimeout(800);
  ck("Next from the bar at the foot opens the details", await onDetails(p));

  const bar = p.locator("form .fixed.inset-x-0.bottom-0");
  ck("The details keep Back and Submit at the foot of the screen", await bar.isVisible());
  const backSize = await size(bar.getByRole("button", { name: /^Back$/i }));
  const submitSize = await size(bar.getByRole("button", { name: /submit booking request/i }));
  ck(
    "…both comfortable to tap",
    backSize?.h >= 48 && backSize?.w >= 44 && submitSize?.h >= 48,
    JSON.stringify({ backSize, submitSize }),
  );
  ck(
    "…and only once each: the desktop pair is hidden",
    (await p.getByRole("button", { name: /^Back$/i }).count()) === 1 &&
      (await p.getByRole("button", { name: /submit booking request/i }).count()) === 1,
  );
  ck(
    "…with the total on the way forward",
    (await bar.innerText()).includes("KD 450"),
    (await bar.innerText()).replace(/\n/g, " | "),
  );
  const indicator = await size(p.getByRole("button", { name: "Back to Dates" }));
  ck(
    "The step indicator's way back is tappable too",
    indicator?.h >= 44,
    JSON.stringify(indicator),
  );
  ck(
    "Nothing scrolls sideways",
    !(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)),
  );
  // Scrolled to the very end, the last thing on the form is above the bar.
  await p.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
  );
  await p.waitForTimeout(300);
  const clear = await p.evaluate(() => {
    const bar = document.querySelector("form .fixed.inset-x-0.bottom-0").getBoundingClientRect();
    const help = [...document.querySelectorAll("form p")]
      .filter((el) => !el.closest(".fixed"))
      .pop()
      .getBoundingClientRect();
    return { helpBottom: Math.round(help.bottom), barTop: Math.round(bar.top) };
  });
  ck(
    "…and the bar never covers the end of the form",
    clear.helpBottom <= clear.barTop,
    JSON.stringify(clear),
  );

  await bar.getByRole("button", { name: /^Back$/i }).tap();
  await p.waitForTimeout(800);
  ck("Back from the bar keeps the dates", (await onDates(p)) && (await selected(p)).length === 2);
  await ctx.close();
}

// ================================================================ Arabic
{
  const state = makeState();
  const { p, ctx } = await page(state, { lang: "ar" });
  await chooseWeekend(p, "ar");
  await p
    .getByRole("button", { name: /^التالي$/ })
    .first()
    .click();
  await p.waitForTimeout(800);
  ck(
    "The Arabic details step breaks the price down too",
    (await text(p, "total")) === "450 د.ك" && (await text(p, "deposit")) === "+ 100 د.ك",
    `${await text(p, "deposit")} / ${await text(p, "total")}`,
  );
  ck(
    "…and explains the deposit in Arabic",
    (await text(p, "deposit-note")).includes("تأميناً مسترداً بقيمة 100 د.ك"),
  );
  ck("…with Back as رجوع", (await p.getByRole("button", { name: /^رجوع$/ }).count()) === 1);
  await ctx.close();
}

console.log(`\n${fails} failing`);
await b.close();
process.exit(fails ? 1 : 0);
