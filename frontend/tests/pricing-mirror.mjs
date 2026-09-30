/**
 * The client's pricing is a mirror of quote_stay() in SQL, kept so the
 * calendar can show a live total without a round-trip. A mirror that has
 * drifted is worse than no mirror: the guest agrees to one number and the
 * server charges another.
 *
 * These are the same cases as backend/supabase/tests/08_weekend_block.sql,
 * with the totals that suite actually returned from Postgres. If the two ever
 * disagree, one of them is wrong and this says so.
 */
import { quote, weekendIsWhole, parseDate, DEFAULT_RATES } from "../src/lib/booking.ts";

let fails = 0;
const ck = (n, c, d = "") => {
  if (!c) fails++;
  console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`);
};

const RATES = {
  ...DEFAULT_RATES,
  fullWeek: 600,
  weekend: 350,
  weekday: 300,
  dailyWeekday: 75,
  dailyWeekend: 120,
  minStayDays: 1,
};
const q = (from, to, prices = {}) => quote(parseDate(from), parseDate(to), prices, RATES, []).total;
const whole = (from, to) => weekendIsWhole(parseDate(from), parseDate(to));

// ---- which ranges may be booked (08_weekend_block.sql, first block)
for (const [from, to, want, why] of [
  ["2026-10-04", "2026-10-07", true, "Sun–Wed"],
  ["2026-10-05", "2026-10-05", true, "one weekday"],
  ["2026-10-08", "2026-10-10", true, "a whole Thu–Sat"],
  ["2026-10-11", "2026-10-17", true, "a week containing one"],
  ["2026-10-09", "2026-10-09", false, "a lone Friday"],
  ["2026-10-08", "2026-10-08", false, "a lone Thursday"],
  ["2026-10-08", "2026-10-09", false, "Thu–Fri, stopping short"],
  ["2026-10-09", "2026-10-10", false, "Fri–Sat, starting late"],
  ["2026-10-04", "2026-10-08", false, "weekdays running into the Thursday"],
  ["2026-10-11", "2026-10-16", false, "a long stay stopping mid-weekend"],
  ["2026-10-10", "2026-10-14", false, "one beginning on the Saturday"],
]) {
  ck(`${why} is ${want ? "bookable" : "refused"}`, whole(from, to) === want);
}

// ---- and what they cost (the totals Postgres returned)
for (const [from, to, want, why] of [
  ["2026-10-07", "2026-10-10", 425, "Wed–Sat = 75 + one weekend"],
  ["2026-10-05", "2026-10-10", 575, "Mon–Sat = 3×75 + 350"],
  ["2026-10-08", "2026-10-17", 1000, "two weekends are two weekend rates"],
  ["2026-10-11", "2026-10-17", 600, "Sun–Sat is still the full week"],
  ["2026-10-08", "2026-10-09", 240, "half a weekend quotes as daily rates"],
  ["2026-10-04", "2026-10-07", 300, "Sun–Wed is the weekday package"],
  ["2026-10-08", "2026-10-10", 350, "Thu–Sat is the weekend package"],
  ["2026-10-05", "2026-10-07", 225, "Mon–Wed is 3×75"],
]) {
  const got = q(from, to);
  ck(`${why} — KD ${want}`, got === want, `got ${got}`);
}

// ---- a custom price breaks its own block, and only its own
{
  const got = q("2026-10-08", "2026-10-10", { "2026-10-09": 500 });
  ck("A priced Friday is charged, not swallowed by the block — KD 740", got === 740, `got ${got}`);
}
{
  // The case the two implementations used to disagree on: a custom price on a
  // Monday made the client price an untouched weekend at three daily rates
  // while the server still charged one weekend rate.
  const got = q("2026-10-05", "2026-10-10", { "2026-10-05": 200 });
  ck(
    "A priced Monday does not cost the guest a weekend elsewhere — KD 700",
    got === 200 + 75 + 75 + 350,
    `got ${got}`,
  );
}

console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
