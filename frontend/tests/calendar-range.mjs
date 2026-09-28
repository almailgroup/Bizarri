/**
 * Choosing dates: the length of the stay, and the minimum the server sets.
 *
 * The minimum used to be a constant in the client as well as a column in the
 * database, so changing it needed two edits and the two could disagree. These
 * drive the UI with different values coming back from the server and check the
 * client follows, rather than checking a number the client made up.
 */
import { chromium } from "playwright";

const B = "http://localhost:4173/";
const LANG = "en";
const pageUrl = (r) => (r ? `${B}${r}/${LANG}` : `${B}${LANG}`);
const SUPA = /ycfvqzcnatwacwlcmiej\.supabase\.co/;

let fails = 0;
const ck = (n, c, d = "") => {
  if (!c) fails++;
  console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`);
};

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = new Date();
today.setHours(0, 0, 0, 0);

const b = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
    : {},
);

async function calendar(minStayDays) {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 1000 } });
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
          name_ar: "ش",
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
        min_stay_days: minStayDays,
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
  // Next month, so every day in the grid is in the future.
  await p.getByRole("button", { name: /Next month/i }).click();
  await p.waitForTimeout(400);
  return { p, ctx, free: p.locator('[role="grid"] button:not([disabled])') };
}

// ======================================================= one day is a stay
{
  const { p, ctx, free } = await calendar(1);

  ck(
    "Nothing is claimed about length before a day is picked",
    (await p.getByText(/days selected/i).count()) === 0,
  );

  await free.nth(3).click();
  await p.waitForTimeout(400);
  ck("Tapping one day already counts as a day", await p.getByText("1 day selected").isVisible());

  // The same day again closes a one-day stay.
  await free.nth(3).click();
  await p.waitForTimeout(400);
  ck("…and it can be booked", await p.getByRole("button", { name: /^Continue$/i }).isEnabled());
  ck("No minimum-stay complaint at one day", (await p.getByText(/Minimum stay/i).count()) === 0);
  await ctx.close();
}

// ================================================ the count, in the calendar
{
  const { p, ctx, free } = await calendar(1);
  await free.nth(2).click();
  await p.waitForTimeout(300);

  // Before a second tap, the pointer stands in for it — so the length can be
  // seen before committing to it.
  await free.nth(5).hover();
  await p.waitForTimeout(400);
  ck(
    "Hovering previews the length before the tap",
    await p.getByText("4 days selected").isVisible(),
  );

  await free.nth(5).click();
  await p.waitForTimeout(400);
  ck("…and tapping keeps it", await p.getByText("4 days selected").isVisible());

  // It has to be beside the grid, not in a summary further down the page:
  // that is the whole point of the change.
  const near = await p.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    const label = [...document.querySelectorAll("p")].find((n) =>
      /days selected/i.test(n.textContent || ""),
    );
    if (!grid || !label) return null;
    return Math.round(label.getBoundingClientRect().top - grid.getBoundingClientRect().bottom);
  });
  ck(
    "The count sits against the calendar",
    near !== null && near >= 0 && near < 120,
    `${near}px below the grid`,
  );

  const range = await p.evaluate(() => {
    const el = [...document.querySelectorAll("p")].find((n) =>
      /\d{4}-\d{2}-\d{2} →/.test(n.textContent || ""),
    );
    return el?.textContent.trim() ?? null;
  });
  ck(
    "…and names the two dates it spans",
    /\d{4}-\d{2}-\d{2} → \d{4}-\d{2}-\d{2}/.test(range ?? ""),
    range,
  );
  await ctx.close();
}

// ================================= the minimum is the server's, not the code's
{
  const { p, ctx, free } = await calendar(3);
  ck(
    "A minimum above one is stated up front",
    await p.getByText(/Minimum stay 3 days/i).isVisible(),
  );

  await free.nth(2).click();
  await p.waitForTimeout(250);
  await free.nth(3).click();
  await p.waitForTimeout(400);
  ck(
    "Two days under a three-day minimum is refused",
    await p
      .getByText(/Minimum stay is 3 days/i)
      .first()
      .isVisible(),
  );
  ck(
    "…and cannot be carried forward",
    await p.getByRole("button", { name: /^Continue$/i }).isDisabled(),
  );

  // A third tap starts a fresh selection rather than extending the old one,
  // so this picks the range again rather than adding a day to it.
  await free.nth(2).click();
  await p.waitForTimeout(250);
  await free.nth(4).click();
  await p.waitForTimeout(400);
  ck("…while three days is accepted", await p.getByText("3 days selected").isVisible());
  ck("…and clears the complaint", (await p.getByText(/Minimum stay is 3 days/i).count()) === 0);
  ck(
    "…and can be carried forward",
    await p.getByRole("button", { name: /^Continue$/i }).isEnabled(),
  );
  await ctx.close();
}

{
  const { p, ctx } = await calendar(1);
  // A minimum of one is no minimum; saying so is noise.
  ck("A minimum of one is not announced", (await p.getByText(/Minimum stay/i).count()) === 0);
  await ctx.close();
}

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
