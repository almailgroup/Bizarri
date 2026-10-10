import { useMemo, useState } from "react";
import { AlertTriangle, CalendarPlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { dateLocale } from "@/lib/locale";
import { addDays, fmtDate, formatMoney, parseDate, startOfToday } from "@/lib/booking";
import {
  useAdminCreateBooking,
  useBlockedDates,
  useBookings,
  useChalets,
  useInsuranceDeposit,
  useQuote,
} from "@/lib/api";
import type { BookingRow } from "@/integrations/supabase/types";
import type { BookingPrefill } from "./AvailabilityPanel";
import { useAdminT, type AdminKey } from "./strings";
import { errorText, useToast } from "./toast";
import { Btn, ErrorNote, Field, Modal, Segmented, inputClass } from "./ui";

const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

type Status = "pending" | "accepted";

/**
 * A booking the admin types in -- the guest rang, or wrote on WhatsApp.
 *
 * Dates are asked as check-in and check-out, the way a person on the phone
 * says them; the booking itself stores the last night (check-out minus one),
 * like every other booking. Everything the server will refuse is checked here
 * first so the admin sees it against the field, but the server checks it all
 * again: this form is a convenience, not the rule.
 */
export function NewBookingModal({
  prefill,
  onClose,
}: {
  prefill?: Partial<BookingPrefill>;
  onClose: () => void;
}) {
  const { lang, tr } = useI18n();
  const t = useAdminT();
  const toast = useToast();
  const { data: chalets } = useChalets();
  const create = useAdminCreateBooking();
  const todayIso = fmtDate(startOfToday());

  const [form, setForm] = useState(() => ({
    chaletId: prefill?.chaletId ?? 1,
    checkIn: prefill?.start ?? "",
    checkOut: prefill?.end ? fmtDate(addDays(parseDate(prefill.end), 1)) : "",
    name: "",
    phone: "",
    email: "",
    guests: "2",
    status: "pending" as Status,
    total: "",
    notes: "",
    adminNote: "",
    lang: lang as "en" | "ar",
    notify: true,
  }));
  const [tried, setTried] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // The booking's last night: check-out is the morning after it.
  const lastNight =
    form.checkIn && form.checkOut && form.checkOut > form.checkIn
      ? fmtDate(addDays(parseDate(form.checkOut), -1))
      : "";
  const nights = lastNight
    ? Math.round(
        (parseDate(lastNight).getTime() - parseDate(form.checkIn).getTime()) / 86_400_000,
      ) + 1
    : 0;

  const errors = useMemo(() => {
    const e: Partial<Record<string, AdminKey>> = {};
    if (!form.checkIn || !form.checkOut) e.dates = "errDates";
    else if (form.checkOut <= form.checkIn) e.dates = "errOrder";
    else if (form.checkIn < todayIso) e.dates = "errPast";
    else if (nights > 90) e.dates = "errTooLong";
    if (form.name.trim().length < 2) e.name = "errName";
    if (form.phone.replace(/\D/g, "").length < 8) e.phone = "errPhone";
    if (!EMAIL.test(form.email.trim())) e.email = "errEmail";
    const g = Number(form.guests);
    if (!Number.isInteger(g) || g < 1 || g > 20) e.guests = "errGuests";
    if (form.total.trim() !== "" && !(Number(form.total) >= 0)) e.total = "errTotal";
    return e;
  }, [form, todayIso, nights]);

  // What the dates run into, worked out here so the admin hears it before
  // pressing Create. An accepted booking cannot overlap another or a closed
  // day; a pending one can, as guests' requests do.
  const { data: bookings } = useBookings(true);
  const { data: blocked } = useBlockedDates(form.chaletId, true);
  const clash: BookingRow | undefined = useMemo(
    () =>
      lastNight
        ? (bookings ?? []).find(
            (b) =>
              b.chalet_id === form.chaletId &&
              b.status === "accepted" &&
              b.start_date <= lastNight &&
              b.end_date >= form.checkIn,
          )
        : undefined,
    [bookings, form.chaletId, form.checkIn, lastNight],
  );
  const closedInRange = useMemo(
    () => (lastNight ? (blocked ?? []).some((d) => d >= form.checkIn && d <= lastNight) : false),
    [blocked, form.checkIn, lastNight],
  );
  const conflict = form.status === "accepted" && (!!clash || closedInRange);

  const quote = useQuote(form.chaletId, form.checkIn, lastNight, !errors.dates);
  // The database adds the same deposit to the row it creates.
  const deposit = useInsuranceDeposit();
  const stayPrice =
    form.total.trim() !== "" && Number(form.total) >= 0
      ? Number(form.total)
      : quote.data && !errors.dates
        ? quote.data.total
        : null;

  const fieldError = (k: string) => (tried && errors[k] ? t(errors[k]!) : undefined);
  const invalid = Object.keys(errors).length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (invalid || conflict) return;
    try {
      const row = await create.mutateAsync({
        chaletId: form.chaletId,
        start: form.checkIn,
        end: lastNight,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        guests: Number(form.guests),
        status: form.status,
        total: form.total.trim() === "" ? null : Number(form.total),
        notes: form.notes.trim(),
        adminNote: form.adminNote.trim(),
        lang: form.lang,
        notifyGuest: form.notify,
      });
      toast.success(t("bookingCreated", { ref: row?.ref ?? "" }));
      onClose();
    } catch {
      // Shown in the form, where the admin is looking; see create.error.
    }
  };

  const fmt = (iso: string) =>
    parseDate(iso).toLocaleDateString(dateLocale(lang), {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  return (
    <Modal
      title={t("newBookingTitle")}
      description={t("newBookingIntro")}
      onClose={onClose}
      size="lg"
      busy={create.isPending}
      footer={
        <>
          <Btn onClick={onClose} disabled={create.isPending}>
            {tr("cancel")}
          </Btn>
          <Btn
            type="submit"
            form="new-booking-form"
            variant="primary"
            busy={create.isPending}
            disabled={conflict}
            icon={<CalendarPlus className="h-4 w-4" aria-hidden="true" />}
          >
            {create.isPending ? t("creating") : t("createBooking")}
          </Btn>
        </>
      }
    >
      <form id="new-booking-form" onSubmit={submit} noValidate className="space-y-6">
        {create.error && <ErrorNote>{errorText(create.error)}</ErrorNote>}
        {tried && invalid && !create.error && <ErrorNote>{t("fixErrors")}</ErrorNote>}

        {/* ------------------------------------------------------- stay */}
        <fieldset className="space-y-4">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("stayDetails")}
          </legend>
          {(chalets ?? []).length > 1 && (
            <Segmented
              label={t("chalet")}
              value={String(form.chaletId)}
              onChange={(v) => set("chaletId", Number(v))}
              options={(chalets ?? []).map((c) => ({
                value: String(c.id),
                label: lang === "en" ? c.name_en : c.name_ar,
              }))}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("checkInDate")} error={fieldError("dates")}>
              {(a) => (
                <input
                  {...a}
                  data-autofocus={prefill?.start ? undefined : true}
                  type="date"
                  min={todayIso}
                  value={form.checkIn}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => ({
                      ...f,
                      checkIn: v,
                      // Keep the stay's length when the check-in moves past
                      // the check-out, rather than leaving it reversed.
                      checkOut:
                        v && (!f.checkOut || f.checkOut <= v)
                          ? fmtDate(addDays(parseDate(v), 1))
                          : f.checkOut,
                    }));
                  }}
                  className={inputClass}
                />
              )}
            </Field>
            <Field label={t("checkOutDate")} error={tried && errors.dates ? " " : undefined}>
              {(a) => (
                <input
                  {...a}
                  type="date"
                  min={form.checkIn ? fmtDate(addDays(parseDate(form.checkIn), 1)) : todayIso}
                  value={form.checkOut}
                  onChange={(e) => set("checkOut", e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
          </div>
          {nights > 0 && !errors.dates && (
            <p className="rounded-md bg-secondary px-3 py-2 text-sm">
              {t("stayLine", {
                days: nights === 1 ? t("oneDay") : t("days", { n: nights }),
                in: fmt(form.checkIn),
                out: fmt(form.checkOut),
              })}
            </p>
          )}
          {(clash || closedInRange) && !errors.dates && (
            <div
              role="status"
              className={
                "flex gap-2 rounded-md border px-3 py-2 text-sm " +
                (conflict
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-amber-200 bg-amber-50 text-amber-900")
              }
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                {clash
                  ? t("clashAccepted", { ref: clash.ref, name: clash.guest_name })
                  : t("clashBlocked")}{" "}
                {conflict && t("clashPendingOk")}
              </p>
            </div>
          )}
        </fieldset>

        {/* ------------------------------------------------------ guest */}
        <fieldset className="space-y-4">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("guestDetails")}
          </legend>
          <Field label={t("fullName")} error={fieldError("name")}>
            {(a) => (
              <input
                {...a}
                data-autofocus={prefill?.start ? true : undefined}
                autoComplete="off"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputClass}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("phone")} error={fieldError("phone")}>
              {(a) => (
                <input
                  {...a}
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  autoComplete="off"
                  placeholder="+965 9xxx xxxx"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
            <Field label={t("email")} error={fieldError("email")}>
              {(a) => (
                <input
                  {...a}
                  type="email"
                  dir="ltr"
                  autoComplete="off"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
          </div>
          <Field label={t("guests")} error={fieldError("guests")} className="max-w-[10rem]">
            {(a) => (
              <input
                {...a}
                type="number"
                min={1}
                max={20}
                inputMode="numeric"
                value={form.guests}
                onChange={(e) => set("guests", e.target.value)}
                className={inputClass}
              />
            )}
          </Field>
          <Field label={t("guestNotes")}>
            {(a) => (
              <textarea
                {...a}
                rows={2}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                className={inputClass}
              />
            )}
          </Field>
        </fieldset>

        {/* -------------------------------------------- status and price */}
        <fieldset className="space-y-4">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("bookingOptions")}
          </legend>
          <div>
            <p className="mb-1.5 text-sm font-medium">{t("status")}</p>
            <Segmented
              label={t("status")}
              value={form.status}
              onChange={(v) => set("status", v)}
              options={[
                { value: "pending", label: t("pending") },
                { value: "accepted", label: t("accepted") },
              ]}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {form.status === "accepted" ? t("statusHintAccepted") : t("statusHintPending")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">{t("calculatedPrice")}</p>
              <p className="mt-1 text-xl font-semibold" data-testid="quote">
                {errors.dates
                  ? "—"
                  : quote.isFetching && !quote.data
                    ? t("calculating")
                    : quote.data
                      ? formatMoney(quote.data.total, lang)
                      : "—"}
              </p>
              {deposit > 0 && (
                <p className="mt-1 text-xs text-muted-foreground" data-testid="quote-deposit">
                  {t("plusDeposit", { amount: formatMoney(deposit, lang) })}
                  {stayPrice !== null && (
                    <>
                      {" · "}
                      {t("totalDue")}{" "}
                      <span className="font-medium text-foreground">
                        {formatMoney(stayPrice + deposit, lang)}
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
            <Field label={t("overrideTotal")} hint={t("overrideHint")} error={fieldError("total")}>
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={0}
                  step="0.001"
                  inputMode="decimal"
                  value={form.total}
                  onChange={(e) => set("total", e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
          </div>

          <Field label={t("internalNote")} hint={t("internalNoteHint")}>
            {(a) => (
              <textarea
                {...a}
                rows={2}
                value={form.adminNote}
                onChange={(e) => set("adminNote", e.target.value)}
                className={inputClass}
              />
            )}
          </Field>

          <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
            <label className="flex min-h-11 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                role="switch"
                checked={form.notify}
                onChange={(e) => set("notify", e.target.checked)}
                className="admin-switch mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">{t("emailGuest")}</span>
                <span className="block text-xs text-muted-foreground">
                  {form.status === "accepted"
                    ? t("emailGuestHintAccepted")
                    : t("emailGuestHintPending")}
                </span>
              </span>
            </label>
            {form.notify && (
              <div>
                <p className="mb-1.5 text-sm font-medium">{t("emailLanguage")}</p>
                <Segmented
                  label={t("emailLanguage")}
                  value={form.lang}
                  onChange={(v) => set("lang", v)}
                  options={[
                    { value: "en", label: t("english") },
                    { value: "ar", label: t("arabic") },
                  ]}
                />
              </div>
            )}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
