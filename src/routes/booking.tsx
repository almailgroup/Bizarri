import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";
import {
  DEFAULT_RATES,
  MIN_STAY_DAYS,
  daysBetween,
  fmtDate,
  formatMoney,
  generateBookingId,
  isBlocked,
  loadBookings,
  loadPrices,
  loadRates,
  loadUnavailable,
  quote,
  rangeIsFree,
  saveBookings,
  startOfMonth,
  startOfToday,
  type Availability,
  type BookingRecord,
  type Rates,
} from "@/lib/booking";

export const Route = createFileRoute("/booking")({ component: Booking });

function Booking() {
  const { tr, lang } = useI18n();
  const [stage, setStage] = useState<"intro" | "calendar" | "form" | "done">("intro");
  const [chalet, setChalet] = useState<"1" | "2">("1");
  const [confirmed, setConfirmed] = useState<BookingRecord | null>(null);

  return (
    <PageShell>
      <section className="mx-auto max-w-4xl px-6 py-24 md:py-32">
        <p className="mb-6 text-xs uppercase tracking-[0.4em] text-muted-foreground">
          {tr("booking")}
        </p>

        {stage === "intro" && (
          <Intro chalet={chalet} setChalet={setChalet} onNext={() => setStage("calendar")} />
        )}

        {stage === "calendar" && (
          <Calendar
            chalet={chalet}
            onDone={(b) => {
              setConfirmed(b);
              setStage("done");
            }}
          />
        )}

        {stage === "done" && confirmed && (
          <div className="animate-fade-up py-20 text-center">
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-black text-white">
              <Check className="h-10 w-10" />
            </div>
            <h1 className="mb-4 font-display text-4xl md:text-5xl">{tr("thankYou")}</h1>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {tr("bookingRef")}
            </p>
            <p className="mt-2 font-mono text-2xl" dir="ltr">
              {confirmed.id}
            </p>
            <p className="mt-8 text-muted-foreground">
              {lang === "en"
                ? "We will contact you shortly to confirm."
                : "سوف نتواصل معكم قريباً للتأكيد."}
            </p>
          </div>
        )}
      </section>
    </PageShell>
  );
}

function Intro({
  chalet,
  setChalet,
  onNext,
}: {
  chalet: "1" | "2";
  setChalet: (c: "1" | "2") => void;
  onNext: () => void;
}) {
  const { tr, lang } = useI18n();
  return (
    <div className="animate-fade-up">
      <h1 className="mb-8 font-display text-5xl md:text-6xl">{tr("startBooking")}</h1>
      <p className="mb-4 max-w-xl text-lg text-muted-foreground">
        {lang === "en"
          ? "Choose your chalet, then pick your dates. Minimum stay is 3 days."
          : "اختر الشاليه، ثم حدد التواريخ. الحد الأدنى للإقامة ٣ أيام."}
      </p>

      <div className="my-8">
        <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
          {tr("pickChalet")}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["1", "2"] as const).map((n) => (
            <button
              key={n}
              onClick={() => setChalet(n)}
              aria-pressed={chalet === n}
              className={`border p-6 text-start transition-colors ${
                chalet === n
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:border-foreground/50"
              }`}
            >
              <p className="text-xs uppercase tracking-widest opacity-70">Chalet {n}</p>
              <p className="mt-2 font-display text-2xl">
                {n === "1" ? tr("bizarri1") : tr("bizarri2")}
              </p>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onNext}
        className="bg-black px-8 py-4 text-sm uppercase tracking-widest text-white hover:opacity-90"
      >
        {tr("bookNow")}
      </button>
    </div>
  );
}

function Calendar({ chalet, onDone }: { chalet: "1" | "2"; onDone: (b: BookingRecord) => void }) {
  const { tr, lang } = useI18n();
  const today = useMemo(startOfToday, []);
  const thisMonth = useMemo(() => startOfMonth(today), [today]);

  const [month, setMonth] = useState(thisMonth);
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [rates, setRates] = useState<Rates>(DEFAULT_RATES);

  useEffect(() => {
    setUnavailable(loadUnavailable());
    setPrices(loadPrices());
    setRates(loadRates());
  }, []);

  const availability: Availability = useMemo(
    () => ({ unavailable: new Set(unavailable), today }),
    [unavailable, today],
  );

  // Past months are not reachable: the back control stops at the current month.
  const atFirstMonth = month.getTime() <= thisMonth.getTime();

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const arr: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= last.getDate(); d++) {
      arr.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    return arr;
  }, [month]);

  const current = start && end ? quote(start, end, prices, rates) : null;
  const tooShort = current !== null && current.days < MIN_STAY_DAYS;

  const selectDay = (d: Date) => {
    setError("");
    // First click, or restarting: begin a new range.
    if (!start || end || d < start) {
      setStart(d);
      setEnd(null);
      return;
    }
    if (!rangeIsFree(start, d, availability)) {
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

  if (showForm && start && end && current) {
    return (
      <BookingForm
        chalet={chalet}
        start={start}
        end={end}
        total={current.total}
        packageLabel={current.packageKey}
        onBack={() => setShowForm(false)}
        onDone={onDone}
      />
    );
  }

  return (
    <div className="animate-fade-up">
      <h1 className="mb-2 font-display text-4xl md:text-5xl">{tr("selectDates")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {chalet === "1" ? tr("bizarri1") : tr("bizarri2")} ·{" "}
        {!start || end ? tr("pickStart") : tr("pickEnd")}
      </p>

      <div className="border border-border p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            disabled={atFirstMonth}
            aria-label={lang === "en" ? "Previous month" : "الشهر السابق"}
            className="p-2 enabled:hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-25"
          >
            <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
          </button>
          <p className="font-display text-2xl capitalize">{monthName}</p>
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            aria-label={lang === "en" ? "Next month" : "الشهر التالي"}
            className="p-2 hover:bg-secondary"
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
            const blocked = isBlocked(d, availability);
            const iso = fmtDate(d);
            const selected = isEdge(d);
            const within = inRange(d);
            const priced = prices[iso] !== undefined;
            const dayLabel = d.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
              weekday: "long",
              day: "numeric",
              month: "long",
            });
            return (
              <button
                key={iso}
                type="button"
                disabled={blocked}
                onClick={() => selectDay(d)}
                aria-label={`${dayLabel}${blocked ? ` — ${tr("unavailableLabel")}` : ""}`}
                aria-pressed={!!selected}
                // One branch only: emitting hover:bg-secondary alongside
                // hover:bg-black let the grey win the cascade, so hovering a
                // selected day made it look deselected.
                className={`relative flex aspect-square flex-col items-center justify-center text-sm transition-colors ${
                  blocked
                    ? "cursor-not-allowed text-muted-foreground/40 line-through"
                    : selected
                      ? "bg-black text-white"
                      : within
                        ? "bg-secondary"
                        : "hover:bg-secondary"
                }`}
              >
                {d.getDate()}
                {priced && !blocked && (
                  <span
                    className={`absolute bottom-1 h-1 w-1 rounded-full ${
                      selected ? "bg-white" : "bg-foreground/50"
                    }`}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 bg-black" /> {tr("selectedLabel")}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 border border-border bg-secondary" />{" "}
            {lang === "en" ? "In stay" : "ضمن الإقامة"}
          </span>
          <span className="flex items-center gap-2">
            <span className="line-through">12</span> {tr("unavailableLabel")}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-foreground/50" /> {tr("customPricing")}
          </span>
        </div>
      </div>

      {/* Live summary: updates on every change to the selection. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="border border-border p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{tr("checkIn")}</p>
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
          className={`border p-4 ${tooShort ? "border-destructive" : "border-foreground bg-foreground text-background"}`}
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

      {current && !tooShort && current.packageKey && (
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
          onClick={() => {
            if (!start || !end) {
              setError(tr("pickStart"));
              return;
            }
            if (daysBetween(start, end) < MIN_STAY_DAYS) {
              setError(tr("minStay"));
              return;
            }
            setShowForm(true);
          }}
          disabled={!start || !end || tooShort}
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
    </div>
  );
}

function BookingForm({
  chalet,
  start,
  end,
  total,
  packageLabel,
  onBack,
  onDone,
}: {
  chalet: "1" | "2";
  start: Date;
  end: Date;
  total: number;
  packageLabel: string | null;
  onBack: () => void;
  onDone: (b: BookingRecord) => void;
}) {
  const { tr, lang } = useI18n();
  const [form, setForm] = useState({ name: "", phone: "", email: "", guests: "2", notes: "" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const existing = loadBookings();
    const record: BookingRecord = {
      id: generateBookingId(existing),
      ...form,
      chalet: `Bizarri Chalet ${chalet}`,
      start: fmtDate(start),
      end: fmtDate(end),
      days: daysBetween(start, end),
      total,
      packageLabel,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    saveBookings([...existing, record]);

    const subject = encodeURIComponent(`Booking ${record.id} — ${record.chalet}`);
    const body = encodeURIComponent(
      `Booking Request ${record.id}\n\n` +
        `Chalet: ${record.chalet}\n` +
        `Dates: ${record.start} → ${record.end} (${record.days} days)\n` +
        `Total: KD ${record.total}\n\n` +
        `Name: ${record.name}\nPhone: ${record.phone}\nEmail: ${record.email}\n` +
        `Guests: ${record.guests}\nNotes: ${record.notes}\n`,
    );
    window.location.href = `mailto:mansouralmail@gmail.com,sales@bizarri.com?subject=${subject}&body=${body}`;
    onDone(record);
  };

  const fields: { key: keyof typeof form; label: string; type?: string }[] = [
    { key: "name", label: tr("fullName") },
    { key: "phone", label: tr("phone"), type: "tel" },
    { key: "email", label: tr("email"), type: "email" },
    { key: "guests", label: tr("guests"), type: "number" },
  ];

  return (
    <form onSubmit={submit} className="animate-fade-up space-y-6">
      <h1 className="mb-4 font-display text-4xl md:text-5xl">
        {lang === "en" ? "Guest Information" : "معلومات الضيف"}
      </h1>

      <div className="space-y-1 border border-border bg-secondary p-4 text-sm">
        <p>
          <span className="text-muted-foreground">{tr("pickChalet")}: </span>
          <span className="font-medium">Bizarri Chalet {chalet}</span>
        </p>
        <p>
          <span className="text-muted-foreground">{tr("selectedDates")}: </span>
          <span className="font-medium" dir="ltr">
            {fmtDate(start)} → {fmtDate(end)} ({daysBetween(start, end)} {tr("nightsLabel")})
          </span>
        </p>
        <p>
          <span className="text-muted-foreground">{tr("total")}: </span>
          <span className="font-medium">{formatMoney(total, lang)}</span>
        </p>
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
              min={f.type === "number" ? 1 : undefined}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className="mt-2 w-full border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
            />
          </label>
        ))}
      </div>

      <label className="block">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          {tr("notes")}
        </span>
        <textarea
          rows={4}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="mt-2 w-full border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="bg-black px-10 py-4 text-sm uppercase tracking-widest text-white hover:opacity-90"
        >
          {tr("submit")}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="border border-border px-8 py-4 text-sm uppercase tracking-widest hover:bg-secondary"
        >
          {lang === "en" ? "Back" : "رجوع"}
        </button>
      </div>
    </form>
  );
}
