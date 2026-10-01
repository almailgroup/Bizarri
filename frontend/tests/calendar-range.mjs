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

/**
 * A special occasion the admin has entered, placed on a Thu-Sat so it does
 * not fall foul of the weekend rule, and far enough out to be bookable.
 */
const eid = (() => {
  const from = new Date(today);
  while (from.getDay() !== 4) from.setDate(from.getDate() + 1);
  from.setDate(from.getDate() + 14);
  const to = new Date(from);
  to.setDate(to.getDate() + 2);
  return { from, to };
})();

async function calendar(minStayDays, lang = LANG, occasions = []) {
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
    if (path === "special_occasions") return send(occasions);
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
  return {
    p,
    ctx,
    free: p.locator('[role="grid"] button:not([disabled]):not([aria-disabled="true"])'),
  };
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
      const cells = [
        ...document.querySelectorAll(
          '[role="grid"] button:not([disabled]):not([aria-disabled="true"])',
        ),
      ];
      const want = cells.filter((b) => (b.getAttribute("aria-label") || "").startsWith(d));
      want[n]?.click();
      return want[n]?.getAttribute("aria-label") ?? null;
    },
    [dow, nth],
  );

// ================================================ the count, in the calendar
{
  const { p, ctx } = await calendar(1);
  // Weekday: Sun-Wed, four days, in one tap. There is no hover preview to
  // test any more -- the pointer used to stand in for a second tap that no
  // longer exists, because choosing a day now chooses its whole stay.
  await p
    .getByRole("button", { name: /^Weekday/i })
    .first()
    .click();
  await p.waitForTimeout(400);
  await clickDay(p, "Sunday");
  await p.waitForTimeout(400);
  ck("One tap counts the whole stay", await p.getByText("4 days selected").isVisible());

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

// ============================ the shapes carry what the shortcuts used to
//
// The quick picks above the calendar are gone. What they did -- name a stay,
// say when it is and what it costs, and land it in one tap -- is what the
// three shape cards do now, so this is the same promise tested where it lives.
{
  const { p, ctx } = await calendar(1);

  const cards = await p.evaluate(() =>
    [...document.querySelectorAll('[role="group"] button[aria-pressed]')].map((b) =>
      b.innerText.replace(/\n+/g, " | "),
    ),
  );
  ck("Every way to book is offered at once", cards.length === 3, cards.join(" / "));
  ck(
    "Each says which days it means",
    cards.every((t) => /Sun|Thu/.test(t)),
    cards.find((t) => !/Sun|Thu/.test(t)) ?? "all do",
  );
  // The cards carry no price: the rates strip above them does, and repeating
  // it three times made the row of choices read as a price list.
  ck(
    "…and none of them quotes a price",
    cards.every((t) => !/KD\s*\d|\d+\s*د\.ك/.test(t)),
    cards.find((t) => /KD\s*\d/.test(t)) ?? "none do",
  );

  // And one tap on a highlighted day lands the whole stay it advertised.
  await p
    .getByRole("button", { name: /^Weekend/i })
    .first()
    .click();
  await p.waitForTimeout(400);
  await clickDay(p, "Thursday");
  await p.waitForTimeout(500);
  ck("One tap lands the stay it advertised", await p.getByText("3 days selected").isVisible());
  ck("…and the calendar is showing it", await p.locator('[role="grid"]').isVisible());
  await ctx.close();
}

// ================================================= three ways to pick dates
{
  const { p, ctx } = await calendar(1);

  for (const [name, note] of [
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

  // The prices live in the rates strip above the shapes, once each, rather
  // than on every card.
  const strip = await p.evaluate(() => document.body.innerText);
  for (const price of [/KD\s*300/, /KD\s*350/]) {
    ck(`The page still quotes ${String(price)}`, price.test(strip));
  }
  ck(
    "…but not on the shape cards themselves",
    (await p.evaluate(() =>
      [...document.querySelectorAll('[role="group"] button[aria-pressed]')].every(
        (b) => !/KD\s*\d/.test(b.innerText),
      ),
    )) === true,
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

  const free = p.locator('[role="grid"] button:not([disabled]):not([aria-disabled="true"])');
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
  const { p, ctx } = await calendar(1);
  await p
    .getByRole("button", { name: /^Weekday/i })
    .first()
    .click();
  await p.waitForTimeout(400);
  await clickDay(p, "Sunday");
  await p.waitForTimeout(400);
  ck("A stay is selected", await p.getByText(/days selected/i).isVisible());

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
  // Weekday: Sun-Wed, so there are days between the two ends to check.
  const { p, ctx } = await calendar(1);
  await p
    .getByRole("button", { name: /^Weekday/i })
    .first()
    .click();
  await p.waitForTimeout(400);
  await clickDay(p, "Sunday");
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
//
// The minimum used to be something to bump into: pick two days under a
// three-day minimum and be told. There is no way to pick two days now, so it
// decides what is on offer instead -- a shape shorter than the minimum is not
// shown at all, which is the same rule enforced a step earlier.
{
  const { p, ctx } = await calendar(3);
  ck(
    "A minimum above one is stated up front",
    await p.getByText(/Minimum stay 3 days/i).isVisible(),
  );

  const offered = await p.evaluate(() =>
    [...document.querySelectorAll('[role="group"] button[aria-pressed]')].map((b) =>
      b.innerText.split("\n")[0].trim(),
    ),
  );
  ck("Ways to book are still offered", offered.length > 0, offered.join(", "));
  ck(
    "…but not the one-day shape, which the server would refuse",
    !offered.some((t) => /^By day$/i.test(t)),
    offered.join(", "),
  );

  // And what is offered is bookable: no shape leads to the complaint.
  await p
    .getByRole("button", { name: /^Weekend/i })
    .first()
    .click();
  await p.waitForTimeout(400);
  await clickDay(p, "Thursday");
  await p.waitForTimeout(500);
  ck("Choosing one lands a stay", await p.getByText("3 days selected").isVisible());
  ck(
    "…with no minimum-stay complaint",
    (await p.getByText(/Minimum stay is 3 days/i).count()) === 0,
  );
  ck(
    "…and it can be carried forward",
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
    [
      ...document.querySelectorAll(
        '[role="grid"] button:not([disabled]):not([aria-disabled="true"])',
      ),
    ].map((b) => (b.getAttribute("aria-label") || "").split(",")[0].trim()),
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
    [
      ...document.querySelectorAll(
        '[role="grid"] button:not([disabled]):not([aria-disabled="true"])',
      ),
    ].map((b) => (b.getAttribute("aria-label") || "").split(",")[0].trim()),
  );
  ck(
    "The weekend shape offers exactly the weekend days",
    wknd.length > 0 && wknd.every((d) => ["Thursday", "Friday", "Saturday"].includes(d)),
    [...new Set(wknd)].join(", "),
  );
  await ctx.close();
}

// ==================== half a weekend cannot be asked for at all
//
// This used to draw Thursday to Friday by hand and check the refusal. There
// is no longer a way to draw it: a stay is a shape, and no shape is part of a
// weekend, so the rule is enforced by what is on offer rather than by turning
// someone away afterwards.
{
  const { p, ctx } = await calendar(1);
  await p
    .getByRole("button", { name: /^Weekend/i })
    .first()
    .click();
  await p.waitForTimeout(400);

  // Tapping the Thursday takes the Saturday with it, every time.
  await clickDay(p, "Thursday");
  await p.waitForTimeout(500);
  ck("A weekend comes whole", await p.getByText("3 days selected").isVisible());
  ck(
    "…and can be carried forward",
    await p.getByRole("button", { name: /^Continue$/i }).isEnabled(),
  );

  // Tapping its Friday selects the same three days rather than starting a
  // shorter one.
  await clickDay(p, "Friday");
  await p.waitForTimeout(500);
  ck(
    "Tapping its Friday selects the same weekend",
    await p.getByText("3 days selected").isVisible(),
  );

  // And under the one-day shape a Friday is not on offer in the first place.
  await p
    .getByRole("button", { name: /^By day/i })
    .first()
    .click();
  await p.waitForTimeout(400);
  const offered = await p.evaluate(() =>
    [
      ...document.querySelectorAll(
        '[role="grid"] button:not([disabled]):not([aria-disabled="true"])',
      ),
    ].map((b) => (b.getAttribute("aria-label") || "").split(",")[0].trim()),
  );
  ck(
    "A single day is never a weekend day",
    offered.length > 0 && !offered.some((d) => ["Thursday", "Friday", "Saturday"].includes(d)),
    [...new Set(offered)].join(", "),
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

// ============================== the holiday shape
//
// Unlike the other three, a holiday is not a rule about weekdays and a
// length: it is whatever the admin entered under Special Occasions, with its
// own dates and its own flat price. The card is only there when there is one.
{
  const { p, ctx } = await calendar(1, "en", []);
  const names = await p.evaluate(() =>
    [...document.querySelectorAll('[role="group"] button[aria-pressed]')].map((b) =>
      b.innerText.split("\n")[0].trim(),
    ),
  );
  ck(
    "With nothing coming up there is no Holiday card",
    !names.includes("HOLIDAY"),
    names.join(", "),
  );
  await ctx.close();
}

{
  const occ = [
    {
      id: "o1",
      name_en: "Eid Al-Fitr",
      name_ar: "عيد الفطر",
      start_date: iso(eid.from),
      end_date: iso(eid.to),
      price: 900,
      active: true,
    },
  ];
  const { p, ctx } = await calendar(1, "en", occ);

  const card = p.getByRole("button", { name: /^Holiday/i }).first();
  ck("An occasion ahead puts a Holiday card on the page", await card.isVisible());
  const text = (await card.innerText()).replace(/\n+/g, " | ");
  // "Holiday" alone says nothing about which one or when.
  ck("…which names the occasion", /Eid Al-Fitr/.test(text), text);
  ck("…and when it is", /\d{1,2}\s+\w{3}/.test(text), text);

  await card.click();
  await p.waitForTimeout(500);
  // The helper opens on next month; the occasion may be in another one.
  const want = eid.from.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  for (let i = 0; i < 8; i++) {
    const heading = (await p.locator('[role="grid"]').getAttribute("aria-label")) ?? "";
    if (heading.includes(want)) break;
    const shown = new Date(`${heading} 1`).getTime();
    const dir = shown > eid.from.getTime() ? /Previous month/i : /Next month/i;
    await p.getByRole("button", { name: dir }).click();
    await p.waitForTimeout(300);
  }
  const offered = await p.evaluate(
    () =>
      [
        ...document.querySelectorAll(
          '[role="grid"] button:not([disabled]):not([aria-disabled="true"])',
        ),
      ].length,
  );
  ck("Choosing it leaves only the occasion selectable", offered === 3, `${offered} days`);

  await p
    .locator('[role="grid"] button:not([disabled]):not([aria-disabled="true"])')
    .first()
    .click();
  await p.waitForTimeout(600);
  ck("One tap takes the whole occasion", await p.getByText("3 days selected").isVisible());
  // The occasion's own price, not the weekend rate those three days would
  // otherwise carry -- the same precedence the server applies.
  const total = await p.evaluate(() => {
    const el = [...document.querySelectorAll("div,p")].find((d) =>
      /^TOTAL/i.test((d.innerText || "").trim()),
    );
    return el ? el.innerText.replace(/\n/g, " ") : "";
  });
  ck("…priced as the occasion, not as a weekend", /900/.test(total), total);
  ck(
    "…and can be carried forward",
    await p.getByRole("button", { name: /^Continue$/i }).isEnabled(),
  );
  await ctx.close();
}

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
