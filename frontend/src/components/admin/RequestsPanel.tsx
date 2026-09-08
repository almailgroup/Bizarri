import { useMemo, useState } from "react";
import { Download, Pencil, Search, Trash2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { fmtDate, formatMoney } from "@/lib/booking";
import { useBookings, useDeleteBooking, useSetBookingStatus } from "@/lib/api";
import type { BookingRow, BookingStatus } from "@/integrations/supabase/types";
import { DeleteConfirm } from "./DeleteConfirm";
import { EditBookingModal } from "./EditBookingModal";

const STATUS_ORDER: BookingStatus[] = ["pending", "accepted", "rejected"];

export function RequestsPanel() {
  const { tr, lang } = useI18n();
  const { data: bookings, isLoading, error } = useBookings(true);
  const setStatus = useSetBookingStatus();
  const remove = useDeleteBooking();
  const [pendingDelete, setPendingDelete] = useState<BookingRow | null>(null);
  const [editing, setEditing] = useState<BookingRow | null>(null);
  const [filter, setFilter] = useState<BookingStatus | "all">("all");
  const [query, setQuery] = useState("");

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

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (bookings ?? []).filter((b) => {
      if (filter !== "all" && b.status !== filter) return false;
      if (!q) return true;
      return (
        b.guest_name.toLowerCase().includes(q) ||
        b.guest_phone.toLowerCase().includes(q) ||
        b.guest_email.toLowerCase().includes(q) ||
        b.ref.toLowerCase().includes(q)
      );
    });
  }, [bookings, filter, query]);

  const exportXlsx = async () => {
    // Loaded on demand so the ~400 kB library never reaches site visitors.
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(
      rows.map((b) => ({
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
        "Internal note": b.admin_note ?? "",
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
      { wch: 30 },
      { wch: 20 },
    ];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Bookings");
    XLSX.writeFile(book, `bizarri-bookings-${fmtDate(new Date())}.xlsx`);
  };

  const failure = setStatus.error ?? remove.error;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
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
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 border border-border px-5 py-2 text-xs uppercase tracking-widest transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> {tr("exportExcel")}
          </button>
        </div>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("searchRequests")}
          className="w-full border border-border bg-secondary py-2.5 pe-9 ps-10 text-sm outline-none focus:border-foreground"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label={tr("clear")}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
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
        <p className="text-sm text-muted-foreground">
          {query ? tr("noMatches") : tr("noRequests")}
        </p>
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
              <div className="flex items-start gap-3">
                <p className="font-display text-2xl">{formatMoney(Number(b.total), lang)}</p>
                <button
                  onClick={() => setEditing(b)}
                  aria-label={tr("editDetails")}
                  className="p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
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
            {b.admin_note && (
              <p className="mt-2 border-s-2 border-foreground/30 ps-3 text-sm text-muted-foreground">
                {tr("internalNote")}: {b.admin_note}
              </p>
            )}

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

      {editing && <EditBookingModal booking={editing} onClose={() => setEditing(null)} />}

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
