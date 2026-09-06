import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Lock, LogOut, Plus, Trash2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import logoWhite from "@/assets/bizarri-logo-white.png";
import {
  DEFAULT_RATES,
  fmtDate,
  formatMoney,
  startOfMonth,
  startOfToday,
  type Rates,
} from "@/lib/booking";
import {
  useAllNews,
  useBlockedDates,
  useBookings,
  useChalets,
  useDayPrices,
  useDeleteBooking,
  useDeleteNews,
  useIsAdmin,
  useRates,
  useSaveNews,
  useSaveRates,
  useSetBookingStatus,
  useSetDayPrice,
  useToggleBlocked,
} from "@/lib/api";
import type { BookingRow, BookingStatus, NewsRow } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin")({ component: Admin });

function Admin() {
  const { session, loading } = useAuth();
  const { data: isAdmin, isLoading: checking } = useIsAdmin(!!session);

  if (loading) return <Splash />;
  if (!session) return <SignIn />;
  if (checking) return <Splash />;
  if (!isAdmin) return <NotAuthorised />;
  return <Dashboard />;
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <img src={logoWhite} alt="Bizarri" className="h-10 w-auto animate-pulse" />
    </div>
  );
}

function SignIn() {
  const { tr, lang } = useI18n();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <Link
        to="/"
        aria-label={tr("close")}
        className="absolute end-5 top-5 border border-white/20 p-2.5 text-white/70 transition-colors hover:border-white/60 hover:text-white"
      >
        <X className="h-5 w-5" />
      </Link>

      <form onSubmit={submit} className="animate-fade-up w-full max-w-sm">
        <img src={logoWhite} alt="Bizarri" className="mx-auto mb-10 h-12 w-auto" />
        <p className="mb-2 text-center text-xs uppercase tracking-[0.4em] text-white/40">
          {tr("admin")}
        </p>
        <h1 className="mb-8 text-center font-display text-3xl">{tr("login")}</h1>

        <label className="block">
          <span className="text-xs uppercase tracking-widest text-white/60">{tr("email")}</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            className="mt-2 w-full border border-white/20 bg-white/5 px-4 py-3 outline-none focus:border-white"
            autoFocus
          />
        </label>

        <label className="mt-5 block">
          <span className="text-xs uppercase tracking-widest text-white/60">{tr("password")}</span>
          <div className="relative mt-2">
            <Lock className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
              className="w-full border border-white/20 bg-white/5 py-3 pe-4 ps-10 outline-none focus:border-white"
            />
          </div>
        </label>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-8 w-full bg-white py-4 text-sm uppercase tracking-widest text-black hover:bg-white/90 disabled:opacity-50"
        >
          {busy ? (lang === "en" ? "Signing in…" : "جارٍ الدخول…") : tr("login")}
        </button>
      </form>
    </div>
  );
}

function NotAuthorised() {
  const { lang } = useI18n();
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black px-6 text-center text-white">
      <img src={logoWhite} alt="Bizarri" className="h-10 w-auto" />
      <p className="max-w-sm text-white/70">
        {lang === "en"
          ? "This account does not have chalet management access."
          : "هذا الحساب لا يملك صلاحية إدارة الشاليه."}
      </p>
      <button
        onClick={signOut}
        className="border border-white/30 px-6 py-3 text-sm uppercase tracking-widest hover:bg-white hover:text-black"
      >
        {lang === "en" ? "Sign out" : "تسجيل الخروج"}
      </button>
    </div>
  );
}

function Dashboard() {
  const { tr, lang } = useI18n();
  const { session, signOut } = useAuth();
  const { data: chalets } = useChalets();
  const [chaletId, setChaletId] = useState(1);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-black text-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-4">
            <img src={logoWhite} alt="Bizarri" className="h-8 w-auto" />
            <span className="hidden text-xs uppercase tracking-[0.4em] text-white/60 sm:inline">
              {tr("dashboard")}
            </span>
          </div>
          <div className="flex items-center gap-5">
            <span className="hidden text-xs text-white/50 md:inline" dir="ltr">
              {session?.user.email}
            </span>
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-xs uppercase tracking-widest hover:text-white/70"
            >
              <LogOut className="h-4 w-4" /> {tr("logout")}
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-border bg-secondary">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-6 py-3">
          <span className="me-2 text-xs uppercase tracking-widest text-muted-foreground">
            {tr("pickChalet")}
          </span>
          {(chalets ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => setChaletId(c.id)}
              aria-pressed={chaletId === c.id}
              className={`px-4 py-2 text-xs uppercase tracking-widest transition-colors ${
                chaletId === c.id
                  ? "bg-foreground text-background"
                  : "border border-border hover:bg-background"
              }`}
            >
              {lang === "en" ? c.name_en : c.name_ar}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-16 px-6 py-12">
        <AvailabilityPanel chaletId={chaletId} />
        <RatesPanel />
        <RequestsPanel />
        <NewsPanel />
      </main>
    </div>
  );
}

/* ------------------------------------------------ availability & pricing */

function AvailabilityPanel({ chaletId }: { chaletId: number }) {
  const { tr, lang } = useI18n();
  const today = useMemo(startOfToday, []);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");

  const { data: blocked } = useBlockedDates(chaletId, true);
  const { data: prices } = useDayPrices(chaletId, true);
  const toggleBlocked = useToggleBlocked();
  const setDayPrice = useSetDayPrice();

  const blockedSet = useMemo(() => new Set(blocked ?? []), [blocked]);
  const priceMap = prices ?? {};

  useEffect(() => {
    setPriceDraft(selected && priceMap[selected] !== undefined ? String(priceMap[selected]) : "");
    // priceMap identity changes on every fetch; key off the values that matter.
  }, [selected, prices]); // eslint-disable-line react-hooks/exhaustive-deps

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const arr: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= last.getDate(); d++) {
      arr.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    return arr;
  }, [month]);

  const monthName = month.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
    month: "long",
    year: "numeric",
  });
  const weekdayLabels =
    lang === "ar"
      ? ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const busy = toggleBlocked.isPending || setDayPrice.isPending;
  const failure = toggleBlocked.error ?? setDayPrice.error;

  return (
    <section>
      <h2 className="mb-2 font-display text-3xl">{tr("availability")}</h2>
      <p className="mb-6 text-sm text-muted-foreground">{tr("adminCalHint")}</p>

      {failure && (
        <p className="mb-4 border border-destructive p-4 text-sm text-destructive">
          {(failure as Error).message}
        </p>
      )}

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
              const isBlocked = blockedSet.has(iso);
              const past = d < today;
              const price = priceMap[iso];
              return (
                <button
                  key={iso}
                  onClick={() => setSelected(iso)}
                  aria-pressed={selected === iso}
                  className={`flex aspect-square flex-col items-center justify-center gap-0.5 border text-sm transition-colors ${
                    selected === iso ? "border-foreground" : "border-transparent"
                  } ${
                    isBlocked
                      ? "bg-destructive/10 text-destructive line-through hover:bg-destructive/20"
                      : "hover:bg-secondary"
                  } ${past && !isBlocked ? "text-muted-foreground/50" : ""}`}
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
                disabled={busy}
                onClick={() =>
                  toggleBlocked.mutate({
                    chaletId,
                    day: selected,
                    blocked: blockedSet.has(selected),
                  })
                }
                className={`w-full py-3 text-sm uppercase tracking-widest transition-colors disabled:opacity-50 ${
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
                    disabled={busy}
                    onClick={() => {
                      const value = Number(priceDraft);
                      setDayPrice.mutate({
                        chaletId,
                        day: selected,
                        price:
                          priceDraft.trim() === "" || !Number.isFinite(value) || value < 0
                            ? null
                            : value,
                      });
                    }}
                    className="flex-1 bg-black py-3 text-sm uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {tr("save")}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setPriceDraft("");
                      setDayPrice.mutate({ chaletId, day: selected, price: null });
                    }}
                    className="border border-border px-4 py-3 text-sm uppercase tracking-widest hover:bg-secondary disabled:opacity-50"
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
  const { data: stored } = useRates();
  const save = useSaveRates();
  const [draft, setDraft] = useState<Rates | null>(null);

  useEffect(() => {
    if (stored) {
      setDraft({
        fullWeek: stored.fullWeek,
        weekend: stored.weekend,
        weekday: stored.weekday,
        dailyWeekday: stored.dailyWeekday,
        dailyWeekend: stored.dailyWeekend,
      });
    }
  }, [stored]);

  const rates = draft ?? DEFAULT_RATES;

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

      {save.error && (
        <p className="mb-4 border border-destructive p-4 text-sm text-destructive">
          {(save.error as Error).message}
        </p>
      )}

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
              onChange={(e) => setDraft({ ...rates, [f.key]: Number(e.target.value) })}
              className="mt-3 w-full border border-border bg-secondary px-3 py-2 font-display text-xl outline-none focus:border-foreground"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={() => save.mutate(rates)}
          disabled={save.isPending}
          className="bg-black px-8 py-3 text-sm uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-50"
        >
          {tr("save")}
        </button>
        <button
          onClick={() => {
            setDraft(DEFAULT_RATES);
            save.mutate(DEFAULT_RATES);
          }}
          disabled={save.isPending}
          className="border border-border px-6 py-3 text-sm uppercase tracking-widest hover:bg-secondary disabled:opacity-50"
        >
          {tr("reset")}
        </button>
        {save.isSuccess && !save.isPending && (
          <span className="text-sm text-muted-foreground">✓</span>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------- booking requests */

const STATUS_ORDER: BookingStatus[] = ["pending", "accepted", "rejected"];

function RequestsPanel() {
  const { tr, lang } = useI18n();
  const { data: bookings, isLoading, error } = useBookings(true);
  const setStatus = useSetBookingStatus();
  const remove = useDeleteBooking();
  const [pendingDelete, setPendingDelete] = useState<BookingRow | null>(null);
  const [filter, setFilter] = useState<BookingStatus | "all">("all");

  const statusLabel = (s: BookingStatus) =>
    s === "accepted"
      ? tr("statusAccepted")
      : s === "rejected"
        ? tr("statusRejected")
        : s === "cancelled"
          ? lang === "en"
            ? "Cancelled"
            : "ملغى"
          : tr("statusPending");

  const packageName = (key: string | null) =>
    key === "fullWeek"
      ? tr("fullWeekPkg")
      : key === "weekend"
        ? tr("weekendPkg")
        : key === "weekday"
          ? tr("weekdayPkg")
          : "";

  const rows = (bookings ?? []).filter((b) => filter === "all" || b.status === filter);

  const exportXlsx = async () => {
    // Loaded on demand so the ~400 kB library never reaches site visitors.
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(
      (bookings ?? []).map((b) => ({
        "Booking ID": b.ref,
        Status: statusLabel(b.status),
        Chalet: b.chalet_id,
        "Check-in": b.start_date,
        "Check-out": b.end_date,
        Days: b.days,
        [`Total (${b.currency})`]: Number(b.total),
        Package: packageName(b.package_key),
        Name: b.guest_name,
        Phone: b.guest_phone,
        Email: b.guest_email,
        Guests: b.guests,
        Notes: b.notes ?? "",
        Submitted: new Date(b.created_at).toLocaleString("en-GB"),
      })),
    );
    sheet["!cols"] = [
      { wch: 12 },
      { wch: 20 },
      { wch: 8 },
      { wch: 12 },
      { wch: 12 },
      { wch: 6 },
      { wch: 12 },
      { wch: 20 },
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
  };

  const failure = setStatus.error ?? remove.error;

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-3xl">{tr("requests")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {(["all", ...STATUS_ORDER] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`px-3 py-2 text-xs uppercase tracking-widest transition-colors ${
                filter === f
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f === "all" ? (lang === "en" ? "All" : "الكل") : statusLabel(f)}
            </button>
          ))}
          <button
            onClick={exportXlsx}
            disabled={(bookings ?? []).length === 0}
            className="inline-flex items-center gap-2 border border-border px-5 py-2 text-xs uppercase tracking-widest transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> {tr("exportExcel")}
          </button>
        </div>
      </div>

      {failure && (
        <p className="mb-4 border border-destructive p-4 text-sm text-destructive">
          {(failure as Error).message}
        </p>
      )}
      {error && (
        <p className="mb-4 border border-destructive p-4 text-sm text-destructive">
          {(error as Error).message}
        </p>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">{tr("noRequests")}</p>
      )}

      <ul className="space-y-3">
        {rows.map((b) => (
          <li key={b.id} className="border border-border p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                  {b.ref}
                </p>
                <p className="mt-1 font-display text-xl">{b.guest_name}</p>
                <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                  Chalet {b.chalet_id} · {b.start_date} → {b.end_date} ({b.days} {tr("nightsLabel")}
                  )
                </p>
              </div>
              <p className="font-display text-2xl">{formatMoney(Number(b.total), lang)}</p>
            </div>

            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              <a href={`tel:${b.guest_phone}`} dir="ltr" className="hover:underline">
                {b.guest_phone}
              </a>
              <a href={`mailto:${b.guest_email}`} dir="ltr" className="truncate hover:underline">
                {b.guest_email}
              </a>
              <span>
                {tr("guestsLabel")}: {b.guests}
              </span>
            </div>
            {b.notes && <p className="mt-3 text-sm text-muted-foreground">{b.notes}</p>}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  disabled={setStatus.isPending}
                  onClick={() => setStatus.mutate({ id: b.id, status: s })}
                  aria-pressed={b.status === s}
                  className={`px-4 py-2 text-xs uppercase tracking-widest transition-colors disabled:opacity-50 ${
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
          label={`${pendingDelete.ref} · ${pendingDelete.guest_name}`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            remove.mutate(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------- news */

function NewsPanel() {
  const { tr, lang } = useI18n();
  const { data: items } = useAllNews(true);
  const save = useSaveNews();
  const remove = useDeleteNews();
  const [form, setForm] = useState({ title_en: "", title_ar: "", body_en: "", body_ar: "" });
  const [pendingDelete, setPendingDelete] = useState<NewsRow | null>(null);

  return (
    <section>
      <h2 className="mb-6 font-display text-3xl">{lang === "en" ? "News" : "الأخبار"}</h2>

      {save.error && (
        <p className="mb-4 border border-destructive p-4 text-sm text-destructive">
          {(save.error as Error).message}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.title_en.trim() && !form.title_ar.trim()) return;
          save.mutate(
            { ...form, published: true },
            { onSuccess: () => setForm({ title_en: "", title_ar: "", body_en: "", body_ar: "" }) },
          );
        }}
        className="mb-6 grid gap-3 border border-border p-5 md:grid-cols-2"
      >
        <input
          placeholder="Title (English)"
          value={form.title_en}
          onChange={(e) => setForm({ ...form, title_en: e.target.value })}
          className="border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
        />
        <input
          placeholder="العنوان (عربي)"
          dir="rtl"
          value={form.title_ar}
          onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
          className="border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
        />
        <textarea
          placeholder="Body (English)"
          rows={3}
          value={form.body_en}
          onChange={(e) => setForm({ ...form, body_en: e.target.value })}
          className="border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
        />
        <textarea
          placeholder="المحتوى (عربي)"
          dir="rtl"
          rows={3}
          value={form.body_ar}
          onChange={(e) => setForm({ ...form, body_ar: e.target.value })}
          className="border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
        />
        <button
          type="submit"
          disabled={save.isPending}
          className="flex items-center justify-center gap-2 bg-black px-6 py-3 text-sm uppercase tracking-widest text-white disabled:opacity-50 md:col-span-2"
        >
          <Plus className="h-4 w-4" /> {lang === "en" ? "Publish News" : "نشر الخبر"}
        </button>
      </form>

      <ul className="space-y-3">
        {(items ?? []).length === 0 && (
          <li className="text-sm text-muted-foreground">{tr("noNews")}</li>
        )}
        {(items ?? []).map((n) => (
          <li
            key={n.id}
            className="flex items-start justify-between gap-4 border border-border p-5"
          >
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {new Date(n.published_at ?? n.created_at).toLocaleDateString()} ·{" "}
                {n.published
                  ? lang === "en"
                    ? "Published"
                    : "منشور"
                  : lang === "en"
                    ? "Draft"
                    : "مسودة"}
              </p>
              <p className="mt-1 font-display text-xl">{n.title_en || n.title_ar}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => save.mutate({ ...n, published: !n.published })}
                className="border border-border px-4 py-2 text-xs uppercase tracking-widest hover:bg-secondary"
              >
                {n.published
                  ? lang === "en"
                    ? "Unpublish"
                    : "إلغاء النشر"
                  : lang === "en"
                    ? "Publish"
                    : "نشر"}
              </button>
              <button
                onClick={() => setPendingDelete(n)}
                aria-label={lang === "en" ? "Delete news item" : "حذف الخبر"}
                className="p-2 text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {pendingDelete && (
        <DeleteConfirm
          label={pendingDelete.title_en || pendingDelete.title_ar}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            remove.mutate(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </section>
  );
}

/** Requires the word "Delete" to be typed, so a stray click cannot destroy a record. */
function DeleteConfirm({
  label,
  onCancel,
  onConfirm,
}: {
  label: string;
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
          {label}
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
