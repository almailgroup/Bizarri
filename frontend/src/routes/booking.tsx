import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import {
  MIN_STAY_DAYS,
  daysBetween,
  eachDay,
  fmtDate,
  formatMoney,
  quote,
  startOfMonth,
  startOfToday,
} from "@/lib/booking";
import {
  useAvailability,
  useChalets,
  useLookupBooking,
  useRates,
  useRequestBooking,
} from "@/lib/api";
import type { BookingRow } from "@/integrations/supabase/types";

export const Route = createFileRoute("/booking")({ component: Booking });

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
              {confirmed.ref}
            </p>
            <p className="mt-6 text-muted-foreground">
              {/* Render the server's date strings as-is. new Date("2026-10-11")
                  parses as UTC midnight, so reading it back with local getters
                  showed the previous day for anyone behind UTC. */}
              <span dir="ltr">
                {confirmed.start_date} → {confirmed.end_date}
              </span>{" "}
              · {formatMoney(Number(confirmed.total), lang)}
            </p>
            <p className="mt-8 text-muted-foreground">
              {lang === "en"
                ? "Keep this reference. We will contact you shortly to confirm."
                : "احتفظ بهذا الرقم. سوف نتواصل معكم قريباً للتأكيد."}
            </p>
          </div>
        )}
      </section>
    </PageShell>
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
  const { data: chalets } = useChalets();

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
      </div>

      <button
        onClick={onNext}
        className="bg-black px-8 py-4 text-sm uppercase tracking-widest text-white hover:opacity-90"
      >
        {tr("bookNow")}
      </button>

      <LookupPanel />
    </div>
  );
}

/** Guests get a reference on confirmation; this is how they use it later. */
function LookupPanel() {
  const { tr, lang } = useI18n();
  const lookup = useLookupBooking();
  const [ref, setRef] = useState("");
  const [email, setEmail] = useState("");

  const found = lookup.data?.[0];
  const statusLabel = (s: string) =>
    s === "accepted"
      ? tr("statusAccepted")
      : s === "rejected"
        ? tr("statusRejected")
        : s === "cancelled"
          ? lang === "en"
            ? "Cancelled"
            : "ملغى"
          : tr("statusPending");

  return (
    <div className="mt-16 border-t border-border pt-10">
      <h2 className="font-display text-2xl">{tr("checkBooking")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{tr("checkBookingHint")}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!ref.trim() || !email.trim()) return;
          lookup.mutate({ ref, email });
        }}
        className="mt-5 flex flex-wrap gap-3"
      >
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="BZR-XXXXXX"
          dir="ltr"
          aria-label={tr("bookingRef")}
          className="min-w-[10rem] flex-1 border border-border bg-secondary px-4 py-3 font-mono outline-none focus:border-foreground"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={tr("email")}
          dir="ltr"
          aria-label={tr("email")}
          className="min-w-[12rem] flex-1 border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
        />
        <button
          type="submit"
          disabled={lookup.isPending}
          className="border border-foreground px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
        >
          {tr("checkStatus")}
        </button>
      </form>

      {lookup.isSuccess && !found && (
        <p className="mt-4 text-sm text-muted-foreground">{tr("bookingNotFound")}</p>
      )}
      {lookup.isError && (
        <p className="mt-4 text-sm text-destructive">{(lookup.error as Error).message}</p>
      )}
      {found && (
        <div className="mt-5 border border-border p-6">
          <p className="font-mono text-xs text-muted-foreground" dir="ltr">
            {found.ref}
          </p>
          <p className="mt-2 font-display text-2xl">{statusLabel(found.status)}</p>
          <p className="mt-2 text-sm text-muted-foreground" dir="ltr">
            Chalet {found.chalet_id} · {found.start_date} → {found.end_date} ({found.days}{" "}
            {tr("nightsLabel")}) · {formatMoney(Number(found.total), lang)}
          </p>
        </div>
      )}
    </div>
  );
}

function Calendar({ chaletId, onDone }: { chaletId: number; onDone: (b: BookingRow) => void }) {
  const { tr, lang } = useI18n();
  const today = useMemo(startOfToday, []);
  const thisMonth = useMemo(() => startOfMonth(today), [today]);

  const [month, setMonth] = useState(thisMonth);
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  // A year of availability in one request, so paging months is instant and the
  // blocked set always comes from the server rather than the browser.
  const windowEnd = useMemo(() => new Date(today.getFullYear() + 1, today.getMonth(), 0), [today]);
  const {
    data: calendar,
    isLoading,
    error: loadError,
  } = useAvailability(chaletId, thisMonth, windowEnd);
  const { data: rates } = useRates();

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

  const customPrices = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [iso, v] of byDay) if (v.custom) out[iso] = v.price;
    return out;
  }, [byDay]);

  const atFirstMonth = month.getTime() <= thisMonth.getTime();
  // Availability is only known inside the fetched window. Without this the
  // guest could page into months where every day renders unavailable, which
  // reads as "booked solid" rather than "not loaded".
  const lastMonth = useMemo(
    () => new Date(windowEnd.getFullYear(), windowEnd.getMonth(), 1),
    [windowEnd],
  );
  const atLastMonth = month.getTime() >= lastMonth.getTime();

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const arr: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= last.getDate(); d++) {
      arr.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    return arr;
  }, [month]);

  // Shown live while choosing; request_booking() re-derives it server-side and
  // its answer is what is stored.
  const current = start && end && rates ? quote(start, end, customPrices, rates) : null;
  const tooShort = current !== null && current.days < MIN_STAY_DAYS;

  const selectDay = (d: Date) => {
    setError("");
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

  if (showForm && start && end && current) {
    return (
      <BookingForm
        chaletId={chaletId}
        start={start}
        end={end}
        total={current.total}
        onBack={() => setShowForm(false)}
        onDone={onDone}
      />
    );
  }

  return (
    <div className="animate-fade-up">
      <h1 className="mb-2 font-display text-4xl md:text-5xl">{tr("selectDates")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {chaletId === 1 ? tr("bizarri1") : tr("bizarri2")} ·{" "}
        {!start || end ? tr("pickStart") : tr("pickEnd")}
      </p>

      {loadError && (
        <p className="mb-4 border border-destructive p-4 text-sm text-destructive">
          {(loadError as Error).message}
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
            const blocked = dayBlocked(d);
            const selected = isEdge(d);
            const within = inRange(d);
            const priced = byDay.get(iso)?.custom === true;
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

        {atLastMonth && <p className="mt-4 text-xs text-muted-foreground">{tr("horizonNote")}</p>}

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
  chaletId,
  start,
  end,
  total,
  onBack,
  onDone,
}: {
  chaletId: number;
  start: Date;
  end: Date;
  total: number;
  onBack: () => void;
  onDone: (b: BookingRow) => void;
}) {
  const { tr, lang } = useI18n();
  const request = useRequestBooking();
  const [form, setForm] = useState({ name: "", phone: "", email: "", guests: "2", notes: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  const validate = () => {
    const next: Partial<Record<keyof typeof form, string>> = {};
    if (form.name.trim().length < 2) {
      next.name = lang === "en" ? "Please enter your full name." : "يرجى إدخال الاسم الكامل.";
    }
    if (form.phone.replace(/\D/g, "").length < 8) {
      next.phone = lang === "en" ? "Enter a valid phone number." : "يرجى إدخال رقم هاتف صحيح.";
    }
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(form.email.trim())) {
      next.email =
        lang === "en" ? "Enter a valid email address." : "يرجى إدخال بريد إلكتروني صحيح.";
    }
    const guests = Number(form.guests);
    if (!Number.isInteger(guests) || guests < 1 || guests > 20) {
      next.guests = lang === "en" ? "Between 1 and 20 guests." : "بين ١ و ٢٠ ضيفاً.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const booking = await request.mutateAsync({
      chaletId,
      start,
      end,
      name: form.name,
      phone: form.phone,
      email: form.email,
      guests: Number(form.guests),
      notes: form.notes,
    });
    onDone(booking);
  };

  const fields: { key: keyof typeof form; label: string; type?: string }[] = [
    { key: "name", label: tr("fullName") },
    { key: "phone", label: tr("phone"), type: "tel" },
    { key: "email", label: tr("email"), type: "email" },
    { key: "guests", label: tr("guests"), type: "number" },
  ];

  return (
    // noValidate: the browser's own bubbles fire first and are unlocalised,
    // so validate() owns the messages instead.
    <form onSubmit={submit} noValidate className="animate-fade-up space-y-6">
      <h1 className="mb-4 font-display text-4xl md:text-5xl">
        {lang === "en" ? "Guest Information" : "معلومات الضيف"}
      </h1>

      <div className="space-y-1 border border-border bg-secondary p-4 text-sm">
        <p>
          <span className="text-muted-foreground">{tr("pickChalet")}: </span>
          <span className="font-medium">Bizarri Chalet {chaletId}</span>
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
              min={f.key === "guests" ? 1 : undefined}
              max={f.key === "guests" ? 20 : undefined}
              value={form[f.key]}
              aria-invalid={!!errors[f.key]}
              aria-describedby={errors[f.key] ? `err-${f.key}` : undefined}
              onChange={(e) => {
                setForm({ ...form, [f.key]: e.target.value });
                if (errors[f.key]) setErrors({ ...errors, [f.key]: undefined });
              }}
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
          {tr("notes")}
        </span>
        <textarea
          rows={4}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="mt-2 w-full border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
        />
      </label>

      {/* Server-side rejections (dates taken since you picked them, rate limit) */}
      {request.isError && (
        <p className="border border-destructive p-4 text-sm text-destructive">
          {(request.error as Error).message}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={request.isPending}
          className="bg-black px-10 py-4 text-sm uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-50"
        >
          {request.isPending ? (lang === "en" ? "Sending…" : "جارٍ الإرسال…") : tr("submit")}
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
