import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Paperclip, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { BookingLookup, rememberBookingRef } from "@/components/BookingLookup";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import {
  MIN_STAY_DAYS,
  addDays,
  daysBetween,
  eachDay,
  fmtDate,
  formatMoney,
  quote,
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

export const Route = createFileRoute("/booking")({ component: Booking });

/** Which package shape the calendar is filtered to. */
type DateFilter = "all" | "weekday" | "weekend";

const FILTER_SHAPE: Record<Exclude<DateFilter, "all">, { startDow: number; length: number }> = {
  weekday: { startDow: 0, length: 4 }, // Sun–Wed
  weekend: { startDow: 4, length: 3 }, // Thu–Sat
};

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

const BLANK_DETAILS: GuestDetails = { name: "", phone: "", email: "", guests: "2", notes: "" };

function Booking() {
  const { tr, lang } = useI18n();
  usePageMeta(
    lang === "en" ? "Booking" : "الحجز",
    lang === "en"
      ? "Check availability and request your stay at Bizarri Chalet."
      : "تحقق من التوفر واطلب إقامتك في شاليه بيزاري.",
  );

  const [stage, setStage] = useState<"intro" | "calendar" | "done">("intro");
  const [chaletId, setChaletId] = useState(1);
  const [confirmed, setConfirmed] = useState<BookingRow | null>(null);

  return (
    <PageShell>
      <section className="mx-auto max-w-4xl px-6 py-24 md:py-32">
        <p className="mb-6 text-xs uppercase tracking-[0.4em] text-muted-foreground">
          {tr("booking")}
        </p>

        {stage === "intro" && (
          <Intro
            chaletId={chaletId}
            setChaletId={setChaletId}
            onNext={() => setStage("calendar")}
          />
        )}

        {stage === "calendar" && (
          <Calendar
            chaletId={chaletId}
            setChaletId={setChaletId}
            onDone={(b) => {
              rememberBookingRef(b.ref);
              setConfirmed(b);
              setStage("done");
            }}
          />
        )}

        {stage === "done" && confirmed && <Confirmation booking={confirmed} />}
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
                className={`flex h-6 w-6 items-center justify-center border text-[11px] ${
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
    { label: tr("fullWeekPkg"), price: rates.fullWeek },
    ...upcoming.map((o) => ({
      label: lang === "en" ? o.nameEn : o.nameAr || o.nameEn,
      price: o.price,
    })),
  ];

  return (
    <div className="mb-6 border border-border p-5">
      <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
        {tr("ratesAtAGlance")}
      </p>
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        {items.map((it) => (
          <div key={it.label}>
            <dt className="text-xs text-muted-foreground">{it.label}</dt>
            <dd className="mt-0.5 text-lg font-medium">{formatMoney(it.price, lang)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{tr("minStayNote")}</p>
    </div>
  );
}

function ChaletPicker({
  chaletId,
  setChaletId,
  compact = false,
}: {
  chaletId: number;
  setChaletId: (id: number) => void;
  compact?: boolean;
}) {
  const { lang } = useI18n();
  const { data: chalets } = useChalets();

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {(chalets ?? []).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setChaletId(c.id)}
            aria-pressed={chaletId === c.id}
            className={`border px-4 py-2 text-xs uppercase tracking-widest transition-colors ${
              chaletId === c.id
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:border-foreground/50"
            }`}
          >
            {lang === "en" ? c.name_en : c.name_ar}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(chalets ?? []).map((c) => (
        <button
          key={c.id}
          onClick={() => setChaletId(c.id)}
          aria-pressed={chaletId === c.id}
          className={`border p-6 text-start transition-colors ${
            chaletId === c.id
              ? "border-foreground bg-foreground text-background"
              : "border-border hover:border-foreground/50"
          }`}
        >
          <p className="text-xs uppercase tracking-widest opacity-70">Chalet {c.id}</p>
          <p className="mt-2 font-display text-2xl">{lang === "en" ? c.name_en : c.name_ar}</p>
        </button>
      ))}
    </div>
  );
}

function Intro({
  chaletId,
  setChaletId,
  onNext,
}: {
  chaletId: number;
  setChaletId: (id: number) => void;
  onNext: () => void;
}) {
  const { tr, lang } = useI18n();

  return (
    <div className="animate-fade-up">
      <Steps current={1} />
      <h1 className="mb-4 font-display text-5xl md:text-6xl">{tr("startBooking")}</h1>
      <p className="mb-6 max-w-xl text-lg text-muted-foreground">
        {lang === "en"
          ? "Choose your chalet, then pick your dates."
          : "اختر الشاليه، ثم حدد التواريخ."}{" "}
        {tr("noPaymentNow")}
      </p>

      <RatesStrip />

      <div className="my-8">
        <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
          {tr("pickChalet")}
        </p>
        <ChaletPicker chaletId={chaletId} setChaletId={setChaletId} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onNext}
          className="bg-black px-8 py-4 text-sm uppercase tracking-widest text-white hover:opacity-90"
        >
          {tr("checkAvailability")}
        </button>
        <WhatsAppLink className="inline-flex items-center gap-2 border border-border px-8 py-4 text-sm uppercase tracking-widest transition-colors hover:bg-secondary" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{tr("whatsappAlt")}</p>

      <div className="mt-16 border-t border-border pt-10">
        <BookingLookup />
      </div>
    </div>
  );
}

function Calendar({
  chaletId,
  setChaletId,
  onDone,
}: {
  chaletId: number;
  setChaletId: (id: number) => void;
  onDone: (b: BookingRow) => void;
}) {
  const { tr, lang } = useI18n();
  const today = useMemo(startOfToday, []);
  const thisMonth = useMemo(() => startOfMonth(today), [today]);

  const [month, setMonth] = useState(thisMonth);
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<DateFilter>("all");
  const [showForm, setShowForm] = useState(false);
  const [jumped, setJumped] = useState(false);

  // Held here, not in BookingForm: stepping back to change dates used to
  // unmount the form and silently discard everything the guest had typed.
  const [details, setDetails] = useState<GuestDetails>(BLANK_DETAILS);
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

  const monthHasFreeDay = (m: Date) => {
    const last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    for (let d = new Date(m); d <= last; d = addDays(d, 1)) {
      if (!dayBlocked(d) && !isPast(d)) return true;
    }
    return false;
  };

  // Landing on a month with nothing left reads as "fully booked". Move to the
  // first month that has something, once, and say so.
  const autoJumped = useRef(false);
  useEffect(() => {
    if (autoJumped.current || !calendar || calendar.length === 0) return;
    autoJumped.current = true;
    if (monthHasFreeDay(thisMonth)) return;
    for (let m = new Date(thisMonth), i = 0; i < 13; i++, m = addDays(startOfMonth(m), 32)) {
      const candidate = startOfMonth(m);
      if (candidate > lastMonth) break;
      if (monthHasFreeDay(candidate)) {
        setMonth(candidate);
        setJumped(true);
        return;
      }
    }
  }, [calendar]); // eslint-disable-line react-hooks/exhaustive-deps

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const arr: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= last.getDate(); d++) {
      arr.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    return arr;
  }, [month]);

  /**
   * With a package filter on, every day that belongs to a complete, still-free
   * stay of that shape maps to the whole window. Clicking any of them selects
   * the stay in one tap instead of asking the guest to know that a weekend
   * starts on Thursday.
   */
  const windows = useMemo(() => {
    if (filter === "all") return null;
    const { startDow, length } = FILTER_SHAPE[filter];
    const map = new Map<string, { start: Date; end: Date }>();
    // Pad either side so a window straddling a month boundary still resolves.
    const from = addDays(new Date(month.getFullYear(), month.getMonth(), 1), -7);
    const to = addDays(new Date(month.getFullYear(), month.getMonth() + 1, 0), 7);
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (d.getDay() !== startDow) continue;
      const last = addDays(d, length - 1);
      const span = eachDay(d, last);
      if (span.some((x) => dayBlocked(x))) continue;
      for (const x of span) map.set(fmtDate(x), { start: d, end: last });
    }
    return map;
  }, [filter, month, byDay]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthHasWindow = useMemo(() => {
    if (!windows) return true;
    return cells.some((d) => d && windows.has(fmtDate(d)));
  }, [windows, cells]);

  // Shown live while choosing; request_booking() re-derives it server-side and
  // its answer is what is stored.
  const current =
    start && end && rates ? quote(start, end, customPrices, rates, occasions ?? []) : null;
  const tooShort = current !== null && current.days < MIN_STAY_DAYS;
  const ready = !!start && !!end && !tooShort;

  const selectDay = (d: Date) => {
    setError("");
    if (windows) {
      const w = windows.get(fmtDate(d));
      if (!w) return;
      setStart(w.start);
      setEnd(w.end);
      return;
    }
    if (!start || end || d < start) {
      setStart(d);
      setEnd(null);
      return;
    }
    if (eachDay(start, d).some(dayBlocked)) {
      setError(tr("rangeBlocked"));
      return;
    }
    setEnd(d);
    if (daysBetween(start, d) < MIN_STAY_DAYS) setError(tr("minStay"));
  };

  const inRange = (d: Date) => start && end && d >= start && d <= end;
  const isEdge = (d: Date) =>
    (start && fmtDate(d) === fmtDate(start)) || (end && fmtDate(d) === fmtDate(end));

  const monthName = month.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
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
    if (daysBetween(start, end) < MIN_STAY_DAYS) {
      setError(tr("minStay"));
      return;
    }
    setShowForm(true);
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
        civilId={civilId}
        setCivilId={setCivilId}
        terms={terms}
        setTerms={setTerms}
        onBack={() => setShowForm(false)}
        onDone={onDone}
      />
    );
  }

  const changeMonth = (delta: number) => {
    setJumped(false);
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
        <h1 className="mb-2 font-display text-4xl md:text-5xl">{tr("selectDates")}</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {filter !== "all" ? tr("filterHint") : !start || end ? tr("pickStart") : tr("pickEnd")}
        </p>

        {/* Switch chalet without losing your place in the flow. */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {tr("changeChalet")}
          </span>
          <ChaletPicker
            chaletId={chaletId}
            setChaletId={(id) => {
              setChaletId(id);
              setStart(null);
              setEnd(null);
              setError("");
            }}
            compact
          />
        </div>

        {loadError && (
          <p className="mb-4 border border-destructive p-4 text-sm text-destructive">
            {(loadError as Error).message}
          </p>
        )}

        {/* Package filter, above the calendar. */}
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={tr("filterAll")}>
          {(["all", "weekday", "weekend"] as DateFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setStart(null);
                setEnd(null);
                setError("");
              }}
              aria-pressed={filter === f}
              className={`border px-4 py-2 text-xs uppercase tracking-widest transition-colors ${
                filter === f
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:border-foreground/50"
              }`}
            >
              {f === "all"
                ? tr("filterAll")
                : f === "weekday"
                  ? tr("filterWeekday")
                  : tr("filterWeekend")}
            </button>
          ))}
        </div>

        {jumped && (
          <p className="mb-4 border border-border bg-secondary p-4 text-sm">
            {tr("noneThisMonth")}
          </p>
        )}

        <div className="relative border border-border p-6 md:p-8">
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
              className="p-2 enabled:hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-25"
            >
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
            </button>
            <p className="font-display text-2xl capitalize">{monthName}</p>
            <button
              onClick={() => changeMonth(1)}
              disabled={atLastMonth}
              aria-label={lang === "en" ? "Next month" : "الشهر التالي"}
              className="p-2 enabled:hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-25"
            >
              <ChevronRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-wider text-muted-foreground">
            {weekdayLabels.map((w) => (
              <div key={w} className="py-2">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={`pad-${i}`} />;
              const iso = fmtDate(d);
              const past = isPast(d);
              // A future day the server refuses is held by a booking or blocked
              // by the admin — that is what black means. Past days are simply
              // gone, and are faded instead.
              const reserved = !past && dayBlocked(d);
              const offPackage = !!windows && !windows.has(iso);
              const disabled = past || reserved || offPackage;
              const selected = isEdge(d);
              const within = inRange(d);
              const priced = byDay.get(iso)?.custom === true;
              const occ = occasionFor(d);
              const dayLabel = d.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
                weekday: "long",
                day: "numeric",
                month: "long",
              });

              const tone = reserved
                ? "bg-black text-white cursor-not-allowed"
                : past
                  ? "cursor-not-allowed text-muted-foreground/30"
                  : selected
                    ? "bg-background font-semibold ring-2 ring-inset ring-foreground"
                    : within
                      ? "bg-secondary"
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
                  onClick={() => selectDay(d)}
                  aria-label={`${dayLabel}${reserved ? ` — ${tr("reservedLabel")}` : ""}${
                    occ ? ` — ${lang === "en" ? occ.nameEn : occ.nameAr || occ.nameEn}` : ""
                  }`}
                  aria-pressed={!!selected}
                  className={`relative flex aspect-square flex-col items-center justify-center text-sm transition-colors ${tone}`}
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

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
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

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

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

        <p className="mt-6 text-sm text-muted-foreground">{tr("noPaymentNow")}</p>
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
  civilId: File | null;
  setCivilId: (f: File | null) => void;
  terms: boolean;
  setTerms: (v: boolean) => void;
  onBack: () => void;
  onDone: (b: BookingRow) => void;
}) {
  const { tr, lang } = useI18n();
  const request = useRequestBooking();
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
      next.guests = lang === "en" ? "Between 1 and 20 guests." : "بين ١ و ٢٠ ضيفاً.";
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
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !civilId) return;

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
    });
    onDone(booking);
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
      { key: "guests", label: tr("guests"), type: "number" },
    ];

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
              to="/rules"
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
          className="inline-flex items-center gap-2 underline underline-offset-4 hover:text-foreground"
          label="WhatsApp"
        />
      </p>

      {/* Server-side rejections (dates taken since you picked them, rate limit) */}
      {request.isError && (
        <p className="border border-destructive p-4 text-sm text-destructive">
          {(request.error as Error).message}
        </p>
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
          to="/reservation"
          className="underline underline-offset-4 text-muted-foreground hover:text-foreground"
        >
          {tr("yourReservation")}
        </Link>
      </p>
    </div>
  );
}
