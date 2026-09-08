import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { fmtDate, startOfToday } from "@/lib/booking";
import { useAvailability, useBlockedDates, useSetDayPrice, useToggleBlocked } from "@/lib/api";

export function AvailabilityPanel({ chaletId }: { chaletId: number }) {
  const { tr, lang } = useI18n();
  const today = useMemo(startOfToday, []);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");

  const monthStart = useMemo(() => new Date(month.getFullYear(), month.getMonth(), 1), [month]);
  const monthEnd = useMemo(() => new Date(month.getFullYear(), month.getMonth() + 1, 0), [month]);

  // The same RPC the guest calendar uses, so "blocked" here means the same
  // thing it means to a guest: past, manually blocked, OR held by an
  // accepted booking. blocked_dates alone (the old source) missed that last
  // case entirely — a day a guest had actually booked looked just as open
  // as any other day on this screen.
  const { data: calendar } = useAvailability(chaletId, monthStart, monthEnd);
  const { data: blocked } = useBlockedDates(chaletId, true);
  const toggleBlocked = useToggleBlocked();
  const setDayPrice = useSetDayPrice();

  const calByDay = useMemo(() => {
    const m = new Map<string, { blocked: boolean; price: number; custom: boolean }>();
    for (const d of calendar ?? [])
      m.set(d.day, { blocked: d.blocked, price: Number(d.price), custom: d.custom });
    return m;
  }, [calendar]);
  const manualBlockedSet = useMemo(() => new Set(blocked ?? []), [blocked]);

  useEffect(() => {
    const price = selected ? calByDay.get(selected) : undefined;
    setPriceDraft(price?.custom ? String(price.price) : "");
  }, [selected, calByDay]);

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

  const selectedIsManualBlock = selected ? manualBlockedSet.has(selected) : false;
  const selectedIsPast = selected ? new Date(selected) < today : false;
  const selectedIsGuestBooked =
    !!selected && !selectedIsManualBlock && !selectedIsPast && !!calByDay.get(selected)?.blocked;

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
              const info = calByDay.get(iso);
              const isManualBlock = manualBlockedSet.has(iso);
              const past = d < today;
              const guestBooked = !isManualBlock && !past && !!info?.blocked;
              return (
                <button
                  key={iso}
                  onClick={() => setSelected(iso)}
                  aria-pressed={selected === iso}
                  title={
                    guestBooked ? (lang === "en" ? "Booked by a guest" : "محجوز من ضيف") : undefined
                  }
                  className={`flex aspect-square flex-col items-center justify-center gap-0.5 border text-sm transition-colors ${
                    selected === iso ? "border-foreground" : "border-transparent"
                  } ${
                    isManualBlock
                      ? "bg-destructive/10 text-destructive line-through hover:bg-destructive/20"
                      : guestBooked
                        ? "bg-foreground text-background hover:opacity-90"
                        : "hover:bg-secondary"
                  } ${past && !isManualBlock && !guestBooked ? "text-muted-foreground/50" : ""}`}
                >
                  {d.getDate()}
                  {info?.custom && !isManualBlock && !guestBooked && (
                    <span className="text-[9px] leading-none text-muted-foreground">
                      {info.price}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 bg-destructive/10" /> {tr("unavailableLabel")}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 bg-foreground" />{" "}
              {lang === "en" ? "Booked by a guest" : "محجوز من ضيف"}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-foreground/50" /> {tr("customPricing")}
            </span>
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

              {selectedIsGuestBooked ? (
                <p className="border border-border bg-secondary p-4 text-sm text-muted-foreground">
                  {lang === "en"
                    ? "This date is covered by an accepted booking. Manage it from Booking Requests."
                    : "هذا التاريخ ضمن حجز مقبول. يمكن إدارته من طلبات الحجز."}
                </p>
              ) : (
                <button
                  disabled={busy}
                  onClick={() =>
                    toggleBlocked.mutate({
                      chaletId,
                      day: selected,
                      blocked: selectedIsManualBlock,
                    })
                  }
                  className={`w-full py-3 text-sm uppercase tracking-widest transition-colors disabled:opacity-50 ${
                    selectedIsManualBlock
                      ? "border border-border hover:bg-secondary"
                      : "bg-black text-white hover:opacity-90"
                  }`}
                >
                  {selectedIsManualBlock ? tr("markAvailable") : tr("markUnavailable")}
                </button>
              )}

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
