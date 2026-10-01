/**
 * Confirming the email address with a one-time code, and the two ways a guest
 * can find a booking again.
 *
 * The code itself never reaches the browser, so these drive it the way a guest
 * does: ask for a code, read it out of the fake inbox, type it in.
 */
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

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = new Date();
today.setHours(0, 0, 0, 0);

const BOOKING = {
  ref: "BZR-PH0NE1",
  status: "accepted",
  chalet_id: 2,
  start_date: "2027-02-04",
  end_date: "2027-02-06",
  days: 3,
  total: 350,
  currency: "KWD",
};
const SECOND = {
  ...BOOKING,
  ref: "BZR-PH0NE2",
  status: "pending",
  start_date: "2027-03-04",
  end_date: "2027-03-06",
};

function makeState(over = {}) {
  return {
    code: null,
    codeSentTo: null,
    booked: false,
    emailConfigured: true,
    sendCount: 0,
    verifyCalls: [],
    phoneCalls: [],
    refCalls: [],
    emailCalls: [],
    bookingsForEmail: [BOOKING],
    bookingsForPhone: [BOOKING],
    ...over,
  };
}

async function page(state) {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => {
    const u = r.request().url();
    if (!SUPA.test(u)) return r.abort();
    const url = new URL(u);
    const raw = url.pathname;
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
      state.codeSentTo = body?.email ?? null;
      if (!state.emailConfigured) return send({ ok: false, emailConfigured: false });
      if (state.sendError) return send({ error: state.sendError }, 429);
      state.code = "246810";
      return send({ ok: true, emailConfigured: true });
    }
    // Confirming the code now submits the booking, so this mock has to carry
    // the two calls that follow it. It never did before, because the code was
    // a widget in the middle of a form nobody in this suite finished.
    if (raw.startsWith("/storage/v1/object/civil-ids/")) {
      return send({ Key: raw.replace("/storage/v1/object/", ""), Id: "obj-1" });
    }
    if (path === "rpc/request_booking") {
      state.booked = true;
      return send({
        id: "b1",
        ref: "BZR-VER001",
        chalet_id: 1,
        start_date: "2026-10-08",
        end_date: "2026-10-10",
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
    if (path === "rpc/verify_email_code") {
      state.verifyCalls.push(body);
      if (state.verifyThrows) return send({ message: state.verifyThrows }, 400);
      return send(String(body?.p_code ?? "") === state.code);
    }
    if (path === "rpc/lookup_booking_by_phone") {
      state.phoneCalls.push(body);
      if (state.phoneError) return send({ message: state.phoneError }, 400);
      return send(state.bookingsForPhone);
    }
    if (path === "rpc/lookup_booking_by_ref") {
      state.refCalls.push(body);
      return send(body?.p_ref?.toUpperCase() === BOOKING.ref ? [BOOKING] : []);
    }
    if (path === "rpc/lookup_booking_by_email") {
      state.emailCalls.push(body);
      if (state.emailError) return send({ message: state.emailError }, 400);
      return send(state.bookingsForEmail ?? []);
    }

    if (path === "chalets")
      return send([
        {
          id: 1,
          slug: "b1",
          name_en: "Bizarri Chalet 1",
          name_ar: "ش١",
          active: true,
          sort_order: 1,
        },
        {
          id: 2,
          slug: "b2",
          name_en: "Bizarri Chalet 2",
          name_ar: "ش٢",
          active: true,
          sort_order: 2,
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
  return { p, ctx };
}

// ===================================================== the lookup, two ways
{
  const state = makeState();
  const { p, ctx } = await page(state);
  await p.goto(pageUrl("reservation"), { waitUntil: "load" });
  await p.waitForTimeout(900);

  const refTab = p.getByRole("tab", { name: /Booking reference/i });
  const emailTab = p.getByRole("tab", { name: /Email address/i });
  const phoneTab = p.getByRole("tab", { name: /Phone number/i });
  ck(
    "The page offers all three ways in",
    (await refTab.isVisible()) && (await emailTab.isVisible()) && (await phoneTab.isVisible()),
  );
  ck(
    "Reference is the one selected to begin with",
    (await refTab.getAttribute("aria-selected")) === "true",
  );

  // One field each. Asking for two makes the "I have lost it" case worse,
  // and that case is the only reason this page exists.
  for (const [name, tab, selector] of [
    ["reference", refTab, 'input[type="text"]'],
    ["email", emailTab, 'input[type="email"]'],
    ["phone", phoneTab, 'input[type="tel"]'],
  ]) {
    await tab.click();
    await p.waitForTimeout(250);
    ck(
      `The ${name} tab asks for one thing only`,
      (await p.locator(selector).isVisible()) && (await p.locator("form input").count()) === 1,
      `${await p.locator("form input").count()} inputs`,
    );
    ck(`…and is the one marked selected`, (await tab.getAttribute("aria-selected")) === "true");
  }

  await emailTab.click();
  await p.locator('input[type="email"]').fill("guest@example.com");
  await p.getByRole("button", { name: /Check status/i }).click();
  await p.waitForTimeout(700);
  ck(
    "The email goes to the email lookup, not the others",
    state.emailCalls[0]?.p_email === "guest@example.com" && state.phoneCalls.length === 0,
    JSON.stringify(state.emailCalls[0]),
  );
  ck("The booking comes back", await p.getByText(BOOKING.ref).isVisible());

  await refTab.click();
  await p.waitForTimeout(300);
  ck("Switching tabs clears the previous result", (await p.getByText(BOOKING.ref).count()) === 0);

  await p.locator('input[type="text"]').fill(BOOKING.ref.toLowerCase());
  await p.getByRole("button", { name: /Check status/i }).click();
  await p.waitForTimeout(700);
  ck(
    "The reference alone is enough",
    state.refCalls[0]?.p_ref === BOOKING.ref.toLowerCase() &&
      (await p.getByText(BOOKING.ref).isVisible()),
    state.refCalls[0]?.p_ref,
  );

  await phoneTab.click();
  await p.locator('input[type="tel"]').fill("+965 5111 0002");
  await p.getByRole("button", { name: /Check status/i }).click();
  await p.waitForTimeout(700);
  ck(
    "The number is sent as typed, for the server to normalise",
    state.phoneCalls[0]?.p_phone === "+965 5111 0002",
    state.phoneCalls[0]?.p_phone,
  );
  ck("…with its status", await p.getByText("Accepted", { exact: false }).first().isVisible());
  await ctx.close();
}

// A number can carry more than one stay.
{
  const state = makeState({ bookingsForPhone: [SECOND, BOOKING] });
  const { p, ctx } = await page(state);
  await p.goto(pageUrl("reservation"), { waitUntil: "load" });
  await p.waitForTimeout(900);
  await p.getByRole("tab", { name: /Phone number/i }).click();
  await p.locator('input[type="tel"]').fill("96551110002");
  await p.getByRole("button", { name: /Check status/i }).click();
  await p.waitForTimeout(700);
  ck(
    "Every stay on the number is listed, not just the first",
    (await p.getByText(BOOKING.ref).isVisible()) && (await p.getByText(SECOND.ref).isVisible()),
  );
  await ctx.close();
}

{
  const state = makeState({ bookingsForPhone: [] });
  const { p, ctx } = await page(state);
  await p.goto(pageUrl("reservation"), { waitUntil: "load" });
  await p.waitForTimeout(900);
  await p.getByRole("tab", { name: /Phone number/i }).click();
  await p.locator('input[type="tel"]').fill("96500000000");
  await p.getByRole("button", { name: /Check status/i }).click();
  await p.waitForTimeout(700);
  ck(
    "An unknown number says so in the phone's own words",
    await p.getByText(/No request matches that phone number/i).isVisible(),
  );
  await ctx.close();
}

{
  const state = makeState({ phoneError: "Too many lookups. Please try again later." });
  const { p, ctx } = await page(state);
  await p.goto(pageUrl("reservation"), { waitUntil: "load" });
  await p.waitForTimeout(900);
  await p.getByRole("tab", { name: /Phone number/i }).click();
  await p.locator('input[type="tel"]').fill("96551110002");
  await p.getByRole("button", { name: /Check status/i }).click();
  await p.waitForTimeout(700);
  ck(
    "The server's throttle message reaches the guest",
    await p.getByText(/Too many lookups/i).isVisible(),
  );
  await ctx.close();
}

// ======================================================== the email code
// Next month, so nothing in the range is in the past.
const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const firstDow = (from, dow) => {
  const d = new Date(from);
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
  return d;
};
const thu = firstDow(nextMonth, 4);

// (?!\d) so "October 1" does not also match "October 15".
const dayCell = (p, d) =>
  p.getByRole("button", {
    name: new RegExp(
      `^${d.toLocaleDateString("en-US", { weekday: "long" })}, ${d.toLocaleDateString("en-US", { month: "long" })} ${d.getDate()}(?!\\d)`,
    ),
  });

async function toCheckout(p) {
  await p.goto(pageUrl("booking"), { waitUntil: "load" });
  await p.waitForTimeout(1200);
  // A stay is a shape now: choose the weekend, then tap its Thursday, and the
  // whole Thu-Sat comes with it. The calendar also opens on the first month
  // with something bookable, so walk to the month the fixtures describe
  // rather than pressing Next once.
  await p
    .getByRole("button", { name: /^Weekend/i })
    .first()
    .click();
  await p.waitForTimeout(350);
  const want = thu.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  for (let i = 0; i < 6; i++) {
    const heading = await p.locator('[role="grid"]').getAttribute("aria-label");
    if ((heading ?? "").includes(want)) break;
    await p.getByRole("button", { name: /Next month/i }).click();
    await p.waitForTimeout(300);
  }
  await dayCell(p, thu).click();
  await p.waitForTimeout(350);
  await p.getByRole("button", { name: /^Continue$/i }).click();
  await p.waitForTimeout(700);
}

/** Everything the form needs except the address, which each test sets. */
async function fillForm(p) {
  await p.getByLabel("Full Name").fill("Guest");
  await p.getByLabel("Phone Number", { exact: true }).fill("+96599999999");
  await p.locator("input[type=file]").setInputFiles({
    name: "id.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  await p.locator("input[type=checkbox]").first().check();
  await p.waitForTimeout(300);
}

const submitBtn = (p) => p.getByRole("button", { name: /submit booking request/i });

/**
 * Get to the code dialog: fill the form, then press Submit.
 *
 * Submit is what asks for a code now, and it only asks once everything else
 * is in order -- so a test about what the code box does has to fill the form
 * first, where it used to be able to type an address and press Send.
 */
async function openCodeDialog(p, email = "guest@example.com") {
  await fillForm(p);
  await p.locator("input[type=email]").fill(email);
  await p.waitForTimeout(200);
  await submitBtn(p).click();
  await p.waitForTimeout(800);
}

// The code is asked for by Submit, in a dialog, rather than sitting in the
// middle of the form. These are the same guarantees as before, in the place
// they now live.
{
  const state = makeState();
  const { p, ctx } = await page(state);
  await toCheckout(p);
  await fillForm(p);

  ck(
    "Nothing is said about spam before a code has been sent",
    (await p.getByText(/spam or junk/i).count()) === 0,
  );

  // An address that is not one never gets a code sent to it: Submit checks
  // the form before it asks, so the dialog does not even open.
  // By input rather than by label: once a field is flagged, the error text
  // joins its <label>, and an exact match on "Email" stops finding it.
  const emailBox = p.locator("input[type=email]");
  await emailBox.fill("not-an-address");
  await submitBtn(p).click();
  await p.waitForTimeout(600);
  ck("A malformed address is refused before any code is sent", state.code === null);
  ck("…and no dialog opens for it", (await p.locator('[role="dialog"]').count()) === 0);
  ck(
    "…and the address is the thing flagged",
    await p
      .getByText(/valid email address/i)
      .first()
      .isVisible(),
  );

  await emailBox.fill("guest@example.com");
  await p.waitForTimeout(200);
  await submitBtn(p).click();
  await p.waitForTimeout(800);

  ck("A real address opens the dialog", (await p.locator('[role="dialog"]').count()) > 0);
  ck("…and the code goes to the address on the form", state.codeSentTo === "guest@example.com");
  ck("…without being asked for twice", state.sendCount === 1, String(state.sendCount));
  ck(
    "The address is echoed back so a typo is visible",
    await p
      .getByText(/guest@example\.com/)
      .first()
      .isVisible(),
  );
  // The commonest "it never arrived" is a code sitting in a spam folder.
  ck(
    "…and the dialog says where to look if it does not arrive",
    await p.getByText(/spam or junk/i).isVisible(),
  );
  ck("Nothing is booked while the code is outstanding", state.booked === false);

  const codeBox = p.getByLabel(/6-digit code/i);
  ck("A box appears for the code", await codeBox.isVisible());
  ck(
    "…and it holds focus, so the next keystroke lands in it",
    await codeBox.evaluate((el) => el === document.activeElement),
  );

  // Letters are not codes.
  await codeBox.fill("abc");
  ck("Letters are refused outright", (await codeBox.inputValue()) === "");

  await codeBox.fill("111111");
  await p.getByRole("button", { name: /^Confirm$/i }).click();
  await p.waitForTimeout(600);
  ck("A wrong code says so", await p.getByText("That code is not correct.").isVisible());
  ck("…and books nothing", state.booked === false);

  // Dismissing it is not a way past the gate.
  await p.getByRole("button", { name: /^Cancel$/i }).click();
  await p.waitForTimeout(400);
  ck("Dismissing the dialog closes it", (await p.locator('[role="dialog"]').count()) === 0);
  ck("…and still books nothing", state.booked === false);
  ck(
    "…and says why the request did not go",
    await p
      .getByText(/confirm your email address/i)
      .first()
      .isVisible(),
  );

  await submitBtn(p).click();
  await p.waitForTimeout(800);
  await p.getByLabel(/6-digit code/i).fill(state.code);
  await p.getByRole("button", { name: /^Confirm$/i }).click();
  await p.waitForTimeout(1400);
  ck("The right code sends the request", state.booked === true);
  ck("…and lands on the confirmation", await p.getByText("BZR-VER001").isVisible());
  await ctx.close();
}

// An expired code comes back as an error, not a false, and has to send the
// guest back to asking for a new one rather than retyping into a dead box.
{
  const state = makeState({ verifyThrows: "That code has expired. Please request a new one." });
  const { p, ctx } = await page(state);
  await toCheckout(p);
  await openCodeDialog(p);
  await p.getByLabel(/6-digit code/i).fill("246810");
  await p.getByRole("button", { name: /^Confirm$/i }).click();
  await p.waitForTimeout(500);
  ck("An expired code explains itself", await p.getByText(/expired/i).isVisible());
  ck(
    "…and offers a fresh one rather than a dead box",
    await p.getByRole("button", { name: /^Send code$/i }).isVisible(),
  );
  await ctx.close();
}

// If the site cannot send mail at all, saying "check your inbox" is a lie.
{
  const state = makeState({ emailConfigured: false });
  const { p, ctx } = await page(state);
  await toCheckout(p);
  await openCodeDialog(p);
  await p.waitForTimeout(600);
  ck(
    "A site that cannot send mail says so",
    await p.getByText(/cannot send codes right now/i).isVisible(),
  );
  ck(
    "…and points somewhere that still works",
    await p
      .getByText(/WhatsApp/i)
      .first()
      .isVisible(),
  );
  ck(
    "…rather than asking for a code that will never arrive",
    (await p.getByLabel(/6-digit code/i).count()) === 0,
  );
  await ctx.close();
}

// The rate limit is the server's to enforce; the form only has to relay it.
{
  const state = makeState({ sendError: "Too many codes requested. Please try again later." });
  const { p, ctx } = await page(state);
  await toCheckout(p);
  await openCodeDialog(p);
  await p.waitForTimeout(600);
  ck(
    "The server's rate limit reaches the guest",
    await p.getByText(/Too many codes requested/i).isVisible(),
  );
  await ctx.close();
}

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
