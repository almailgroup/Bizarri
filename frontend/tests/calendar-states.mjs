/**
 * The guest calendar's three ways a day can be spoken for.
 *
 *   selected  the guest's own choice      white, with a ring
 *   pending   another guest's request     grey, cannot be chosen
 *   reserved  confirmed by the admin      black, cannot be chosen
 *
 * Colours are read from the rendered page, not from class names: a class that
 * stopped being generated would still read correctly in className.
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
const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const today = new Date();
today.setHours(0, 0, 0, 0);
// The first Sunday of next month whose fortnight stays in that month, so the
// calendar shows all of it on one page.
const sun = (() => {
  const d = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  return d;
})();
const mon = add(sun, 1);
const tue = add(sun, 2);
const wed = add(sun, 3);
const sun2 = add(sun, 7);
const mon2 = add(sun, 8);
const tue2 = add(sun, 9);

async function page(state, { clock = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => {
    const u = r.request().url();
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
      state.calendarCalls++;
      const out = [];
      const d = new Date(body.p_from + "T00:00:00");
      const e = new Date(body.p_to + "T00:00:00");
      for (; d <= e; d.setDate(d.getDate() + 1)) {
        const k = iso(d);
        const past = k < iso(today);
        const reserved = state.reserved.includes(k);
        const pending = state.pending.includes(k);
        // As the database reports it: pending days are blocked too.
        out.push({
          day: k,
          blocked: past || reserved || pending,
          pending: pending && !past && !reserved,
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
  if (clock) await p.clock.install();
  await p.goto(`${B}booking/en`, { waitUntil: "load" });
  await p.waitForTimeout(1200);
  for (let i = 0; i < 4; i++) {
    if (await p.locator(`[data-day="${iso(sun)}"]`).count()) break;
    await p.getByRole("button", { name: /Next month/i }).click();
    await p.waitForTimeout(300);
  }
  return { p, ctx };
}

const cell = (p, d) => p.locator(`[data-day="${iso(d)}"]`);
const look = (p, d) =>
  cell(p, d).evaluate((el) => {
    const s = getComputedStyle(el);
    const c = document.createElement("canvas").getContext("2d");
    c.fillStyle = "#fff";
    c.fillRect(0, 0, 1, 1);
    c.fillStyle = s.backgroundColor;
    c.fillRect(0, 0, 1, 1);
    const [r, g, bl] = c.getImageData(0, 0, 1, 1).data;
    return {
      lum: Math.round(((0.2126 * r + 0.7152 * g + 0.0722 * bl) / 255) * 1000) / 1000,
      bg: s.backgroundColor,
      ring: s.boxShadow !== "none",
      disabled: el.disabled,
      label: el.getAttribute("aria-label"),
      state: el.dataset.state,
    };
  });
const shape = async (p, name) => {
  await p
    .getByRole("button", { name: new RegExp(`^${name}`, "i") })
    .first()
    .click();
  await p.waitForTimeout(350);
};

// ====================================================== how each one looks
{
  const state = { pending: [iso(mon), iso(tue)], reserved: [iso(wed)], calendarCalls: 0 };
  const { p, ctx } = await page(state);

  const pend = await look(p, mon);
  ck(
    "A day awaiting approval is grey",
    pend.lum > 0.8 && pend.lum < 0.97 && pend.state === "pending",
    JSON.stringify(pend),
  );
  ck("…and cannot be chosen", pend.disabled === true);
  ck("…and says why, to a screen reader", /Awaiting approval/.test(pend.label ?? ""), pend.label);

  const res = await look(p, wed);
  ck("A reserved day is black", res.lum < 0.1 && res.state === "reserved", JSON.stringify(res));
  ck("…and cannot be chosen", res.disabled === true);
  ck("…and is not called pending", !/Awaiting approval/.test(res.label ?? ""), res.label);

  // "By day": a single weekday.
  await shape(p, "By day");
  await cell(p, tue).click({ force: true });
  await p.waitForTimeout(300);
  ck(
    "Clicking a pending day selects nothing",
    (await p.locator('[data-day][data-state="selected"]').count()) === 0,
  );
  await cell(p, mon2).click();
  await p.waitForTimeout(300);
  const sel = await look(p, mon2);
  ck(
    "The guest's own selection is white, not grey",
    sel.lum > 0.99 && sel.state === "selected" && sel.ring,
    JSON.stringify(sel),
  );

  // Sun-Wed: the week with the pending days has no stay on offer; the next does.
  await shape(p, "Weekday");
  const offered = {
    ...(await look(p, sun)),
    ariaDisabled: await cell(p, sun).getAttribute("aria-disabled"),
    pressed: await p
      .getByRole("button", { name: /^Weekday/i })
      .first()
      .getAttribute("aria-pressed"),
  };
  // Off-shape days stay focusable for the arrow keys (aria-disabled, not
  // disabled) and do nothing when pressed.
  await cell(p, sun).click({ force: true });
  await p.waitForTimeout(300);
  ck(
    "A package that would take in a pending day is not offered",
    offered.ariaDisabled === "true" &&
      offered.pressed === "true" &&
      (await p.locator('[data-day][data-state="selected"]').count()) === 0,
    JSON.stringify(offered),
  );
  await cell(p, sun2).click();
  await p.waitForTimeout(300);
  const ends = [await look(p, sun2), await look(p, add(sun2, 3))];
  const between = [await look(p, mon2), await look(p, tue2)];
  ck(
    "A whole stay is white from end to end",
    [...ends, ...between].every((s) => s.lum > 0.99 && s.state === "selected" && s.ring),
    JSON.stringify([...ends, ...between].map((s) => s.lum)),
  );
  ck(
    "…with its two ends marked more strongly than the days between",
    (await cell(p, sun2).getAttribute("aria-pressed")) === "true" &&
      (await cell(p, mon2).getAttribute("aria-pressed")) === "false",
  );

  const legend = await p.locator("main").innerText();
  ck(
    "The key names all three: reserved, awaiting approval, selected",
    /Reserved/.test(legend) && /Awaiting approval/.test(legend) && /Selected/.test(legend),
  );
  ck("…and no longer a grey 'In stay'", !/In stay/.test(legend));

  // Hovering a free day must not paint it grey: grey means awaiting approval.
  await cell(p, add(sun2, 14)).hover();
  await p.waitForTimeout(250);
  const hovered = await look(p, add(sun2, 14));
  ck("Hovering a free day does not turn it grey", hovered.lum > 0.99, JSON.stringify(hovered));
  await ctx.close();
}

// ================================ taken while the guest was looking at it
{
  const state = { pending: [], reserved: [], calendarCalls: 0 };
  const { p, ctx } = await page(state, { clock: true });
  await shape(p, "By day");
  await cell(p, mon2).click();
  await p.waitForTimeout(300);
  ck("A free day is selected", (await look(p, mon2)).state === "selected");

  // Somebody else asks for it; the page asks the server again on its own.
  state.pending = [iso(mon2)];
  const before = state.calendarCalls;
  await p.clock.fastForward(61_000);
  await p.waitForTimeout(1200);
  ck(
    "The calendar is asked again within a minute",
    state.calendarCalls > before,
    `${state.calendarCalls} calls`,
  );
  const now = await look(p, mon2);
  ck(
    "The day now shows as awaiting approval",
    now.state === "pending" && now.lum < 0.97,
    JSON.stringify(now),
  );
  ck(
    "…the selection is let go",
    (await p.locator('[data-day][data-state="selected"]').count()) === 0,
  );
  ck(
    "…and the guest is told why",
    await p
      .getByText(/just been requested by someone else/i)
      .first()
      .isVisible(),
  );

  // The admin rejects it: the day comes back.
  state.pending = [];
  await p.clock.fastForward(61_000);
  await p.waitForTimeout(1200);
  ck("Once declined, the day is free again", (await look(p, mon2)).state === "free");

  // The admin confirms someone else's stay: black.
  state.reserved = [iso(mon2)];
  await p.clock.fastForward(61_000);
  await p.waitForTimeout(1200);
  ck("Once confirmed, it turns black", (await look(p, mon2)).state === "reserved");
  await ctx.close();
}

console.log(`\n${fails} failing`);
await b.close();
process.exit(fails ? 1 : 0);
