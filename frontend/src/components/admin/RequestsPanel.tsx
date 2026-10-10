import { useMemo, useState } from "react";
import {
  CalendarPlus,
  Download,
  IdCard,
  Inbox,
  Mail,
  Pencil,
  Phone,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { dateLocale } from "@/lib/locale";
import { checkOutDay, fmtDate, formatMoney, parseDate } from "@/lib/booking";
import {
  civilIdUrl,
  useBookings,
  useChalets,
  useDeleteBooking,
  useSetBookingStatus,
} from "@/lib/api";
import type { BookingRow, BookingStatus } from "@/integrations/supabase/types";
import { DeleteConfirm } from "./DeleteConfirm";
import { EditBookingModal } from "./EditBookingModal";
import { useAdminT } from "./strings";
import { errorText, useToast } from "./toast";
import {
  Btn,
  Card,
  EmptyState,
  ErrorNote,
  IconBtn,
  PanelHeader,
  SkeletonList,
  StatusBadge,
  Tag,
  cx,
} from "./ui";

const STATUS_ORDER: BookingStatus[] = ["pending", "accepted", "rejected"];

export function RequestsPanel({
  initialQuery = "",
  onNewBooking,
}: {
  initialQuery?: string;
  onNewBooking: () => void;
}) {
  const { tr, lang } = useI18n();
  const t = useAdminT();
  const toast = useToast();
  const { data: bookings, isLoading, error, refetch } = useBookings(true);
  const { data: chalets } = useChalets();
  const setStatus = useSetBookingStatus();
  const remove = useDeleteBooking();
  const [pendingDelete, setPendingDelete] = useState<BookingRow | null>(null);
  const [editing, setEditing] = useState<BookingRow | null>(null);
  const [filter, setFilter] = useState<BookingStatus | "all">("all");
  const [query, setQuery] = useState(initialQuery);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: (bookings ?? []).length };
    for (const b of bookings ?? []) c[b.status] = (c[b.status] ?? 0) + 1;
    return c;
  }, [bookings]);

  const packageName = (key: string | null) =>
    key === "fullWeek"
      ? tr("fullWeekPkg")
      : key === "weekend"
        ? tr("weekendPkg")
        : key === "weekday"
          ? tr("weekdayPkg")
          : key === "special"
            ? tr("specialPkg")
            : "";

  const chaletName = (id: number) => {
    const c = (chalets ?? []).find((x) => x.id === id);
    return c ? (lang === "en" ? c.name_en : c.name_ar) : `Chalet ${id}`;
  };

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
        Status: t(b.status),
        Chalet: b.chalet_id,
        // The same check-in and check-out the guest is shown: arrival on the
        // first booked day, departure the morning after the last.
        "Check-in": `${b.start_date} 14:00`,
        "Check-out": `${fmtDate(checkOutDay(parseDate(b.end_date)))} 12:00`,
        Days: b.days,
        [`Total (${b.currency})`]: Number(b.total),
        Package: packageName(b.package_key),
        Name: b.guest_name,
        Phone: b.guest_phone,
        Email: b.guest_email,
        Guests: b.guests,
        Notes: b.notes ?? "",
        "Internal note": b.admin_note ?? "",
        Source: b.source === "admin" ? "Admin" : "Website",
        Submitted: new Date(b.created_at).toLocaleString("en-GB"),
      })),
    );
    sheet["!cols"] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
      { wch: 16 },
      { wch: 16 },
      { wch: 6 },
      { wch: 12 },
      { wch: 20 },
      { wch: 22 },
      { wch: 16 },
      { wch: 26 },
      { wch: 8 },
      { wch: 40 },
      { wch: 30 },
      { wch: 10 },
      { wch: 20 },
    ];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Bookings");
    XLSX.writeFile(book, `bizarri-bookings-${fmtDate(new Date())}.xlsx`);
  };

  const changeStatus = (b: BookingRow, status: BookingStatus) =>
    setStatus.mutate(
      { id: b.id, status },
      {
        onSuccess: () => toast.success(t("statusChanged", { ref: b.ref, status: t(status) })),
        onError: (err) => toast.error(errorText(err)),
      },
    );

  const fmt = (iso: string, year = false) =>
    parseDate(iso).toLocaleDateString(dateLocale(lang), {
      weekday: "short",
      day: "numeric",
      month: "short",
      ...(year ? { year: "numeric" } : {}),
    });

  return (
    <section>
      <PanelHeader
        title={tr("requests")}
        description={counts.all ? t("bookingsCount", { n: counts.all }) : undefined}
        actions={
          <>
            <Btn
              onClick={exportXlsx}
              disabled={rows.length === 0}
              icon={<Download className="h-4 w-4" aria-hidden="true" />}
            >
              {tr("exportExcel")}
            </Btn>
            <Btn
              variant="primary"
              onClick={onNewBooking}
              icon={<CalendarPlus className="h-4 w-4" aria-hidden="true" />}
            >
              {t("newBooking")}
            </Btn>
          </>
        }
      />

      <Card className="mb-5 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("changeStatus")}>
          {(["all", ...STATUS_ORDER, "cancelled"] as const)
            .filter((f) => f !== "cancelled" || counts.cancelled)
            .map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cx(
                  "inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                  filter === f
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {f === "all" ? t("all") : t(f)}
                <span
                  className={cx(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    filter === f ? "bg-background/20" : "bg-secondary",
                  )}
                >
                  {counts[f] ?? 0}
                </span>
              </button>
            ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("searchRequests")}
            aria-label={tr("searchRequests")}
            className="min-h-10 w-full rounded-md border border-border bg-background py-2 pe-10 ps-9 text-sm outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={tr("clear")}
              className="absolute end-0 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </Card>

      {error && (
        <div className="mb-4">
          <ErrorNote onRetry={() => refetch()}>{errorText(error)}</ErrorNote>
        </div>
      )}

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Inbox className="h-6 w-6" />}>
          {query ? tr("noMatches") : tr("noRequests")}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map((b) => {
            const updating = setStatus.isPending && setStatus.variables?.id === b.id;
            return (
              <Card as="li" key={b.id} className="overflow-hidden">
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={b.status} />
                        {b.source === "admin" && <Tag>{t("addedByAdmin")}</Tag>}
                        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                          {b.ref}
                        </span>
                      </div>
                      <p className="mt-2 text-lg font-semibold">{b.guest_name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {chaletName(b.chalet_id)} · {fmt(b.start_date)} → {fmt(b.end_date, true)} ·{" "}
                        {b.days === 1 ? t("oneDay") : t("days", { n: b.days })}
                      </p>
                    </div>
                    <div className="sm:text-end">
                      <p className="text-xl font-semibold tabular-nums">
                        {formatMoney(Number(b.total), lang)}
                      </p>
                      {b.package_key && (
                        <p className="text-xs text-muted-foreground">
                          {packageName(b.package_key)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    <a
                      href={`tel:${b.guest_phone}`}
                      dir="ltr"
                      className="inline-flex min-h-6 items-center gap-1.5 hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      {b.guest_phone}
                    </a>
                    <a
                      href={`mailto:${b.guest_email}`}
                      dir="ltr"
                      className="inline-flex min-h-6 min-w-0 items-center gap-1.5 hover:underline"
                    >
                      <Mail
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="truncate">{b.guest_email}</span>
                    </a>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      {tr("guestsLabel")}: {b.guests}
                    </span>
                  </div>

                  {b.source !== "admin" && <CivilIdLink path={b.civil_id_path} />}
                  {b.notes && (
                    <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm">{b.notes}</p>
                  )}
                  {b.admin_note && (
                    <p className="mt-2 border-s-2 border-amber-400 ps-3 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{tr("internalNote")}:</span>{" "}
                      {b.admin_note}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-secondary/40 px-4 py-2 sm:px-5">
                  <div className="flex flex-wrap gap-1" role="group" aria-label={t("changeStatus")}>
                    {STATUS_ORDER.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={updating}
                        onClick={() => b.status !== s && changeStatus(b, s)}
                        aria-pressed={b.status === s}
                        className={cx(
                          "min-h-10 rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-50",
                          b.status === s
                            ? s === "accepted"
                              ? "bg-emerald-600 text-white"
                              : s === "rejected"
                                ? "bg-destructive text-destructive-foreground"
                                : "bg-amber-100 text-amber-900"
                            : "text-muted-foreground hover:bg-background hover:text-foreground",
                        )}
                      >
                        {t(s)}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center">
                    <IconBtn label={tr("editDetails")} onClick={() => setEditing(b)}>
                      <Pencil className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn
                      tone="danger"
                      label={tr("deleteRequest")}
                      onClick={() => setPendingDelete(b)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  </div>
                </div>
              </Card>
            );
          })}
        </ul>
      )}

      {editing && <EditBookingModal booking={editing} onClose={() => setEditing(null)} />}

      {pendingDelete && (
        <DeleteConfirm
          title={t("deleteBookingTitle")}
          body={t("deleteBookingBody")}
          label={`${pendingDelete.ref} · ${pendingDelete.guest_name}`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            const ref = pendingDelete.ref;
            await remove.mutateAsync(pendingDelete.id);
            setPendingDelete(null);
            toast.success(t("bookingDeleted", { ref }));
          }}
        />
      )}
    </section>
  );
}

/**
 * The bucket is private, so the image is reached through a short-lived signed
 * URL minted on demand rather than a stored link that would outlive the view.
 */
function CivilIdLink({ path }: { path: string | null }) {
  const { tr } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!path) {
    return <p className="mt-3 text-sm text-muted-foreground">{tr("noCivilId")}</p>;
  }

  return (
    <div className="mt-3">
      <Btn
        size="sm"
        busy={busy}
        icon={<IdCard className="h-4 w-4" aria-hidden="true" />}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            window.open(await civilIdUrl(path), "_blank", "noopener,noreferrer");
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {tr("viewCivilId")}
      </Btn>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
