/**
 * The Terms & Conditions and the Cancellation & Refund Policy: the owner's
 * text, in both languages, with the stay hours the rest of the site gives,
 * and reachable from the footer, the menu and the booking form.
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

const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
// Nothing here needs the database; keep the pages from reaching out.
await ctx.route(/^https?:\/\/(?!localhost)/, (r) =>
  r.request().url().includes("supabase.co")
    ? r.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    : r.abort(),
);
await ctx.addInitScript(() => sessionStorage.setItem("bizarri_intro_seen", "1"));
const p = await ctx.newPage();
const main = () => p.evaluate(() => document.querySelector("main").innerText);
const headings = () =>
  p.evaluate(() => [...document.querySelectorAll("main h2")].map((h) => h.innerText.trim()));

// ========================================================= the terms, English
await p.goto(`${B}rules/en`, { waitUntil: "load" });
await p.waitForTimeout(800);
{
  const text = await main();
  const h = await headings();
  ck(
    "The page is Terms & Conditions",
    (await p.title()).startsWith("Terms & Conditions"),
    await p.title(),
  );
  ck(
    "It has the eight sections, numbered, in order",
    h.length === 8 &&
      h[0] === "1. Check-in and Check-out" &&
      h[2] === "3. Advance Payments, Cancellation and No-show" &&
      h[6] === "7. Force Majeure Cancellations" &&
      h[7] === "8. Additional Special Obligations",
    h.join(" | "),
  );
  ck(
    "Check-in and check-out are the hours the booking page gives",
    text.includes("Check-in is at 2:00 PM and check-out is at 12:00 PM (noon).") &&
      text.includes("no later than 12:00 PM (noon) on the check-out date"),
  );
  ck(
    "…and not the hours of the text it came from",
    !/10:00 AM|2:00 PM\. In case of delay/.test(text),
  );
  ck(
    "The law is cited as Law No. 35 of 1978",
    text.includes("Law No. 35 of 1978") && !text.includes("1987"),
  );
  ck(
    "It names Bizarri Chalet, not another company",
    text.includes("policies of Bizarri Chalet") && !/Shalehna/i.test(text),
  );
  ck(
    "Sentences are not run together any more",
    !/[a-z]\.[A-Z]/.test(text),
    text.match(/[a-z]\.[A-Z]/)?.[0],
  );
  ck(
    "It links to the cancellation policy",
    (await p
      .getByRole("link", { name: "Cancellation & Refund Policy" })
      .last()
      .getAttribute("href")) === "/cancellation/en",
  );
  ck("The old privacy text is gone from it", !text.includes("committed to protecting the privacy"));
}

// ========================================================== the terms, Arabic
await p.goto(`${B}rules/ar`, { waitUntil: "load" });
await p.waitForTimeout(800);
{
  const text = await main();
  const h = await headings();
  ck(
    "The Arabic page is in Arabic",
    text.includes("الشروط والأحكام لحجز الشاليه واستخدامه") &&
      h.length === 8 &&
      !/Check-in/.test(text),
    h[0],
  );
  ck(
    "…with the same hours and the same law",
    text.includes("الساعة 2:00 مساءً") &&
      text.includes("الساعة 12:00 ظهراً") &&
      text.includes("رقم 35 لسنة 1978"),
  );
  ck("…right to left", (await p.evaluate(() => document.documentElement.dir)) === "rtl");
}

// ================================================== the cancellation policy
await p.goto(`${B}cancellation/en`, { waitUntil: "load" });
await p.waitForTimeout(800);
{
  const text = await main();
  const h = await headings();
  ck(
    "The cancellation policy has its two sections",
    h.join(" | ") === "Advance Payments, Cancellation and No-show | Force Majeure Cancellations",
    h.join(" | "),
  );
  ck(
    "…in the same words as the terms",
    text.includes(
      "For cancellations made less than one (1) week before check-in, 50% of the total amount paid will be deducted.",
    ) && text.includes("only in the form of rescheduling"),
  );
  ck(
    "…and links back to the full terms",
    (await p
      .getByRole("link", { name: "Read the full Terms & Conditions" })
      .getAttribute("href")) === "/rules/en",
  );
  ck(
    "The footer links to both",
    (await p.locator("footer").getByRole("link", { name: "Terms & Conditions" }).count()) === 1 &&
      (await p
        .locator("footer")
        .getByRole("link", { name: "Cancellation & Refund Policy" })
        .count()) === 1,
  );
}
await p.goto(`${B}cancellation/ar`, { waitUntil: "load" });
await p.waitForTimeout(800);
ck(
  "The Arabic cancellation policy is in Arabic",
  (await headings()).join(" | ") ===
    "الدفعات المقدمة والإلغاء وعدم الحضور | الإلغاء بسبب القوة القاهرة",
  (await headings()).join(" | "),
);

await b.close();
console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
