import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Lock, LogOut, Trash2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import logoWhite from "@/assets/bizarri-logo-white.png";
import {
  DEFAULT_RATES,
  fmtDate,
  formatMoney,
  loadBookings,
  loadPrices,
  loadRates,
  loadUnavailable,
  savePrices,
  saveRates,
  saveBookings,
  saveUnavailable,
  startOfMonth,
  startOfToday,
  type BookingRecord,
  type BookingStatus,
  type Rates,
} from "@/lib/booking";

export const Route = createFileRoute("/admin")({ component: Admin });

const PASSWORD = "BIZARRIkwt2026";

function Admin() {
  const { tr, lang } = useI18n();
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    try {
      if (sessionStorage.getItem("bizarri_admin") === "1") setAuthed(true);
    } catch {
      /* private mode */
    }
  }, []);

  if (authed) {
    return (
      <Dashboard
        onLogout={() => {
          try {
            sessionStorage.removeItem("bizarri_admin");
          } catch {
            /* ignore */
          }
          setAuthed(false);
        }}
      />
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <Link
        to="/"
        aria-label={tr("close")}
        className="absolute end-5 top-5 border border-white/20 p-2.5 text-white/70 transition-colors hover:border-white/60 hover:text-white"
      >
        <X className="h-5 w-5" />
      </Link>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pw === PASSWORD) {
            try {
              sessionStorage.setItem("bizarri_admin", "1");
            } catch {
              /* ignore */
            }
            setAuthed(true);
          } else {
            setErr(lang === "en" ? "Incorrect password" : "كلمة المرور غير صحيحة");
          }
        }}
        className="animate-fade-up w-full max-w-sm"
      >
        <img src={logoWhite} alt="Bizarri" className="mx-auto mb-10 h-12 w-auto" />
        <p className="mb-2 text-center text-xs uppercase tracking-[0.4em] text-white/40">
          {tr("admin")}
        </p>
        <h1 className="mb-8 text-center font-display text-3xl">{tr("login")}</h1>
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-white/60">{tr("password")}</span>
          <div className="relative mt-2">
            <Lock className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="w-full border border-white/20 bg-white/5 py-3 pe-4 ps-10 outline-none focus:border-white"
              autoFocus
            />
          </div>
        </label>
        {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
        <button
          type="submit"
          className="mt-8 w-full bg-white py-4 text-sm uppercase tracking-widest text-black hover:bg-white/90"
        >
          {tr("login")}
        </button>
      </form>
    </div>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const { tr } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-black text-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <img src={logoWhite} alt="Bizarri" className="h-8 w-auto" />
            <span className="text-xs uppercase tracking-[0.4em] text-white/60">
              {tr("dashboard")}
            </span>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-xs uppercase tracking-widest hover:text-white/70"
          >
            <LogOut className="h-4 w-4" /> {tr("logout")}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-16 px-6 py-12">
        <AvailabilityPanel />
        <RatesPanel />
        <RequestsPanel />
      </main>
    </div>
  );
}

/* ------------------------------------------------ availability & pricing */

function AvailabilityPanel() {
  const { tr, lang } = useI18n();
  const today = useMemo(startOfToday, []);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");

  useEffect(() => {
    setUnavailable(loadUnavailable());
    setPrices(loadPrices());
  }, []);

  useEffect(() => {
    setPriceDraft(selected && prices[selected] !== undefined ? String(prices[selected]) : "");
  }, [selected, prices]);

  const blockedSet = useMemo(() => new Set(unavailable), [unavailable]);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const arr: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= last.getDate(); d++) {
      arr.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    return arr;
  }, [month]);

  const toggleDay = (iso: string) => {
    const next = blockedSet.has(iso)
      ? unavailable.filter((d) => d !== iso)
      : [...unavailable, iso].sort();
    setUnavailable(next);
    saveUnavailable(next);
  };

  const applyPrice = () => {
    if (!selected) return;
    const next = { ...prices };
    const value = Number(priceDraft);
    if (priceDraft.trim() === "" || !Number.isFinite(value) || value < 0) delete next[selected];
    else next[selected] = value;
    setPrices(next);
    savePrices(next);
  };

  const clearPrice = () => {
    if (!selected) return;
    const next = { ...prices };
    delete next[selected];
    setPrices(next);
    savePrices(next);
    setPriceDraft("");
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
    <section>
      <h2 className="mb-2 font-display text-3xl">{tr("availability")}</h2>
      <p className="mb-6 text-sm text-muted-foreground">{tr("adminCalHint")}</p>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="border border-border p-6">
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              aria-label={lang === "en" ? "Previous month" : "الشهر السابق"}
              className="p-2 hover:bg-secondary"
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
              const iso = fmtDate(d);
              const blocked = blockedSet.has(iso);
              const past = d < today;
              const price = prices[iso];
              return (
                <button
                  key={iso}
                  onClick={() => setSelected(iso)}
                  aria-pressed={selected === iso}
                  className={`flex aspect-square flex-col items-center justify-center gap-0.5 border text-sm transition-colors ${
                    selected === iso ? "border-foreground" : "border-transparent"
                  } ${
                    blocked
                      ? "bg-destructive/10 text-destructive line-through hover:bg-destructive/20"
                      : "hover:bg-secondary"
                  } ${past && !blocked ? "text-muted-foreground/50" : ""}`}
                >
                  {d.getDate()}
                  {price !== undefined && (
                    <span className="text-[9px] leading-none text-muted-foreground">{price}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border border-border p-6">
          {!selected ? (
            <p className="text-sm text-muted-foreground">{tr("adminCalHint")}</p>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {tr("selectedLabel")}
                </p>
                <p className="mt-1 font-display text-2xl" dir="ltr">
                  {selected}
                </p>
              </div>

              <button
                onClick={() => toggleDay(selected)}
                className={`w-full py-3 text-sm uppercase tracking-widest transition-colors ${
                  blockedSet.has(selected)
                    ? "border border-border hover:bg-secondary"
                    : "bg-black text-white hover:opacity-90"
                }`}
              >
                {blockedSet.has(selected) ? tr("markAvailable") : tr("markUnavailable")}
              </button>

              <div>
                <label className="block">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    {tr("customPrice")}
                  </span>
                  <input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={priceDraft}
                    onChange={(e) => setPriceDraft(e.target.value)}
                    placeholder={lang === "en" ? "Default rate" : "السعر الافتراضي"}
                    className="mt-2 w-full border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
                  />
                </label>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={applyPrice}
                    className="flex-1 bg-black py-3 text-sm uppercase tracking-widest text-white hover:opacity-90"
                  >
                    {tr("save")}
                  </button>
                  <button
                    onClick={clearPrice}
                    className="border border-border px-4 py-3 text-sm uppercase tracking-widest hover:bg-secondary"
                  >
                    {tr("clear")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ package rates */

function RatesPanel() {
  const { tr, lang } = useI18n();
  const [rates, setRates] = useState<Rates>(DEFAULT_RATES);
  const [saved, setSaved] = useState(false);

  useEffect(() => setRates(loadRates()), []);

  const fields: { key: keyof Rates; label: string; hint: string }[] = [
    {
      key: "fullWeek",
      label: tr("fullWeekPkg"),
      hint: lang === "en" ? "Sun – Sat · 7 days" : "الأحد – السبت · ٧ أيام",
    },
    {
      key: "weekday",
      label: tr("weekdayPkg"),
      hint: lang === "en" ? "Sun – Wed · 4 days" : "الأحد – الأربعاء · ٤ أيام",
    },
    {
      key: "weekend",
      label: tr("weekendPkg"),
      hint: lang === "en" ? "Thu – Sat · 3 days" : "الخميس – السبت · ٣ أيام",
    },
    {
      key: "dailyWeekday",
      label: tr("weekdayNight"),
      hint: lang === "en" ? "Fallback rate" : "السعر الاحتياطي",
    },
    {
      key: "dailyWeekend",
      label: tr("weekendNight"),
      hint: lang === "en" ? "Fallback rate" : "السعر الاحتياطي",
    },
  ];

  return (
    <section>
      <h2 className="mb-2 font-display text-3xl">{tr("packageRates")}</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        {lang === "en"
          ? "Applied when a stay matches a package exactly. Other stays use the per-day fallback rates; a custom daily price always wins."
          : "تُطبَّق عندما تطابق الإقامة باقة تماماً. الإقامات الأخرى تستخدم الأسعار اليومية الاحتياطية؛ السعر المخصص له الأولوية دائماً."}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {fields.map((f) => (
          <label key={f.key} className="block border border-border p-5">
            <span className="block text-xs uppercase tracking-widest text-muted-foreground">
              {f.label}
            </span>
            <span className="mt-1 block text-[11px] text-muted-foreground/70">{f.hint}</span>
            <input
              type="number"
              min={0}
              value={rates[f.key]}
              onChange={(e) => {
                setSaved(false);
                setRates({ ...rates, [f.key]: Number(e.target.value) });
              }}
              className="mt-3 w-full border border-border bg-secondary px-3 py-2 font-display text-xl outline-none focus:border-foreground"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={() => {
            saveRates(rates);
            setSaved(true);
          }}
          className="bg-black px-8 py-3 text-sm uppercase tracking-widest text-white hover:opacity-90"
        >
          {tr("save")}
        </button>
        <button
          onClick={() => {
            setRates(DEFAULT_RATES);
            saveRates(DEFAULT_RATES);
            setSaved(true);
          }}
          className="border border-border px-6 py-3 text-sm uppercase tracking-widest hover:bg-secondary"
        >
          {tr("reset")}
        </button>
        {saved && <span className="text-sm text-muted-foreground">✓</span>}
      </div>
    </section>
  );
}

/* -------------------------------------------------------- booking requests */

const STATUS_ORDER: BookingStatus[] = ["pending", "accepted", "rejected"];

function RequestsPanel() {
  const { tr, lang } = useI18n();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [pendingDelete, setPendingDelete] = useState<BookingRecord | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => setBookings(loadBookings()), []);

  const persist = (next: BookingRecord[]) => {
    setBookings(next);
    saveBookings(next);
  };

  const setStatus = (id: string, status: BookingStatus) =>
    persist(bookings.map((b) => (b.id === id ? { ...b, status } : b)));

  const packageName = (key: string | null) =>
    key === "fullWeek"
      ? tr("fullWeekPkg")
      : key === "weekend"
        ? tr("weekendPkg")
        : key === "weekday"
          ? tr("weekdayPkg")
          : "";

  const statusLabel = (s: BookingStatus) =>
    s === "accepted"
      ? tr("statusAccepted")
      : s === "rejected"
        ? tr("statusRejected")
        : tr("statusPending");

  const exportXlsx = async () => {
    setExporting(true);
    try {
      // Loaded on demand so the ~400 kB library never reaches site visitors.
      const XLSX = await import("xlsx");
      const rows = bookings.map((b) => ({
        "Booking ID": b.id,
        Status: statusLabel(b.status),
        Chalet: b.chalet,
        "Check-in": b.start,
        "Check-out": b.end,
        Days: b.days,
        "Total (KD)": b.total,
        Package: packageName(b.packageLabel),
        Name: b.name,
        Phone: b.phone,
        Email: b.email,
        Guests: b.guests,
        Notes: b.notes ?? "",
        Submitted: new Date(b.createdAt).toLocaleString("en-GB"),
      }));
      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet["!cols"] = [
        { wch: 12 },
        { wch: 20 },
        { wch: 18 },
        { wch: 12 },
        { wch: 12 },
        { wch: 6 },
        { wch: 10 },
        { wch: 12 },
        { wch: 22 },
        { wch: 16 },
        { wch: 26 },
        { wch: 8 },
        { wch: 40 },
        { wch: 20 },
      ];
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Bookings");
      XLSX.writeFile(book, `bizarri-bookings-${fmtDate(new Date())}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-3xl">{tr("requests")}</h2>
        <button
          onClick={exportXlsx}
          disabled={bookings.length === 0 || exporting}
          className="inline-flex items-center gap-2 border border-border px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-4 w-4" /> {tr("exportExcel")}
        </button>
      </div>

      {bookings.length === 0 && <p className="text-sm text-muted-foreground">{tr("noRequests")}</p>}

      <ul className="space-y-3">
        {bookings.map((b) => (
          <li key={b.id} className="border border-border p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                  {b.id}
                </p>
                <p className="mt-1 font-display text-xl">{b.name}</p>
                <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                  {b.chalet} · {b.start} → {b.end} ({b.days} {tr("nightsLabel")})
                </p>
              </div>
              <div className="text-end">
                <p className="font-display text-2xl">{formatMoney(b.total, lang)}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              <span dir="ltr">{b.phone}</span>
              <span className="truncate" dir="ltr">
                {b.email}
              </span>
              <span>
                {tr("guestsLabel")}: {b.guests}
              </span>
            </div>
            {b.notes && <p className="mt-3 text-sm text-muted-foreground">{b.notes}</p>}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(b.id, s)}
                  aria-pressed={b.status === s}
                  className={`px-4 py-2 text-xs uppercase tracking-widest transition-colors ${
                    b.status === s
                      ? s === "accepted"
                        ? "bg-foreground text-background"
                        : s === "rejected"
                          ? "bg-destructive text-destructive-foreground"
                          : "bg-secondary text-foreground"
                      : "border border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {statusLabel(s)}
                </button>
              ))}
              <button
                onClick={() => setPendingDelete(b)}
                aria-label={tr("deleteRequest")}
                className="ms-auto p-2 text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {pendingDelete && (
        <DeleteConfirm
          booking={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            persist(bookings.filter((x) => x.id !== pendingDelete.id));
            setPendingDelete(null);
          }}
        />
      )}
    </section>
  );
}

/** Requires the word "Delete" to be typed, so a stray click can't destroy a request. */
function DeleteConfirm({
  booking,
  onCancel,
  onConfirm,
}: {
  booking: BookingRecord;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { tr } = useI18n();
  const [text, setText] = useState("");
  const ready = text.trim().toLowerCase() === "delete";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={tr("deleteConfirmTitle")}
    >
      <div className="animate-scale-in w-full max-w-md border border-border bg-background p-8">
        <h3 className="font-display text-2xl">{tr("deleteConfirmTitle")}</h3>
        <p className="mt-2 font-mono text-xs text-muted-foreground" dir="ltr">
          {booking.id} · {booking.name}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">{tr("deleteConfirmBody")}</p>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          dir="ltr"
          placeholder="Delete"
          className="mt-4 w-full border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
        />
        <div className="mt-6 flex gap-3">
          <button
            onClick={onConfirm}
            disabled={!ready}
            className="flex-1 bg-destructive py-3 text-sm uppercase tracking-widest text-destructive-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Trash2 className="h-4 w-4" /> {tr("deleteRequest")}
            </span>
          </button>
          <button
            onClick={onCancel}
            className="border border-border px-6 py-3 text-sm uppercase tracking-widest hover:bg-secondary"
          >
            {tr("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
