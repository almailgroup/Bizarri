import { requireLang } from "@/lib/lang-route";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Paperclip, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CodeDialog } from "@/components/EmailVerify";
import { rememberBookingRef } from "@/components/BookingLookup";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { useI18n, type TrKey } from "@/lib/i18n";
import { dateLocale } from "@/lib/locale";
import { usePageMeta } from "@/hooks/use-page-meta";
import { scrollToTop } from "@/lib/scroll";
import {
  MIN_STAY_DAYS,
  addDays,
  daysBetween,
  eachDay,
  fmtDate,
  formatMoney,
  formatSpan,
  parseDate,
  quote,
  weekendIsWhole,
  startOfMonth,
  startOfToday,
} from "@/lib/booking";
import {
  uploadCivilId,
  useAvailability,
  useChalets,
  useRates,
  useRequestBooking,
  useSpecialOccasions,
} from "@/lib/api";
import type { BookingRow } from "@/integrations/supabase/types";
import { readGuest, rememberGuest } from "@/lib/guest";

/**
 * Which step of the flow is on screen, carried in the address.
 *
 * The three steps used to be component state at one URL, so they left no
 * trace in the browser's history: Back from "Your details" skipped the dates
 * entirely and left the booking page for whatever came before it -- usually
 * the home page. Each step is now a history entry of its own, so Back and
 * Forward move one step at a time like everywhere else on the site.
 *
 * No step means the dates. Anything else in the address is ignored rather
 * than trusted: the steps after the first only make sense with a stay chosen
 * in this visit, and a link or a reload that lands on one without it is sent
 * back to the start (see Booking and Calendar).
 */
type Step = "details" | "done";
interface BookingSearch {
  step?: Step;
}

export const Route = createFileRoute("/booking/$lang")({
  component: Booking,
  beforeLoad: requireLang,
  validateSearch: (s: Record<string, unknown>): BookingSearch =>
    s.step === "details" || s.step === "done" ? { step: s.step } : {},
});

/**
 * Every stay is one of four shapes. There is no free-form option: a guest
 * picks a shape and then a day inside it, and the calendar selects the whole
 * stay. Sun-Wed is also sold a day at a time, which is what "day" is.
 */
type DateFilter = "day" | "weekday" | "weekend" | "holiday";

/**
 * startDow null means any day of the week can begin a window, which is what
 * makes "by day" a filter rather than a special case: it is a package of one
 * that starts anywhere.
 *
 * "holiday" has no entry: its windows are not a weekday and a length but the
 * special occasions an admin has entered, each with its own dates and its own
 * flat price. It is the one shape whose stays come from the database rather
 * than from a rule, which is why windowsIn() handles it separately.
 */
const FILTER_SHAPE: Record<
  Exclude<DateFilter, "holiday">,
  { startDow: number | null; length: number }
> = {
  day: { startDow: null, length: 1 }, // any single day
  weekday: { startDow: 0, length: 4 }, // Sun–Wed
  weekend: { startDow: 4, length: 3 }, // Thu–Sat
};

const FILTERS: DateFilter[] = ["day", "weekday", "weekend", "holiday"];

const FILTER_LABEL = {
  day: "filterByDay",
  weekday: "filterWeekday",
  weekend: "filterWeekend",
  holiday: "filterHoliday",
} as const;

const FILTER_NOTE = {
  day: "filterByDayNote",
  weekday: "filterWeekdayNote",
  weekend: "filterWeekendNote",
  holiday: "filterHolidayNote",
} as const;

const MAX_ID_BYTES = 5 * 1024 * 1024;
const ID_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

/** Guest details, held by Calendar so stepping back does not wipe them. */
interface GuestDetails {
  name: string;
  phone: string;
  email: string;
  guests: string;
  notes: string;
}

const BLANK_DETAILS: GuestDetails = { name: "", phone: "+965 ", email: "", guests: "2", notes: "" };

function Booking() {
  const { tr, lang } = useI18n();
  usePageMeta(
    lang === "en" ? "Booking" : "الحجز",
    lang === "en"
      ? "Check availability and request your stay at Bizarri Chalet."
      : "تحقق من التوفر واطلب إقامتك في شاليه بيزاري.",
  );

  const { step } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [chaletId, setChaletId] = useState(1);
  const [confirmed, setConfirmed] = useState<BookingRow | null>(null);

  // A confirmation is only ever this visit's own: reloaded, or followed from
  // a link, there is no booking in hand to show, so start again from the dates
  // rather than an empty "Confirmed".
  const done = step === "done" && !!confirmed;

  // Every step starts at the top, however it was reached -- Continue, the
  // page's Back, or the browser's Back and Forward. On a history move the
  // router puts back the old offset instead, which on the dates is wherever
  // Continue was pressed: halfway down the calendar, with the step's heading
  // and the shapes off the top of the screen. It does that when it signals
  // onRendered; subscribing to the same signal runs after it, so this has the
  // last word rather than racing it. Only for a change of step on this page:
  // moving between pages is left to the router, which already gets it right.
  const router = useRouter();
  useEffect(
    () =>
      router.subscribe("onRendered", ({ fromLocation, toLocation }) => {
        if (!fromLocation || fromLocation.pathname !== toLocation.pathname) return;
        const stepOf = (l: typeof toLocation) => (l.search as BookingSearch).step;
        if (stepOf(fromLocation) !== stepOf(toLocation)) scrollToTop();
      }),
    [router],
  );
  useEffect(() => {
    if (step === "done" && !confirmed) navigate({ search: {}, replace: true });
  }, [step, confirmed, navigate]);

  return (
    <PageShell>
      <section className="mx-auto max-w-4xl px-6 py-16 md:py-32">
        <p className="mb-6 text-xs uppercase tracking-[0.4em] text-muted-foreground">
          {tr("booking")}
        </p>

        {!done && (
          <Calendar
            chaletId={chaletId}
            setChaletId={setChaletId}
            showForm={step === "details"}
            onDone={(b) => {
              rememberBookingRef(b.ref);
              setConfirmed(b);
              // In place of the details entry, not on top of it: Back from
              // the confirmation must not land on a form that has already
              // been sent, inviting the same request a second time. It goes
              // to the dates instead, fresh, for anyone booking another stay.
              navigate({ search: { step: "done" }, replace: true });
              scrollToTop();
            }}
          />
        )}

        {done && confirmed && <Confirmation booking={confirmed} />}
      </section>
    </PageShell>
  );
}

/** Where the guest is in the flow, so the page never feels open-ended. */
function Steps({ current }: { current: 1 | 2 | 3 }) {
  const { tr } = useI18n();
  const labels = [tr("stepDates"), tr("stepDetails"), tr("stepDone")];
  return (
    <ol className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs uppercase tracking-widest">
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-3">
            <span
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-2 ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center border text-xs ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : done
                      ? "border-foreground/40 text-foreground/60"
                      : "border-border"
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : n}
              </span>
              {label}
            </span>
            {n < 3 && <span aria-hidden="true" className="h-px w-5 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

/** The package rates, so nobody has to leave the flow to find out what it costs. */
function RatesStrip() {
  const { tr, lang } = useI18n();
  const { data: rates } = useRates();
  const { data: occasions } = useSpecialOccasions();
  if (!rates) return null;

  const today = fmtDate(new Date());
  const upcoming = (occasions ?? []).filter((o) => o.end >= today).slice(0, 2);

  const items = [
    { label: tr("weekdayPkg"), price: rates.weekday },
    { label: tr("weekendPkg"), price: rates.weekend },
    // No full week. Nothing on this page can select a Sun–Sat stay any more,
    // and a price for something the site will not sell is worse than one
    // fewer row -- a guest who asks for it has to be told no.
    ...upcoming.map((o) => ({
      label: lang === "en" ? o.nameEn : o.nameAr || o.nameEn,
      price: o.price,
    })),
  ];

  return (
    <div className="mb-5 border border-border p-3 md:mb-6 md:p-5">
      <p className="mb-2 hidden text-xs uppercase tracking-widest text-muted-foreground md:mb-3 md:block">
        {tr("ratesAtAGlance")}
      </p>
      <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1 md:gap-x-8 md:gap-y-3">
        {items.map((it) => (
          <div key={it.label} className="flex items-baseline gap-1.5 md:block">
            <dt className="text-xs text-muted-foreground">{it.label}</dt>
            {/* "From", because the number beside a package is what that stay
                costs before a custom day price moves it, and because a single
                weekday is less than any of them. A bare figure reads as the
                price; this reads as the floor, which is what it is. */}
            <dd className="text-sm font-medium md:mt-0.5 md:text-lg">
              {tr("priceFrom").replace("{price}", formatMoney(it.price, lang))}
            </dd>
          </div>
        ))}
      </dl>
      {/* A minimum of one is no minimum at all; saying so is noise. */}
      {rates.minStayDays > 1 && (
        <p className="mt-2 text-xs text-muted-foreground md:mt-3">
          {tr("minStayNote").replace("{n}", String(rates.minStayDays))}
        </p>
      )}
    </div>
  );
}

/**
 * Which chalet the calendar underneath is about.
 *
 * It used to be a label and two pills reading BIZARRI CHALET 1 and BIZARRI
 * CHALET 2, in small wide-tracked capitals. Everything but the last character
 * of each was identical, so telling them apart meant reading both to the end
 * -- the one job the control has. The names now get the room and the weight
 * to be read at a glance, in the same card shape as the quick picks and the
 * date filter further down, so the page speaks one visual language.
 *
 * Nothing said the choice did anything, either; the note does.
 */
function ChaletPicker({
  chaletId,
  setChaletId,
}: {
  chaletId: number;
  setChaletId: (id: number) => void;
}) {
  const { tr, lang } = useI18n();
  const { data: chalets } = useChalets();
  const list = chalets ?? [];

  // One chalet is not a choice. A lone button that cannot be turned off, under
  // a heading asking which one you want, is a question with one answer.
  if (list.length < 2) return null;

  return (
    <div className="mb-6">
      <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground" id="pick-chalet">
        {tr("pickChalet")}
      </p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="pick-chalet">
        {list.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setChaletId(c.id)}
            aria-pressed={chaletId === c.id}
            className={`border p-3 text-start font-display text-sm transition-colors sm:p-4 sm:text-lg ${
              chaletId === c.id
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:border-foreground/50"
            }`}
          >
            {lang === "en" ? c.name_en : c.name_ar}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{tr("pickChaletNote")}</p>
    </div>
  );
}

function Calendar({
  chaletId,
  setChaletId,
  showForm,
  onDone,
}: {
  chaletId: number;
  setChaletId: (id: number) => void;
  /** The details step is in the address; see BookingSearch. */
  showForm: boolean;
  onDone: (b: BookingRow) => void;
}) {
  const { tr, lang } = useI18n();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const today = useMemo(startOfToday, []);
  const thisMonth = useMemo(() => startOfMonth(today), [today]);

  const [month, setMonth] = useState(thisMonth);
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [error, setError] = useState("");
  // A day at a time is the least committing of the three, so it is where the
  // calendar opens.
  const [filter, setFilter] = useState<DateFilter>("day");
  // Whether this visit put the details step into history itself. When it did,
  // the page's own Back button is the browser's Back -- the entry behind is
  // the dates -- so the two can never disagree, and pressing one after the
  // other does not leave a duplicate of the dates to walk back through.
  const pushedForm = useRef(false);
  const [jumped, setJumped] = useState(false);
  // Roving focus for the date grid. Every day used to be its own tab stop,
  // so a keyboard user pressed Tab about thirty times to get past the
  // calendar; a date grid should be one stop with arrows inside it.
  const [focusDay, setFocusDay] = useState<Date | null>(null);
  const [keyboardNav, setKeyboardNav] = useState(false);

  // Held here, not in BookingForm: stepping back to change dates used to
  // unmount the form and silently discard everything the guest had typed.
  const [details, setDetails] = useState<GuestDetails>(BLANK_DETAILS);
  const [recognised, setRecognised] = useState(false);

  // localStorage is not readable during SSR, so fill in after mount.
  useEffect(() => {
    const saved = readGuest();
    if (!saved) return;
    setDetails((d) => ({ ...d, ...saved }));
    setRecognised(true);
  }, []);
  const [civilId, setCivilId] = useState<File | null>(null);
  const [terms, setTerms] = useState(false);

  // A year of availability in one request, so paging months is instant and the
  // blocked set always comes from the server rather than the browser.
  const windowEnd = useMemo(() => new Date(today.getFullYear() + 1, today.getMonth(), 0), [today]);
  const {
    data: calendar,
    isLoading,
    error: loadError,
  } = useAvailability(chaletId, thisMonth, windowEnd);
  const { data: rates } = useRates();
  const { data: occasions } = useSpecialOccasions();

  const byDay = useMemo(() => {
    const map = new Map<string, { blocked: boolean; price: number; custom: boolean }>();
    for (const d of calendar ?? []) {
      map.set(d.day, { blocked: d.blocked, price: Number(d.price), custom: d.custom });
    }
    return map;
  }, [calendar]);

  // Days outside the fetched window count as unavailable rather than
  // optimistically bookable.
  const dayBlocked = (d: Date) => byDay.get(fmtDate(d))?.blocked ?? true;
  const isPast = (d: Date) => d < today;

  const customPrices = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [iso, v] of byDay) if (v.custom) out[iso] = v.price;
    return out;
  }, [byDay]);

  const occasionFor = (d: Date) => {
    const iso = fmtDate(d);
    return (occasions ?? []).find((o) => o.start <= iso && o.end >= iso) ?? null;
  };

  const atFirstMonth = month.getTime() <= thisMonth.getTime();
  // Availability is only known inside the fetched window. Without this the
  // guest could page into months where every day renders unavailable, which
  // reads as "booked solid" rather than "not loaded".
  const lastMonth = useMemo(
    () => new Date(windowEnd.getFullYear(), windowEnd.getMonth(), 1),
    [windowEnd],
  );
  const atLastMonth = month.getTime() >= lastMonth.getTime();

  /**
   * Every still-free stay of a given shape that touches a month, keyed by each
   * of its days, so tapping any of them selects the whole thing.
   *
   * Shared with the month-jump below rather than written twice: "has anything
   * left" has to mean the same thing as "has anything you can tap", or the
   * calendar opens on a month where every cell is dead and only a small note
   * explains why.
   */
  const windowsIn = (m: Date, f: DateFilter) => {
    const map = new Map<string, { start: Date; end: Date }>();
    // Pad either side so a window straddling a month boundary still resolves.
    const from = addDays(new Date(m.getFullYear(), m.getMonth(), 1), -7);
    const to = addDays(new Date(m.getFullYear(), m.getMonth() + 1, 0), 7);

    // A holiday is whatever the admin entered: its own dates, its own price.
    // The same two tests as every other shape still apply -- every day free,
    // and no half a weekend -- so a holiday the server would refuse is not
    // offered either.
    if (f === "holiday") {
      for (const o of occasions ?? []) {
        const oStart = parseDate(o.start);
        const oEnd = parseDate(o.end);
        if (oEnd < from || oStart > to) continue;
        if (oStart < today || oEnd > windowEnd) continue;
        const span = eachDay(oStart, oEnd);
        if (span.some((x) => dayBlocked(x))) continue;
        if (!weekendIsWhole(oStart, oEnd)) continue;
        for (const x of span) map.set(fmtDate(x), { start: oStart, end: oEnd });
      }
      return map;
    }

    const { startDow, length } = FILTER_SHAPE[f];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (startDow !== null && d.getDay() !== startDow) continue;
      const last = addDays(d, length - 1);
      const span = eachDay(d, last);
      if (span.some((x) => dayBlocked(x))) continue;
      // One rule for every shape: it is what stops "by day" offering a lone
      // Friday, and it leaves the weekday and weekend windows untouched.
      if (!weekendIsWhole(d, last)) continue;
      for (const x of span) map.set(fmtDate(x), { start: d, end: last });
    }
    return map;
  };

  /**
   * The occasions still to come, nearest first.
   *
   * What the Holiday card is for: it appears only when there is one, and
   * names the next, because "Holiday" on its own tells a guest nothing about
   * when it is. Past occasions are left behind rather than offered and then
   * refused, and anything beyond the booking horizon is not ours to sell yet.
   */
  const holidays = useMemo(() => {
    const iso = fmtDate(today);
    const horizon = fmtDate(windowEnd);
    return (occasions ?? [])
      .filter((o) => o.end >= iso && o.start <= horizon)
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [occasions, today, windowEnd]);
  const holidaysAhead = holidays.length > 0;

  /**
   * Whether this month has a day you can actually tap.
   *
   * Not "is the window map non-empty": that map is padded a week either side
   * so a stay straddling a month boundary still resolves, so a September that
   * offers nothing still reports the first window in October. The question is
   * whether any day drawn in this month's own grid belongs to one.
   */
  const monthHasFreeDay = (m: Date) => {
    const w = windowsIn(m, filter);
    const last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    for (let d = new Date(m.getFullYear(), m.getMonth(), 1); d <= last; d = addDays(d, 1)) {
      if (w.has(fmtDate(d))) return true;
    }
    return false;
  };

  /**
   * Landing on a month with nothing tappable reads as "fully booked". Move to
   * the first month that has something, and say so.
   *
   * Re-run when the shape changes, not only once on load: the shapes
   * themselves depend on the minimum stay, so the one in force at the moment
   * the calendar arrived is often not the one being shown a tick later. It
   * used to run once, decide September was fine because a single day was
   * free, and then sit there after the shape settled on Sun-Wed, which
   * September had none of -- thirty dead cells and a footnote.
   */
  const userPaged = useRef(false);
  useEffect(() => {
    if (!calendar || calendar.length === 0) return;
    if (userPaged.current) return;
    if (monthHasFreeDay(month)) return;
    for (let m = new Date(month), i = 0; i < 13; i++, m = addDays(startOfMonth(m), 32)) {
      const candidate = startOfMonth(m);
      if (candidate > lastMonth) break;
      if (monthHasFreeDay(candidate)) {
        setMonth(candidate);
        setJumped(true);
        return;
      }
    }
  }, [calendar, filter, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const arr: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= last.getDate(); d++) {
      arr.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    return arr;
  }, [month]);

  const windows = useMemo(
    () => windowsIn(month, filter),
    [filter, month, byDay], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** The single day in the grid that Tab reaches; arrows move it from there. */
  const activeDay = useMemo(() => {
    const inMonth = (d: Date | null) =>
      !!d && d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
    if (inMonth(focusDay)) return focusDay as Date;
    if (inMonth(start)) return start as Date;
    if (inMonth(today)) return today;
    const firstFree = cells.find((d) => d && !dayBlocked(d) && !isPast(d));
    return firstFree ?? new Date(month.getFullYear(), month.getMonth(), 1);
  }, [focusDay, start, month, cells, byDay]); // eslint-disable-line react-hooks/exhaustive-deps

  // Move focus to the roving day, but only in response to a key — otherwise
  // the page would steal focus on load and on every re-render.
  useEffect(() => {
    if (!keyboardNav) return;
    document.querySelector<HTMLButtonElement>(`[data-day="${fmtDate(activeDay)}"]`)?.focus();
  }, [activeDay, keyboardNav]);

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 7,
      ArrowUp: -7,
      PageDown: 30,
      PageUp: -30,
    };
    let target: Date;
    if (e.key in steps) {
      target = addDays(activeDay, steps[e.key]);
    } else if (e.key === "Home") {
      target = new Date(month.getFullYear(), month.getMonth(), 1);
    } else if (e.key === "End") {
      target = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    } else {
      return;
    }
    e.preventDefault();
    // Disabled days cannot hold focus, so keep going the same way until a
    // selectable one turns up rather than dead-ending on a booked week.
    const dir = target >= activeDay ? 1 : -1;
    for (let i = 0; i < 400 && (dayBlocked(target) || isPast(target)); i++) {
      target = addDays(target, dir);
    }
    if (target < today || target > windowEnd) return;
    setKeyboardNav(true);
    setFocusDay(target);
    if (target.getMonth() !== month.getMonth() || target.getFullYear() !== month.getFullYear()) {
      setMonth(startOfMonth(target));
      setJumped(false);
    }
  };

  const monthHasWindow = useMemo(
    () => cells.some((d) => d && windows.has(fmtDate(d))),
    [windows, cells],
  );

  // Shown live while choosing; request_booking() re-derives it server-side and
  // its answer is what is stored.
  const current =
    start && end && rates ? quote(start, end, customPrices, rates, occasions ?? []) : null;
  // rates is the source of truth; the constant only covers the moment before
  // it has loaded. request_booking() enforces the same number server-side.
  const minStay = rates?.minStayDays ?? MIN_STAY_DAYS;

  /**
   * Only the shapes long enough to book.
   *
   * With a three-day minimum, "one day" is a shape the server would refuse,
   * and offering it is a promise the booking cannot keep -- the guest picks a
   * day and finds Continue dead, with no way to make it work inside that
   * shape. Dropping it means every shape on offer is bookable by
   * construction, which is why the calendar no longer has any way to produce
   * a stay that is too short.
   */
  const shapes = useMemo(() => {
    const fit = FILTERS.filter((f) =>
      // A holiday's length is whatever the occasion is, so it is offered when
      // there is one to offer rather than by measuring it against the
      // minimum; an occasion shorter than the minimum is a contradiction the
      // admin has to resolve, and the server says so.
      f === "holiday" ? holidaysAhead : FILTER_SHAPE[f].length >= minStay,
    );
    // A minimum longer than every shape is a misconfiguration rather than a
    // reason to offer nothing; the server has the final say either way.
    return fit.length ? fit : FILTERS.filter((f) => f !== "holiday");
  }, [minStay, holidaysAhead]);

  useEffect(() => {
    if (shapes.includes(filter)) return;
    setFilter(shapes[0]);
    setStart(null);
    setEnd(null);
  }, [shapes, filter]);
  const tooShort = current !== null && current.days < minStay;
  // Thu–Sat is one product, so a stay may not take a slice of it. Checked
  // here as well as on the tap: a selection can also arrive from a quick
  // pick or from switching filters, and request_booking() refuses it either
  // way -- better to say so before the guest fills in a form.
  const halfWeekend = !!start && !!end && !weekendIsWhole(start, end);
  const ready = !!start && !!end && !tooShort && !halfWeekend;

  // The whole stay is chosen in one tap now, so there is no half-made range
  // for a pointer to stand in for: what is highlighted is what is selected.
  const previewEnd = end;
  const selectedDays = start && previewEnd ? daysBetween(start, previewEnd) : 0;

  // One tap selects the whole stay. There is no second tap to set an end:
  // every shape has a fixed length, so a day is either inside a still-free
  // window of the chosen shape or it is not selectable at all.
  const selectDay = (d: Date) => {
    setError("");
    const w = windows.get(fmtDate(d));
    if (!w) return;
    setStart(w.start);
    setEnd(w.end);
  };

  const inRange = (d: Date) => start && previewEnd && d >= start && d <= previewEnd;
  const isEdge = (d: Date) =>
    (start && fmtDate(d) === fmtDate(start)) || (previewEnd && fmtDate(d) === fmtDate(previewEnd));

  const monthName = month.toLocaleDateString(dateLocale(lang, "en-US"), {
    month: "long",
    year: "numeric",
  });
  const weekdayLabels =
    lang === "ar"
      ? ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const goToForm = () => {
    if (!start || !end) {
      setError(tr("pickStart"));
      return;
    }
    if (!weekendIsWhole(start, end)) {
      setError(tr("weekendWhole"));
      return;
    }
    if (daysBetween(start, end) < minStay) {
      setError(tr("minStay").replace("{n}", String(minStay)));
      return;
    }
    pushedForm.current = true;
    navigate({ search: { step: "details" } });
    scrollToTop();
  };

  // Details with no stay chosen -- a reload, a shared link, Forward into a
  // page whose dates are gone -- has nothing to fill in, so it is the dates.
  // Replaced, not pushed, so Back does not return to the empty step.
  useEffect(() => {
    if (showForm && (!start || !end)) navigate({ search: {}, replace: true });
  }, [showForm, start, end, navigate]);

  const backToDates = () => {
    if (pushedForm.current) router.history.back();
    else navigate({ search: {}, replace: true });
  };

  if (showForm && start && end && current) {
    return (
      <BookingForm
        chaletId={chaletId}
        start={start}
        end={end}
        total={current.total}
        details={details}
        setDetails={setDetails}
        recognised={recognised}
        civilId={civilId}
        setCivilId={setCivilId}
        terms={terms}
        setTerms={setTerms}
        onBack={backToDates}
        onDone={onDone}
      />
    );
  }

  const changeMonth = (delta: number) => {
    setJumped(false);
    // Once the guest pages for themselves, the calendar stops moving under
    // them: an empty month they chose to look at is their business.
    userPaged.current = true;
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  };

  const rangeLabel = start
    ? `${fmtDate(start)}${end ? ` → ${fmtDate(end)}` : ""}`
    : tr("pickStart");

  return (
    <>
      {/* The bar below is position:fixed, so it must sit OUTSIDE the animated
          wrapper: animate-fade-up leaves a transform on the element (fill-mode
          both), and a transformed ancestor becomes the containing block for
          fixed descendants — the bar would scroll with the page instead of
          staying pinned. */}
      <div className="animate-fade-up pb-28 lg:pb-0">
        <Steps current={1} />
        <h1 className="mb-2 font-display text-3xl md:text-5xl">{tr("selectDates")}</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {tr("noPaymentNow")} {filter === "day" ? tr("filterDayHint") : tr("filterHint")}
        </p>

        <RatesStrip />

        <ChaletPicker
          chaletId={chaletId}
          setChaletId={(id) => {
            setChaletId(id);
            setStart(null);
            setEnd(null);
            setError("");
          }}
        />

        {loadError && (
          <p className="mb-4 border border-destructive p-4 text-sm text-destructive">
            {(loadError as Error).message}
          </p>
        )}

        {/* How to choose, above the calendar. Each option says what it gives
            you and what it costs, because "Weekend" on its own does not tell
            a guest it means three days from a Thursday at 350. */}
        <div
          className={`mb-4 grid gap-2 ${shapes.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}
          role="group"
          aria-label={tr("pickShape")}
        >
          {shapes.map((f) => {
            const on = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFilter(f);
                  setStart(null);
                  setEnd(null);
                  setError("");
                }}
                aria-pressed={on}
                className={`flex flex-col gap-1 border p-3 text-start transition-colors ${
                  on
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground/50"
                }`}
              >
                <span className="text-xs uppercase tracking-widest">{tr(FILTER_LABEL[f])}</span>
                {/* Every other shape is a rule and says so. A holiday is a
                    date, so it names the next one instead: "Holiday / Sun -
                    Wed" would be true of a weekday break too, and tells a
                    guest nothing about which holiday or when. */}
                <span className={`text-xs ${on ? "opacity-70" : "text-muted-foreground"}`}>
                  {f === "holiday" && holidays[0]
                    ? lang === "en"
                      ? holidays[0].nameEn
                      : holidays[0].nameAr || holidays[0].nameEn
                    : tr(FILTER_NOTE[f])}
                </span>
                {f === "holiday" && holidays[0] && (
                  <span className={`text-xs ${on ? "opacity-70" : "text-muted-foreground"}`}>
                    {formatSpan(parseDate(holidays[0].start), parseDate(holidays[0].end), lang)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {jumped && (
          <p className="mb-4 border border-border bg-secondary p-4 text-sm">
            {tr("noneThisMonth")}
          </p>
        )}

        <div className="relative border border-border p-2 sm:p-6 md:p-8">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 text-sm uppercase tracking-widest text-muted-foreground">
              {lang === "en" ? "Loading availability…" : "جارٍ تحميل التوفر…"}
            </div>
          )}

          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => changeMonth(-1)}
              disabled={atFirstMonth}
              aria-label={lang === "en" ? "Previous month" : "الشهر السابق"}
              className="shrink-0 p-2 enabled:hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-25"
            >
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
            </button>
            <p
              className="whitespace-nowrap font-display text-xl capitalize sm:text-2xl"
              aria-live="polite"
            >
              {monthName}
            </p>
            <button
              onClick={() => changeMonth(1)}
              disabled={atLastMonth}
              aria-label={lang === "en" ? "Next month" : "الشهر التالي"}
              className="shrink-0 p-2 enabled:hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-25"
            >
              <ChevronRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-0.5 text-center text-xs uppercase tracking-wider text-muted-foreground sm:gap-1">
            {weekdayLabels.map((w) => (
              <div key={w} className="py-2">
                {w}
              </div>
            ))}
          </div>

          <div
            role="grid"
            aria-label={monthName}
            onKeyDown={onGridKeyDown}
            // Tighter gaps on a phone buy the cells themselves a few pixels
            // each, which is the difference between a 37px tap target and a
            // 40px one on a 360px screen.
            className="grid grid-cols-7 gap-0.5 sm:gap-1"
          >
            {cells.map((d, i) => {
              if (!d) return <div key={`pad-${i}`} />;
              const iso = fmtDate(d);
              const past = isPast(d);
              // A future day the server refuses is held by a booking or blocked
              // by the admin — that is what black means. Past days are simply
              // gone, and are faded instead.
              const reserved = !past && dayBlocked(d);
              const offPackage = !windows.has(iso);
              // Off-shape days are aria-disabled rather than disabled: a
              // disabled button cannot take focus, and with "one day" as the
              // opening shape three columns in seven are off-shape, so arrow
              // keys had nothing to land on and the grid stopped being
              // navigable at all. They stay in the roving order, read as
              // unavailable, and do nothing when pressed -- selectDay already
              // returns when a day is in no window. Past and reserved days
              // are genuinely gone rather than merely out of shape, and stay
              // disabled.
              const disabled = past || reserved;
              const selected = isEdge(d);
              const within = inRange(d);
              const priced = byDay.get(iso)?.custom === true;
              const occ = occasionFor(d);
              const dayLabel = d.toLocaleDateString(dateLocale(lang, "en-US"), {
                weekday: "long",
                day: "numeric",
                month: "long",
              });

              const tone = reserved
                ? "bg-black text-white cursor-not-allowed"
                : past
                  ? "cursor-not-allowed text-muted-foreground/30"
                  : selected
                    ? // An outlined circle, not a filled one: the ring marks the
                      // day without hiding its number under a solid block, and
                      // ring-inset keeps it inside the cell so nothing shifts.
                      "bg-background font-semibold text-foreground ring-2 ring-inset ring-foreground"
                    : within
                      ? "bg-secondary text-foreground"
                      : offPackage
                        ? "cursor-not-allowed text-muted-foreground/30"
                        : occ
                          ? "ring-1 ring-inset ring-foreground/25 hover:bg-secondary"
                          : "hover:bg-secondary";

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  aria-disabled={offPackage || undefined}
                  onClick={() => selectDay(d)}
                  aria-label={`${dayLabel}${reserved ? ` — ${tr("reservedLabel")}` : ""}${
                    occ ? ` — ${lang === "en" ? occ.nameEn : occ.nameAr || occ.nameEn}` : ""
                  }`}
                  aria-pressed={!!selected}
                  data-day={iso}
                  tabIndex={fmtDate(activeDay) === iso ? 0 : -1}
                  // The cell is square, so a full radius is a circle. Only
                  // the two chosen days get one; the days between stay
                  // rectangular so the run still reads as one stay rather
                  // than a row of separate marks.
                  className={`relative flex aspect-square flex-col items-center justify-center text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-current ${tone} ${
                    selected ? "rounded-full" : ""
                  }`}
                >
                  {d.getDate()}
                  {priced && !reserved && !past && (
                    <span
                      className="absolute bottom-1 h-1 w-1 rounded-full bg-foreground/50"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* The count, where the counting happens. Reading it off a summary
              below the fold means tapping, scrolling, checking, scrolling
              back — so it sits against the grid and follows the pointer while
              a check-out day is still being chosen. */}
          {start && (
            <div className="mt-5 border-t border-border pt-4">
              <div>
                <p className="font-display text-xl" aria-live="polite">
                  {previewEnd
                    ? selectedDays === 1
                      ? tr("oneDaySelected")
                      : tr("daysSelected").replace("{n}", String(selectedDays))
                    : tr("pickEndHint")}
                </p>
                {previewEnd && (
                  <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                    {fmtDate(start)} → {fmtDate(previewEnd)}
                  </p>
                )}
              </div>
            </div>
          )}

          {!monthHasWindow && (
            <p className="mt-4 text-xs text-muted-foreground">{tr("filterNoneLeft")}</p>
          )}
          {atLastMonth && <p className="mt-4 text-xs text-muted-foreground">{tr("horizonNote")}</p>}

          <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 bg-black" /> {tr("reservedLabel")}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 ring-2 ring-inset ring-foreground" /> {tr("selectedLabel")}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 border border-border bg-secondary" />{" "}
              {lang === "en" ? "In stay" : "ضمن الإقامة"}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 ring-1 ring-inset ring-foreground/25" /> {tr("specialPkg")}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-foreground/50" /> {tr("customPricing")}
            </span>
          </div>
        </div>

        {/* Only once there is something to summarise: three boxes of em-dashes
            were the tallest thing between the calendar and the button, and
            said nothing. The calendar states the length on its own. */}
        <div className={`mt-6 grid gap-3 sm:grid-cols-3 ${start ? "" : "hidden sm:grid"}`}>
          <div className="border border-border p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {tr("checkIn")}
            </p>
            <p className="mt-1 font-display text-xl" dir="ltr">
              {start ? fmtDate(start) : "—"}
            </p>
          </div>
          <div className="border border-border p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {tr("checkOut")}
            </p>
            <p className="mt-1 font-display text-xl" dir="ltr">
              {end ? fmtDate(end) : "—"}
            </p>
          </div>
          <div
            className={`border p-4 ${
              tooShort ? "border-destructive" : "border-foreground bg-foreground text-background"
            }`}
          >
            <p className="text-xs uppercase tracking-widest opacity-70">
              {tr("total")}
              {current ? ` · ${current.days} ${tr("nightsLabel")}` : ""}
            </p>
            <p className="mt-1 font-display text-xl">
              {current && !tooShort ? formatMoney(current.total, lang) : "—"}
            </p>
          </div>
        </div>

        {current && !tooShort && current.occasion && (
          <p className="mt-3 text-sm text-muted-foreground">
            {tr("specialPkg")} ·{" "}
            {lang === "en"
              ? current.occasion.nameEn
              : current.occasion.nameAr || current.occasion.nameEn}
          </p>
        )}
        {current && !tooShort && current.packageKey && current.packageKey !== "special" && (
          <p className="mt-3 text-sm text-muted-foreground">
            {current.packageKey === "fullWeek"
              ? tr("fullWeekPkg")
              : current.packageKey === "weekend"
                ? tr("weekendPkg")
                : tr("weekdayPkg")}
          </p>
        )}
        {current && !tooShort && current.hasCustom && (
          <p className="mt-3 text-sm text-muted-foreground">{tr("customPricing")}</p>
        )}

        {/* Selection, price and refusals were all silent to a screen reader:
            the calendar changed underneath them with no announcement. */}
        <p aria-live="polite" className="sr-only">
          {error
            ? error
            : current && !tooShort && start && end
              ? `${fmtDate(start)} → ${fmtDate(end)}, ${current.days} ${tr("nightsLabel")}, ${formatMoney(current.total, lang)}`
              : ""}
        </p>

        {error && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={goToForm}
            disabled={!ready}
            className="bg-black px-8 py-4 text-sm uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {tr("continueLabel")}
          </button>
          <button
            onClick={() => {
              setStart(null);
              setEnd(null);
              setError("");
            }}
            className="border border-border px-8 py-4 text-sm uppercase tracking-widest hover:bg-secondary"
          >
            {tr("clear")}
          </button>
        </div>

        <p className="mt-8 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {tr("whatsappAlt")}
          <WhatsAppLink
            context={{ chaletId, start, end }}
            className="-my-2 inline-flex items-center gap-2 py-2 underline underline-offset-4 hover:text-foreground"
            label="WhatsApp"
          />
        </p>

        <p className="mt-4 text-sm text-muted-foreground">
          <Link
            to="/reservation/$lang"
            params={{ lang }}
            className="-my-2 inline-block py-2 underline underline-offset-4 hover:text-foreground"
          >
            {tr("checkBooking")}
          </Link>
        </p>
      </div>

      {/* Mobile keeps the running total and the way forward in view; on a
          phone the tiles above scroll out of sight as soon as you pick dates. */}
      {start && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-5 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-[11px] uppercase tracking-widest text-muted-foreground">
                {tr("yourStay")}
              </p>
              <p className="truncate text-sm" dir="ltr">
                {rangeLabel}
              </p>
              <p className="text-sm font-semibold">
                {current && !tooShort ? formatMoney(current.total, lang) : "—"}
              </p>
            </div>
            <button
              onClick={goToForm}
              disabled={!ready}
              className="shrink-0 bg-black px-6 py-3 text-xs uppercase tracking-widest text-white disabled:opacity-30"
            >
              {tr("continueLabel")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function BookingForm({
  chaletId,
  start,
  end,
  total,
  details,
  setDetails,
  recognised,
  civilId,
  setCivilId,
  terms,
  setTerms,
  onBack,
  onDone,
}: {
  chaletId: number;
  start: Date;
  end: Date;
  total: number;
  details: GuestDetails;
  setDetails: (d: GuestDetails) => void;
  /** Their details came back from a previous booking on this device. */
  recognised: boolean;
  civilId: File | null;
  setCivilId: (f: File | null) => void;
  terms: boolean;
  setTerms: (v: boolean) => void;
  onBack: () => void;
  onDone: (b: BookingRow) => void;
}) {
  const { tr, lang } = useI18n();
  const request = useRequestBooking();
  // The address that was actually proved, not a boolean: editing the field
  // after confirming has to drop the confirmation, and comparing the two is
  // the only way to notice.
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const emailVerified = verifiedEmail !== null && verifiedEmail === details.email.trim();
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof GuestDetails | "civilId" | "terms", string>>
  >({});

  // Release the object URL when the chosen file changes or the form unmounts.
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!civilId || !civilId.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(civilId);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [civilId]);

  const validate = () => {
    const next: typeof errors = {};
    if (details.name.trim().length < 2) {
      next.name = lang === "en" ? "Please enter your full name." : "يرجى إدخال الاسم الكامل.";
    }
    if (details.phone.replace(/\D/g, "").length < 8) {
      next.phone = lang === "en" ? "Enter a valid phone number." : "يرجى إدخال رقم هاتف صحيح.";
    }
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(details.email.trim())) {
      next.email =
        lang === "en" ? "Enter a valid email address." : "يرجى إدخال بريد إلكتروني صحيح.";
    }
    const guests = Number(details.guests);
    if (!Number.isInteger(guests) || guests < 1 || guests > 20) {
      next.guests = lang === "en" ? "Between 1 and 20 guests." : "بين 1 و 20 ضيفاً.";
    }
    if (!civilId) {
      next.civilId = tr("civilIdMissing");
    } else if (civilId.size > MAX_ID_BYTES) {
      next.civilId = tr("civilIdTooBig");
    } else if (civilId.type && !ID_TYPES.includes(civilId.type)) {
      next.civilId = tr("civilIdWrongType");
    }
    if (!terms) {
      next.terms = tr("acceptTermsRequired");
    }
    // Not the confirmation code: that is asked for after everything else is
    // in order, in the dialog Submit opens. Checking it here would mark the
    // address in error before the guest has been given any way to confirm it.
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /**
   * Everything after the code: upload the ID, ask the server for the booking.
   *
   * Separate from submit() because it has two callers -- a guest who has
   * already confirmed their address goes straight here, and one who has not
   * arrives from the dialog the moment they do.
   */
  const sendRequest = async () => {
    if (!civilId) return;

    let civilIdPath: string;
    setUploading(true);
    try {
      civilIdPath = await uploadCivilId(civilId);
    } catch (err) {
      setErrors({ civilId: (err as Error).message });
      return;
    } finally {
      setUploading(false);
    }

    const booking = await request.mutateAsync({
      chaletId,
      start,
      end,
      name: details.name,
      phone: details.phone,
      email: details.email,
      guests: Number(details.guests),
      notes: details.notes,
      civilIdPath,
      termsAccepted: terms,
      lang,
    });
    rememberGuest({ name: details.name, phone: details.phone, email: details.email });
    onDone(booking);
  };

  const [codeOpen, setCodeOpen] = useState(false);

  /**
   * Submit asks for the code, rather than the form asking for it up front.
   *
   * It used to be a step in the middle of the form: send one, wait for the
   * mail, type it, then carry on filling in the rest. That put a wait on the
   * critical path of a form nobody had finished, and a guest who never came
   * back to it had asked for a code for nothing. Now everything else is
   * checked first and the code is the last thing between the guest and the
   * request -- which is also the first moment it is worth sending one.
   */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !civilId) return;
    if (!emailVerified) {
      setCodeOpen(true);
      return;
    }
    await sendRequest();
  };

  const set = (key: keyof GuestDetails, value: string) => {
    setDetails({ ...details, [key]: value });
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
  };

  const fields: { key: keyof GuestDetails; label: string; type?: string; autoComplete?: string }[] =
    [
      { key: "name", label: tr("fullName"), autoComplete: "name" },
      { key: "phone", label: tr("phone"), type: "tel", autoComplete: "tel" },
      { key: "email", label: tr("email"), type: "email", autoComplete: "email" },
    ];

  const guests = Number(details.guests) || 0;
  const stepGuests = (by: number) => {
    const next = Math.min(20, Math.max(1, guests + by));
    set("guests", String(next));
  };

  const busy = uploading || request.isPending;

  return (
    // noValidate: the browser's own bubbles fire first and are unlocalised,
    // so validate() owns the messages instead.
    <form onSubmit={submit} noValidate className="animate-fade-up space-y-6">
      <Steps current={2} />
      <h1 className="mb-4 font-display text-4xl md:text-5xl">
        {lang === "en" ? "Guest Information" : "معلومات الضيف"}
      </h1>

      <div className="space-y-1 border border-border bg-secondary p-4 text-sm">
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
          {tr("yourStay")}
        </p>
        <p>
          <span className="font-medium">Bizarri Chalet {chaletId}</span>
        </p>
        <p dir="ltr">
          {fmtDate(start)} → {fmtDate(end)} ({daysBetween(start, end)} {tr("nightsLabel")})
        </p>
        <p className="pt-1 text-base font-semibold">{formatMoney(total, lang)}</p>
      </div>

      {recognised && <p className="text-sm text-muted-foreground">{tr("welcomeBack")}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {f.label}
            </span>
            <input
              required
              type={f.type || "text"}
              autoComplete={f.autoComplete}
              inputMode={f.key === "phone" ? "tel" : undefined}
              min={f.key === "guests" ? 1 : undefined}
              max={f.key === "guests" ? 20 : undefined}
              value={details[f.key]}
              aria-invalid={!!errors[f.key]}
              aria-describedby={errors[f.key] ? `err-${f.key}` : undefined}
              onChange={(e) => set(f.key, e.target.value)}
              className={`mt-2 w-full border bg-secondary px-4 py-3 outline-none focus:border-foreground ${
                errors[f.key] ? "border-destructive" : "border-border"
              }`}
            />
            {errors[f.key] && (
              <span id={`err-${f.key}`} className="mt-1 block text-sm text-destructive">
                {errors[f.key]}
              </span>
            )}
          </label>
        ))}
      </div>

      <div>
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          {tr("guests")}
        </span>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => stepGuests(-1)}
            disabled={guests <= 1}
            aria-label={lang === "en" ? "Fewer guests" : "عدد أقل من الضيوف"}
            className="h-12 w-12 border border-border text-lg transition-colors hover:bg-secondary disabled:opacity-30"
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            value={details.guests}
            aria-label={tr("guests")}
            aria-invalid={!!errors.guests}
            onChange={(e) => set("guests", e.target.value)}
            className={`h-12 w-20 border bg-secondary text-center outline-none focus:border-foreground ${
              errors.guests ? "border-destructive" : "border-border"
            }`}
          />
          <button
            type="button"
            onClick={() => stepGuests(1)}
            disabled={guests >= 20}
            aria-label={lang === "en" ? "More guests" : "عدد أكبر من الضيوف"}
            className="h-12 w-12 border border-border text-lg transition-colors hover:bg-secondary disabled:opacity-30"
          >
            +
          </button>
        </div>
        {errors.guests && (
          <span className="mt-1 block text-sm text-destructive">{errors.guests}</span>
        )}
      </div>

      <label className="block">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          {tr("notes")} · {tr("optionalLabel")}
        </span>
        <textarea
          rows={3}
          value={details.notes}
          onChange={(e) => set("notes", e.target.value)}
          className="mt-2 w-full border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
        />
      </label>

      {/* Civil ID — mandatory for checkout. */}
      <div>
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          {tr("civilId")} · {tr("requiredLabel")}
        </span>
        <p className="mt-1 text-sm text-muted-foreground">{tr("whyCivilId")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{tr("civilIdHint")}</p>
        <label
          className={`mt-2 flex cursor-pointer items-center gap-3 border bg-secondary px-4 py-3 transition-colors hover:border-foreground/50 ${
            errors.civilId ? "border-destructive" : "border-border"
          }`}
        >
          <Paperclip className="h-4 w-4 shrink-0" />
          <span className="truncate text-sm">{civilId ? civilId.name : tr("civilIdChoose")}</span>
          <input
            type="file"
            accept={ID_TYPES.join(",")}
            aria-label={tr("civilId")}
            aria-invalid={!!errors.civilId}
            onChange={(e) => {
              setCivilId(e.target.files?.[0] ?? null);
              if (errors.civilId) setErrors({ ...errors, civilId: undefined });
            }}
            className="sr-only"
          />
        </label>
        {preview && (
          <img src={preview} alt="" className="mt-3 max-h-40 border border-border object-contain" />
        )}
        {errors.civilId && (
          <span className="mt-1 block text-sm text-destructive">{errors.civilId}</span>
        )}
      </div>

      {/* Terms — mandatory for checkout. */}
      <div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={terms}
            aria-invalid={!!errors.terms}
            onChange={(e) => {
              setTerms(e.target.checked);
              if (errors.terms) setErrors({ ...errors, terms: undefined });
            }}
            className="mt-1 h-4 w-4 shrink-0 accent-black"
          />
          <span className="text-sm">
            {tr("acceptTerms")}{" "}
            <Link
              to="/rules/$lang"
              params={{ lang }}
              target="_blank"
              className="underline underline-offset-4 hover:opacity-70"
            >
              {tr("readTerms")}
            </Link>
          </span>
        </label>
        {errors.terms && (
          <span className="mt-1 block text-sm text-destructive">{errors.terms}</span>
        )}
      </div>

      <div className="flex items-start gap-3 border border-border p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {tr("noPaymentNow")} {tr("weReplyIn")}
        </span>
      </div>

      <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        {tr("whatsappHelp")}
        <WhatsAppLink
          context={{ chaletId, start, end }}
          className="-my-2 inline-flex items-center gap-2 py-2 underline underline-offset-4 hover:text-foreground"
          label="WhatsApp"
        />
      </p>

      {/* Server-side rejections (dates taken since you picked them, rate limit) */}
      {request.isError && (
        <p className="border border-destructive p-4 text-sm text-destructive">
          {(request.error as Error).message}
        </p>
      )}

      {/* Opened by Submit, never before. Everything else on the form has
          already been checked by the time this appears, so the only thing
          left between the guest and their request is the code. */}
      {codeOpen && !emailVerified && (
        <CodeDialog
          email={details.email}
          onClose={() => {
            setCodeOpen(false);
            // Say why nothing happened, for a guest who dismisses it.
            setErrors((prev) => ({ ...prev, email: tr("emailNeedsConfirming") }));
          }}
          onVerified={(e) => {
            setVerifiedEmail(e);
            setErrors((prev) => ({ ...prev, email: undefined }));
            setCodeOpen(false);
            void sendRequest();
          }}
        />
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-black px-10 py-4 text-sm uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-50"
        >
          {uploading
            ? tr("civilIdUploading")
            : request.isPending
              ? lang === "en"
                ? "Sending…"
                : "جارٍ الإرسال…"
              : tr("submit")}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="border border-border px-8 py-4 text-sm uppercase tracking-widest hover:bg-secondary disabled:opacity-50"
        >
          {lang === "en" ? "Back" : "رجوع"}
        </button>
      </div>
    </form>
  );
}

function Confirmation({ booking }: { booking: BookingRow }) {
  const { tr, lang } = useI18n();
  return (
    <div className="animate-fade-up py-12 text-center">
      <Steps current={3} />
      <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-black text-white">
        <Check className="h-10 w-10" />
      </div>
      <h1 className="mb-4 font-display text-4xl md:text-5xl">{tr("thankYou")}</h1>
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{tr("bookingRef")}</p>
      <p className="mt-2 font-mono text-2xl" dir="ltr">
        {booking.ref}
      </p>
      <p className="mt-6 text-muted-foreground">
        {/* Render the server's date strings as-is. new Date("2026-10-11")
            parses as UTC midnight, so reading it back with local getters
            showed the previous day for anyone behind UTC. */}
        <span dir="ltr">
          {booking.start_date} → {booking.end_date}
        </span>{" "}
        · {formatMoney(Number(booking.total), lang)}
      </p>

      <div className="mx-auto mt-10 max-w-md border border-border p-6 text-start">
        <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
          {tr("whatHappensNext")}
        </p>
        <ol className="space-y-3 text-sm">
          {[tr("nextStep1"), tr("nextStep2"), tr("nextStep3")].map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-border text-[11px]">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{s}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-8 text-sm">
        <Link
          to="/reservation/$lang"
          params={{ lang }}
          className="underline underline-offset-4 text-muted-foreground hover:text-foreground"
        >
          {tr("yourReservation")}
        </Link>
      </p>
    </div>
  );
}
