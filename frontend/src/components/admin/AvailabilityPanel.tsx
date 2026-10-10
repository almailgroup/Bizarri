import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Lock,
  LockOpen,
  Tag as TagIcon,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { dateLocale } from "@/lib/locale";
import { addDays, eachDay, fmtDate, formatMoney, parseDate, startOfToday } from "@/lib/booking";
import {
  useAvailability,
  useBlockedDates,
  useBookings,
  useChalets,
  useSetBlockedDays,
  useSetDayPrices,
} from "@/lib/api";
import type { BookingRow } from "@/integrations/supabase/types";
import { useAdminT } from "./strings";
import { errorText, useToast } from "./toast";
import {
  Btn,
  Card,
  ErrorNote,
  Field,
  PanelHeader,
  Segmented,
  StatusBadge,
  cx,
  inputClass,
} from "./ui";

export interface BookingPrefill {
  chaletId: number;
  start: string;
  end: string;
}

/** Everything one cell needs to draw itself and to answer "what is this day". */
interface DayInfo {
  iso: string;
  date: Date;
  inMonth: boolean;
  past: boolean;
  today: boolean;
  /** Closed by the admin. */
  blocked: boolean;
  /** The accepted booking holding the day, if any. */
  booking?: BookingRow;
  /** Held, but the booking itself is not in the list (it failed to load). */
  heldUnknown: boolean;
  pending: BookingRow[];
  price: number | null;
  custom: boolean;
}

const isBooked = (d: DayInfo) => !!d.booking || d.heldUnknown;

/**
 * The admin calendar.
 *
 * It used to change one day per tap: blocking a week off for maintenance was
 * seven taps and seven round trips, and the only thing a cell said about a
 * booking was that it was black. Now a selection can be a range -- dragged
 * across, Shift-clicked, or typed as From/To -- and every action applies to
 * all of it at once, skipping what it cannot change (past days, days held by
 * a booking) and saying so.
 */
export function AvailabilityPanel({
  chaletId,
  onChaletChange,
  onNewBooking,
  onOpenBooking,
}: {
  chaletId: number;
  onChaletChange: (id: number) => void;
  onNewBooking: (prefill: BookingPrefill) => void;
  onOpenBooking: (ref: string) => void;
}) {
  const { lang, tr } = useI18n();
  const t = useAdminT();
  const toast = useToast();
  const locale = dateLocale(lang, "en-GB");
  const today = useMemo(startOfToday, []);
  const todayIso = fmtDate(today);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  // Six weeks from the Sunday on or before the 1st, so the grid never jumps
  // in height between months and the days either side are there to drag into.
  const gridStart = useMemo(() => addDays(month, -month.getDay()), [month]);
  const gridEnd = useMemo(() => addDays(gridStart, 41), [gridStart]);

  const { data: chalets } = useChalets();
  const {
    data: calendar,
    error: calError,
    refetch,
  } = useAvailability(chaletId, gridStart, gridEnd);
  const { data: blocked } = useBlockedDates(chaletId, true);
  const { data: bookings } = useBookings(true);
  const setBlocked = useSetBlockedDays();
  const setPrices = useSetDayPrices();

  const days: DayInfo[] = useMemo(() => {
    const cal = new Map((calendar ?? []).map((c) => [c.day, c]));
    const closed = new Set(blocked ?? []);
    const mine = (bookings ?? []).filter((b) => b.chalet_id === chaletId);
    return eachDay(gridStart, gridEnd).map((date) => {
      const iso = fmtDate(date);
      const covering = mine.filter((b) => iso >= b.start_date && iso <= b.end_date);
      const booking = covering.find((b) => b.status === "accepted");
      const past = date < today;
      const c = cal.get(iso);
      const isClosed = closed.has(iso);
      return {
        iso,
        date,
        inMonth: date.getMonth() === month.getMonth(),
        past,
        today: iso === todayIso,
        blocked: isClosed,
        booking,
        // The server says it is held, by neither a closure nor a booking we
        // can see: a booking, then, that the list did not bring back.
        heldUnknown: !booking && !isClosed && !past && !!c?.blocked,
        pending: covering.filter((b) => b.status === "pending"),
        price: c ? Number(c.price) : null,
        custom: !!c?.custom,
      };
    });
  }, [calendar, blocked, bookings, chaletId, gridStart, gridEnd, month, today, todayIso]);

  const byIso = useMemo(() => new Map(days.map((d) => [d.iso, d])), [days]);

  /* ------------------------------------------------------------ selection */

  const [anchor, setAnchor] = useState<string | null>(null);
  const [focusEnd, setFocusEnd] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string>(todayIso);
  // The press in progress. A mouse selects the moment it goes down. A finger
  // waits: it may be the start of a scroll, and a scroll that happened to
  // begin on the calendar should not move the selection. It selects on lift,
  // or as soon as it drags sideways onto another day.
  const press = useRef<{ iso: string; started: boolean } | null>(null);
  const dragging = {
    get current() {
      return !!press.current?.started;
    },
  };

  const range = useMemo(() => {
    if (!anchor || !focusEnd) return null;
    const [from, to] = anchor <= focusEnd ? [anchor, focusEnd] : [focusEnd, anchor];
    return { from, to };
  }, [anchor, focusEnd]);

  const selectedIsos = useMemo(
    () => (range ? eachDay(parseDate(range.from), parseDate(range.to)).map(fmtDate) : []),
    [range],
  );
  const selectedSet = useMemo(() => new Set(selectedIsos), [selectedIsos]);

  const select = useCallback((iso: string, extend: boolean) => {
    if (extend) {
      setAnchor((a) => a ?? iso);
      setFocusEnd(iso);
    } else {
      setAnchor(iso);
      setFocusEnd(iso);
    }
    setCursor(iso);
  }, []);

  const clear = () => {
    setAnchor(null);
    setFocusEnd(null);
  };

  // A selection survives a change of month (a range may run across one) but
  // not a change of chalet, where it would describe somebody else's days.
  useEffect(clear, [chaletId]);

  useEffect(() => {
    const stop = () => (press.current = null);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const cellAt = (x: number, y: number) =>
    (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-day]")
      ?.dataset.day;

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const iso = (e.target as HTMLElement).closest<HTMLElement>("[data-day]")?.dataset.day;
    if (!iso) return;
    setHover(null);
    if (e.pointerType === "touch") {
      press.current = { iso, started: false };
      return;
    }
    select(iso, e.shiftKey && !!anchor);
    press.current = { iso, started: true };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (!p) return;
    const iso = cellAt(e.clientX, e.clientY);
    if (!iso) return;
    if (!p.started) {
      if (iso === p.iso) return;
      select(p.iso, false);
      p.started = true;
    }
    setFocusEnd(iso);
    setCursor(iso);
  };

  const onPointerUp = () => {
    const p = press.current;
    if (p && !p.started) select(p.iso, false);
    press.current = null;
  };

  const gridRef = useRef<HTMLDivElement>(null);

  // Arrow keys move between days, Shift+arrow grows the selection, Enter or
  // Space selects; Page Up/Down change month. One day is in the tab order.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step: Record<string, number> = {
      ArrowLeft: lang === "ar" ? 1 : -1,
      ArrowRight: lang === "ar" ? -1 : 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    let next: Date | null = null;
    if (e.key in step) next = addDays(parseDate(cursor), step[e.key]);
    if (e.key === "PageUp") next = addDays(parseDate(cursor), -28);
    if (e.key === "PageDown") next = addDays(parseDate(cursor), 28);
    if (!next) return;
    e.preventDefault();
    const iso = fmtDate(next);
    setCursor(iso);
    if (e.shiftKey && e.key.startsWith("Arrow")) {
      setAnchor((a) => a ?? cursor);
      setFocusEnd(iso);
    }
    if (next < gridStart || next > gridEnd || next.getMonth() !== month.getMonth()) {
      setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    }
    requestAnimationFrame(() =>
      gridRef.current?.querySelector<HTMLElement>(`[data-day="${iso}"]`)?.focus(),
    );
  };

  /* ---------------------------------------------------------------- hover */

  const [hover, setHover] = useState<{
    iso: string;
    x: number;
    y: number;
    w: number;
    h: number;
    above: boolean;
  } | null>(null);

  /* -------------------------------------------------------------- actions */

  const sel = selectedIsos.map((iso) => byIso.get(iso)).filter((d): d is DayInfo => !!d);
  // Days outside the six weeks on screen are still in the selection; what we
  // know about them comes from the lists rather than the calendar call.
  const known = (iso: string): DayInfo =>
    byIso.get(iso) ?? {
      iso,
      date: parseDate(iso),
      inMonth: false,
      past: parseDate(iso) < today,
      today: iso === todayIso,
      blocked: (blocked ?? []).includes(iso),
      booking: (bookings ?? []).find(
        (b) =>
          b.chalet_id === chaletId &&
          b.status === "accepted" &&
          iso >= b.start_date &&
          iso <= b.end_date,
      ),
      heldUnknown: false,
      pending: [],
      price: null,
      custom: false,
    };
  const all = selectedIsos.map(known);
  const toBlock = all.filter((d) => !d.past && !isBooked(d) && !d.blocked).map((d) => d.iso);
  const toOpen = all.filter((d) => !d.past && d.blocked).map((d) => d.iso);
  const toPrice = all.filter((d) => !d.past && !isBooked(d)).map((d) => d.iso);
  const priced = all.filter((d) => !d.past && d.custom).map((d) => d.iso);
  const counts = {
    available: all.filter((d) => !d.past && !d.blocked && !isBooked(d)).length,
    unavailable: all.filter((d) => !d.past && d.blocked).length,
    booked: all.filter((d) => !d.past && isBooked(d)).length,
    past: all.filter((d) => d.past).length,
  };
  const inSelection = useMemo(() => {
    if (!range) return [];
    return (bookings ?? [])
      .filter(
        (b) =>
          b.chalet_id === chaletId &&
          (b.status === "accepted" || b.status === "pending") &&
          b.start_date <= range.to &&
          b.end_date >= range.from,
      )
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [bookings, chaletId, range]);

  const [priceDraft, setPriceDraft] = useState("");
  // Prefill the price when every priceable selected day already shares one.
  useEffect(() => {
    const prices = new Set(sel.filter((d) => d.custom && !d.past).map((d) => d.price));
    setPriceDraft(
      prices.size === 1 && sel.every((d) => d.custom || d.past || isBooked(d))
        ? String([...prices][0])
        : "",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to, chaletId]);

  const busy = setBlocked.isPending || setPrices.isPending;

  const run = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      toast.success(done);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const block = () =>
    run(
      () => setBlocked.mutateAsync({ chaletId, days: toBlock, blocked: true }),
      toBlock.length === 1 ? t("blockedOne") : t("blockedN", { n: toBlock.length }),
    );
  const open = () =>
    run(
      () => setBlocked.mutateAsync({ chaletId, days: toOpen, blocked: false }),
      toOpen.length === 1 ? t("openedOne") : t("openedN", { n: toOpen.length }),
    );
  const priceValue = priceDraft.trim() === "" ? NaN : Number(priceDraft);
  const priceOk = Number.isFinite(priceValue) && priceValue >= 0;
  const applyPrice = () =>
    run(
      () => setPrices.mutateAsync({ chaletId, days: toPrice, price: priceValue }),
      t("pricedN", { n: toPrice.length }),
    );
  const clearPrice = () =>
    run(
      () => setPrices.mutateAsync({ chaletId, days: priced, price: null }),
      t("priceClearedN", { n: priced.length }),
    );

  /* ------------------------------------------------------------- labels */

  const monthName = month.toLocaleDateString(dateLocale(lang, "en-US"), {
    month: "long",
    year: "numeric",
  });
  const weekdayLabels = useMemo(
    () =>
      eachDay(gridStart, addDays(gridStart, 6)).map((d) =>
        d.toLocaleDateString(locale, { weekday: "short" }),
      ),
    [gridStart, locale],
  );
  const longDate = (iso: string) =>
    parseDate(iso).toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const shortDate = (iso: string, year = false) =>
    parseDate(iso).toLocaleDateString(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      ...(year ? { year: "numeric" } : {}),
    });

  const describe = (d: DayInfo) => {
    const parts = [longDate(d.iso)];
    if (d.past) parts.push(t("past"));
    if (d.booking) parts.push(`${t("bookedByGuest")} · ${d.booking.guest_name}`);
    else if (d.heldUnknown) parts.push(t("bookedByGuest"));
    else if (d.blocked) parts.push(t("unavailable"));
    else if (!d.past) parts.push(t("available"));
    if (d.pending.length) parts.push(`${d.pending.length} × ${t("pendingRequest")}`);
    if (d.custom && d.price !== null)
      parts.push(`${t("customPrice")} ${formatMoney(d.price, lang)}`);
    return parts.join(", ");
  };

  const firstName = (b: BookingRow) => b.guest_name.split(/\s+/)[0];

  const monthStats = useMemo(() => {
    const live = days.filter((d) => d.inMonth && !d.past);
    return {
      available: live.filter((d) => !d.blocked && !isBooked(d)).length,
      unavailable: live.filter((d) => d.blocked).length,
      booked: live.filter((d) => isBooked(d)).length,
    };
  }, [days]);

  const hovered = hover ? byIso.get(hover.iso) : undefined;
  const single = range && range.from === range.to ? byIso.get(range.from) : undefined;

  return (
    <section className={range ? "pb-20 lg:pb-0" : undefined}>
      <PanelHeader
        title={tr("availability")}
        description={t("calendarHint")}
        actions={
          (chalets ?? []).length > 1 ? (
            <Segmented
              label={t("chalet")}
              value={String(chaletId)}
              onChange={(v) => onChaletChange(Number(v))}
              options={(chalets ?? []).map((c) => ({
                value: String(c.id),
                label: lang === "en" ? c.name_en : c.name_ar,
              }))}
            />
          ) : undefined
        }
      />

      {calError && (
        <div className="mb-4">
          <ErrorNote onRetry={() => refetch()}>{errorText(calError)}</ErrorNote>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="p-3 sm:p-5">
          {/* Month navigation */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                aria-label={t("previousMonth")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-secondary"
              >
                <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
              </button>
              <h3
                className="min-w-[10rem] text-center text-xl font-semibold capitalize"
                aria-live="polite"
                data-month-label
              >
                {monthName}
              </h3>
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                aria-label={t("nextMonth")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-secondary"
              >
                <ChevronRight className="h-5 w-5 rtl:rotate-180" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <p className="hidden text-xs text-muted-foreground md:block">
                {t("nAvailable", { n: monthStats.available })} ·{" "}
                {t("nUnavailable", { n: monthStats.unavailable })} ·{" "}
                {t("nBooked", { n: monthStats.booked })}
              </p>
              <Btn
                size="sm"
                onClick={() => {
                  setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                  setCursor(todayIso);
                }}
              >
                {t("today")}
              </Btn>
            </div>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground sm:gap-1.5">
            {weekdayLabels.map((w, i) => (
              <div key={i} className="py-1.5">
                {w}
              </div>
            ))}
          </div>

          <div className="relative">
            <div
              ref={gridRef}
              role="group"
              aria-label={monthName}
              className="grid grid-cols-7 gap-1 select-none sm:gap-1.5"
              style={{ touchAction: "pan-y" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onKeyDown={onKeyDown}
              onPointerLeave={() => setHover(null)}
            >
              {days.map((d, index) => {
                const selected = selectedSet.has(d.iso);
                const booked = isBooked(d);
                return (
                  <button
                    key={d.iso}
                    type="button"
                    data-day={d.iso}
                    tabIndex={d.iso === cursor ? 0 : -1}
                    aria-pressed={selected}
                    aria-label={describe(d)}
                    onClick={(e) => {
                      // A mouse or a finger already selected on pointerdown;
                      // this is the keyboard's Enter and Space.
                      if (e.detail === 0) select(d.iso, e.shiftKey && !!anchor);
                    }}
                    onPointerEnter={(e) => {
                      if (e.pointerType !== "mouse" || dragging.current) return;
                      const el = e.currentTarget;
                      setHover({
                        iso: d.iso,
                        x: el.offsetLeft,
                        y: el.offsetTop,
                        w: el.offsetWidth,
                        h: el.offsetHeight,
                        // The bottom two rows open upwards, inside the card.
                        above: index >= 28,
                      });
                    }}
                    onFocus={() => setCursor(d.iso)}
                    className={cx(
                      "relative flex h-14 flex-col items-start justify-between overflow-hidden rounded-lg border p-1 text-start text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 sm:h-20 sm:p-2",
                      !d.inMonth && "opacity-45",
                      d.past
                        ? "border-transparent bg-secondary/40 text-muted-foreground/70"
                        : booked
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : d.blocked
                            ? "admin-closed border-red-200 bg-red-50 text-red-700"
                            : "border-border bg-background hover:border-foreground/40",
                      selected && "z-[1] ring-2 ring-sky-500 ring-offset-1 ring-offset-background",
                      selected && !booked && !d.blocked && !d.past && "bg-sky-50",
                    )}
                  >
                    <span
                      className={cx(
                        "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold sm:text-sm",
                        d.today && "bg-sky-600 text-white",
                      )}
                    >
                      {d.date.getDate()}
                    </span>

                    {d.pending.length > 0 && !d.past && (
                      <span
                        className="absolute end-1 top-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background sm:end-2 sm:top-2"
                        aria-hidden="true"
                      />
                    )}

                    {booked && d.booking && (
                      <span className="hidden w-full truncate text-[11px] leading-tight text-white/80 sm:block">
                        {firstName(d.booking)}
                      </span>
                    )}
                    {d.blocked && !booked && !d.past && (
                      <Lock className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                    )}
                    {/* A bare "50" under a date told an admin a number without
                        saying what it was. The pill carries the currency. */}
                    {d.custom && !booked && !d.blocked && d.price !== null && (
                      <span
                        data-price
                        className="max-w-full truncate rounded-full bg-secondary px-1.5 py-0.5 text-xs font-medium leading-none text-foreground ring-1 ring-border sm:px-2"
                      >
                        {/* A phone's cell is too narrow for the currency;
                            the number alone there, the full price from sm. */}
                        <span className="sm:hidden">{d.price}</span>
                        <span className="hidden sm:inline">{formatMoney(d.price, lang)}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Details on hover, for a mouse. A finger gets the same in the
                selection panel once it taps. */}
            {hover && hovered && (
              <div
                className="pointer-events-none absolute z-20 w-60 rounded-lg border border-border bg-background p-3 text-sm shadow-xl"
                style={{
                  ...(hover.above
                    ? { bottom: (gridRef.current?.offsetHeight ?? 0) - hover.y + 6 }
                    : { top: hover.y + hover.h + 6 }),
                  left: Math.max(
                    0,
                    Math.min(
                      hover.x + hover.w / 2 - 120,
                      (gridRef.current?.offsetWidth ?? 240) - 240,
                    ),
                  ),
                }}
              >
                <p className="font-semibold">{shortDate(hovered.iso, true)}</p>
                <p className="mt-1 text-muted-foreground">
                  {hovered.past
                    ? t("past")
                    : hovered.booking || hovered.heldUnknown
                      ? t("bookedByGuest")
                      : hovered.blocked
                        ? t("unavailable")
                        : t("available")}
                  {hovered.price !== null && !hovered.past && (
                    <>
                      {" · "}
                      {formatMoney(hovered.price, lang)}
                      {hovered.custom && ` (${t("customPrice").toLowerCase()})`}
                    </>
                  )}
                </p>
                {hovered.booking && (
                  <p className="mt-2 border-t border-border pt-2">
                    <span className="font-medium">{hovered.booking.guest_name}</span>
                    <span className="block font-mono text-xs text-muted-foreground" dir="ltr">
                      {hovered.booking.ref}
                    </span>
                  </p>
                )}
                {hovered.pending.length > 0 && (
                  <p className="mt-2 text-xs text-amber-700">
                    {hovered.pending.length} × {t("pendingRequest")}
                  </p>
                )}
              </div>
            )}
          </div>

          <Legend />
        </Card>

        {/* -------------------------------------------- the selection panel */}
        <Card className="h-fit p-5 lg:sticky lg:top-6" as="section">
          <div id="selection-panel" className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("selection")}
              </p>
              {range ? (
                <>
                  <p className="mt-1 text-lg font-semibold">
                    {range.from === range.to
                      ? longDate(range.from)
                      : `${shortDate(range.from)} → ${shortDate(range.to, true)}`}
                  </p>
                  {range.from !== range.to && (
                    <p className="text-sm text-muted-foreground">
                      {t("days", { n: selectedIsos.length })}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">{t("nothingSelected")}</p>
              )}
            </div>
            {range && (
              <button
                type="button"
                onClick={clear}
                aria-label={t("clearSelection")}
                title={t("clearSelection")}
                className="-me-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* From / To: a range by typing, and the only way on a phone that
              does not involve dragging. */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label={t("from")}>
              {(a) => (
                <input
                  {...a}
                  type="date"
                  value={range?.from ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    setAnchor(v);
                    setFocusEnd((f) => (f && f >= v ? f : v));
                    setMonth(new Date(parseDate(v).getFullYear(), parseDate(v).getMonth(), 1));
                  }}
                  className={inputClass}
                />
              )}
            </Field>
            <Field label={t("to")}>
              {(a) => (
                <input
                  {...a}
                  type="date"
                  value={range?.to ?? ""}
                  min={range?.from}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    if (!range) {
                      setAnchor(v);
                      setFocusEnd(v);
                    } else if (v >= range.from) {
                      setAnchor(range.from);
                      setFocusEnd(v);
                    }
                  }}
                  className={inputClass}
                />
              )}
            </Field>
          </div>

          {range && (
            <div className="mt-5 space-y-5">
              <div className="flex flex-wrap gap-1.5 text-xs">
                {counts.available > 0 && (
                  <span className="rounded-full bg-secondary px-2.5 py-1">
                    {t("nAvailable", { n: counts.available })}
                  </span>
                )}
                {counts.unavailable > 0 && (
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">
                    {t("nUnavailable", { n: counts.unavailable })}
                  </span>
                )}
                {counts.booked > 0 && (
                  <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-white">
                    {t("nBooked", { n: counts.booked })}
                  </span>
                )}
                {counts.past > 0 && (
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">
                    {t("nPast", { n: counts.past })}
                  </span>
                )}
              </div>

              {single && isBooked(single) && !single.past && (
                <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">
                  {t("coveredByBooking")}
                </p>
              )}

              <div className="grid gap-2">
                {toBlock.length > 0 && (
                  <Btn
                    variant="primary"
                    onClick={block}
                    busy={setBlocked.isPending && setBlocked.variables?.blocked === true}
                    disabled={busy}
                    icon={<Lock className="h-4 w-4" aria-hidden="true" />}
                  >
                    {toBlock.length === 1 && selectedIsos.length === 1
                      ? t("markOneUnavailable")
                      : t("markNUnavailable", { n: t("days", { n: toBlock.length }) })}
                  </Btn>
                )}
                {toOpen.length > 0 && (
                  <Btn
                    onClick={open}
                    busy={setBlocked.isPending && setBlocked.variables?.blocked === false}
                    disabled={busy}
                    icon={<LockOpen className="h-4 w-4" aria-hidden="true" />}
                  >
                    {toOpen.length === 1 && selectedIsos.length === 1
                      ? t("makeOneAvailable")
                      : t("makeNAvailable", { n: t("days", { n: toOpen.length }) })}
                  </Btn>
                )}
              </div>

              {toPrice.length > 0 && (
                <div className="border-t border-border pt-5">
                  <Field
                    label={t("priceForSelection")}
                    error={priceDraft.trim() !== "" && !priceOk ? t("invalidPrice") : undefined}
                  >
                    {(a) => (
                      <input
                        {...a}
                        type="number"
                        min={0}
                        inputMode="decimal"
                        value={priceDraft}
                        onChange={(e) => setPriceDraft(e.target.value)}
                        placeholder={t("defaultRate")}
                        className={inputClass}
                      />
                    )}
                  </Field>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn
                      variant="primary"
                      size="sm"
                      onClick={applyPrice}
                      disabled={!priceOk || busy}
                      busy={setPrices.isPending && setPrices.variables?.price !== null}
                      icon={<TagIcon className="h-4 w-4" aria-hidden="true" />}
                    >
                      {t("applyPrice")}
                    </Btn>
                    {priced.length > 0 && (
                      <Btn
                        size="sm"
                        onClick={clearPrice}
                        disabled={busy}
                        busy={setPrices.isPending && setPrices.variables?.price === null}
                      >
                        {t("clearPrice")}
                      </Btn>
                    )}
                  </div>
                </div>
              )}

              {(counts.past > 0 || counts.booked > 0) &&
                (toBlock.length > 0 || toPrice.length > 0) && (
                  <p className="text-xs text-muted-foreground">{t("pastLeftAlone")}</p>
                )}

              {range.from >= todayIso && (
                <Btn
                  className="w-full"
                  onClick={() => onNewBooking({ chaletId, start: range.from, end: range.to })}
                  icon={<CalendarPlus className="h-4 w-4" aria-hidden="true" />}
                >
                  {t("bookTheseDates")}
                </Btn>
              )}

              {inSelection.length > 0 && (
                <div className="border-t border-border pt-5">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("bookingsInSelection")}
                  </p>
                  <ul className="space-y-2">
                    {inSelection.map((b) => (
                      <li key={b.id} className="rounded-md border border-border p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{b.guest_name}</span>
                          <StatusBadge status={b.status} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {shortDate(b.start_date)} → {shortDate(b.end_date)} ·{" "}
                          <span dir="ltr" className="font-mono">
                            {b.ref}
                          </span>
                        </p>
                        <button
                          type="button"
                          onClick={() => onOpenBooking(b.ref)}
                          className="mt-1 min-h-10 text-xs font-medium underline underline-offset-4 hover:text-foreground"
                        >
                          {t("openRequests")}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* On a phone the panel is below the calendar; the two actions that
          matter most ride along at the foot of the screen. */}
      {range && (toBlock.length > 0 || toOpen.length > 0) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-2">
            <a
              href="#selection-panel"
              className="min-w-0 flex-1 truncate text-sm font-medium underline-offset-4 hover:underline"
            >
              {selectedIsos.length === 1
                ? shortDate(selectedIsos[0])
                : t("days", { n: selectedIsos.length })}
            </a>
            {toOpen.length > 0 && (
              <Btn
                size="sm"
                onClick={open}
                disabled={busy}
                icon={<LockOpen className="h-4 w-4" aria-hidden="true" />}
              >
                {t("available")}
              </Btn>
            )}
            {toBlock.length > 0 && (
              <Btn
                size="sm"
                variant="primary"
                onClick={block}
                disabled={busy}
                icon={<Lock className="h-4 w-4" aria-hidden="true" />}
              >
                {t("unavailable")}
              </Btn>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Legend() {
  const t = useAdminT();
  const { lang } = useI18n();
  const item = "flex items-center gap-2";
  const swatch = "h-4 w-4 rounded border";
  return (
    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
      <span className={item}>
        <span className={cx(swatch, "border-border bg-background")} /> {t("available")}
      </span>
      <span className={item}>
        <span className={cx(swatch, "admin-closed border-red-200 bg-red-50")} /> {t("unavailable")}
      </span>
      <span className={item}>
        <span className={cx(swatch, "border-neutral-900 bg-neutral-900")} /> {t("bookedByGuest")}
      </span>
      <span className={item}>
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> {t("pendingRequest")}
      </span>
      <span className={item}>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium leading-none text-foreground ring-1 ring-border">
          {formatMoney(0, lang).replace(/\d+/, "—")}
        </span>
        {t("customPrice")}
      </span>
      <span className={item}>
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-[10px] font-semibold text-white">
          1
        </span>
        {t("today")}
      </span>
      <span className={item}>
        <span className={cx(swatch, "border-border bg-sky-50 ring-2 ring-sky-500")} />{" "}
        {t("selection")}
      </span>
    </div>
  );
}
