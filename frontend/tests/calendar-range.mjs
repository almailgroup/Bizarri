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
const pageUrl = (r, lang = LANG) => (r ? `${B}${r}/${lang}` : `${B}${lang}`);
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

async function calendar(minStayDays, lang = LANG) {
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
  await p.goto(pageUrl("booking", lang), { waitUntil: "load" });
  await p.waitForTimeout(1400);
  // Next month, so every day in the grid is in the future.
  await p.getByRole("button", { name: lang === "ar" ? "الشهر التالي" : /Next month/i }).click();
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

/**
 * Click the nth selectable day that falls on a given weekday.
 *
 * Picking cells by index picks whatever the month happens to start on, which
 * stopped being harmless once Thu-Sat became a block: a test meaning to check
 * the minimum stay would select a Thursday and a Friday and get told about
 * weekends instead. Naming the weekday keeps each test on its own rule.
 */
const clickDay = (p, dow, nth = 0) =>
  p.evaluate(
    ([d, n]) => {
      const cells = [...document.querySelectorAll('[role="grid"] button:not([disabled])')];
      const want = cells.filter((b) => (b.getAttribute("aria-label") || "").startsWith(d));
      want[n]?.click();
      return want[n]?.getAttribute("aria-label") ?? null;
    },
    [dow, nth],
  );

// ====================================================== the quick picks
{
  const { p, ctx } = await calendar(1);
  const picks = await p.evaluate(() => {
    const head = [...document.querySelectorAll("p")].find((n) => /quick pick/i.test(n.textContent));
    const grid = head?.nextElementSibling;
    return [...(grid?.querySelectorAll("button") ?? [])].map((b) =>
      b.innerText.replace(/\n+/g, " | "),
    );
  });

  ck("Several stays are offered outright", picks.length >= 4, `${picks.length} offered`);
  ck(
    "…including tonight, now that one day is a booking",
    picks.some((t) => /tonight/i.test(t)),
    picks[0],
  );
  ck(
    "…and a weekend",
    picks.some((t) => /weekend/i.test(t)),
  );
  ck(
    "…and a full week",
    picks.some((t) => /full week/i.test(t)),
  );

  // "This weekend" does not say which Thursday, and that is what a guest is
  // checking before they tap.
  ck(
    "Every pick shows the dates it would book",
    picks.every((t) => /\d{1,2}\s+\w{3}/.test(t)),
    picks.find((t) => !/\d{1,2}\s+\w{3}/.test(t)) ?? "all do",
  );
  ck(
    "…and what it costs",
    picks.every((t) => /KD\s*\d/.test(t)),
    picks.find((t) => !/KD\s*\d/.test(t)) ?? "all do",
  );
  // A locale comma after the weekday reads wrong mid-range: "Thu 1 – Sat, 3 Oct".
  ck(
    "…without a comma stranded inside a range",
    !picks.some((t) => /–\s*\w{3},/.test(t)),
    picks.find((t) => /–\s*\w{3},/.test(t)) ?? "none",
  );

  // Tapping one has to land exactly the stay it advertised.
  const weekend = picks.findIndex((t) => /this weekend/i.test(t));
  const grid = p.locator('[role="grid"]');
  await p.evaluate((i) => {
    const head = [...document.querySelectorAll("p")].find((n) => /quick pick/i.test(n.textContent));
    head?.nextElementSibling?.querySelectorAll("button")[i].click();
  }, weekend);
  await p.waitForTimeout(700);
  ck("Tapping a pick selects that stay", await p.getByText("3 days selected").isVisible());
  ck("…and the calendar is showing it", await grid.isVisible());
  await ctx.close();
}

// The other spans on this page carry dir="ltr", because a "+" or a "@" beside
// digits is bidi-neutral and lands at the wrong end without it. A date range is
// not that: "الخميس ١ – السبت ٣ أكتوبر" is Arabic throughout, so it is one RTL
// run and a forced dir="ltr" does not reverse it today — it only declares a
// direction the content is not. It would bite the day one of those dates
// renders with a Latin month or Latin digits, which is exactly the change
// nobody would think to re-check. So this pins both: the span runs the way the
// page does, and the date the stay starts on is the one an Arabic reader meets
// first.
{
  const { p, ctx } = await calendar(1, "ar");

  const laidOut = await p.evaluate(() => {
    const head = [...document.querySelectorAll("p")].find((n) =>
      /اختيار سريع|سريع/.test(n.textContent || ""),
    );
    const grid = head?.nextElementSibling;
    for (const b of grid?.querySelectorAll("button") ?? []) {
      const span = [...b.querySelectorAll("span")].find((s) => s.textContent.includes("–"));
      if (!span) continue;
      const t = span.textContent;
      const i = t.indexOf("–");
      const at = (n) => {
        const r = document.createRange();
        r.setStart(span.firstChild, n);
        r.setEnd(span.firstChild, n + 1);
        return r.getBoundingClientRect().left;
      };
      return {
        dir: getComputedStyle(span).direction,
        first: at(0),
        last: at(t.length - 1),
        dash: at(i),
        text: t,
      };
    }
    return null;
  });

  ck("A quick pick on the Arabic page spans two dates", laidOut !== null, laidOut?.text);
  if (laidOut) {
    ck("…laid out right to left, like the page around it", laidOut.dir === "rtl", laidOut.dir);
    ck(
      "…so the date it starts on is the one read first",
      laidOut.first > laidOut.last,
      `start at ${Math.round(laidOut.first)}px, end at ${Math.round(laidOut.last)}px`,
    );
  }
  await ctx.close();
}

// ================================================= four ways to pick dates
{
  const { p, ctx } = await calendar(1);

  for (const [name, note] of [
    ["All dates", /Any nights/i],
    // Not just "one day": which days, because Thu–Sat is sold whole and a
    // guest who taps a Friday would otherwise find nothing happens.
    ["By day", /Sun\s*.\s*Wed\s*.\s*one day/i],
    ["Weekday", /Sun\s*.\s*Wed/i],
    ["Weekend", /Thu\s*.\s*Sat/i],
  ]) {
    const tab = p.getByRole("button", { name: new RegExp(`^${name}`, "i") }).first();
    ck(`"${name}" is offered`, await tab.isVisible());
    // A label alone does not tell a guest that "Weekend" means three days
    // from a Thursday, so each option carries what it actually gives you.
    ck(
      `…and says what it means`,
      note.test((await tab.textContent()) ?? ""),
      (await tab.textContent())?.replace(/\s+/g, " ").trim(),
    );
  }

  for (const [name, price] of [
    ["By day", /KD\s*75/],
    ["Weekday", /KD\s*300/],
    ["Weekend", /KD\s*350/],
  ]) {
    const tab = p.getByRole("button", { name: new RegExp(`^${name}`, "i") }).first();
    ck(`…and what "${name}" costs`, price.test((await tab.textContent()) ?? ""));
  }
  ck(
    "All dates quotes no single price, because it has none",
    !/KD/.test(
      (await p
        .getByRole("button", { name: /^All dates/i })
        .first()
        .textContent()) ?? "",
    ),
  );
  await ctx.close();
}

// ======================================= each shape picks its stay in one tap
for (const [name, days] of [
  ["By day", 1],
  ["Weekend", 3],
  ["Weekday", 4],
]) {
  const { p, ctx } = await calendar(1);
  await p
    .getByRole("button", { name: new RegExp(`^${name}`, "i") })
    .first()
    .click();
  await p.waitForTimeout(600);

  const free = p.locator('[role="grid"] button:not([disabled])');
  ck(
    `"${name}" leaves some days selectable`,
    (await free.count()) > 0,
    `${await free.count()} days`,
  );

  // One tap, not two: with a shape chosen, the guest should not have to know
  // which day a weekend starts on.
  await free.nth(1).click();
  await p.waitForTimeout(600);
  const label = days === 1 ? "1 day selected" : `${days} days selected`;
  ck(
    `…and one tap selects ${days === 1 ? "that day" : `all ${days} days`}`,
    await p.getByText(label).isVisible(),
    label,
  );
  await ctx.close();
}

// Switching shapes must not leave the previous pick behind.
{
  const { p, ctx, free } = await calendar(1);
  await free.nth(2).click();
  await p.waitForTimeout(250);
  await free.nth(5).click();
  await p.waitForTimeout(400);
  ck("A selection is made under All dates", await p.getByText(/days selected/i).isVisible());

  await p
    .getByRole("button", { name: /^Weekend/i })
    .first()
    .click();
  await p.waitForTimeout(500);
  ck(
    "Changing the shape clears it rather than keeping a stay of the wrong shape",
    (await p.getByText(/days selected|1 day selected/i).count()) === 0,
  );
  await ctx.close();
}

// ============================================ the chosen days are circles
{
  const { p, ctx, free } = await calendar(1);
  await free.nth(2).click();
  await p.waitForTimeout(250);
  await free.nth(6).click();
  await p.waitForTimeout(500);

  const shapes = await p.evaluate(() => {
    const read = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      // All four corners. Reading one of them called rounded-s-full a circle,
      // which is a pill with two square corners.
      const corners = [
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomLeftRadius",
        "borderBottomRightRadius",
      ].map((k) => Math.min(parseFloat(cs[k]) || 0, r.width / 2));
      return {
        w: Math.round(r.width),
        radius: Math.min(...corners),
        corners,
        bg: cs.backgroundColor,
        ring: cs.boxShadow,
      };
    };
    const cells = [...document.querySelectorAll('[role="grid"] button')];
    const chosen = cells.filter((c) => c.getAttribute("aria-pressed") === "true");
    // A day inside the stay: shaded, but not one of the two ends.
    const between = cells.find(
      (c) =>
        c.getAttribute("aria-pressed") !== "true" &&
        getComputedStyle(c).backgroundColor !== "rgba(0, 0, 0, 0)" &&
        !c.disabled,
    );
    return {
      chosen: chosen.map(read),
      between: between ? read(between) : null,
      // The page colour, to compare the cell against. An earlier version
      // looked the comparison colour up with a query that could miss, and
      // when it did the assertion passed on a solid black cell.
      page: getComputedStyle(document.body).backgroundColor,
    };
  });

  ck(
    "Both ends of the stay are marked",
    shapes.chosen.length === 2,
    `${shapes.chosen.length} marked`,
  );
  ck(
    "…and each is a circle",
    shapes.chosen.length > 0 && shapes.chosen.every((c) => c.radius >= c.w / 2 - 0.5),
    shapes.chosen
      .map((c) => `${c.w}px wide, corners ${c.corners.map((x) => x.toFixed(0)).join("/")}`)
      .join(" | "),
  );
  // An outline, not a fill: the number has to stay readable inside the mark.
  ck(
    "…drawn as an outline rather than filled in",
    shapes.chosen.every((c) => c.ring && c.ring !== "none"),
    shapes.chosen[0]?.ring?.slice(0, 40),
  );
  ck(
    "…over the page colour, not a solid block",
    !!shapes.page && shapes.chosen.every((c) => c.bg === shapes.page),
    `cell ${shapes.chosen[0]?.bg} vs page ${shapes.page}`,
  );

  // The days between stay square, or the run reads as separate marks rather
  // than one stay.
  ck(
    "The days between are not",
    !!shapes.between && shapes.between.radius < 4,
    shapes.between
      ? `corners ${shapes.between.corners.map((x) => x.toFixed(0)).join("/")}`
      : "no day between",
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

  // Sun and Mon: weekdays, so the only thing wrong with the range is that it
  // is two days long.
  await clickDay(p, "Sunday");
  await p.waitForTimeout(250);
  await clickDay(p, "Monday");
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
  await clickDay(p, "Sunday");
  await p.waitForTimeout(250);
  await clickDay(p, "Tuesday");
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

// ============================== the weekend is one product
//
// Sun-Wed is sold by the day. Thu-Sat is not: it is one three-day stay, so the
// calendar must not let a guest ask for part of it. request_booking() refuses
// such a range anyway -- this is about finding that out before filling a form,
// not instead of the server saying so.
{
  const { p, ctx } = await calendar(1);

  const byDay = await p.getByRole("button", { name: /^By day/i }).first();
  await byDay.click();
  await p.waitForTimeout(500);

  const offered = await p.evaluate(() =>
    [...document.querySelectorAll('[role="grid"] button:not([disabled])')].map((b) =>
      (b.getAttribute("aria-label") || "").split(",")[0].trim(),
    ),
  );
  ck("Single days are still offered", offered.length > 10, `${offered.length} days`);
  ck(
    "…but never a Thursday, Friday or Saturday",
    !offered.some((d) => ["Thursday", "Friday", "Saturday"].includes(d)),
    [...new Set(offered)].join(", "),
  );

  // The weekend filter still offers the whole thing.
  await p
    .getByRole("button", { name: /^Weekend/i })
    .first()
    .click();
  await p.waitForTimeout(500);
  const wknd = await p.evaluate(() =>
    [...document.querySelectorAll('[role="grid"] button:not([disabled])')].map((b) =>
      (b.getAttribute("aria-label") || "").split(",")[0].trim(),
    ),
  );
  ck(
    "The weekend shape offers exactly the weekend days",
    wknd.length > 0 && wknd.every((d) => ["Thursday", "Friday", "Saturday"].includes(d)),
    [...new Set(wknd)].join(", "),
  );
  await ctx.close();
}

// Under "All dates" the guest draws the range themselves, which is the one
// place half a weekend can be asked for.
{
  const { p, ctx } = await calendar(1);

  ck(
    "The rule is stated before it is broken",
    await p.getByText(/Thursday to Saturday, all three days/i).isVisible(),
  );

  // Thursday to Friday: reaches a weekend and stops before its Saturday.
  await clickDay(p, "Thursday");
  await p.waitForTimeout(300);
  await clickDay(p, "Friday");
  await p.waitForTimeout(500);
  ck(
    "Half a weekend is refused",
    await p
      .getByText(/Thursday to Saturday/i)
      .first()
      .isVisible(),
  );
  ck(
    "…and cannot be carried forward",
    !(await p.getByRole("button", { name: /^Continue$/i }).isEnabled()),
  );

  // Taking the whole thing instead. A tap with both ends already set starts a
  // fresh selection rather than extending it, so this is the Thursday again
  // and then its Saturday.
  await clickDay(p, "Thursday");
  await p.waitForTimeout(300);
  await clickDay(p, "Saturday");
  await p.waitForTimeout(500);
  ck("Taking the whole weekend is accepted", await p.getByText("3 days selected").isVisible());
  ck(
    "…and can be carried forward",
    await p.getByRole("button", { name: /^Continue$/i }).isEnabled(),
  );
  await ctx.close();
}

// A quick pick that led to a refusal would not be a shortcut.
{
  const { p, ctx } = await calendar(1);
  const picks = await p.evaluate(() => {
    const head = [...document.querySelectorAll("p")].find((n) => /quick pick/i.test(n.textContent));
    return [...(head?.nextElementSibling?.querySelectorAll("button") ?? [])].map((b) =>
      b.innerText.replace(/\n+/g, " "),
    );
  });
  // Tonight and Tomorrow are single days, so they may only appear when that
  // day is Sun-Wed. Whichever are shown, every one of them has to be bookable.
  const single = picks.filter((t) => /tonight|tomorrow/i.test(t));
  const weekendish = single.filter((t) => /Thu|Fri|Sat/.test(t));
  ck(
    "No one-day shortcut lands on a weekend",
    weekendish.length === 0,
    weekendish.join(" | ") || `${single.length} single-day picks, none on a weekend`,
  );
  await ctx.close();
}

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
