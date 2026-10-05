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

async function page() {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 1000 } });
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
    if (path === "special_occasions") return send([OCCASION]);
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
  return { ctx, p: await ctx.newPage() };
}

const path = (p) => {
  const u = new URL(p.url());
  return u.pathname + u.search;
};
const cta = (p) => p.getByRole("link", { name: /Start your booking request/i });
const shapeOn = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll('[aria-label="Choose your stay"] button[aria-pressed="true"]')]
      .map((x) => x.innerText.split("\n")[0].trim())
      .join(","),
  );

async function fromOffers(p, pick) {
  await p.goto(`${B}en`, { waitUntil: "load" });
  await p.waitForTimeout(500);
  await p.goto(`${B}offers/en`, { waitUntil: "load" });
  await p.waitForTimeout(900);
  await pick();
  await p.waitForTimeout(200);
  await cta(p).click();
  await p.waitForTimeout(1500);
}

// ======================================================== the offers page
{
  const { ctx, p } = await page();
  await p.goto(`${B}offers/en`, { waitUntil: "load" });
  await p.waitForTimeout(900);
  const pressed = await p.locator("main button[aria-pressed]").count();
  ck(
    "Every offer can be chosen: three packages, per day, the occasion",
    pressed === 5,
    String(pressed),
  );
  ck(
    "Nothing is chosen until the guest chooses",
    (await p.locator('main button[aria-pressed="true"]').count()) === 0,
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
  ["Per-day rate", /Custom dates/i, "BY DAY"],
]) {
  const { ctx, p } = await page();
  await fromOffers(p, () => p.getByRole("button", { name: re }).first().click());
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
        /^TOTAL/i.test((d.innerText || "").trim()),
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
    ck("…and Back returns to the offers", path(p) === "/offers/en", path(p));
  }
  await ctx.close();
}

// ================================================ a holiday, dates and all
{
  const { ctx, p } = await page();
  await fromOffers(p, () => p.getByRole("button", { name: /National Day/i }).click());
  ck("A holiday opens on the Holiday shape", (await shapeOn(p)) === "HOLIDAY", await shapeOn(p));
  ck(
    "…on its month",
    ((await p.locator('[role="grid"]').getAttribute("aria-label")) ?? "").includes(
      occFrom.toLocaleDateString("en-US", { month: "long" }),
    ),
    await p.locator('[role="grid"]').getAttribute("aria-label"),
  );
  ck("…with its dates already chosen", await p.getByText("3 days selected").isVisible());
  ck("…from its first day", (await p.getByText(iso(occFrom)).count()) > 0);
  const total = await p.evaluate(() => {
    const el = [...document.querySelectorAll("div,p")].find((d) =>
      /^TOTAL/i.test((d.innerText || "").trim()),
    );
    return el ? el.innerText.replace(/\n/g, " ") : "";
  });
  ck("…at its own price", /900/.test(total), total);
  ck("…ready to continue", await p.getByRole("button", { name: /^Continue$/i }).isEnabled());
  await ctx.close();
}

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
