import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { eachDay, formatMoney, parseDate, startOfToday } from "@/lib/booking";
import { useBookings, useChalets } from "@/lib/api";
import type { BookingRow } from "@/integrations/supabase/types";

/** Nights of `booking` that fall within [monthStart, monthEnd], inclusive. */
function nightsInMonth(booking: BookingRow, monthStart: Date, monthEnd: Date): number {
  const start = parseDate(booking.start_date);
  const end = parseDate(booking.end_date);
  if (end < monthStart || start > monthEnd) return 0;
  const clampedStart = start < monthStart ? monthStart : start;
  const clampedEnd = end > monthEnd ? monthEnd : end;
  return eachDay(clampedStart, clampedEnd).length;
}

export function OverviewPanel() {
  const { tr, lang } = useI18n();
  const { data: bookings } = useBookings(true);
  const { data: chalets } = useChalets();
  const today = useMemo(startOfToday, []);

  const stats = useMemo(() => {
    const rows = bookings ?? [];
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysInMonth = monthEnd.getDate();

    const pending = rows.filter((b) => b.status === "pending").length;
    const accepted = rows.filter((b) => b.status === "accepted");

    const revenueThisMonth = accepted.reduce((sum, b) => {
      const start = parseDate(b.start_date);
      return start >= monthStart && start <= monthEnd ? sum + Number(b.total) : sum;
    }, 0);

    const upcoming = accepted
      .filter((b) => parseDate(b.end_date) >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 5);

    const occupancyByChalet = new Map<number, number>();
    for (const b of accepted) {
      const nights = nightsInMonth(b, monthStart, monthEnd);
      if (nights > 0)
        occupancyByChalet.set(b.chalet_id, (occupancyByChalet.get(b.chalet_id) ?? 0) + nights);
    }

    return { pending, revenueThisMonth, upcoming, occupancyByChalet, daysInMonth };
  }, [bookings, today]);

  const chaletName = (id: number) => {
    const c = (chalets ?? []).find((x) => x.id === id);
    return c ? (lang === "en" ? c.name_en : c.name_ar) : `Chalet ${id}`;
  };

  const monthLabel = today.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <section>
      <h2 className="mb-6 font-display text-3xl">{tr("overview")}</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-border p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {tr("pendingRequests")}
          </p>
          <p className="mt-2 font-display text-4xl">{stats.pending}</p>
        </div>
        <div className="border border-border p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {tr("revenueThisMonth")}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/70">{monthLabel}</p>
          <p className="mt-1 font-display text-4xl">{formatMoney(stats.revenueThisMonth, lang)}</p>
        </div>
        {(chalets ?? []).map((c) => {
          const nights = stats.occupancyByChalet.get(c.id) ?? 0;
          const pct = Math.round((nights / stats.daysInMonth) * 100);
          return (
            <div key={c.id} className="border border-border p-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {tr("occupancyThisMonth")}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground/70">
                {lang === "en" ? c.name_en : c.name_ar}
              </p>
              <p className="mt-1 font-display text-4xl">{pct}%</p>
              <p className="text-xs text-muted-foreground">
                {nights} / {stats.daysInMonth} {lang === "en" ? "nights" : "ليلة"}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-10">
        <h3 className="mb-4 font-display text-xl">{tr("upcomingCheckins")}</h3>
        {stats.upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr("noUpcoming")}</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {stats.upcoming.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-display text-lg">{b.guest_name}</p>
                  <p className="text-sm text-muted-foreground" dir="ltr">
                    {chaletName(b.chalet_id)} · {b.start_date} → {b.end_date}
                  </p>
                </div>
                <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                  {b.ref}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
