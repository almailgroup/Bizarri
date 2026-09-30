/**
 * Which locale to format a date or a time in.
 *
 * The point of it is the "-u-nu-latn": plain "ar-EG" numbers a date in
 * Arabic-Indic digits (١٢٣), and nothing else on the site does. Prices are
 * written "350 د.ك", a booking reference is BZR-4K2M9X, the phone number is
 * +965 94040955, and the day cells in the booking calendar are a plain 1, 2,
 * 3 — so an Arabic-Indic month heading sat directly above a Western-numbered
 * grid of its own days. A reference and a phone number cannot be anything but
 * Latin, so Latin is the only digit set the whole site can agree on.
 *
 * Its own module rather than i18n.tsx so that src/lib/booking.ts, which is
 * domain logic with no React in it, can call it without pulling the router
 * and the context provider into its import graph. Every date on the site goes
 * through here, so switching back is this one string rather than the seven
 * call sites it replaced, which had already drifted into three locales.
 */
export function dateLocale(lang: "en" | "ar", en: "en-GB" | "en-US" = "en-GB"): string {
  return lang === "ar" ? "ar-EG-u-nu-latn" : en;
}
