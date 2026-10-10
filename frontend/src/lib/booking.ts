/**
 * Booking domain: dates, money and the pricing rules.
 *
 * This is a deliberate mirror of the SQL in backend/supabase/migrations — quote_stay(),
 * match_package() and default_day_rate() — so the calendar can show a live
 * total without a round-trip per click. It is NOT the authority: the server
 * re-prices every request inside request_booking(), and its answer is what gets
 * stored. If the two ever disagree, the database wins.
 *
 * All persistence lives in src/lib/api.ts.
 */

// A sibling, not "@/lib/locale": this module is pure domain logic with no
// build step in its way, and the pricing test imports it straight into Node to
// check it against what Postgres returned for the same stays.
import { dateLocale } from "./locale.ts";

/**
 * Fallback minimum stay, for the moment before the rates have loaded.
 *
 * The real value is rates.min_stay_days, which the admin panel edits and
 * request_booking() enforces. This is only what the UI assumes until the
 * server has answered, so it is the permissive value: briefly allowing a
 * selection the server then refuses is better than briefly refusing one it
 * would have taken.
 */
export const MIN_STAY_DAYS = 1;

import type { PackageKey } from "@/integrations/supabase/types";

export type { BookingStatus, PackageKey } from "@/integrations/supabase/types";

export interface Rates {
  /** Sun–Sat, 7 days. */
  fullWeek: number;
  /** Thu–Sat, 3 days. */
  weekend: number;
  /** Sun–Wed, 4 days. */
  weekday: number;
  /** Per-day fallback for Sun–Wed when a range matches no package. */
  dailyWeekday: number;
  /** Per-day fallback for Thu–Sat when a range matches no package. */
  dailyWeekend: number;
}

export const DEFAULT_RATES: Rates = {
  fullWeek: 600,
  weekend: 350,
  weekday: 300,
  dailyWeekday: 75,
  dailyWeekend: 120,
};

/* ------------------------------------------------------------------ dates */

/**
 * Local yyyy-mm-dd. Deliberately not toISOString(), which converts to UTC and
 * shifts a late-evening Kuwait date (UTC+3) back to the previous day.
 */
export function fmtDate(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function startOfToday(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Inclusive list of days from start to end. */
export function eachDay(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function daysBetween(start: Date, end: Date): number {
  return eachDay(start, end).length;
}

/* -------------------------------------------------------------- pricing */

/** A premium window (Eid and the like): a flat price for the whole window. */
export interface Occasion {
  id: string;
  nameEn: string;
  nameAr: string;
  /** Inclusive yyyy-mm-dd bounds. */
  start: string;
  end: string;
  price: number;
}

export interface Quote {
  total: number;
  days: number;
  /** Which package matched, if any. */
  packageKey: PackageKey | null;
  /** True when a custom daily override applied to at least one day. */
  hasCustom: boolean;
  /** Set when a special occasion priced the stay. */
  occasion: Occasion | null;
  breakdown: { date: string; price: number; custom: boolean }[];
}

/** Sun–Wed are weekday nights; Thu–Sat are weekend nights. */
export function isWeekendDay(d: Date): boolean {
  const dow = d.getDay();
  return dow >= 4; // Thu(4), Fri(5), Sat(6)
}

export function defaultDayRate(d: Date, rates: Rates): number {
  return isWeekendDay(d) ? rates.dailyWeekend : rates.dailyWeekday;
}

/** The Thursday and Saturday of the weekend a given day belongs to. */
export function weekendBlock(d: Date): { from: Date; to: Date } {
  const dow = d.getDay();
  return { from: addDays(d, 4 - dow), to: addDays(d, 6 - dow) };
}

/**
 * A weekend is sold whole or not at all.
 *
 * Sun-Wed can be taken a day at a time at the daily rate, but Thu-Sat is one
 * three-day product at one price, so a stay may not take a slice of it: no
 * single Friday, and no stay that runs Sun-Thu and stops before Saturday.
 * A stay that reaches a weekend has to carry all three of its days.
 *
 * Kept next to the pricing rather than in the calendar because the server
 * enforces the same rule in weekend_is_whole(), and the two have to agree --
 * the calendar only decides what is easy to ask for, not what is allowed.
 */
export function weekendIsWhole(start: Date, end: Date): boolean {
  for (const d of eachDay(start, end)) {
    if (!isWeekendDay(d)) continue;
    const { from, to } = weekendBlock(d);
    if (from < start || to > end) return false;
  }
  return true;
}

/**
 * What the days of a stay cost, before any package or occasion rate.
 *
 * Mirrors sum_stay_days() in SQL. A complete Thu-Sat costs rates.weekend once
 * rather than three daily rates; "complete" means all three of its days are
 * among the days being summed, decided per day rather than assumed, because
 * this also prices ranges nobody may book -- the calendar quotes what a guest
 * is dragging across before it knows where they will stop, and a Thu-Fri whose
 * Saturday is outside the range has to come out as two daily rates rather than
 * as a weekend that was never there.
 *
 * A custom price anywhere in a block takes that block back to per-day, for the
 * same reason a custom price anywhere in a range suppresses the packages: an
 * override must never be masked by a flat rate. That is why this takes the
 * prices rather than being skipped when any exist -- a priced Monday must not
 * quietly cost the guest a weekend elsewhere in the same stay.
 */
function sumStayDays(days: Date[], rates: Rates, prices: Record<string, number>): number {
  const present = new Set(days.map(fmtDate));
  const custom = (d: Date) => Object.prototype.hasOwnProperty.call(prices, fmtDate(d));
  const wholeBlock = (d: Date) => {
    if (!isWeekendDay(d)) return false;
    const { from, to } = weekendBlock(d);
    const block = eachDay(from, to);
    return block.every((x) => present.has(fmtDate(x))) && !block.some(custom);
  };

  let total = 0;
  for (const d of days) {
    if (wholeBlock(d)) {
      // The Thursday carries the price of all three days of its weekend.
      if (d.getDay() === 4) total += rates.weekend;
      continue;
    }
    total += custom(d) ? prices[fmtDate(d)] : defaultDayRate(d, rates);
  }
  return total;
}

/** The package a range matches exactly, by length and start/end weekday. */
export function matchPackage(start: Date, end: Date): Exclude<PackageKey, "special"> | null {
  const len = daysBetween(start, end);
  const from = start.getDay();
  const to = end.getDay();
  if (len === 7 && from === 0 && to === 6) return "fullWeek";
  if (len === 3 && from === 4 && to === 6) return "weekend";
  if (len === 4 && from === 0 && to === 3) return "weekday";
  return null;
}

/**
 * Price a stay. Mirrors quote_stay() in SQL, same precedence:
 *   1. custom day prices — sum per day, so an override is never masked.
 *   2. special occasion  — its flat price, plus per-day defaults for any days
 *                          the stay extends beyond the window.
 *   3. exact package     — fullWeek / weekend / weekday.
 *   4. per-day defaults, with a whole Thu–Sat priced as one weekend.
 *
 * Step 4 is why Wed–Sat is 75 + 350 and not four daily rates: the weekend is
 * one product, so it costs the same whether it is taken alone or on the end
 * of a weekday stay. Sun–Sat still lands on the full-week package above,
 * which is cheaper than the 300 + 350 the same range would sum to — the most
 * specific rule that matches wins, and it is the one that favours the guest.
 */
export function quote(
  start: Date,
  end: Date,
  prices: Record<string, number>,
  rates: Rates,
  occasions: Occasion[] = [],
): Quote {
  const days = eachDay(start, end);
  const breakdown = days.map((d) => {
    const iso = fmtDate(d);
    const custom = Object.prototype.hasOwnProperty.call(prices, iso);
    return { date: iso, price: custom ? prices[iso] : defaultDayRate(d, rates), custom };
  });
  const hasCustom = breakdown.some((b) => b.custom);
  const perDay = sumStayDays(days, rates, prices);

  if (hasCustom) {
    return {
      total: perDay,
      days: days.length,
      packageKey: null,
      hasCustom,
      occasion: null,
      breakdown,
    };
  }

  const from = fmtDate(start);
  const to = fmtDate(end);
  // The server forbids overlapping active occasions, so at most one matches;
  // the sort only decides a winner if that ever changes.
  const occasion = occasions
    .filter((o) => o.start <= to && o.end >= from)
    .sort((a, b) => b.price - a.price)[0];

  if (occasion) {
    // The same sum over the days the occasion has not already paid for. A
    // block straddling the edge of that window is not whole among them, so it
    // falls back to daily rates -- the rule, rather than an exception to it.
    const outside = sumStayDays(
      days.filter((d) => fmtDate(d) < occasion.start || fmtDate(d) > occasion.end),
      rates,
      prices,
    );
    return {
      total: occasion.price + outside,
      days: days.length,
      packageKey: "special",
      hasCustom: false,
      occasion,
      breakdown,
    };
  }

  const packageKey = matchPackage(start, end);
  const total = packageKey ? rates[packageKey] : perDay;

  return { total, days: days.length, packageKey, hasCustom: false, occasion: null, breakdown };
}

/* -------------------------------------------------------- availability */

export interface Availability {
  unavailable: Set<string>;
  today: Date;
}

export function isBlocked(d: Date, a: Availability): boolean {
  return d < a.today || a.unavailable.has(fmtDate(d));
}

/** True when every day in the inclusive range is selectable. */
export function rangeIsFree(start: Date, end: Date, a: Availability): boolean {
  return eachDay(start, end).every((d) => !isBlocked(d, a));
}

/**
 * "Thu 8 \u2013 Sat 10 Oct", or a single date when the stay is one day.
 *
 * Shared by the booking calendar and the reservation lookup: a guest who
 * picked "Thu 1 \u2013 Sat 3 Oct" should be shown the same stay in the same
 * words when they come back to check it, not the ISO dates the row is
 * stored as. The year is left off because both places are talking about a
 * stay that is being chosen or is still ahead.
 */
export function formatSpan(from: Date, to: Date, lang: "en" | "ar"): string {
  const loc = dateLocale(lang);
  // Locales put a comma after the weekday, which reads wrong in the middle
  // of a range: "Thu 1 \u2013 Sat, 3 Oct". Both commas, since Arabic has its own.
  const fmt = (d: Date, withMonth: boolean) =>
    d
      .toLocaleDateString(loc, {
        weekday: "short",
        day: "numeric",
        ...(withMonth ? { month: "short" } : {}),
      })
      .replace(/[,\u060C]/g, "");
  if (fmtDate(from) === fmtDate(to)) return fmt(to, true);
  return `${fmt(from, false)} \u2013 ${fmt(to, true)}`;
}

export function formatMoney(amount: number, lang: "en" | "ar"): string {
  const n = Number.isInteger(amount) ? amount : Number(amount.toFixed(2));
  return lang === "ar" ? `${n} د.ك` : `KD ${n}`;
}

/**
 * The refundable insurance deposit added on top of every stay.
 *
 * The real amount is settings.insurance_deposit, which the database also
 * records on each booking; this is only what the page shows before the
 * settings have loaded, and it matches the database's own fallback.
 */
export const INSURANCE_DEPOSIT = 100;

/**
 * Arrival and departure times.
 *
 * A booked day is a night at the chalet, and its stay ends the morning after
 * the last one: a single Monday is Monday 2 PM to Tuesday 12 PM, the Thu–Sat
 * weekend is Thursday 2 PM to Sunday 12 PM. That is what makes the week fit
 * together -- the weekend's guests leave Sunday at noon and the weekday's
 * arrive at two, and the same again on Thursday -- with two hours between
 * them to turn the chalet round. Showing the last booked day as the check-out
 * day would have put check-out at noon on the day of a 2 PM check-in.
 */
export const CHECK_IN_HOUR = 14;
export const CHECK_OUT_HOUR = 12;

/** The day a stay is left: the morning after its last booked day. */
export function checkOutDay(end: Date): Date {
  return addDays(end, 1);
}

/** "2:00 PM" / "2:00 م", in Latin digits like every other number on the site. */
export function formatHour(hour: number, lang: "en" | "ar"): string {
  return new Date(2000, 0, 1, hour).toLocaleTimeString(dateLocale(lang, "en-US"), {
    hour: "numeric",
    minute: "2-digit",
  });
}
