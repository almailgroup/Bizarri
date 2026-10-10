/**
 * The booking flow, driven without a pointer.
 *
 * A date grid is the classic component that works perfectly with a mouse and
 * is unusable without one: every day its own tab stop, arrows dead, and the
 * month silently changing underneath a screen reader.
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

async function page() {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => {
    const u = r.request().url();
    if (/fonts\.(googleapis|gstatic)/.test(u)) return r.continue();
    if (!SUPA.test(u)) return r.abort();
    const path = new URL(u).pathname.replace("/rest/v1/", "");
    let body = null;
    try {
      body = r.request().postDataJSON?.() ?? null;
    } catch {
      body = null;
    }
    const send = (d) =>
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
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
  await p.goto(pageUrl("booking"), { waitUntil: "load" });
  await p.waitForTimeout(1400);
  return { p, ctx };
}

const focused = (p) =>
  p.evaluate(() => {
    const el = document.activeElement;
    return el?.getAttribute("aria-label") || el?.textContent?.trim().slice(0, 40) || "(none)";
  });

// ========================================= the grid is one stop, not thirty
{
  const { p, ctx } = await page();

  const cells = await p.locator('[role="grid"] button').count();
  const tabbable = await p.evaluate(
    () =>
      [...document.querySelectorAll('[role="grid"] button')].filter(
        (x) => !x.disabled && x.tabIndex >= 0,
      ).length,
  );
  ck("The month renders a full grid of days", cells > 25, `${cells} cells`);
  ck(
    "…but the whole grid is a single tab stop",
    tabbable === 1,
    `${tabbable} of ${cells} reachable by Tab`,
  );

  ck(
    "The grid is announced as a grid, labelled by its month",
    (await p.locator('[role="grid"]').getAttribute("aria-label"))?.length > 3,
    await p.locator('[role="grid"]').getAttribute("aria-label"),
  );

  // Tab must pass through the calendar, not get stuck inside it.
  //
  // 30 stops, not 20: the shortcuts and the date filter above the grid are ten
  // buttons on their own, and the header another eight, so a smaller budget
  // fails on the way down rather than on anything the grid does. The claim
  // being tested is the day count below -- one stop for the whole month --
  // and that is what shrinks the walk.
  const seen = [];
  for (let i = 0; i < 30; i++) {
    await p.keyboard.press("Tab");
    seen.push(await focused(p));
  }
  const dayStops = seen.filter((l) => /^\w+day, /.test(l)).length;
  ck(
    "Tabbing does not have to cross every day",
    dayStops <= 1,
    `${dayStops} day stops in ${seen.length} tabs`,
  );
  ck(
    "Tab reaches the controls past the calendar",
    seen.some((l) => /clear|continue/i.test(l)),
    seen.slice(-4).join(" | "),
  );
  await ctx.close();
}

// ================================================ arrows move within the grid
{
  const { p, ctx } = await page();
  await p
    .locator('[role="grid"] button:not([disabled]):not([aria-disabled="true"])')
    .first()
    .focus();
  // By the date on the focused cell, and by how far it moved: "focus
  // changed" passed for a whole month while the first arrow went the wrong
  // way, because it moved from today rather than from the focused day.
  const day = () => p.evaluate(() => document.activeElement?.getAttribute("data-day"));
  const plus = (iso, n) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const start = await day();

  await p.keyboard.press("ArrowRight");
  const right = await day();
  ck("ArrowRight moves to the next day", right === plus(start, 1), `${start} → ${right}`);

  await p.keyboard.press("ArrowDown");
  const down = await day();
  ck("ArrowDown moves a week on", down === plus(right, 7), `${right} → ${down}`);

  await p.keyboard.press("ArrowLeft");
  const left = await day();
  ck("ArrowLeft moves back a day", left === plus(down, -1), `${down} → ${left}`);

  // Paging past the end of the month should follow, not dead-end.
  const monthBefore = await p.locator('[role="grid"]').getAttribute("aria-label");
  for (let i = 0; i < 6; i++) await p.keyboard.press("PageDown");
  const monthAfter = await p.locator('[role="grid"]').getAttribute("aria-label");
  ck(
    "Paging forward carries the grid into later months",
    monthBefore !== monthAfter,
    `${monthBefore} → ${monthAfter}`,
  );
  ck("…and focus stays on a day", /day, /i.test(await focused(p)), await focused(p));
  await ctx.close();
}

// ================================= a whole booking without touching a mouse
{
  const { p, ctx } = await page();
  await p
    .locator('[role="grid"] button:not([disabled]):not([aria-disabled="true"])')
    .first()
    .focus();

  // One press takes the whole stay: a day belongs to a shape, and choosing it
  // chooses the shape's whole window rather than one end of a range.
  await p.keyboard.press("Enter");
  await p.waitForTimeout(400);

  const checkIn = await p.locator("text=Check-in").locator("..").innerText();
  const checkOut = await p.locator("text=Check-out").locator("..").innerText();
  ck(
    "Keyboard alone selects a stay",
    !checkIn.includes("—") && !checkOut.includes("—"),
    `${checkIn.trim()} / ${checkOut.trim()}`,
  );

  const announced = await p.locator('[aria-live="polite"].sr-only').innerText();
  ck(
    "The chosen stay is announced, not just drawn",
    /\d{4}-\d{2}-\d{2}/.test(announced),
    announced.trim(),
  );
  ck("…including the price", /KD|د\.ك/.test(announced), announced.trim());
  await ctx.close();
}

// ============================ a shape too short to book is not offered
//
// This used to select two days under a three-day minimum and check that the
// refusal was announced. There is no longer a way to ask for one: every shape
// on offer is at least as long as the minimum, so the refusal it tested
// cannot be reached from the calendar. Better than announcing a refusal is
// not making the offer.
{
  const { p, ctx } = await page();
  const offered = await p.evaluate(() =>
    [...document.querySelectorAll('[role="group"] button[aria-pressed]')].map((b) =>
      b.innerText.split("\n")[0].trim(),
    ),
  );
  ck("Some way to choose a stay is offered", offered.length > 0, offered.join(", "));
  // The mock sets a three-day minimum, so the one-day shape must be gone.
  ck(
    "…and never one shorter than the minimum stay",
    !offered.some((t) => /^By day$/i.test(t)),
    offered.join(", "),
  );
  ck(
    "Choosing one lands a stay that can be carried forward",
    await (async () => {
      await p
        .locator('[role="grid"] button:not([disabled]):not([aria-disabled="true"])')
        .first()
        .click();
      await p.waitForTimeout(400);
      return p.getByRole("button", { name: /^Continue$/i }).isEnabled();
    })(),
  );
  await ctx.close();
}

// ============================================ focus is visible where it lands
{
  const { p, ctx } = await page();
  const ring = async (loc) => {
    await loc.focus();
    return loc.evaluate((el) => {
      const s = getComputedStyle(el);
      return { w: s.outlineWidth, style: s.outlineStyle };
    });
  };
  const day = await ring(
    p.locator('[role="grid"] button:not([disabled]):not([aria-disabled="true"])').first(),
  );
  ck(
    "A focused day shows a visible ring",
    day.style !== "none" && parseFloat(day.w) >= 1,
    JSON.stringify(day),
  );
  const nav = await ring(p.getByRole("link", { name: /your reservation/i }).first());
  ck(
    "Header links show one too",
    nav.style !== "none" && parseFloat(nav.w) >= 1,
    JSON.stringify(nav),
  );
  await ctx.close();
}

// ============================================ the dashboard on a phone
{
  const session = () => ({
    access_token: "t",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "r",
    user: {
      id: "a1",
      aud: "authenticated",
      role: "authenticated",
      email: "admin@example.com",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  });
  const bookings = [
    {
      id: "b-1",
      ref: "BZR-AAA111",
      chalet_id: 1,
      start_date: "2026-11-05",
      end_date: "2026-11-07",
      days: 3,
      total: 350,
      currency: "KWD",
      package_key: "weekend",
      guest_name: "Aisha Al-Sabah",
      guest_phone: "+96594040955",
      guest_email: "aisha@example.com",
      guests: 4,
      notes: "Late check-in",
      admin_note: null,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: "",
      decided_at: null,
      decided_by: null,
      civil_id_path: "ids/a.jpg",
      terms_accepted_at: new Date().toISOString(),
    },
  ];

  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => {
    const u = r.request().url();
    if (/fonts\.(googleapis|gstatic)/.test(u)) return r.continue();
    if (!SUPA.test(u)) return r.abort();
    const path = new URL(u).pathname.replace("/rest/v1/", "").replace("/auth/v1/", "auth:");
    const send = (d) =>
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
    if (path.startsWith("auth:token")) return send(session());
    if (path.startsWith("auth:user")) return send(session().user);
    if (path === "rpc/is_admin") return send(true);
    if (path === "bookings") return send(bookings);
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
    return send([]);
  });
  await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
  const p = await ctx.newPage();
  await p.goto(pageUrl("admin"), { waitUntil: "load" });
  await p.waitForTimeout(700);
  await p.locator("input[type=email]").fill("admin@example.com");
  await p.locator("input[type=password]").fill("pw");
  await p.getByRole("button", { name: /^Login$/i }).click();
  await p.waitForTimeout(1200);

  const overflows = () =>
    p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ck("The dashboard does not scroll sideways on a phone", !(await overflows()));

  await p.getByRole("button", { name: /Booking Requests/i }).click();
  await p.waitForTimeout(700);
  ck("…nor does the request list", !(await overflows()));

  // Two thresholds, because they are two different problems. WCAG 2.5.8 sets
  // the floor at 24x24 for anything clickable. Icon-only controls get held to
  // 40px as well: they carry no text to widen the target, and here they are
  // the buttons that approve and delete a booking.
  const targets = await p.evaluate(() =>
    [...document.querySelectorAll("button")]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 22),
          w: Math.round(r.width),
          h: Math.round(r.height),
          iconOnly: !el.textContent?.trim(),
        };
      })
      .filter((t) => t.w > 0 && t.h > 0),
  );
  const belowFloor = targets.filter((t) => t.h < 24 || t.w < 24);
  ck(
    "No button is below the 24px floor",
    belowFloor.length === 0,
    belowFloor.map((t) => `${t.label} ${t.w}x${t.h}`).join(", "),
  );
  const smallIcons = targets.filter((t) => t.iconOnly && (t.h < 40 || t.w < 40));
  ck(
    "Icon-only controls are thumb-sized",
    smallIcons.length === 0,
    smallIcons.map((t) => `${t.label} ${t.w}x${t.h}`).join(", "),
  );

  await p
    .getByRole("button", { name: /edit details/i })
    .first()
    .click();
  // Wait out the entry animation: mid-animation the panel is still
  // translucent, which looks exactly like a missing backdrop.
  await p.waitForTimeout(1600);
  ck("The edit modal opens without breaking the layout", !(await overflows()));
  const panel = await p.getByRole("dialog").boundingBox();
  ck("…and fits the screen", panel.width <= 390 && panel.x >= 0, JSON.stringify(panel));
  const opaque = await p.getByRole("dialog").evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, opacity: s.opacity };
  });
  ck(
    "…over a solid panel, not the page showing through",
    opaque.opacity === "1" && !/rgba\(0, 0, 0, 0\)/.test(opaque.bg),
    JSON.stringify(opaque),
  );
  await ctx.close();
}

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
