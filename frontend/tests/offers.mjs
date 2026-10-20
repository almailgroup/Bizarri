/**
 * Choosing an offer on the Offers page and having the booking page open on
 * it. It used to be a price list and a button: the guest chose the weekend
 * on one page and then had to choose it again on the next.
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
const today = new Date();
today.setHours(0, 0, 0, 0);
// An occasion two months out, Thu-Sat, so it is whole and in the future.
const occFrom = (() => {
  const d = new Date(today.getFullYear(), today.getMonth() + 2, 1);
  while (d.getDay() !== 4) d.setDate(d.getDate() + 1);
  return d;
})();
const occTo = new Date(occFrom.getFullYear(), occFrom.getMonth(), occFrom.getDate() + 2);
const OCCASION = {
  id: "7f1c2a9e-0000-4000-8000-000000000001",
  name_en: "National Day",
  name_ar: "العيد الوطني",
  start_date: iso(occFrom),
  end_date: iso(occTo),
  price: 900,
  active: true,
};

// The offers the admin has set, two months out. A is Wed-Sun, which is none
// of the booking page's shapes, on either chalet; B is chalet 2's alone and
// has no title; C is taken on both chalets; the last has already begun.
const offFrom = (() => {
  const d = new Date(today.getFullYear(), today.getMonth() + 2, 1);
  while (d.getDay() !== 3) d.setDate(d.getDate() + 1);
  return d;
})();
const at = (n) => new Date(offFrom.getFullYear(), offFrom.getMonth(), offFrom.getDate() + n);
const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
const OFFERS = [
  {
    id: "0f0f0000-0000-4000-8000-00000000000a",
    title_en: "Long weekend",
    title_ar: "عطلة طويلة",
    chalet_id: null,
    start_date: iso(offFrom),
    end_date: iso(at(4)),
    price: 200,
    active: true,
  },
  {
    id: "0f0f0000-0000-4000-8000-00000000000b",
    title_en: "",
    title_ar: "",
    chalet_id: 2,
    start_date: iso(at(11)),
    end_date: iso(at(14)),
    price: 250,
    active: true,
  },
  {
    id: "0f0f0000-0000-4000-8000-00000000000c",
    title_en: "Sold out deal",
    title_ar: "",
    chalet_id: null,
    start_date: iso(at(18)),
    end_date: iso(at(21)),
    price: 150,
    active: true,
  },
  {
    id: "0f0f0000-0000-4000-8000-00000000000d",
    title_en: "Old deal",
    title_ar: "",
    chalet_id: null,
    start_date: iso(yesterday),
    end_date: iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)),
    price: 100,
    active: true,
  },
];
// Days already held, per chalet: offer C on both.
const TAKEN = { 1: [iso(at(18))], 2: [iso(at(19))] };

async function page(
  viewport = { width: 1200, height: 1000 },
  occasions = [OCCASION],
  offers = OFFERS,
  taken = TAKEN,
) {
  const ctx = await b.newContext({ viewport });
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
        min_stay_days: 1,
        updated_at: "",
        updated_by: null,
      });
    if (path === "special_occasions") return send(occasions);
    if (path === "offers") return send(offers);
    if (path === "rpc/availability_calendar") {
      const held = taken[body.p_chalet_id] ?? [];
      const out = [];
      const d = new Date(body.p_from + "T00:00:00");
      const e = new Date(body.p_to + "T00:00:00");
      for (; d <= e; d.setDate(d.getDate() + 1)) {
        const k = iso(d);
        out.push({
          day: k,
          blocked: k < iso(today) || held.includes(k),
          pending: held.includes(k),
          price: 75,
          custom: false,
        });
      }
      return send(out);
    }
    return send([]);
  });
  await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
  return { ctx, p: await ctx.newPage() };
}

const path = (p) => {
  const u = new URL(p.url());
  return u.pathname + u.search;
};
const cta = (p) => p.getByRole("link", { name: /Start your booking request/i });
const chaletOn = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll('[aria-labelledby="pick-chalet"] button[aria-pressed="true"]')]
      .map((x) => x.innerText.trim())
      .join(","),
  );
const subtotal = (p) =>
  p.evaluate(() => {
    const el = [...document.querySelectorAll("div,p")].find((d) =>
      /^(BOOKING SUB)?TOTAL/i.test((d.innerText || "").trim()),
    );
    return el ? el.innerText.replace(/\n/g, " ") : "";
  });
const shapeOn = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll('[aria-label="Choose your stay"] button[aria-pressed="true"]')]
      .map((x) => x.innerText.split("\n")[0].trim())
      .join(","),
  );

/** From the Offers page or the Packages page, through to booking. */
async function fromOffers(p, pick, from = "offers") {
  await p.goto(`${B}en`, { waitUntil: "load" });
  await p.waitForTimeout(500);
  await p.goto(`${B}${from}/en`, { waitUntil: "load" });
  await p.waitForTimeout(900);
  await pick();
  await p.waitForTimeout(200);
  await cta(p).click();
  await p.waitForTimeout(1500);
}

// ============================================== packages and offers, apart
// One page until the owner asked for them separately: the year-round stays
// on Packages, and on Offers the dates the admin has priced -- not the
// special occasions, which are booked under their own option.
{
  const { ctx, p } = await page();
  await p.goto(`${B}offers/en`, { waitUntil: "load" });
  await p.waitForTimeout(1200);
  const cards = p.locator("main button[aria-pressed]");
  ck("The Offers page lists the offers the admin has set", (await cards.count()) === 3);
  ck("…not the special occasions", (await p.getByText(/National Day/i).count()) === 0);
  ck("…nor one that has already begun", (await p.getByText(/Old deal/i).count()) === 0);
  ck(
    "…nor the packages, which have their own page",
    (await p.getByText(/Full Week Package|Thu – Sat Package|By the day/i).count()) === 0,
  );
  const a = (await cards.nth(0).innerText()).replace(/\n+/g, " | ");
  ck(
    "Each says its title, its dates, its length and its price",
    /Long weekend/.test(a) &&
      a.includes(`${iso(offFrom)} → ${iso(at(4))}`) &&
      /5 days/.test(a) &&
      /KD 200/.test(a),
    a,
  );
  const bText = (await cards.nth(1).innerText()).replace(/\n+/g, " | ");
  ck(
    "One without a title is a special offer, and one for a chalet says which",
    /Special offer/.test(bText) && /Bizarri Chalet 2 only/.test(bText) && /KD 250/.test(bText),
    bText,
  );
  const c = (await cards.nth(2).innerText()).replace(/\n+/g, " | ");
  ck(
    "One already taken on every chalet says so and cannot be chosen",
    /Fully booked/i.test(c) && (await cards.nth(2).isDisabled()),
    c,
  );
  await cards.nth(0).click();
  ck(
    "Choosing one puts it on the button",
    (await cta(p).getAttribute("href")) === `/booking/en?offer=${OFFERS[0].id}`,
    await cta(p).getAttribute("href"),
  );
  await ctx.close();
}
{
  const { ctx, p } = await page(undefined, [], []);
  await p.goto(`${B}offers/en`, { waitUntil: "load" });
  await p.waitForTimeout(900);
  ck(
    "With no offers running, the Offers page says so",
    await p.getByText("No offers running right now").isVisible(),
  );
  const wa = p.getByRole("link", { name: /Ask about offers/i });
  ck(
    "…offers WhatsApp to ask about the next one",
    /^https:\/\/wa\.me\//.test((await wa.getAttribute("href")) ?? ""),
  );
  const pk = p.getByRole("link", { name: /See our packages/i });
  ck("…and points to the packages", (await pk.getAttribute("href")) === "/packages/en");
  await pk.click();
  await p.waitForTimeout(800);
  ck("…which open", path(p) === "/packages/en", path(p));
  await ctx.close();
}

// ====================================================== the packages page
{
  const { ctx, p } = await page();
  await p.goto(`${B}packages/en`, { waitUntil: "load" });
  await p.waitForTimeout(900);
  const pressed = await p.locator("main button[aria-pressed]").count();
  ck(
    "Every package can be chosen: the three packages and by the day",
    pressed === 4,
    String(pressed),
  );
  ck("…and the offers are not here", (await p.getByText(/Long weekend/i).count()) === 0);
  // The by-the-day card matches the rule: weekdays a day at a time, the
  // weekend only whole. It used to say "3 days or more" and quote a Thu-Sat
  // daily rate that no booking could use.
  const perDay = await p.getByRole("button", { name: /By the day/i }).innerText();
  ck(
    "By the day says weekdays can be booked from a single day",
    /Sunday to Wednesday.*single day/s.test(perDay) && !/3 days or more/.test(perDay),
    perDay.replace(/\n+/g, " | "),
  );
  ck(
    "…and quotes no Thursday-Saturday daily rate",
    /KD 75/.test(perDay) && !/120/.test(perDay) && !/Thu – Sat, per day/i.test(perDay),
  );
  ck(
    "Nothing is chosen until the guest chooses",
    (await p.locator('main button[aria-pressed="true"]').count()) === 0,
  );
  // The full week used to wear a heavy black border before anyone chose it,
  // which read as already picked. Unchosen, the three look the same.
  const borders = await p
    .locator("main .grid button[aria-pressed]")
    .evaluateAll((els) =>
      els.map(
        (el) => `${getComputedStyle(el).borderTopWidth} ${getComputedStyle(el).borderTopColor}`,
      ),
    );
  ck(
    "…and no package is singled out before then",
    borders.length === 3 && new Set(borders).size === 1,
    borders.join(" | "),
  );
  const plain = new URL((await cta(p).getAttribute("href")) ?? "", B);
  ck(
    "…and the button then goes to a plain booking page",
    plain.pathname + plain.search === "/booking/en",
    plain.pathname + plain.search,
  );

  const weekend = p.getByRole("button", { name: /Thu – Sat Package/i });
  await weekend.click();
  ck("Choosing one marks it", (await weekend.getAttribute("aria-pressed")) === "true");
  // Light grey, not inverted to black: the owner found black heavy on a phone.
  // Read once the colour transition has finished, not halfway through it.
  await p.waitForTimeout(500);
  const bg = await weekend.evaluate((el) => {
    const c = document.createElement("canvas").getContext("2d");
    c.fillStyle = getComputedStyle(el).backgroundColor;
    c.fillRect(0, 0, 1, 1);
    const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
    return {
      lum: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
      css: getComputedStyle(el).backgroundColor,
    };
  });
  ck(
    "…in light grey, not black",
    bg.lum > 0.85 && bg.lum < 0.995 && !/\/\s*0?\.\d+\)$/.test(bg.css),
    `${bg.css} (${bg.lum.toFixed(2)})`,
  );
  ck(
    "…with its text still dark",
    await weekend.evaluate((el) => {
      const c = getComputedStyle(el.querySelector("h2"))
        .color.match(/[\d.]+/g)
        .map(Number);
      return c[0] < 80 && c[1] < 80 && c[2] < 80;
    }),
  );
  ck(
    "…and the button carries it",
    /shape=weekend/.test((await cta(p).getAttribute("href")) ?? ""),
    await cta(p).getAttribute("href"),
  );
  await p.getByRole("button", { name: /Full Week Package/i }).click();
  ck(
    "Choosing another moves the choice",
    (await weekend.getAttribute("aria-pressed")) === "false" &&
      /shape=fullWeek/.test((await cta(p).getAttribute("href")) ?? ""),
  );
  await p.getByRole("button", { name: /Full Week Package/i }).click();
  ck(
    "Tapping the chosen one again lets it go",
    (await p.locator('main button[aria-pressed="true"]').count()) === 0,
  );
  await ctx.close();
}

// ============================================== each one, on the booking page
for (const [name, re, want] of [
  ["Weekend package", /Thu – Sat Package/i, "WEEKEND"],
  ["Weekday package", /Sun – Wed Package/i, "WEEKDAY"],
  ["Full week package", /Full Week Package/i, "FULL WEEK"],
  ["Per-day rate", /By the day/i, "BY DAY"],
]) {
  const { ctx, p } = await page();
  await fromOffers(p, () => p.getByRole("button", { name: re }).first().click(), "packages");
  ck(`${name}: the booking page opens on it`, (await shapeOn(p)) === want, await shapeOn(p));
  ck(`…with the address tidied`, path(p) === "/booking/en", path(p));
  if (want === "FULL WEEK") {
    // A Sunday tap takes the whole week, at the package price.
    await p
      .locator('[role="grid"] button:not([disabled]):not([aria-disabled="true"])')
      .first()
      .click();
    await p.waitForTimeout(500);
    ck("…and a tap takes Sunday to Saturday", await p.getByText("7 days selected").isVisible());
    const total = await p.evaluate(() => {
      const el = [...document.querySelectorAll("div,p")].find((d) =>
        /^(BOOKING SUB)?TOTAL/i.test((d.innerText || "").trim()),
      );
      return el ? el.innerText.replace(/\n/g, " ") : "";
    });
    ck("…priced as the full week", /600/.test(total), total);
  }
  if (want === "WEEKEND") {
    // Picking something else is not overruled by where the guest came from.
    await p.getByRole("button", { name: /^Weekday/i }).click();
    await p.waitForTimeout(300);
    ck("…and it can still be changed", (await shapeOn(p)) === "WEEKDAY");
    await p.goBack();
    await p.waitForTimeout(700);
    ck("…and Back returns to the packages", path(p) === "/packages/en", path(p));
  }
  await ctx.close();
}

// ===================================== the booking page opens at its top
// The button sits at the foot of a long page on a phone; arriving on the
// booking page at the same offset dropped the guest past the heading and the
// chalets, into the middle of the calendar.
for (const [name, re, source] of [
  ["a package", /Full Week Package/i, "packages"],
  ["an offer", /Long weekend/i, "offers"],
]) {
  const { ctx, p } = await page({ width: 390, height: 844 });
  await p.goto(`${B}${source}/en`, { waitUntil: "load" });
  await p.waitForTimeout(900);
  await p.getByRole("button", { name: re }).click();
  // From the very foot of the page, however long it is.
  await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await p.waitForTimeout(200);
  const from = await p.evaluate(() => Math.round(window.scrollY));
  await cta(p).click();
  await p.waitForTimeout(1500);
  const y = await p.evaluate(() => Math.round(window.scrollY));
  ck(
    `Choosing ${name} opens the booking page at the top`,
    from > 200 && y === 0,
    `${from}px → ${y}px`,
  );
  await ctx.close();
}

// An offer for a chalet that has been switched off is for nothing bookable.
{
  const ghost = {
    ...OFFERS[0],
    id: "0f0f0000-0000-4000-8000-00000000000e",
    title_en: "Closed chalet deal",
    chalet_id: 3,
  };
  const { ctx, p } = await page(undefined, [OCCASION], [...OFFERS, ghost]);
  await p.goto(`${B}offers/en`, { waitUntil: "load" });
  await p.waitForTimeout(1200);
  ck(
    "An offer for a chalet that is switched off is not listed",
    (await p.getByText(/Closed chalet deal/).count()) === 0 &&
      (await p.locator("main button[aria-pressed]").count()) === 3,
  );
  await ctx.close();
}

// ================================================ an offer, dates and all
{
  const { ctx, p } = await page();
  await fromOffers(p, () => p.getByRole("button", { name: /Long weekend/i }).click());
  ck("An offer opens the booking page with the address tidied", path(p) === "/booking/en", path(p));
  ck(
    "…on its month",
    ((await p.locator('[role="grid"]').getAttribute("aria-label")) ?? "").includes(
      offFrom.toLocaleDateString("en-US", { month: "long" }),
    ),
    await p.locator('[role="grid"]').getAttribute("aria-label"),
  );
  // Wed-Sun is none of the shapes; it is selected all the same.
  ck("…with its dates already chosen", await p.getByText("5 days selected").isVisible());
  ck(
    "…from its first day to its last",
    (await p.getByText(`${iso(offFrom)} → ${iso(at(4))}`).count()) > 0,
  );
  ck("…at the offer's price", /KD 200/.test(await subtotal(p)), await subtotal(p));
  ck(
    "…and says it is an offer",
    (await p.getByTestId("offer-line").innerText()) === "Special offer · Long weekend",
  );
  ck("…ready to continue", await p.getByRole("button", { name: /^Next$/i }).isEnabled());

  // It covers both chalets, so changing chalet keeps it.
  await p.getByRole("button", { name: "Bizarri Chalet 2" }).click();
  await p.waitForTimeout(800);
  ck(
    "Switching to the other chalet keeps an offer that covers both",
    (await chaletOn(p)) === "Bizarri Chalet 2" &&
      (await p.getByText("5 days selected").isVisible()),
  );
  await ctx.close();
}

// One chalet's offer opens on that chalet, and is let go on the other.
{
  const { ctx, p } = await page();
  await fromOffers(p, () => p.getByRole("button", { name: /Special offer/i }).click());
  ck(
    "A chalet's own offer opens on that chalet",
    (await chaletOn(p)) === "Bizarri Chalet 2",
    await chaletOn(p),
  );
  ck(
    "…with its dates and its price",
    (await p.getByText("4 days selected").isVisible()) && /KD 250/.test(await subtotal(p)),
    await subtotal(p),
  );
  await p.getByRole("button", { name: "Bizarri Chalet 1" }).click();
  await p.waitForTimeout(800);
  ck("…and switching away lets it go", (await p.getByText(/days selected/).count()) === 0);
  await ctx.close();
}

// An offer for both, taken on the first chalet: the second is used.
{
  const { ctx, p } = await page(undefined, [OCCASION], OFFERS, { 1: [iso(at(1))] });
  await fromOffers(p, () => p.getByRole("button", { name: /Long weekend/i }).click());
  ck(
    "An offer for both chalets opens on the one that has it free",
    (await chaletOn(p)) === "Bizarri Chalet 2" &&
      (await p.getByText("5 days selected").isVisible()),
    await chaletOn(p),
  );
  await ctx.close();
}

// Taken between the two pages: the guest is told, not left with nothing.
{
  const { ctx, p } = await page();
  await p.goto(`${B}booking/en?offer=${OFFERS[2].id}`, { waitUntil: "load" });
  await p.waitForTimeout(1800);
  ck(
    "An offer whose dates were taken in the meantime says so",
    await p
      .getByText(/That offer.s dates are no longer free/)
      .first()
      .isVisible(),
  );
  ck("…and selects nothing", (await p.getByText(/days selected/).count()) === 0);
  await p.goto(`${B}booking/en?offer=0f0f0000-0000-4000-8000-0000000000ff`, { waitUntil: "load" });
  await p.waitForTimeout(1500);
  ck(
    "An offer that no longer exists says so too",
    await p
      .getByText(/That offer is no longer available/)
      .first()
      .isVisible(),
  );
  await ctx.close();
}

// A special occasion link shared before offers had their own page still
// opens on the occasion.
{
  const { ctx, p } = await page();
  await p.goto(`${B}booking/en?shape=holiday&occasion=${OCCASION.id}`, { waitUntil: "load" });
  await p.waitForTimeout(1800);
  ck(
    "An occasion link still opens on Special Occasions",
    (await shapeOn(p)) === "SPECIAL OCCASIONS",
    await shapeOn(p),
  );
  ck(
    "…with its dates chosen, at its own price",
    (await p.getByText("3 days selected").isVisible()) && /900/.test(await subtotal(p)),
    await subtotal(p),
  );
  await ctx.close();
}

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
