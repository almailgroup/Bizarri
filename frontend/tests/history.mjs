/**
 * Back and Forward, the way a guest uses them.
 *
 * The booking flow's three steps used to be component state at one address,
 * so they never reached the browser's history: Back from "Your details" left
 * the booking page altogether, usually for the home page. Every step is a
 * history entry now, and these walk through them with the browser's own
 * buttons rather than the page's, since those are the ones that were broken.
 */
import { chromium } from "playwright";

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
const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
const firstDow = (from, dow) => {
  const d = new Date(from);
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
  return d;
};
const thu = firstDow(nextMonth, 4);

function makeState() {
  return { code: null, booked: 0 };
}

async function page(state, vp = { width: 1200, height: 900 }) {
  const ctx = await b.newContext({ viewport: vp });
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
    if (path === "rpc/request_booking") {
      state.booked++;
      return send({
        id: "b1",
        ref: "BZR-HIST01",
        chalet_id: 1,
        start_date: iso(thu),
        end_date: iso(new Date(thu.getFullYear(), thu.getMonth(), thu.getDate() + 2)),
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

const dayCell = (p, d) =>
  p.getByRole("button", {
    name: new RegExp(
      `^${d.toLocaleDateString("en-US", { weekday: "long" })}, ${d.toLocaleDateString("en-US", { month: "long" })} ${d.getDate()}(?!\\d)`,
    ),
  });

/** On the booking page already: choose the weekend after next month starts. */
async function chooseWeekend(p) {
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
}

const continueBtn = (p) => p.getByRole("button", { name: /^Continue$/i });
const onDates = async (p) =>
  (await p.getByRole("heading", { name: /Select your dates/i }).count()) > 0;
const onDetails = async (p) =>
  (await p.getByRole("heading", { name: /Guest Information/i }).count()) > 0;
const path = (p) => {
  const u = new URL(p.url());
  return u.pathname + u.search;
};
const back = async (p) => {
  await p.goBack();
  await p.waitForTimeout(600);
};
const forward = async (p) => {
  await p.goForward();
  await p.waitForTimeout(600);
};

// ================================== Back from the details goes to the dates
{
  const state = makeState();
  const { p, ctx } = await page(state);
  // Arrive the way a guest does, from the home page, so there is something
  // behind the booking page for a broken Back to fall through to.
  await p.goto(pageUrl(""), { waitUntil: "load" });
  await p.waitForTimeout(900);
  await p.goto(pageUrl("booking"), { waitUntil: "load" });
  await p.waitForTimeout(1000);
  await chooseWeekend(p);
  await continueBtn(p).click();
  await p.waitForTimeout(700);

  ck("Continue opens the details", await onDetails(p));
  ck("…as an address of its own", path(p) === "/booking/en?step=details", path(p));
  await p.getByLabel("Full Name").fill("Fatima");

  await back(p);
  ck("Back from the details returns to the dates", await onDates(p), path(p));
  ck("…not to the home page", path(p) === "/booking/en", path(p));
  ck(
    "…with the stay still chosen",
    (await p.getByText(iso(thu)).count()) > 0 &&
      (await p
        .locator('[role="grid"] [aria-pressed="true"], [role="grid"] [aria-selected="true"]')
        .count()) > 0,
  );

  await forward(p);
  ck("Forward goes to the details again", await onDetails(p), path(p));
  ck(
    "…with what was typed still there",
    (await p.getByLabel("Full Name").inputValue()) === "Fatima",
  );

  // The page's own Back and the browser's are the same step. Pressing the
  // page's must not leave a second copy of the dates to walk back through.
  await p.getByRole("button", { name: /^Back$/i }).click();
  await p.waitForTimeout(600);
  ck("The page's Back button goes to the dates", await onDates(p), path(p));
  ck("…at the same address", path(p) === "/booking/en", path(p));
  await back(p);
  ck("One more Back leaves the booking page for the one before it", path(p) === "/en", path(p));
  await ctx.close();
}

// ========================== Back from the confirmation does not resubmit it
{
  const state = makeState();
  const { p, ctx } = await page(state);
  await p.goto(pageUrl(""), { waitUntil: "load" });
  await p.waitForTimeout(900);
  await p.goto(pageUrl("booking"), { waitUntil: "load" });
  await p.waitForTimeout(1000);
  await chooseWeekend(p);
  await continueBtn(p).click();
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
  await p.waitForTimeout(900);
  await p.getByLabel(/6-digit code/i).fill(state.code ?? "");
  await p.getByRole("button", { name: /^Confirm$/i }).click();
  await p.waitForTimeout(1200);

  ck("The request is confirmed", await p.getByText("BZR-HIST01").isVisible());
  ck("…at an address of its own", path(p) === "/booking/en?step=done", path(p));

  await back(p);
  ck(
    "Back from the confirmation goes to the dates, not the sent form",
    (await onDates(p)) && !(await onDetails(p)),
    path(p),
  );
  ck("…and sends nothing a second time", state.booked === 1, String(state.booked));
  await back(p);
  ck("…and the next Back leaves for the page before", path(p) === "/en", path(p));
  await ctx.close();
}

// =================================== A step with nothing behind it is the start
{
  const state = makeState();
  const { p, ctx } = await page(state);
  for (const step of ["details", "done"]) {
    await p.goto(`${pageUrl("booking")}?step=${step}`, { waitUntil: "load" });
    await p.waitForTimeout(1000);
    ck(
      `?step=${step} with no stay chosen shows the dates`,
      (await onDates(p)) && path(p) === "/booking/en",
      path(p),
    );
  }
  // Not a step at all: ignored rather than trusted.
  await p.goto(`${pageUrl("booking")}?step=nonsense`, { waitUntil: "load" });
  await p.waitForTimeout(1000);
  ck("An unknown step is ignored", await onDates(p), path(p));

  // A reload mid-flow: the stay was this visit's, so it is the start again
  // rather than a form for no dates.
  await chooseWeekend(p);
  await continueBtn(p).click();
  await p.waitForTimeout(700);
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(1000);
  ck("A reload on the details starts from the dates", await onDates(p), path(p));
  await ctx.close();
}

// ====================== Each step starts at the top, by any way of reaching it
// Continue already did this. Back and Forward are history moves now, and the
// router would rather put the old offset back -- on the dates that is wherever
// Continue was pressed, halfway down the calendar.
{
  const state = makeState();
  const { p, ctx } = await page(state, { width: 390, height: 844 });
  const y = () => p.evaluate(() => Math.round(window.scrollY));
  const down = () => p.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
  await p.goto(pageUrl("booking"), { waitUntil: "load" });
  await p.waitForTimeout(1000);
  await chooseWeekend(p);
  await down();
  await p.waitForTimeout(200);
  await continueBtn(p).first().click();
  await p.waitForTimeout(700);
  ck("Continue starts the details at the top", (await y()) === 0, `${await y()}px`);
  await down();
  await p.waitForTimeout(200);
  await back(p);
  ck("Browser Back starts the dates at the top", (await y()) === 0, `${await y()}px`);
  await down();
  await p.waitForTimeout(200);
  await forward(p);
  ck("Browser Forward starts the details at the top", (await y()) === 0, `${await y()}px`);
  await ctx.close();
}

// ================================== Changing language keeps the guest's place
{
  const state = makeState();
  const { p, ctx } = await page(state);
  await p.goto(pageUrl("booking"), { waitUntil: "load" });
  await p.waitForTimeout(1000);
  await chooseWeekend(p);
  await continueBtn(p).click();
  await p.waitForTimeout(700);
  await p.getByLabel("Full Name").fill("Fatima");
  await p
    .getByRole("button", { name: /العربية/ })
    .first()
    .click();
  await p.waitForTimeout(800);
  ck(
    "Switching to Arabic on the details stays on the details",
    path(p) === "/booking/ar?step=details",
    path(p),
  );
  ck(
    "…with what was typed still there",
    (await p.locator("form input").first().inputValue()) === "Fatima",
  );
  await ctx.close();
}

// ========================================= Every page is one Back from the next
{
  const state = makeState();
  const { p, ctx } = await page(state);
  await p.goto(pageUrl(""), { waitUntil: "load" });
  await p.waitForTimeout(900);
  const trail = ["/en"];
  for (const name of ["Facilities", "Photos", "Offers", "Booking", "Contact Us"]) {
    await p
      .locator("header")
      .getByRole("link", { name: new RegExp(`^${name}$`, "i") })
      .first()
      .click();
    await p.waitForTimeout(700);
    trail.push(path(p));
  }
  ck(
    "The header reaches every page",
    trail.join(" ") === "/en /facilities/en /photos/en /offers/en /booking/en /contact/en",
    trail.join(" "),
  );
  const walked = [path(p)];
  for (let i = 0; i < trail.length - 1; i++) {
    await back(p);
    walked.push(path(p));
  }
  ck(
    "Back walks the same pages in reverse, one at a time",
    walked.join(" ") === [...trail].reverse().join(" "),
    walked.join(" "),
  );
  await ctx.close();
}

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
