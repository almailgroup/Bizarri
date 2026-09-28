/**
 * A "+" or "@" is bidi-neutral. Dropped into the Arabic page's RTL run it
 * lands at the visual end, so +96594040955 reads back as 96594040955+ and
 * @bizarri.chalet as bizarri.chalet@ — wrong numbers, on the contact page.
 *
 * Nothing in the DOM says this: textContent is correct either way. The only
 * honest check is where the glyphs actually land, so this measures the "+"
 * against the first digit.
 */
import { chromium } from "playwright";

const B = "http://localhost:4173/";
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

const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
await ctx.addInitScript(() => {
  localStorage.setItem("bizarri_lang", "ar");
  sessionStorage.setItem("bizarri_intro_seen", "1");
});
const p = await ctx.newPage();

/** Where each character of a node's text actually sits, left to right. */
const visualOrder = async (text) =>
  p.evaluate((needle) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.includes(needle)) continue;
      const i = node.textContent.indexOf(needle);
      const boxes = [];
      for (let k = 0; k < needle.length; k++) {
        const r = document.createRange();
        r.setStart(node, i + k);
        r.setEnd(node, i + k + 1);
        const q = r.getBoundingClientRect();
        if (q.width || q.height) boxes.push({ ch: needle[k], x: q.x });
      }
      if (!boxes.length) continue;
      return boxes
        .sort((a, c) => a.x - c.x)
        .map((x) => x.ch)
        .join("");
    }
    return null;
  }, text);

await p.goto(B + "contact", { waitUntil: "load" });
await p.waitForTimeout(1200);
const dir = await p.evaluate(() => document.documentElement.dir);
ck("/contact really is the Arabic page", dir === "rtl", `dir=${dir}`);

const phone = await visualOrder("+96594040955");
ck("The phone reads +965\u2026 left to right", phone === "+96594040955", `reads "${phone}"`);

const handle = await visualOrder("@bizarri.chalet");
ck("The Instagram handle keeps its @ in front", handle === "@bizarri.chalet", `reads "${handle}"`);
const mail = await visualOrder("sales@bizarri.com");
ck("The email is not reordered either", mail === "sales@bizarri.com", `reads "${mail}"`);

// The footer is on every page, and the homepage prints the number a second
// time with a space in it, so both are worth their own measurement.
await p.goto(B, { waitUntil: "load" });
await p.waitForTimeout(1200);
const home = await visualOrder("+965 94040955");
ck("The homepage number reads the same way", home === "+965 94040955", `reads "${home}"`);
const foot = await p.evaluate(() => {
  const a = document.querySelector('footer a[href^="tel:"]');
  if (!a) return null;
  const t = [...a.childNodes].find((n) => n.nodeType === 3 && n.textContent.includes("+"));
  if (!t) return null;
  const out = [];
  for (let k = 0; k < t.textContent.length; k++) {
    const r = document.createRange();
    r.setStart(t, k);
    r.setEnd(t, k + 1);
    const q = r.getBoundingClientRect();
    if (q.width || q.height) out.push({ ch: t.textContent[k], x: q.x });
  }
  return out
    .sort((a, c) => a.x - c.x)
    .map((x) => x.ch)
    .join("");
});
ck("The footer number does too", foot === "+96594040955", `reads "${foot}"`);

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
