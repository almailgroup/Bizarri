/**
 * Calendar redesign, package filters, special-occasion pricing, the Civil ID +
 * terms checkout gate, the header reservation shortcut, and admin typography.
 *
 * Drives the real built app against a mocked Supabase. The i18n dictionary is
 * typed as Record<string, …>, so a mistyped key silently renders as the raw
 * key rather than failing the build — several assertions here exist purely to
 * catch that.
 */
import { chromium } from "playwright";
import { readFile, readdir } from "node:fs/promises";

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

/* ----------------------------------------------------------------- dates */

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const today = new Date();
today.setHours(0, 0, 0, 0);
// Everything happens next month: no past days there, so "black" can only ever
// mean reserved, and the assertions do not depend on today's date.
const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
const firstDow = (monthStart, dow) => {
  const d = new Date(monthStart);
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
  return d;
};

const thuA = firstDow(nextMonth, 4); // plain weekend package
const sunA = firstDow(nextMonth, 0); // plain weekday package
const reservedFrom = addDays(thuA, 7); // held by an accepted booking
const reservedTo = addDays(thuA, 9);
const occFrom = addDays(thuA, 14); // special occasion window
const occTo = addDays(thuA, 16);

const session = () => ({
  access_token: "tok-admin",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "r-admin",
  user: {
    id: "admin-1",
    aud: "authenticated",
    role: "authenticated",
    email: "admin@example.com",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  },
});

function makeState() {
  return {
    chalets: [
      { id: 1, slug: "b1", name_en: "Bizarri Chalet 1", name_ar: "شاليه بيزاري ١", active: true, sort_order: 1 },
      { id: 2, slug: "b2", name_en: "Bizarri Chalet 2", name_ar: "شاليه بيزاري ٢", active: true, sort_order: 2 },
    ],
    occasions: [
      {
        id: "occ-1",
        name_en: "Eid Al-Fitr",
        name_ar: "عيد الفطر",
        start_date: iso(occFrom),
        end_date: iso(occTo),
        price: 900,
        active: true,
        created_at: "",
        updated_at: "",
        updated_by: null,
      },
    ],
    bookings: [
      {
        id: "b-1",
        ref: "BZR-AAA111",
        chalet_id: 1,
        start_date: iso(reservedFrom),
        end_date: iso(reservedTo),
        days: 3,
        total: 350,
        currency: "KWD",
        package_key: "weekend",
        guest_name: "Aisha Al-Sabah",
        guest_phone: "+96594040955",
        guest_email: "aisha@example.com",
        guests: 4,
        notes: null,
        admin_note: null,
        status: "accepted",
        created_at: new Date().toISOString(),
        updated_at: "",
        decided_at: null,
        decided_by: null,
        civil_id_path: "ids/aisha.jpg",
        terms_accepted_at: new Date().toISOString(),
      },
      {
        id: "b-2",
        ref: "BZR-BBB222",
        chalet_id: 1,
        start_date: iso(addDays(thuA, 40)),
        end_date: iso(addDays(thuA, 42)),
        days: 3,
        total: 350,
        currency: "KWD",
        package_key: "weekend",
        guest_name: "Legacy Guest",
        guest_phone: "+96599999999",
        guest_email: "legacy@example.com",
        guests: 2,
        notes: null,
        admin_note: null,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: "",
        decided_at: null,
        decided_by: null,
        civil_id_path: null,
        terms_accepted_at: null,
      },
    ],
    uploads: [],
    calls: [],
  };
}

function mock(ctx, state) {
  return ctx.route(SUPA, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const raw = url.pathname;
    const path = raw.replace("/rest/v1/", "").replace("/auth/v1/", "auth:");
    // The storage upload is multipart, not JSON; postDataJSON() throws on it.
    let body = null;
    try {
      body = req.postDataJSON?.() ?? null;
    } catch {
      body = null;
    }
    state.calls.push({ method: req.method(), path, body, search: url.search });
    const send = (data, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });

    // ---- storage
    if (raw.startsWith("/storage/v1/object/sign/civil-ids/")) {
      return send({ signedURL: `/object/sign/civil-ids/x?token=t` });
    }
    if (raw.startsWith("/storage/v1/object/civil-ids/")) {
      const key = raw.replace("/storage/v1/object/", "");
      state.uploads.push(key);
      return send({ Key: key, Id: "obj-1" });
    }

    if (path.startsWith("auth:token")) return send(session());
    if (path.startsWith("auth:user")) return send(session().user);
    if (path === "rpc/is_admin") return send(true);
    if (path === "chalets" && req.method() === "GET") return send(state.chalets);
    if (path === "bookings" && req.method() === "GET") return send(state.bookings);
    if (path === "audit_log") return send([]);
    if (path === "settings" && req.method() === "GET") return send([]);

    if (path === "special_occasions" && req.method() === "GET") {
      const onlyActive = url.searchParams.get("active") === "eq.true";
      return send(onlyActive ? state.occasions.filter((o) => o.active) : state.occasions);
    }
    if (path === "special_occasions" && req.method() === "POST") {
      const row = { id: `occ-${state.occasions.length + 1}`, ...body };
      state.occasions.push(row);
      return send([row]);
    }
    if (path === "special_occasions" && req.method() === "PATCH") {
      const id = decodeURIComponent(url.searchParams.get("id") ?? "").replace("eq.", "");
      const i = state.occasions.findIndex((o) => o.id === id);
      if (i >= 0) state.occasions[i] = { ...state.occasions[i], ...body };
      return send([state.occasions[i] ?? {}]);
    }

    if (path === "rpc/request_booking") {
      return send({
        id: "new-1",
        ref: "BZR-NEW999",
        chalet_id: body.p_chalet_id,
        start_date: body.p_start,
        end_date: body.p_end,
        days: 3,
        total: 350,
        currency: "KWD",
        package_key: "weekend",
        guest_name: body.p_guest_name,
        guest_phone: body.p_guest_phone,
        guest_email: body.p_guest_email,
        guests: body.p_guests,
        notes: body.p_notes,
        admin_note: null,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: "",
        decided_at: null,
        decided_by: null,
        civil_id_path: body.p_civil_id_path,
        terms_accepted_at: new Date().toISOString(),
      });
    }

    if (path === "rpc/lookup_booking") {
      const hit = state.bookings.find(
        (x) => x.ref.toLowerCase() === String(body.p_ref ?? "").trim().toLowerCase(),
      );
      return send(hit ? [hit] : []);
    }

    if (path === "rpc/availability_calendar") {
      const accepted = state.bookings.filter(
        (bk) => bk.chalet_id === body.p_chalet_id && bk.status === "accepted",
      );
      const out = [];
      const d = new Date(body.p_from + "T00:00:00");
      const end = new Date(body.p_to + "T00:00:00");
      const todayIso = iso(today);
      for (; d <= end; d.setDate(d.getDate() + 1)) {
        const day = iso(d);
        const blocked =
          day < todayIso || accepted.some((bk) => day >= bk.start_date && day <= bk.end_date);
        out.push({ day, blocked, price: 75, custom: false });
      }
      return send(out);
    }

    if (path === "blocked_dates") return send([]);
    if (path === "day_prices") return send([]);
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
    return send([]);
  });
}

async function guestPage(state, route = "booking") {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1100 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) =>
    SUPA.test(r.request().url()) ? r.fallback() : r.abort(),
  );
  await mock(ctx, state);
  await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
  const p = await ctx.newPage();
  await p.goto(B + route, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(500);
  return { p, ctx };
}

/** Advance the guest calendar from this month to next month. */
async function toCalendarNextMonth(p) {
  await p.getByRole("button", { name: /^Book Now$/i }).click();
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: /Next month/i }).click();
  await p.waitForTimeout(250);
}

// (?!\d) so "October 1" does not also match "October 15".
const dayCell = (p, d) =>
  p.getByRole("button", {
    name: new RegExp(
      `^${d.toLocaleDateString("en-US", { weekday: "long" })}, ${d.toLocaleDateString("en-US", { month: "long" })} ${d.getDate()}(?!\\d)`,
    ),
  });

const bg = (loc) => loc.evaluate((el) => getComputedStyle(el).backgroundColor);

// ==================================================== calendar: black = reserved
{
  const state = makeState();
  const { p, ctx } = await guestPage(state);
  await toCalendarNextMonth(p);

  const reservedCell = dayCell(p, reservedFrom);
  const freeCell = dayCell(p, thuA);

  ck("Reserved day is rendered solid black", (await bg(reservedCell)) === "rgb(0, 0, 0)", await bg(reservedCell));
  ck("Reserved day is not selectable", await reservedCell.isDisabled());
  ck("Free day is not black", (await bg(freeCell)) !== "rgb(0, 0, 0)", await bg(freeCell));
  ck("Legend explains the black cells", await p.getByText("Reserved", { exact: true }).first().isVisible());

  // Selection must no longer use black, or it would read as reserved.
  await freeCell.click();
  await p.waitForTimeout(200);
  ck(
    "Selected day is distinct from reserved (not black)",
    (await bg(freeCell)) !== "rgb(0, 0, 0)",
    await bg(freeCell),
  );
  await ctx.close();
}

// ======================================================= calendar: past days
{
  const state = makeState();
  const { p, ctx } = await guestPage(state);
  await p.getByRole("button", { name: /^Book Now$/i }).click();
  await p.waitForTimeout(700);
  if (today.getDate() > 1) {
    const yesterday = addDays(today, -1);
    const cell = dayCell(p, yesterday);
    ck(
      "A past day is faded, not black (black means reserved)",
      (await bg(cell)) !== "rgb(0, 0, 0)",
      await bg(cell),
    );
  } else {
    ck("A past day is faded, not black (black means reserved)", true, "skipped: 1st of month");
  }
  await ctx.close();
}

// ======================================================= calendar: filters
{
  const state = makeState();
  const { p, ctx } = await guestPage(state);
  await toCalendarNextMonth(p);

  ck("Weekday filter chip is shown", await p.getByRole("button", { name: /Weekday/i }).isVisible());
  ck("Weekend filter chip is shown", await p.getByRole("button", { name: /Weekend/i }).isVisible());

  // Weekend: one tap on any Thursday should take the whole Thu-Sat stay.
  await p.getByRole("button", { name: /Weekend/i }).click();
  await p.waitForTimeout(250);
  const monday = firstDow(nextMonth, 1);
  ck(
    "Weekend filter disables days outside a Thu-Sat stay",
    await dayCell(p, monday).isDisabled(),
  );
  await dayCell(p, thuA).click();
  await p.waitForTimeout(250);
  const checkIn = await p.locator("text=Check-in").locator("..").innerText();
  const checkOut = await p.locator("text=Check-out").locator("..").innerText();
  ck("Tapping a Thursday selects the whole weekend", checkIn.includes(iso(thuA)), checkIn.trim());
  ck("…through the Saturday", checkOut.includes(iso(addDays(thuA, 2))), checkOut.trim());
  ck(
    "Weekend package is priced at 350",
    (await p.locator("text=Total").locator("..").innerText()).includes("350"),
  );

  // Weekday: Sun-Wed, 4 days, 300.
  await p.getByRole("button", { name: /Weekday/i }).click();
  await p.waitForTimeout(250);
  await dayCell(p, sunA).click();
  await p.waitForTimeout(250);
  const co2 = await p.locator("text=Check-out").locator("..").innerText();
  ck("Weekday filter selects Sun-Wed", co2.includes(iso(addDays(sunA, 3))), co2.trim());
  ck(
    "Weekday package is priced at 300",
    (await p.locator("text=Total").locator("..").innerText()).includes("300"),
  );
  await ctx.close();
}

// ============================================= calendar: special occasion
{
  const state = makeState();
  const { p, ctx } = await guestPage(state);
  await toCalendarNextMonth(p);
  await p.getByRole("button", { name: /Weekend/i }).click();
  await p.waitForTimeout(250);
  await dayCell(p, occFrom).click();
  await p.waitForTimeout(300);

  const total = await p.locator("text=Total").locator("..").innerText();
  ck("An occasion weekend is priced at 900, not 350", total.includes("900"), total.trim());
  ck(
    "The occasion is named under the calendar",
    await p.getByText("Eid Al-Fitr").first().isVisible(),
  );
  await ctx.close();
}

// ========================================== checkout: Civil ID and terms
{
  const state = makeState();
  const { p, ctx } = await guestPage(state);
  await toCalendarNextMonth(p);
  await p.getByRole("button", { name: /Weekend/i }).click();
  await p.waitForTimeout(250);
  await dayCell(p, thuA).click();
  await p.waitForTimeout(250);
  await p.getByRole("button", { name: /^Continue$/i }).click();
  await p.waitForTimeout(400);

  ck("Civil ID field is on the checkout form", await p.getByText("Civil ID image").first().isVisible());
  ck(
    "Terms checkbox is on the checkout form",
    await p.getByText(/accept the terms and regulations/i).first().isVisible(),
  );

  // Fill the guest details but neither requirement.
  await p.getByLabel("Full Name").fill("Test Guest");
  await p.getByLabel("Phone Number", { exact: true }).fill("+96599998888");
  await p.getByLabel("Email", { exact: true }).fill("guest@example.com");
  await p.getByRole("button", { name: /^Submit/i }).click();
  await p.waitForTimeout(300);

  ck(
    "Submitting without a Civil ID is refused",
    await p.getByText("Please attach your Civil ID image.").isVisible(),
  );
  ck(
    "Submitting without accepting the terms is refused",
    await p.getByText("You must accept the terms and regulations.").isVisible(),
  );
  ck(
    "No booking was sent while requirements were unmet",
    !state.calls.some((c) => c.path === "rpc/request_booking"),
  );

  // Now satisfy both.
  await p.locator('input[type=file]').setInputFiles({
    name: "civil-id.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  await p.locator('input[type=checkbox]').check();
  await p.waitForTimeout(150);
  await p.getByRole("button", { name: /^Submit/i }).click();
  await p.waitForTimeout(900);

  ck("The Civil ID is uploaded to the private bucket", state.uploads.length === 1, state.uploads[0]);
  ck(
    "The upload goes to the civil-ids bucket",
    (state.uploads[0] ?? "").startsWith("civil-ids/"),
    state.uploads[0],
  );
  const rpc = state.calls.find((c) => c.path === "rpc/request_booking");
  ck("The booking request is sent", !!rpc);
  ck(
    "request_booking carries the uploaded path",
    !!rpc && (state.uploads[0] ?? "").endsWith(rpc.body.p_civil_id_path),
    rpc?.body?.p_civil_id_path,
  );
  ck("request_booking carries the terms acceptance", rpc?.body?.p_terms_accepted === true);
  ck("Confirmation shows the reference", await p.getByText("BZR-NEW999").isVisible());
  await ctx.close();
}

// ======================================== header shortcut + /reservation
{
  const state = makeState();
  const { p, ctx } = await guestPage(state, "");
  const shortcut = p.getByRole("link", { name: /Your Reservation/i }).first();
  ck("Header shows a Your Reservation shortcut", await shortcut.isVisible());
  await shortcut.click();
  await p.waitForTimeout(600);
  ck("The shortcut opens the reservation page", p.url().includes("/reservation"));
  ck(
    "The reservation page explains itself",
    await p.getByText(/Already requested a stay/i).isVisible(),
  );

  await p.locator('input[placeholder="BZR-XXXXXX"]').fill("BZR-AAA111");
  await p.locator('input[type=email]').fill("aisha@example.com");
  await p.getByRole("button", { name: /Check status/i }).click();
  await p.waitForTimeout(600);
  ck("Looking up a reference shows its status", await p.getByText("Accepted").first().isVisible());
  await ctx.close();
}

// ========================================= reservation: remembered reference
{
  const state = makeState();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) =>
    SUPA.test(r.request().url()) ? r.fallback() : r.abort(),
  );
  await mock(ctx, state);
  await ctx.addInitScript(() => {
    sessionStorage.setItem("bizarri_intro_seen", "1");
    localStorage.setItem("bizarri:lastRef", "BZR-AAA111");
  });
  const p = await ctx.newPage();
  await p.goto(B + "reservation", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(500);
  ck(
    "A returning guest's reference is prefilled",
    (await p.locator('input[placeholder="BZR-XXXXXX"]').inputValue()) === "BZR-AAA111",
  );
  ck("…and the prefill is explained", await p.getByText(/from your last request/i).isVisible());
  await ctx.close();
}

/* ------------------------------------------------------------------ admin */

async function adminPage(state, tab) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1100 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) =>
    SUPA.test(r.request().url()) ? r.fallback() : r.abort(),
  );
  await mock(ctx, state);
  await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
  const p = await ctx.newPage();
  await p.goto(B + "admin", { waitUntil: "domcontentloaded" });
  await p.locator("input[type=email]").fill("admin@example.com");
  await p.locator("input[type=password]").fill("pw");
  await p.getByRole("button", { name: /^Login$/i }).click();
  await p.waitForTimeout(900);
  if (tab) {
    await p.getByRole("button", { name: tab }).click();
    await p.waitForTimeout(500);
  }
  return { p, ctx };
}

// ================================================ admin: occasions panel
{
  const state = makeState();
  const { p, ctx } = await adminPage(state, /Special Occasions/i);
  ck("Occasions tab lists the existing window", await p.getByText("Eid Al-Fitr").first().isVisible());
  ck(
    "…with its flat price",
    (await p.locator("li", { hasText: "Eid Al-Fitr" }).first().innerText()).includes("900"),
  );

  await p.getByPlaceholder("Eid Al-Fitr").fill("National Day");
  await p.locator('input[type=date]').first().fill(iso(addDays(occFrom, 60)));
  await p.locator('input[type=date]').nth(1).fill(iso(addDays(occFrom, 62)));
  await p.getByRole("button", { name: /Add occasion/i }).click();
  await p.waitForTimeout(600);

  const post = state.calls.find((c) => c.path === "special_occasions" && c.method === "POST");
  ck("Adding an occasion posts it", !!post, JSON.stringify(post?.body));
  ck("…with the default 900 price", post?.body?.price === 900);
  ck("…and is active by default", post?.body?.active === true);
  ck("The new occasion appears in the list", await p.getByText("National Day").first().isVisible());
  await ctx.close();
}

// ================================================ admin: Civil ID access
{
  const state = makeState();
  const { p, ctx } = await adminPage(state, /Booking Requests/i);
  ck(
    "A booking with an ID offers to open it",
    await p.locator("li", { hasText: "Aisha Al-Sabah" }).getByRole("button", { name: /View Civil ID/i }).isVisible(),
  );
  ck(
    "A booking without one says so",
    (await p.locator("li", { hasText: "Legacy Guest" }).innerText()).includes("No Civil ID on file"),
  );

  await p.locator("li", { hasText: "Aisha Al-Sabah" }).getByRole("button", { name: /View Civil ID/i }).click();
  await p.waitForTimeout(500);
  const signed = state.calls.find((c) => c.path.includes("object/sign/civil-ids"));
  ck("Opening it mints a short-lived signed URL", !!signed, signed?.path);
  await ctx.close();
}

// ================================================ admin: one font throughout
{
  const state = makeState();
  const { p, ctx } = await adminPage(state, /Booking Requests/i);
  const bodyFont = await p.evaluate(() => getComputedStyle(document.body).fontFamily);
  const headingFont = await p
    .getByRole("heading", { name: /Booking Requests/i })
    .evaluate((el) => getComputedStyle(el).fontFamily);
  const refFont = await p
    .locator("li", { hasText: "Aisha Al-Sabah" })
    .locator("p")
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily);

  ck("Admin headings use the body font, not the marketing serif", headingFont === bodyFont, headingFont);
  // (?<!sans-) so the sans stack's own "sans-serif" fallback is not a match.
  const SERIF = /Cormorant|Playfair|(?<!sans-)serif/i;
  ck("No serif is left in an admin heading", !SERIF.test(headingFont), headingFont);
  ck("Admin monospace is unified too", refFont === bodyFont, refFont);

  // The public site must keep its display serif — this is an admin-only change.
  const gp = await ctx.newPage();
  await gp.goto(B, { waitUntil: "domcontentloaded" });
  await gp.waitForTimeout(500);
  const marketing = await gp
    .getByRole("heading", { level: 1 })
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  ck("The public site keeps its display serif", SERIF.test(marketing), marketing);
  await ctx.close();
}

// ======================================= no untranslated keys leak to screen
/**
 * The dictionary is Record<string, …>, so tr("typo") compiles and silently
 * renders the bare key. Derive the keys the CODE asks for (not the ones the
 * dictionary has — a leak is precisely a key the dictionary is missing) and
 * check both statically and on screen.
 */
const dictKeys = new Set(
  [...(await readFile("src/lib/i18n.tsx", "utf8")).matchAll(/^ {2}([A-Za-z0-9_]+): [{]/gm)].map(
    (m) => m[1],
  ),
);

async function sourceFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...(await sourceFiles(full)));
    else if (/\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

const askedFor = new Set();
for (const f of await sourceFiles("src")) {
  for (const m of (await readFile(f, "utf8")).matchAll(/\btr\(\s*"([A-Za-z0-9_]+)"/g)) {
    askedFor.add(m[1]);
  }
}

{
  ck("Found the tr() call sites", askedFor.size > 50, `${askedFor.size} keys used`);
  const missing = [...askedFor].filter((k) => !dictKeys.has(k));
  ck("Every tr() key exists in the dictionary", missing.length === 0, missing.join(", "));
}

// And on screen: a leak renders the requested key verbatim. Compared
// case-insensitively because several surfaces are CSS-uppercased — that is
// exactly how the last one of these escaped notice.
const leaks = (text) => {
  const hay = text.toLowerCase();
  return [...askedFor].filter((k) => /[A-Z]/.test(k) && hay.includes(k.toLowerCase()));
};

{
  const state = makeState();
  const { p, ctx } = await guestPage(state, "booking");
  const intro = leaks(await p.locator("body").innerText());
  ck("No raw i18n keys on the booking intro", intro.length === 0, intro.join(", "));

  await toCalendarNextMonth(p);
  const cal = leaks(await p.locator("body").innerText());
  ck("No raw i18n keys on the calendar", cal.length === 0, cal.join(", "));

  await p.getByRole("button", { name: /Weekend/i }).click();
  await p.waitForTimeout(200);
  await dayCell(p, thuA).click();
  await p.waitForTimeout(200);
  await p.getByRole("button", { name: /^Continue$/i }).click();
  await p.waitForTimeout(400);
  const form = leaks(await p.locator("body").innerText());
  ck("No raw i18n keys on the checkout form", form.length === 0, form.join(", "));
  await ctx.close();
}

{
  const state = makeState();
  const { p, ctx } = await guestPage(state, "reservation");
  ck("No raw i18n keys on the reservation page", leaks(await p.locator("body").innerText()).length === 0);
  await ctx.close();
}

{
  const state = makeState();
  const { p, ctx } = await guestPage(state, "offers");
  ck("No raw i18n keys on the offers page", leaks(await p.locator("body").innerText()).length === 0);
  await ctx.close();
}

for (const [label, tab] of [
  ["Special Occasions", /Special Occasions/i],
  ["Booking Requests", /Booking Requests/i],
  ["Overview", /Overview/i],
]) {
  const state = makeState();
  const { p, ctx } = await adminPage(state, tab);
  const found = leaks(await p.locator("body").innerText());
  ck(`No raw i18n keys on the ${label} tab`, found.length === 0, found.join(", "));
  await ctx.close();
}

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
