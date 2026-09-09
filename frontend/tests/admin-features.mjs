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
      {
        id: 1,
        slug: "b1",
        name_en: "Bizarri Chalet 1",
        name_ar: "شاليه بيزاري ١",
        active: true,
        sort_order: 1,
      },
      {
        id: 2,
        slug: "b2",
        name_en: "Bizarri Chalet 2",
        name_ar: "شاليه بيزاري ٢",
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
        start_date: "2026-10-06",
        end_date: "2026-10-09",
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
        start_date: "2026-11-01",
        end_date: "2026-11-04",
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
        id: 1,
        actor: "admin-1",
        actor_email: "admin@example.com",
        action: "booking.created",
        entity: "bookings",
        entity_id: "BZR-BBB222",
        detail: { chalet: 2, start: "2026-11-01", end: "2026-11-04", total: 350 },
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
        out.push({ day: iso, blocked, price: 75, custom: false });
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

async function adminPage(state) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
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
  // Chalet 1 has an accepted booking Oct 6-9; the panel defaults to the
  // current month, so page forward to October 2026 if needed.
  for (let i = 0; i < 3; i++) {
    const label = await p
      .locator("p.font-display.text-2xl")
      .first()
      .innerText()
      .catch(() => "");
    if (label.includes("October")) break;
    await p.getByRole("button", { name: /next month/i }).click();
    await p.waitForTimeout(300);
  }
  const day7 = p.locator(".grid.grid-cols-7 button", { hasText: "7" }).first();
  const title = await day7.getAttribute("title");
  ck(
    "A day inside an accepted booking is marked booked-by-guest",
    title === "Booked by a guest",
    title,
  );
  await day7.click();
  await p.waitForTimeout(300);
  ck(
    "Selecting a guest-booked day explains it instead of offering to block it",
    await p.getByText(/covered by an accepted booking/i).isVisible(),
  );
  await ctx.close();
}

console.log("\n" + fails + " failing");
await b.close();
process.exit(fails ? 1 : 0);
