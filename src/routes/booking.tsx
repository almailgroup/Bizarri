import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

export const Route = createFileRoute("/booking")({ component: Booking });

function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function getUnavailable(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("bizarri_unavailable") || "[]");
  } catch {
    return [];
  }
}

function Booking() {
  const { tr, lang } = useI18n();
  const [stage, setStage] = useState<"intro" | "calendar" | "form" | "done">("intro");
  const [chalet, setChalet] = useState<"1" | "2">("1");
  const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const unavailable = useMemo(() => getUnavailable(), [stage]);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const arr: (Date | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) arr.push(null);
    for (let d = 1; d <= last.getDate(); d++)
      arr.push(new Date(month.getFullYear(), month.getMonth(), d));
    return arr;
  }, [month]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isUnavail = (d: Date) => unavailable.includes(fmtDate(d));

  const selectDay = (d: Date) => {
    setError("");
    const dow = d.getDay();
    let s: Date | null = null;
    let e: Date | null = null;
    if (dow === 0) {
      // Sunday → Sun..Wed
      s = d;
      e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3);
    } else if (dow === 4) {
      // Thursday → Thu..Sat
      s = d;
      e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 2);
    } else {
      setError(tr("invalidSelection"));
      setStart(null);
      setEnd(null);
      return;
    }
    // ensure no unavailable day in range
    let cur = new Date(s);
    while (cur <= e) {
      if (isUnavail(cur)) {
        setError(
          lang === "en"
            ? "Selected package contains an unavailable date."
            : "الباقة المحددة تحتوي على تاريخ غير متاح.",
        );
        setStart(null);
        setEnd(null);
        return;
      }
      cur = new Date(cur.getTime() + 86400000);
    }
    setStart(s);
    setEnd(e);
  };

  const isInRange = (d: Date) => start && end && d >= start && d <= end;
  const isStart = (d: Date) => start && fmtDate(d) === fmtDate(start);
  const isEnd = (d: Date) => end && fmtDate(d) === fmtDate(end);

  const proceed = () => {
    if (!start || !end) {
      setError(tr("invalidSelection"));
      return;
    }
    setStage("form");
  };

  const monthName = month.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
    month: "long",
    year: "numeric",
  });
  const weekdayLabels =
    lang === "ar"
      ? ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <PageShell>
      <section className="max-w-4xl mx-auto px-6 py-24 md:py-32">
        <p className="text-xs tracking-[0.4em] uppercase text-muted-foreground mb-6">
          {tr("booking")}
        </p>

        {stage === "intro" && (
          <div className="animate-fade-up">
            <h1 className="font-display text-5xl md:text-6xl mb-8">{tr("startBooking")}</h1>
            <p className="text-muted-foreground text-lg mb-4 max-w-xl">
              {lang === "en"
                ? "Pick which chalet you'd like, then tap a Sunday or Thursday — your package fills automatically."
                : "اختر الشاليه المطلوب، ثم اضغط على يوم الأحد أو الخميس — تُحدد الباقة تلقائياً."}
            </p>

            <div className="my-8">
              <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">
                {tr("pickChalet")}
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {(["1", "2"] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setChalet(n)}
                    className={`text-left border p-6 transition-colors ${
                      chalet === n
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground/50"
                    }`}
                  >
                    <p className="text-xs tracking-widest uppercase opacity-70">Chalet {n}</p>
                    <p className="font-display text-2xl mt-2">
                      {n === "1" ? tr("bizarri1") : tr("bizarri2")}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 my-8">
              <div className="border border-border p-6">
                <p className="text-xs tracking-widest uppercase text-muted-foreground">Package 1</p>
                <p className="font-display text-2xl mt-2">{tr("weekdayPkg")}</p>
              </div>
              <div className="border border-border p-6">
                <p className="text-xs tracking-widest uppercase text-muted-foreground">Package 2</p>
                <p className="font-display text-2xl mt-2">{tr("weekendPkg")}</p>
              </div>
            </div>
            <button
              onClick={() => setStage("calendar")}
              className="px-8 py-4 bg-black text-white text-sm tracking-widest uppercase hover:opacity-90"
            >
              {tr("bookNow")}
            </button>
          </div>
        )}

        {stage === "calendar" && (
          <div className="animate-fade-up">
            <h1 className="font-display text-4xl md:text-5xl mb-2">
              {lang === "en" ? "Select Dates" : "اختر التواريخ"}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {chalet === "1" ? tr("bizarri1") : tr("bizarri2")} ·{" "}
              {lang === "en" ? "Tap a Sunday or Thursday" : "اضغط على الأحد أو الخميس"}
            </p>
            <div className="border border-border p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  className="p-2 hover:bg-secondary"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <p className="font-display text-2xl capitalize">{monthName}</p>
                <button
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                  className="p-2 hover:bg-secondary"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {weekdayLabels.map((w) => (
                  <div key={w} className="py-2">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const past = d < today;
                  const unav = isUnavail(d);
                  const inRange = isInRange(d);
                  const sel = isStart(d) || isEnd(d);
                  const dow = d.getDay();
                  const selectable = !past && !unav && (dow === 0 || dow === 4);
                  return (
                    <button
                      key={i}
                      disabled={!selectable && !inRange}
                      onClick={() => selectable && selectDay(d)}
                      className={`aspect-square text-sm transition-colors relative
                        ${past || unav ? "text-muted-foreground/30 line-through cursor-not-allowed" : ""}
                        ${!selectable && !past && !unav ? "text-muted-foreground/50 cursor-not-allowed" : "hover:bg-secondary"}
                        ${inRange ? "bg-secondary" : ""}
                        ${sel ? "bg-black text-white hover:bg-black" : ""}
                      `}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-black" /> {lang === "en" ? "Selected" : "المحدد"}
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-secondary border border-border" />{" "}
                  {lang === "en" ? "In package" : "ضمن الباقة"}
                </span>
                <span className="flex items-center gap-2">
                  <span className="line-through">12</span>{" "}
                  {lang === "en" ? "Unavailable" : "غير متاح"}
                </span>
              </div>
            </div>

            <div className="mt-6 grid sm:grid-cols-2 gap-3 text-sm">
              <div className="p-4 border border-border">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
                  {lang === "en" ? "Check-in" : "الوصول"}
                </p>
                <p className="font-display text-xl">{start ? fmtDate(start) : "—"}</p>
              </div>
              <div className="p-4 border border-border">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
                  {lang === "en" ? "Check-out" : "المغادرة"}
                </p>
                <p className="font-display text-xl">{end ? fmtDate(end) : "—"}</p>
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={proceed}
                className="px-8 py-4 bg-black text-white text-sm tracking-widest uppercase hover:opacity-90"
              >
                {lang === "en" ? "Continue" : "متابعة"}
              </button>
              <button
                onClick={() => {
                  setStart(null);
                  setEnd(null);
                  setError("");
                }}
                className="px-8 py-4 border border-border text-sm tracking-widest uppercase"
              >
                {lang === "en" ? "Reset" : "إعادة"}
              </button>
            </div>
          </div>
        )}

        {stage === "form" && start && end && (
          <BookingForm chalet={chalet} start={start} end={end} onDone={() => setStage("done")} />
        )}

        {stage === "done" && (
          <div className="animate-fade-up text-center py-20">
            <div className="w-20 h-20 mx-auto bg-black text-white rounded-full flex items-center justify-center mb-8">
              <Check className="w-10 h-10" />
            </div>
            <h1 className="font-display text-4xl md:text-5xl mb-4">{tr("thankYou")}</h1>
            <p className="text-muted-foreground">
              {lang === "en"
                ? "We will contact you on +965 94040955 shortly."
                : "سوف نتواصل معكم قريباً."}
            </p>
          </div>
        )}
      </section>
    </PageShell>
  );
}

function BookingForm({
  chalet,
  start,
  end,
  onDone,
}: {
  chalet: "1" | "2";
  start: Date;
  end: Date;
  onDone: () => void;
}) {
  const { tr, lang } = useI18n();
  const [form, setForm] = useState({ name: "", phone: "", email: "", guests: "2", notes: "" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const dates = `${fmtDate(start)} → ${fmtDate(end)}`;
    const chaletLabel = `Bizarri Chalet ${chalet}`;
    const subject = encodeURIComponent(`New ${chaletLabel} Booking Request`);
    const body = encodeURIComponent(
      `New Booking Request\n\n` +
        `Chalet: ${chaletLabel}\n` +
        `Name: ${form.name}\nPhone: ${form.phone}\nEmail: ${form.email}\n` +
        `Guests: ${form.guests}\nDates: ${dates}\n` +
        `Notes: ${form.notes}\n`,
    );
    try {
      const all = JSON.parse(localStorage.getItem("bizarri_bookings") || "[]");
      all.push({ ...form, chalet: chaletLabel, dates, createdAt: new Date().toISOString() });
      localStorage.setItem("bizarri_bookings", JSON.stringify(all));
    } catch {
      /* ignore malformed localStorage */
    }
    window.location.href = `mailto:mansouralmail@gmail.com,sales@bizarri.com?subject=${subject}&body=${body}`;
    onDone();
  };

  const fields: { key: keyof typeof form; label: string; type?: string }[] = [
    { key: "name", label: tr("fullName") },
    { key: "phone", label: tr("phone"), type: "tel" },
    { key: "email", label: tr("email"), type: "email" },
    { key: "guests", label: tr("guests"), type: "number" },
  ];

  return (
    <form onSubmit={submit} className="animate-fade-up space-y-6">
      <h1 className="font-display text-4xl md:text-5xl mb-4">
        {lang === "en" ? "Guest Information" : "معلومات الضيف"}
      </h1>
      <div className="p-4 bg-secondary border border-border text-sm space-y-1">
        <p>
          <span className="text-muted-foreground">{tr("pickChalet")}: </span>
          <span className="font-medium">Bizarri Chalet {chalet}</span>
        </p>
        <p>
          <span className="text-muted-foreground">{tr("selectedDates")}: </span>
          <span className="font-medium">
            {fmtDate(start)} → {fmtDate(end)}
          </span>
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {f.label}
            </span>
            <input
              required
              type={f.type || "text"}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className="mt-2 w-full px-4 py-3 bg-secondary border border-border focus:border-foreground outline-none"
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
          className="mt-2 w-full px-4 py-3 bg-secondary border border-border focus:border-foreground outline-none"
        />
      </label>
      <button
        type="submit"
        className="px-10 py-4 bg-black text-white text-sm tracking-widest uppercase hover:opacity-90"
      >
        {tr("submit")}
      </button>
    </form>
  );
}
