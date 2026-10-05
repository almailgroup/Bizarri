/**
 * The chalet's photography: all 55 photos from the shoot, in the gallery and
 * on the home page.
 *
 * Each photo ships twice, an 800px copy for grids and a 2000px one for the
 * lightbox, so these check not only that every photo appears and loads but
 * that each place uses the right one: a grid of full-size files is 12 MB on
 * a phone for no visible gain, and a lightbox of thumbnails is a blurred photo
 * blown up to fill the screen.
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

async function page(vp = { width: 1280, height: 900 }) {
  const ctx = await b.newContext({ viewport: vp });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) =>
    SUPA.test(r.request().url())
      ? r.fulfill({ status: 200, contentType: "application/json", body: "[]" })
      : r.abort(),
  );
  await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
  return { ctx, p: await ctx.newPage() };
}

/** Scroll the whole page through so every lazy image is asked for. */
async function loadAll(p) {
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 60));
    }
  });
  await p.waitForFunction(
    () => [...document.querySelectorAll("main img")].every((i) => i.complete),
    null,
    { timeout: 30000 },
  );
}

const EXPECTED = {
  Exterior: 6,
  Pool: 7,
  "Outdoor Area": 9,
  "Living Area": 8,
  "Dining Area": 1,
  Kitchen: 2,
  Rooms: 9,
  Bathrooms: 2,
  "Seating Area": 2,
  Entrance: 6,
  "Beach Access": 3,
};

// ================================================================ the grid
{
  const { ctx, p } = await page();
  await p.goto(`${B}photos/en`, { waitUntil: "load" });
  await p.waitForTimeout(800);
  await loadAll(p);

  const grid = await p.evaluate(() =>
    [...document.querySelectorAll("main h2")].map((h) => {
      const imgs = [...h.parentElement.querySelectorAll("img")];
      return {
        name: h.textContent.trim(),
        count: imgs.length,
        widths: imgs.map((i) => i.naturalWidth),
        srcs: imgs.map((i) => i.getAttribute("src")),
      };
    }),
  );
  const got = Object.fromEntries(grid.map((g) => [g.name, g.count]));
  ck(
    "Every category from the shoot is shown, with its photos",
    JSON.stringify(got) === JSON.stringify(EXPECTED),
    JSON.stringify(got),
  );
  const all = grid.flatMap((g) => g.widths);
  ck("All 55 photos are in the gallery", all.length === 55, String(all.length));
  ck(
    "…and every one of them loads",
    all.every((w) => w > 0),
    `${all.filter((w) => w === 0).length} broken`,
  );
  ck(
    "The grid uses the 800px copies, not the full files",
    all.every((w) => w === 800),
    [...new Set(all)].join(","),
  );
  const srcs = grid.flatMap((g) => g.srcs);
  ck("No photo appears twice", new Set(srcs).size === srcs.length);
  ck("The building comes first", grid[0]?.name === "Exterior", grid.map((g) => g.name).join(", "));
  ck(
    "Categories with no photography yet are listed as coming, not shown empty",
    await p.getByText("Smart Home Features").isVisible(),
  );

  // ============================================================= lightbox
  await p.locator("main button[aria-label*='open photo']").first().click();
  await p.waitForTimeout(600);
  const big = () =>
    p.evaluate(() => {
      const i = document.querySelector(
        '[role="dialog"] img.animate-scale-in, [role="dialog"] > div img',
      );
      return i ? { w: i.naturalWidth, src: i.getAttribute("src") } : null;
    });
  await p.waitForFunction(() => {
    const i = document.querySelector('[role="dialog"] img');
    return i && i.complete;
  });
  const first = await big();
  ck("The lightbox shows the 2000px original", first?.w === 2000, String(first?.w));

  const strip = async () =>
    p.evaluate(() => {
      const btns = [...document.querySelectorAll('[role="dialog"] button[aria-label^="Photo "]')];
      const box = btns[0]?.parentElement.getBoundingClientRect();
      const cur = btns.find((x) => x.getAttribute("aria-current") === "true");
      const r = (el) => el.getBoundingClientRect();
      return {
        count: btns.length,
        thumbW: btns.map((x) => x.querySelector("img").naturalWidth),
        firstInside: btns[0] ? r(btns[0]).left >= box.left - 1 : false,
        currentVisible: cur ? r(cur).left >= box.left - 1 && r(cur).right <= box.right + 1 : false,
      };
    });
  const s1 = await strip();
  ck("The filmstrip holds every photo", s1.count === 55, String(s1.count));
  // A centred row wider than the screen hides its start, out of scroll reach.
  ck("…and its first photo is reachable, not cut off the start", s1.firstInside);

  await p.keyboard.press("ArrowLeft"); // wrap to the last photo
  await p.waitForTimeout(700);
  const s2 = await strip();
  ck("Going to the last photo brings its thumbnail into view", s2.currentVisible);
  await p.waitForTimeout(800);
  const s3 = await strip();
  ck(
    "The filmstrip uses the small copies",
    s3.thumbW.filter((w) => w > 0).every((w) => w === 800),
    [...new Set(s3.thumbW)].join(","),
  );
  await p.keyboard.press("Escape");
  await ctx.close();
}

// =============================================================== home page
{
  const { ctx, p } = await page();
  await p.goto(`${B}en`, { waitUntil: "load" });
  await p.waitForTimeout(800);
  await loadAll(p);
  const preview = await p.evaluate(() =>
    [...document.querySelectorAll('main a[href*="/photos/"] img')].map((i) => i.naturalWidth),
  );
  ck(
    "The home page previews three photos from the shoot, all loaded",
    preview.length === 3 && preview.every((w) => w > 0),
    preview.join(","),
  );
  ck("…the large one sharp enough for its size", preview[0] === 2000, String(preview[0]));
  await ctx.close();
}

// ================================================================ in Arabic
{
  const { ctx, p } = await page({ width: 390, height: 844 });
  await p.goto(`${B}photos/ar`, { waitUntil: "load" });
  await p.waitForTimeout(800);
  ck(
    "The Arabic gallery names its categories in Arabic",
    (await p.getByRole("heading", { name: "الواجهة الخارجية" }).count()) === 1 &&
      (await p.getByRole("heading", { name: "المسبح" }).count()) === 1,
  );
  ck(
    "…and does not scroll sideways on a phone",
    (await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1,
  );
  await ctx.close();
}

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
