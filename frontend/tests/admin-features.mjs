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

/**
 * The bookings' dates, from today rather than written in: the accepted one
 * used to be 6-9 October 2026, and the day the panel checks went into the
 * past on the 9th. A Sunday at least a week ahead whose Wednesday is in the
 * same month, so the panel shows the whole booking on one page.
 */
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const AHEAD = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 7);
  for (;;) {
    const wed = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3);
    if (d.getDay() === 0 && wed.getMonth() === d.getMonth()) break;
    d.setDate(d.getDate() + 1);
  }
  return d;
})();
const at = (n) => new Date(AHEAD.getFullYear(), AHEAD.getMonth(), AHEAD.getDate() + n);
const A_START = ymd(AHEAD);
const A_END = ymd(at(3));
const A_MID = at(1).getDate();
const A_MONTH = AHEAD.toLocaleDateString("en-US", { month: "long" });
const B_START = ymd(at(25));
const B_END = ymd(at(28));

function makeState() {
  return {
    chalets: [
      {
        id: 1,
        slug: "b1",
        name_en: "Bizarri Chalet 1",
        name_ar: "شاليه بيزاري 1",
        active: true,
        sort_order: 1,
      },
      {
        id: 2,
        slug: "b2",
        name_en: "Bizarri Chalet 2",
        name_ar: "شاليه بيزاري 2",
        active: true,
        sort_order: 2,
      },
    ],
    settings: {
      contact: {
        phone: "+96594040955",
        whatsapp: "96594040955",
        email: "sales@bizarri.com",
        instagram: "https://instagram.com/bizarri.chalet",
        maps: "https://maps.app.goo.gl/x",
      },
      notify_emails: ["sales@bizarri.com"],
    },
    bookings: [
      {
        id: "b-1",
        ref: "BZR-AAA111",
        chalet_id: 1,
        start_date: A_START,
        end_date: A_END,
        days: 4,
        total: 300,
        currency: "KWD",
        package_key: "weekday",
        guest_name: "Aisha Al-Sabah",
        guest_phone: "+96594040955",
        guest_email: "aisha@example.com",
        guests: 4,
        notes: "Late check-in",
        admin_note: null,
        status: "accepted",
        created_at: new Date().toISOString(),
        updated_at: "",
        decided_at: null,
        decided_by: null,
      },
      {
        id: "b-2",
        ref: "BZR-BBB222",
        chalet_id: 2,
        start_date: B_START,
        end_date: B_END,
        days: 3,
        total: 350,
        currency: "KWD",
        package_key: "weekend",
        guest_name: "Omar Khalid",
        guest_phone: "+96599999999",
        guest_email: "omar@example.com",
        guests: 6,
        notes: null,
        admin_note: null,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: "",
        decided_at: null,
        decided_by: null,
      },
    ],
    audit: [
      {
        // A guest's request: request_booking runs with no signed-in user.
        id: 1,
        actor: null,
        actor_email: null,
        action: "booking.created",
        entity: "bookings",
        entity_id: "BZR-BBB222",
        detail: { chalet: 2, start: B_START, end: B_END, total: 350 },
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        actor: "admin-1",
        actor_email: "admin@example.com",
        action: "booking.status",
        entity: "bookings",
        entity_id: "BZR-AAA111",
        detail: { from: "pending", to: "accepted" },
        created_at: new Date().toISOString(),
      },
    ],
    blocked: [],
    dayPrices: {},
    calls: [],
  };
}

function mock(ctx, state) {
  return ctx.route(SUPA, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace("/rest/v1/", "").replace("/auth/v1/", "auth:");
    const body = req.postDataJSON?.() ?? null;
    state.calls.push({ method: req.method(), path, body, search: url.search });
    const send = (data, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });

    if (path.startsWith("auth:token")) return send(session());
    if (path.startsWith("auth:user")) return send(session().user);
    if (path === "rpc/is_admin") return send(true);
    if (path === "chalets" && req.method() === "GET") return send(state.chalets);
    if (path === "settings" && req.method() === "GET")
      return send(
        Object.entries(state.settings).map(([key, value]) => ({
          key,
          value,
          updated_at: "",
          updated_by: null,
        })),
      );
    if (path === "bookings" && req.method() === "GET") return send(state.bookings);
    if (path === "bookings" && req.method() === "PATCH") {
      const id = decodeURIComponent(url.searchParams.get("id")).replace("eq.", "");
      const idx = state.bookings.findIndex((x) => x.id === id);
      if (idx >= 0) state.bookings[idx] = { ...state.bookings[idx], ...body };
      return send(state.bookings[idx] ?? {});
    }
    if (path === "bookings" && req.method() === "DELETE") {
      const id = decodeURIComponent(url.searchParams.get("id")).replace("eq.", "");
      state.bookings = state.bookings.filter((x) => x.id !== id);
      return send({});
    }
    if (path === "chalets" && req.method() === "PATCH") {
      const id = Number(decodeURIComponent(url.searchParams.get("id")).replace("eq.", ""));
      const idx = state.chalets.findIndex((x) => x.id === id);
      if (idx >= 0) state.chalets[idx] = { ...state.chalets[idx], ...body };
      return send(state.chalets[idx] ?? {});
    }
    if (path === "settings" && (req.method() === "POST" || req.method() === "PATCH")) {
      const rows = Array.isArray(body) ? body : [body];
      for (const r of rows) state.settings[r.key] = r.value;
      return send(rows);
    }
    if (path === "audit_log") return send(state.audit);
    if (path === "rpc/availability_calendar") {
      // Mirror the real SQL function: a day is blocked if it falls inside an
      // accepted booking for this chalet, matching what AvailabilityPanel is
      // meant to reflect (not just manual blocked_dates rows, which the
      // panel used to rely on exclusively before this fix).
      const accepted = state.bookings.filter(
        (bk) => bk.chalet_id === body.p_chalet_id && bk.status === "accepted",
      );
      const out = [];
      const d = new Date(body.p_from + "T00:00:00");
      const end = new Date(body.p_to + "T00:00:00");
      for (; d <= end; d.setDate(d.getDate() + 1)) {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const blocked = accepted.some((bk) => iso >= bk.start_date && iso <= bk.end_date);
        // One custom-priced day a month, so the admin calendar has something
        // to draw its price badge on.
        const custom = d.getDate() === 12;
        out.push({ day: iso, blocked, price: custom ? 50 : 75, custom });
      }
      return send(out);
    }
    // PostgREST filters arrive as day=in.(2026-10-01,2026-10-02).
    const inList = (key) =>
      (decodeURIComponent(url.searchParams.get(key) ?? "").match(/^in\.\((.*)\)$/)?.[1] ?? "")
        .split(",")
        .filter(Boolean);
    if (path === "blocked_dates") {
      if (req.method() === "GET") return send(state.blocked.map((day) => ({ day })));
      if (req.method() === "POST") {
        for (const r of body) if (!state.blocked.includes(r.day)) state.blocked.push(r.day);
        return send([]);
      }
      if (req.method() === "DELETE") {
        const days = inList("day");
        state.blocked = state.blocked.filter((d) => !days.includes(d));
        return send([]);
      }
    }
    if (path === "day_prices") {
      if (req.method() === "POST") for (const r of body) state.dayPrices[r.day] = r.price;
      if (req.method() === "DELETE") for (const d of inList("day")) delete state.dayPrices[d];
      return send([]);
    }
    if (path === "rpc/quote_stay") {
      const n =
        Math.round(
          (new Date(body.p_end + "T00:00:00") - new Date(body.p_start + "T00:00:00")) / 86400000,
        ) + 1;
      return send([
        { total: n * 75, package_key: null, days: n, has_custom: false, occasion: null },
      ]);
    }
    if (path === "rpc/set_booking_status") {
      const bk = state.bookings.find((x) => x.id === body.p_id);
      if (bk) bk.status = body.p_status;
      return send(bk ?? {});
    }
    if (path === "rpc/admin_create_booking") {
      const n =
        Math.round(
          (new Date(body.p_end + "T00:00:00") - new Date(body.p_start + "T00:00:00")) / 86400000,
        ) + 1;
      const row = {
        id: `b-new-${state.bookings.length + 1}`,
        ref: "BZR-NEW001",
        chalet_id: body.p_chalet_id,
        start_date: body.p_start,
        end_date: body.p_end,
        days: n,
        total: body.p_total ?? n * 75,
        currency: "KWD",
        package_key: null,
        guest_name: body.p_guest_name,
        guest_phone: body.p_guest_phone,
        guest_email: body.p_guest_email,
        guests: body.p_guests,
        notes: body.p_notes,
        admin_note: body.p_admin_note,
        status: body.p_status,
        source: "admin",
        notify_guest: body.p_notify_guest,
        lang: body.p_lang,
        civil_id_path: null,
        created_at: new Date().toISOString(),
        updated_at: "",
        decided_at: null,
        decided_by: null,
      };
      state.bookings = [row, ...state.bookings];
      return send(row);
    }
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

/** Page the calendar forward until it shows `monthName`. */
async function toMonth(p, monthName) {
  for (let i = 0; i < 4; i++) {
    const label = await p
      .locator("[data-month-label]")
      .innerText()
      .catch(() => "");
    if (label.includes(monthName)) return;
    await p.getByRole("button", { name: /next month/i }).click();
    await p.waitForTimeout(300);
  }
}

async function adminPage(state, { phone = false } = {}) {
  const ctx = await b.newContext(
    phone
      ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
      : { viewport: { width: 1400, height: 1000 } },
  );
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) =>
    SUPA.test(r.request().url()) ? r.fallback() : r.abort(),
  );
  await mock(ctx, state);
  await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
  const p = await ctx.newPage();
  await p.goto(pageUrl("admin"), { waitUntil: "domcontentloaded" });
  await p.locator("input[type=email]").fill("admin@example.com");
  await p.locator("input[type=password]").fill("pw");
  await p.getByRole("button", { name: /^Login$/i }).click();
  await p.waitForTimeout(900);
  return { p, ctx };
}

// ============================================================ Overview tab
{
  const state = makeState();
  const { p, ctx } = await adminPage(state);
  ck("Overview is the landing tab", await p.getByText("Pending Requests").isVisible());
  ck(
    "Pending count reflects one pending booking",
    await p
      .locator("text=Pending Requests")
      .locator("..")
      .getByText("1", { exact: true })
      .isVisible(),
  );
  ck(
    "Upcoming check-ins lists the accepted booking",
    await p.getByText("Aisha Al-Sabah").first().isVisible(),
  );
  await ctx.close();
}

// ================================================ tabs are history entries
// Back from a tab returns to the tab before it, not out of the dashboard, and
// a reload stays on the tab it was on.
{
  const state = makeState();
  const { p, ctx } = await adminPage(state);
  const where = () => new URL(p.url()).pathname + new URL(p.url()).search;
  const start = where();
  await p.getByRole("button", { name: "Booking Requests" }).click();
  await p.waitForTimeout(400);
  ck("A tab has an address of its own", where() === "/admin/en?tab=requests", where());
  await p.getByRole("button", { name: "Package Rates" }).click();
  await p.waitForTimeout(400);
  await p.goBack();
  await p.waitForTimeout(500);
  ck(
    "Back returns to the previous tab",
    where() === "/admin/en?tab=requests" &&
      (await p.getByRole("button", { name: "Booking Requests" }).getAttribute("aria-current")) ===
        "true",
    where(),
  );
  await p.goBack();
  await p.waitForTimeout(500);
  ck(
    "…and then to the overview, still in the dashboard",
    where() === start && (await p.getByText("Pending Requests").isVisible()),
    where(),
  );
  await p.goForward();
  await p.waitForTimeout(500);
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(1200);
  ck(
    "A reload stays on the tab",
    (await p.getByRole("button", { name: "Booking Requests" }).getAttribute("aria-current")) ===
      "true",
    where(),
  );
  await ctx.close();
}

// ==================================================== Requests: search + edit
{
  const state = makeState();
  const { p, ctx } = await adminPage(state);
  await p.getByRole("button", { name: "Booking Requests" }).click();
  await p.waitForTimeout(400);
  ck("Both bookings visible before search", await p.getByText("Omar Khalid").isVisible());

  await p.getByPlaceholder(/search by name/i).fill("aisha");
  await p.waitForTimeout(200);
  ck("Search filters to the matching guest", await p.getByText("Aisha Al-Sabah").isVisible());
  ck(
    "Search hides the non-matching guest",
    !(await p
      .getByText("Omar Khalid")
      .isVisible()
      .catch(() => false)),
  );
  await p.getByPlaceholder(/search by name/i).fill("");

  // edit details modal
  await p.locator("li", { hasText: "Omar Khalid" }).getByLabel("Edit details").click();
  await p.waitForTimeout(300);
  const dialog = p.getByRole("dialog");
  ck("Edit modal opens", await dialog.isVisible());
  await dialog.locator("input[type=email]").fill("omar.k@example.com");
  await dialog.locator("textarea").nth(1).fill("VIP guest, called ahead");
  await dialog.getByRole("button", { name: /save changes/i }).click();
  await p.waitForTimeout(400);

  const patchCall = state.calls.find(
    (c) =>
      c.path === "bookings" && c.method === "PATCH" && c.body?.guest_email === "omar.k@example.com",
  );
  ck("Edit sends a PATCH with the updated email", !!patchCall, JSON.stringify(patchCall?.body));
  ck("Edit includes the internal note", patchCall?.body?.admin_note === "VIP guest, called ahead");
  ck(
    "Edit did not touch unrelated fields like guests",
    patchCall && !("start_date" in patchCall.body),
  );
  await ctx.close();
}

// ============================================================ Chalets panel
{
  const state = makeState();
  const { p, ctx } = await adminPage(state);
  await p.getByRole("button", { name: "Chalets" }).click();
  await p.waitForTimeout(400);
  // `.filter({ hasText })` matches every ancestor div containing the text; the
  // grid wrapper around both cards matches too, so `.last()` (the innermost,
  // most specific match) is the actual card, not `.first()` (the wrapper).
  const card = p.locator("div", { hasText: "Chalet 2 · b2" }).last();
  // A plain click, not .uncheck(): the checkbox is fully controlled by
  // server data with no optimistic flip, so it only shows unchecked after
  // the mutation round-trips and refetches.
  await card.locator("input[type=checkbox]").click();
  await p.waitForTimeout(500);
  const toggleCall = state.calls.find(
    (c) => c.path === "chalets" && c.method === "PATCH" && c.body?.active === false,
  );
  ck("Deactivating a chalet sends active:false", !!toggleCall, JSON.stringify(toggleCall?.body));
  ck("Chalet store reflects the change", state.chalets.find((c) => c.id === 2).active === false);
  await ctx.close();
}

// =========================================================== Settings panel
{
  const state = makeState();
  const { p, ctx } = await adminPage(state);
  await p.getByRole("button", { name: "Site Settings" }).click();
  await p.waitForTimeout(400);
  const phoneInput = p.locator('input[value="+96594040955"]');
  await phoneInput.fill("+96500001111");
  await p
    .getByRole("button", { name: /^Save$/i })
    .first()
    .click();
  await p.waitForTimeout(400);
  const saveCall = state.calls.find(
    (c) =>
      c.path === "settings" && c.body?.key === "contact" && c.body?.value?.phone === "+96500001111",
  );
  ck("Saving contact settings upserts the contact row", !!saveCall, JSON.stringify(saveCall?.body));
  ck(
    "Settings store reflects the new phone number",
    state.settings.contact.phone === "+96500001111",
  );
  await ctx.close();
}

// ================================================= WhatsApp recipients (CallMeBot)
{
  const state = makeState();
  const { p, ctx } = await adminPage(state);
  await p.getByRole("button", { name: "Site Settings" }).click();
  await p.waitForTimeout(400);

  ck(
    "Starts with no WhatsApp numbers",
    await p.getByText("No WhatsApp numbers added yet.").isVisible(),
  );
  ck(
    "Shows the CallMeBot opt-in steps",
    await p.getByText(/I allow callmebot to send me messages/).isVisible(),
  );

  await p.getByRole("button", { name: /add number/i }).click();
  await p.waitForTimeout(200);
  // Three inputs share the "96594040955" placeholder (contact phone,
  // contact WhatsApp, and this recipient row), so target by label instead.
  await p.getByLabel("Phone (with country code, digits only)").fill("96599998888");
  await p.getByLabel("CallMeBot API key").fill("998877");
  await p
    .getByRole("button", { name: /^Save$/i })
    .last()
    .click();
  await p.waitForTimeout(400);

  const waCall = state.calls.find(
    (c) => c.path === "settings" && c.body?.key === "notify_whatsapp",
  );
  ck(
    "Saving adds a {phone, apikey} pair to notify_whatsapp",
    JSON.stringify(waCall?.body?.value) ===
      JSON.stringify([{ phone: "96599998888", apikey: "998877" }]),
    JSON.stringify(waCall?.body),
  );
  ck(
    "Settings store reflects the new WhatsApp recipient",
    JSON.stringify(state.settings.notify_whatsapp) ===
      JSON.stringify([{ phone: "96599998888", apikey: "998877" }]),
  );

  // remove it again
  await p.getByLabel(/remove number/i).click();
  await p
    .getByRole("button", { name: /^Save$/i })
    .last()
    .click();
  await p.waitForTimeout(400);
  ck(
    "Removing the row and saving clears notify_whatsapp",
    Array.isArray(state.settings.notify_whatsapp) && state.settings.notify_whatsapp.length === 0,
    JSON.stringify(state.settings.notify_whatsapp),
  );
  await ctx.close();
}

// =========================================================== Activity panel
{
  const state = makeState();
  const { p, ctx } = await adminPage(state);
  await p.getByRole("button", { name: "Activity Log" }).click();
  await p.waitForTimeout(400);
  ck(
    "Activity log lists a booking creation entry",
    await p.getByText(/New request BZR-BBB222/).isVisible(),
  );
  ck(
    "Activity log lists a status change entry",
    await p.getByText(/pending.*accepted/).isVisible(),
  );
  await ctx.close();
}

// ================================================ Availability shows bookings
{
  const state = makeState();
  const { p, ctx } = await adminPage(state);
  await p.getByRole("button", { name: "Availability & Pricing", exact: true }).click();
  await p.waitForTimeout(500);
  // Chalet 1 has an accepted booking Sun-Wed of the anchor week; the panel
  // defaults to the current month, so page forward to that month if needed.
  await toMonth(p, A_MONTH);
  const day7 = p.locator(`[data-day="${ymd(at(1))}"]`);
  const label = await day7.getAttribute("aria-label");
  ck(
    "A day inside an accepted booking is marked booked-by-guest",
    /Booked by a guest · Aisha Al-Sabah/.test(label ?? ""),
    label,
  );
  await day7.click();
  await p.waitForTimeout(300);
  ck(
    "Selecting a guest-booked day explains it instead of offering to block it",
    await p.getByText(/covered by an accepted booking/i).isVisible(),
  );
  await ctx.close();
}

// ================================= crossing between the site and the panel
{
  const state = makeState();
  const { p, ctx } = await adminPage(state);

  // The logo goes back to the site, as it does on every other page.
  await p.locator("header img").first().click();
  await p.waitForTimeout(900);
  ck(
    "The admin logo goes back to the website",
    !new URL(p.url()).pathname.includes("admin"),
    p.url(),
  );

  await p.goBack();
  await p.waitForTimeout(900);
  // …and a labelled link too, for anyone who would not think to click a logo.
  await p.getByRole("link", { name: /View site/i }).click();
  await p.waitForTimeout(900);
  ck("…and so does the View site link", !new URL(p.url()).pathname.includes("admin"), p.url());
  await ctx.close();
}

// ======================================= the panel can change language too
{
  const state = makeState();
  const { p, ctx } = await adminPage(state);
  ck(
    "The dashboard offers a language toggle",
    await p.getByRole("button", { name: /العربية/ }).isVisible(),
  );
  await p.getByRole("button", { name: /العربية/ }).click();
  await p.waitForTimeout(1000);

  const st = await p.evaluate(() => ({
    path: location.pathname,
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
  }));
  ck("…that stays in the dashboard", st.path.includes("admin"), st.path);
  ck("…and actually switches it", st.lang === "ar" && st.dir === "rtl", `${st.lang}/${st.dir}`);
  ck(
    "…with the dashboard's own chrome translated",
    await p.getByText("لوحة التحكم").first().isVisible(),
  );
  ck(
    "…and the tabs with it",
    await p
      .getByRole("button", { name: /نظرة عامة/ })
      .first()
      .isVisible(),
  );

  // Back again, so it is a toggle and not a one-way trip.
  await p.getByRole("button", { name: /English/i }).click();
  await p.waitForTimeout(1000);
  const back = await p.evaluate(() => document.documentElement.lang);
  ck("…and back to English", back === "en", back);
  await ctx.close();
}

// The signed-out screens need it too, or you cannot reach an Arabic login.
{
  const state = makeState();
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) =>
    SUPA.test(r.request().url()) ? r.fallback() : r.abort(),
  );
  await mock(ctx, state);
  const p = await ctx.newPage();
  await p.goto(pageUrl("admin"), { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(900);
  ck(
    "The login screen offers it as well",
    await p.getByRole("button", { name: /العربية/ }).isVisible(),
  );
  await p.getByRole("button", { name: /العربية/ }).click();
  await p.waitForTimeout(900);
  ck(
    "…and the login form follows",
    (await p.evaluate(() => document.documentElement.dir)) === "rtl",
  );
  await ctx.close();
}

// ================================= a custom price has to be readable at a glance
{
  const state = makeState();
  const { p, ctx } = await adminPage(state);
  await p
    .getByRole("button", { name: /Availability/i })
    .first()
    .click();
  await p.waitForTimeout(1200);

  const badge = await p.evaluate(() => {
    const span = document.querySelector("[data-day] [data-price]");
    if (!span) return null;
    const cs = getComputedStyle(span);
    return {
      text: span.textContent.trim(),
      px: parseFloat(cs.fontSize),
      radius: parseFloat(cs.borderRadius),
      bg: cs.backgroundColor,
    };
  });

  ck("A custom price is shown on the day", !!badge, badge?.text);
  // It used to read "50" at 9px, which says a number without saying what it
  // is, at a size you have to lean in for.
  ck(
    "…with the currency, not a bare number",
    /KD|\u062f\.\u0643/.test(badge?.text ?? ""),
    badge?.text,
  );
  ck("…at a size that can be read", (badge?.px ?? 0) >= 12, `${badge?.px}px`);
  ck("…in a pill, not loose text", (badge?.radius ?? 0) >= 8, `radius ${badge?.radius}px`);
  ck(
    "…on a light background rather than none",
    !!badge && badge.bg !== "rgba(0, 0, 0, 0)",
    badge?.bg,
  );
  await ctx.close();
}

// ======================================== calendar: ranges, not single days
// Blocking a week used to be seven taps and seven round trips. A selection is
// now a range -- dragged, Shift-clicked or typed -- and each action covers it.
{
  const state = makeState();
  const { p, ctx } = await adminPage(state);
  await p.getByRole("button", { name: "Availability & Pricing", exact: true }).click();
  await p.waitForTimeout(700);
  await toMonth(p, A_MONTH);
  const cell = (n) => p.locator(`[data-day="${ymd(at(n))}"]`);
  const centre = async (n) => {
    const b = await cell(n).boundingBox();
    return [b.x + b.width / 2, b.y + b.height / 2];
  };
  const panel = p.locator("#selection-panel").locator("..");

  // Drag from the booked Tuesday to the Saturday: five days, two of them held.
  const [ax, ay] = await centre(2);
  const [zx, zy] = await centre(6);
  await p.mouse.move(ax, ay);
  await p.mouse.down();
  await p.mouse.move(zx, zy, { steps: 10 });
  await p.mouse.up();
  await p.waitForTimeout(300);
  const pressed = await p.locator('[data-day][aria-pressed="true"]').count();
  ck("Dragging across days selects the whole range", pressed === 5, `${pressed} selected`);
  ck(
    "…and the panel says how long it is",
    await panel.getByText("5 days", { exact: true }).isVisible(),
  );
  ck(
    "…and what is in it",
    (await panel.getByText("3 available").isVisible()) &&
      (await panel.getByText("2 booked").isVisible()),
  );

  const blockBtn = panel.getByRole("button", { name: /Mark 3 days unavailable/ });
  ck("The block button counts only the days it can close", await blockBtn.isVisible());
  await blockBtn.click();
  await p.waitForTimeout(700);
  const post = state.calls.find((c) => c.path === "blocked_dates" && c.method === "POST");
  ck(
    "One request closes all of them",
    state.calls.filter((c) => c.path === "blocked_dates" && c.method === "POST").length === 1 &&
      JSON.stringify(post?.body?.map((r) => r.day)) ===
        JSON.stringify([ymd(at(4)), ymd(at(5)), ymd(at(6))]),
    JSON.stringify(post?.body),
  );
  ck("…leaving the booked days alone", !post?.body?.some((r) => r.day === ymd(at(2))));
  ck(
    "…as an upsert, so a day already closed is not an error",
    /on_conflict=chalet_id,day/.test(decodeURIComponent(post?.search ?? "")),
    post?.search,
  );
  ck(
    "…and says it worked",
    await p.locator('[data-toast="success"]', { hasText: "3 days marked unavailable" }).isVisible(),
  );
  ck(
    "The closed days now read as unavailable",
    /Unavailable/.test((await cell(5).getAttribute("aria-label")) ?? ""),
    await cell(5).getAttribute("aria-label"),
  );

  // From / To: the same range by typing, then reopen it.
  await panel.getByRole("button", { name: /Clear selection/i }).click();
  await panel.getByLabel("From", { exact: true }).fill(ymd(at(4)));
  await panel.getByLabel("To", { exact: true }).fill(ymd(at(6)));
  await p.waitForTimeout(300);
  ck(
    "Typing From and To selects the range too",
    (await p.locator('[data-day][aria-pressed="true"]').count()) === 3,
  );
  await panel.getByRole("button", { name: /Make 3 days available/ }).click();
  await p.waitForTimeout(700);
  const del = state.calls.find((c) => c.path === "blocked_dates" && c.method === "DELETE");
  ck(
    "Reopening them is one request too",
    decodeURIComponent(del?.search ?? "").includes(
      `day=in.(${ymd(at(4))},${ymd(at(5))},${ymd(at(6))})`,
    ),
    decodeURIComponent(del?.search ?? ""),
  );
  ck("…and they are open again", state.blocked.length === 0, JSON.stringify(state.blocked));

  // Shift-click extends from where the selection began.
  await cell(4).click();
  await cell(6).click({ modifiers: ["Shift"] });
  await p.waitForTimeout(200);
  ck(
    "Shift-click extends the selection",
    (await p.locator('[data-day][aria-pressed="true"]').count()) === 3,
  );

  // A price for every day in the range at once.
  await panel.getByLabel("Custom price per day").fill("90");
  await panel.getByRole("button", { name: "Apply price" }).click();
  await p.waitForTimeout(700);
  ck(
    "A price applies to the whole range",
    [4, 5, 6].every((n) => state.dayPrices[ymd(at(n))] === 90),
    JSON.stringify(state.dayPrices),
  );

  // And the same dates can become a booking.
  await panel.getByRole("button", { name: /Create a booking for these dates/ }).click();
  await p.waitForTimeout(400);
  const dlg = p.getByRole("dialog");
  ck(
    "The selection opens a new booking with its dates filled in",
    (await dlg.getByLabel("Check-in date").inputValue()) === ymd(at(4)) &&
      (await dlg.getByLabel("Check-out date").inputValue()) === ymd(at(7)),
    `${await dlg.getByLabel("Check-in date").inputValue()} → ${await dlg.getByLabel("Check-out date").inputValue()}`,
  );
  await ctx.close();
}

// ========================================= deleting: one click to confirm
{
  const state = makeState();
  const { p, ctx } = await adminPage(state);
  await p.getByRole("button", { name: "Booking Requests" }).click();
  await p.waitForTimeout(500);
  const row = p.locator("li", { hasText: "Omar Khalid" });

  await row.getByLabel("Delete request").click();
  await p.waitForTimeout(300);
  const dlg = p.getByRole("dialog");
  ck(
    "Delete asks plainly",
    await dlg.getByText("Are you sure you want to delete this booking?").isVisible(),
  );
  ck("…with nothing to type", (await dlg.locator("input, textarea").count()) === 0);
  ck(
    "…and two clear answers",
    (await dlg.getByRole("button", { name: "Yes, delete" }).isEnabled()) &&
      (await dlg.getByRole("button", { name: "Cancel" }).isVisible()),
  );

  await dlg.getByRole("button", { name: "Cancel" }).click();
  await p.waitForTimeout(300);
  ck(
    "Cancel deletes nothing",
    (await p.getByRole("dialog").count()) === 0 &&
      !state.calls.some((c) => c.path === "bookings" && c.method === "DELETE"),
  );

  await row.getByLabel("Delete request").click();
  await p.getByRole("dialog").getByRole("button", { name: "Yes, delete" }).click();
  await p.waitForTimeout(800);
  const delCall = state.calls.find((c) => c.path === "bookings" && c.method === "DELETE");
  ck(
    "Yes deletes it in one click",
    decodeURIComponent(delCall?.search ?? "").includes("id=eq.b-2"),
  );
  ck(
    "…closes the dialog and says so",
    (await p.getByRole("dialog").count()) === 0 &&
      (await p.locator('[data-toast="success"]', { hasText: "BZR-BBB222 deleted" }).isVisible()),
  );
  ck(
    "…and the booking is gone from the list",
    (await p.locator("li", { hasText: "Omar Khalid" }).count()) === 0,
  );
  await ctx.close();
}

// ============================================== bookings the admin enters
{
  const state = makeState();
  const { p, ctx } = await adminPage(state);
  await p.getByRole("button", { name: "Booking Requests" }).click();
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: "New booking" }).click();
  await p.waitForTimeout(400);
  const dlg = p.getByRole("dialog");
  ck(
    "New booking opens a form",
    await dlg.getByRole("heading", { name: "New booking" }).isVisible(),
  );

  // Nothing filled in: every problem is named against its field, and nothing is sent.
  await dlg.getByRole("button", { name: "Create booking" }).click();
  await p.waitForTimeout(300);
  ck(
    "An empty form is refused field by field",
    (await dlg.getByText("Choose a check-in and a check-out date").isVisible()) &&
      (await dlg.getByText("Enter the guest's full name").isVisible()) &&
      (await dlg.getByText("Enter a phone number with at least 8 digits").isVisible()) &&
      (await dlg.getByText("Enter a valid email address").isVisible()),
  );
  ck(
    "…without calling the server",
    !state.calls.some((c) => c.path === "rpc/admin_create_booking"),
  );

  // Accepted over Aisha's accepted stay: said before Create, and Create held back.
  await dlg.getByLabel("Check-in date").fill(A_START);
  await dlg.getByLabel("Check-out date").fill(ymd(at(2)));
  await dlg.getByRole("button", { name: "Accepted" }).click();
  await p.waitForTimeout(300);
  ck(
    "A clash with an accepted booking is named",
    await dlg.getByText(/overlap accepted booking BZR-AAA111 \(Aisha Al-Sabah\)/).isVisible(),
  );
  ck(
    "…and an accepted booking cannot be created over it",
    await p.getByRole("button", { name: "Create booking" }).isDisabled(),
  );

  // A clean one.
  await dlg.getByLabel("Check-in date").fill(ymd(at(10)));
  await dlg.getByLabel("Check-out date").fill(ymd(at(12)));
  await p.waitForTimeout(500);
  ck(
    "The stay is spelled out",
    await dlg.getByText(/^2 days · in .* at 2:00 PM · out .* at 12:00 PM$/).isVisible(),
  );
  ck(
    "…and priced from the rates",
    (await dlg.locator('[data-testid="quote"]').innerText()) === "KD 150",
  );
  await dlg.getByLabel("Full name", { exact: true }).fill("Phone Guest");
  await dlg.getByLabel("Phone", { exact: true }).fill("+965 9000 1111");
  await dlg.getByLabel("Email", { exact: true }).fill("Phone.Guest@Example.com");
  await dlg.getByLabel("Guests", { exact: true }).fill("5");
  await dlg.getByLabel("Internal note", { exact: true }).fill("Paid deposit by link");
  await dlg.getByRole("button", { name: "Arabic" }).click();
  await p.getByRole("button", { name: "Create booking" }).click();
  await p.waitForTimeout(900);

  const rpc = state.calls.find((c) => c.path === "rpc/admin_create_booking");
  ck("Create calls admin_create_booking", !!rpc, JSON.stringify(rpc?.body));
  ck(
    "…with the last night, not the check-out day",
    rpc?.body?.p_start === ymd(at(10)) && rpc?.body?.p_end === ymd(at(11)),
    `${rpc?.body?.p_start} → ${rpc?.body?.p_end}`,
  );
  ck(
    "…and the details as entered, tidied",
    rpc?.body?.p_status === "accepted" &&
      rpc?.body?.p_guest_email === "phone.guest@example.com" &&
      rpc?.body?.p_guests === 5 &&
      rpc?.body?.p_lang === "ar" &&
      rpc?.body?.p_notify_guest === true &&
      rpc?.body?.p_total === null &&
      rpc?.body?.p_admin_note === "Paid deposit by link",
    JSON.stringify(rpc?.body),
  );
  ck(
    "The form closes and says which booking it made",
    (await p.getByRole("dialog").count()) === 0 &&
      (await p
        .locator('[data-toast="success"]', { hasText: "Booking BZR-NEW001 created" })
        .isVisible()),
  );
  const added = p.locator("li", { hasText: "Phone Guest" });
  ck("The new booking is in the list straight away", await added.isVisible());
  ck("…marked as the admin's", (await added.innerText()).includes("Added by admin"));
  await ctx.close();
}

// ================================================== the calendar on a phone
{
  const state = makeState();
  const { p, ctx } = await adminPage(state, { phone: true });
  await p.getByRole("button", { name: "Availability & Pricing", exact: true }).click();
  await p.waitForTimeout(700);
  await toMonth(p, A_MONTH);
  ck(
    "The open tab is scrolled into view in the phone's tab strip",
    await p.evaluate(() => {
      const el = document.querySelector('nav [aria-current="true"]');
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.right <= window.innerWidth;
    }),
  );
  await p.locator(`[data-day="${ymd(at(5))}"]`).tap();
  await p.waitForTimeout(300);
  ck(
    "A tap selects that one day",
    (await p.locator('[data-day][aria-pressed="true"]').count()) === 1 &&
      (await p.locator(`[data-day="${ymd(at(5))}"]`).getAttribute("aria-pressed")) === "true",
  );
  ck(
    "The calendar does not scroll sideways",
    !(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)),
  );
  const bar = p.locator(".fixed.inset-x-0.bottom-0").filter({ hasText: "Unavailable" });
  ck("The main actions ride along at the foot of the screen", await bar.isVisible());
  await bar.getByRole("button", { name: "Unavailable" }).tap();
  await p.waitForTimeout(700);
  ck(
    "…and close the day from there",
    JSON.stringify(state.blocked) === JSON.stringify([ymd(at(5))]),
    JSON.stringify(state.blocked),
  );
  await ctx.close();
}

// ============================================ deciding from the overview
{
  const state = makeState();
  const { p, ctx } = await adminPage(state);
  await p.getByRole("button", { name: "Accept Omar Khalid" }).click();
  await p.waitForTimeout(700);
  const call = state.calls.find((c) => c.path === "rpc/set_booking_status");
  ck(
    "A pending request can be accepted from the overview",
    call?.body?.p_id === "b-2" && call?.body?.p_status === "accepted",
    JSON.stringify(call?.body),
  );
  ck(
    "…and the result is confirmed",
    await p
      .locator('[data-toast="success"]', { hasText: "BZR-BBB222 marked Accepted" })
      .isVisible(),
  );
  await ctx.close();
}

console.log("\n" + fails + " failing");
await b.close();
process.exit(fails ? 1 : 0);
