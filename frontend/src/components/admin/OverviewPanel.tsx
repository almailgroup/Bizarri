import { useMemo } from "react";
import { ArrowRight, CalendarCheck, CalendarPlus, Check, Inbox, Wallet, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { dateLocale } from "@/lib/locale";
import { eachDay, formatMoney, parseDate, startOfToday } from "@/lib/booking";
import { useBookings, useChalets, useSetBookingStatus } from "@/lib/api";
import type { BookingRow, BookingStatus } from "@/integrations/supabase/types";
import { useAdminT } from "./strings";
import { errorText, useToast } from "./toast";
import { Btn, Card, EmptyState, ErrorNote, Skeleton, cx } from "./ui";

/** Nights of `booking` that fall within [monthStart, monthEnd], inclusive. */
function nightsInMonth(booking: BookingRow, monthStart: Date, monthEnd: Date): number {
  const start = parseDate(booking.start_date);
  const end = parseDate(booking.end_date);
  if (end < monthStart || start > monthEnd) return 0;
  const clampedStart = start < monthStart ? monthStart : start;
  const clampedEnd = end > monthEnd ? monthEnd : end;
  return eachDay(clampedStart, clampedEnd).length;
}

export function OverviewPanel({
  onNewBooking,
  onOpenTab,
}: {
  onNewBooking: () => void;
  onOpenTab: (tab: "requests" | "availability") => void;
}) {
  const { tr, lang } = useI18n();
  const t = useAdminT();
  const toast = useToast();
  const { data: bookings, isLoading, error, refetch } = useBookings(true);
  const { data: chalets } = useChalets();
  const setStatus = useSetBookingStatus();
  const today = useMemo(startOfToday, []);
  const locale = dateLocale(lang);

  const stats = useMemo(() => {
    const rows = bookings ?? [];
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysInMonth = monthEnd.getDate();

    const pendingRows = rows
      .filter((b) => b.status === "pending")
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    const accepted = rows.filter((b) => b.status === "accepted");

    const revenueThisMonth = accepted.reduce((sum, b) => {
      const start = parseDate(b.start_date);
      return start >= monthStart && start <= monthEnd ? sum + Number(b.total) : sum;
    }, 0);

    const upcomingAll = accepted
      .filter((b) => parseDate(b.end_date) >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));

    const occupancyByChalet = new Map<number, number>();
    for (const b of accepted) {
      const nights = nightsInMonth(b, monthStart, monthEnd);
      if (nights > 0)
        occupancyByChalet.set(b.chalet_id, (occupancyByChalet.get(b.chalet_id) ?? 0) + nights);
    }

    return {
      pending: pendingRows.length,
      pendingRows: pendingRows.slice(0, 5),
      revenueThisMonth,
      upcoming: upcomingAll.slice(0, 6),
      upcomingCount: upcomingAll.length,
      occupancyByChalet,
      daysInMonth,
    };
  }, [bookings, today]);

  const chaletName = (id: number) => {
    const c = (chalets ?? []).find((x) => x.id === id);
    return c ? (lang === "en" ? c.name_en : c.name_ar) : `Chalet ${id}`;
  };

  const monthLabel = today.toLocaleDateString(dateLocale(lang, "en-US"), {
    month: "long",
    year: "numeric",
  });
  const todayLabel = today.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const fmt = (iso: string) =>
    parseDate(iso).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });

  const decide = (b: BookingRow, status: BookingStatus) =>
    setStatus.mutate(
      { id: b.id, status },
      {
        onSuccess: () => toast.success(t("statusChanged", { ref: b.ref, status: t(status) })),
        onError: (err) => toast.error(errorText(err)),
      },
    );

  const next = stats.upcoming[0];

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{todayLabel}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            {tr("overview")}
          </h2>
        </div>
        <Btn
          variant="primary"
          onClick={onNewBooking}
          icon={<CalendarPlus className="h-4 w-4" aria-hidden="true" />}
        >
          {t("newBooking")}
        </Btn>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorNote onRetry={() => refetch()}>{errorText(error)}</ErrorNote>
        </div>
      )}

      {/* ------------------------------------------------------ stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Inbox className="h-5 w-5" />}
          tone="amber"
          label={tr("pendingRequests")}
          value={isLoading ? null : String(stats.pending)}
          onClick={() => onOpenTab("requests")}
        />
        <StatCard
          icon={<CalendarCheck className="h-5 w-5" />}
          tone="emerald"
          label={t("upcomingStays")}
          value={isLoading ? null : String(stats.upcomingCount)}
          sub={next ? `${t("nextArrival")}: ${fmt(next.start_date)}` : t("none")}
          onClick={() => onOpenTab("availability")}
        />
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          tone="sky"
          label={tr("revenueThisMonth")}
          value={isLoading ? null : formatMoney(stats.revenueThisMonth, lang)}
          sub={`${monthLabel} · ${t("confirmedRevenue")}`}
        />
        <Card className="p-5">
          <p className="text-sm font-medium text-muted-foreground">{tr("occupancyThisMonth")}</p>
          <p className="text-xs text-muted-foreground/80">{monthLabel}</p>
          <ul className="mt-3 space-y-3">
            {(chalets ?? []).map((c) => {
              const nights = stats.occupancyByChalet.get(c.id) ?? 0;
              const pct = Math.round((nights / stats.daysInMonth) * 100);
              return (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{lang === "en" ? c.name_en : c.name_ar}</span>
                    <span className="font-semibold tabular-nums">{pct}%</span>
                  </div>
                  <div
                    className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={lang === "en" ? c.name_en : c.name_ar}
                  >
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("nightsOf", { n: nights, total: stats.daysInMonth })}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* ------------------------------------------- needs your decision */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">{t("needsAttention")}</h3>
            <button
              type="button"
              onClick={() => onOpenTab("requests")}
              className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {t("viewAll")} <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </button>
          </div>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : stats.pendingRows.length === 0 ? (
            <EmptyState icon={<Check className="h-6 w-6" />}>{t("allCaughtUp")}</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {stats.pendingRows.map((b) => {
                const busy = setStatus.isPending && setStatus.variables?.id === b.id;
                return (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{b.guest_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {chaletName(b.chalet_id)} · {fmt(b.start_date)} → {fmt(b.end_date)} ·{" "}
                        {formatMoney(Number(b.total), lang)}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Btn
                        size="sm"
                        variant="success"
                        disabled={busy}
                        onClick={() => decide(b, "accepted")}
                        icon={<Check className="h-4 w-4" aria-hidden="true" />}
                        aria-label={`${t("accept")} ${b.guest_name}`}
                      >
                        {t("accept")}
                      </Btn>
                      <Btn
                        size="sm"
                        disabled={busy}
                        onClick={() => decide(b, "rejected")}
                        icon={<X className="h-4 w-4" aria-hidden="true" />}
                        aria-label={`${t("reject")} ${b.guest_name}`}
                      >
                        {t("reject")}
                      </Btn>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* -------------------------------------------- upcoming check-ins */}
        <Card className="p-5">
          <h3 className="mb-4 text-lg font-semibold">{tr("upcomingCheckins")}</h3>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : stats.upcoming.length === 0 ? (
            <EmptyState icon={<CalendarCheck className="h-6 w-6" />}>{tr("noUpcoming")}</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {stats.upcoming.map((b) => {
                const d = parseDate(b.start_date);
                return (
                  <li key={b.id} className="flex items-center gap-4 py-3">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary leading-none">
                      <span className="text-[11px] uppercase text-muted-foreground">
                        {d.toLocaleDateString(locale, { month: "short" })}
                      </span>
                      <span className="mt-0.5 text-lg font-semibold">{d.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{b.guest_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {chaletName(b.chalet_id)} · {fmt(b.start_date)} → {fmt(b.end_date)}
                      </p>
                    </div>
                    <span
                      className="hidden font-mono text-xs text-muted-foreground sm:block"
                      dir="ltr"
                    >
                      {b.ref}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}

const TONE = {
  amber: "bg-amber-50 text-amber-700",
  emerald: "bg-emerald-50 text-emerald-700",
  sky: "bg-sky-50 text-sky-700",
} as const;

function StatCard({
  icon,
  tone,
  label,
  value,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  tone: keyof typeof TONE;
  label: string;
  value: string | null;
  sub?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {value === null ? (
            <Skeleton className="mt-2 h-8 w-20" />
          ) : (
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
          )}
        </div>
        <span
          className={cx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            TONE[tone],
          )}
        >
          {icon}
        </span>
      </div>
      {sub && <p className="mt-2 text-xs text-muted-foreground">{sub}</p>}
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-lg border border-border bg-background p-5 text-start shadow-xs transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-foreground"
    >
      {body}
    </button>
  ) : (
    <Card className="p-5">{body}</Card>
  );
}
