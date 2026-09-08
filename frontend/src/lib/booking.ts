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

/** Guests may not request a stay shorter than this. */
export const MIN_STAY_DAYS = 3;

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

export interface Quote {
  total: number;
  days: number;
  /** Which package matched, if any. */
  packageKey: PackageKey | null;
  /** True when a custom daily override applied to at least one day. */
  hasCustom: boolean;
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

/** The package a range matches exactly, by length and start/end weekday. */
export function matchPackage(start: Date, end: Date): PackageKey | null {
  const len = daysBetween(start, end);
  const from = start.getDay();
  const to = end.getDay();
  if (len === 7 && from === 0 && to === 6) return "fullWeek";
  if (len === 3 && from === 4 && to === 6) return "weekend";
  if (len === 4 && from === 0 && to === 3) return "weekday";
  return null;
}

/**
 * Price a stay.
 *
 * Custom daily prices win outright: if the admin has priced any day in the
 * range, the whole range is summed per-day so the override is never masked by
 * a flat package rate. Otherwise an exact package match uses the flat rate,
 * and anything else falls back to the per-day defaults.
 */
export function quote(start: Date, end: Date, prices: Record<string, number>, rates: Rates): Quote {
  const days = eachDay(start, end);
  const breakdown = days.map((d) => {
    const iso = fmtDate(d);
    const custom = Object.prototype.hasOwnProperty.call(prices, iso);
    return { date: iso, price: custom ? prices[iso] : defaultDayRate(d, rates), custom };
  });
  const hasCustom = breakdown.some((b) => b.custom);
  const packageKey = hasCustom ? null : matchPackage(start, end);

  const total = packageKey ? rates[packageKey] : breakdown.reduce((sum, b) => sum + b.price, 0);

  return { total, days: days.length, packageKey, hasCustom, breakdown };
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

export function formatMoney(amount: number, lang: "en" | "ar"): string {
  const n = Number.isInteger(amount) ? amount : Number(amount.toFixed(2));
  return lang === "ar" ? `${n} د.ك` : `KD ${n}`;
}
