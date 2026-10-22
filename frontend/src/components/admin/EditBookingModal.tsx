import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { dateLocale } from "@/lib/locale";
import { addDays, discountAmount, fmtDate, formatMoney, parseDate } from "@/lib/booking";
import { useAdminUpdateBooking, useChalets, useQuote, useUpdateBookingDetails } from "@/lib/api";
import type { BookingRow } from "@/integrations/supabase/types";
import { useAdminT } from "./strings";
import { errorText, useToast } from "./toast";
import { Btn, ErrorNote, Field, Modal, Segmented, inputClass } from "./ui";

/**
 * Everything about a booking an admin may change: where and when (moved
 * through admin_update_booking(), which runs the same overlap checks a new
 * booking gets), who and how many, the price and the deposit, the email
 * language, the guest's notes and the internal note. The status has its own
 * buttons on the list.
 */
export function EditBookingModal({
  booking,
  onClose,
}: {
  booking: BookingRow;
  onClose: () => void;
}) {
  const { tr, lang } = useI18n();
  const t = useAdminT();
  const toast = useToast();
  const { data: chalets } = useChalets();
  const update = useUpdateBookingDetails();
  const move = useAdminUpdateBooking();

  // Asked as check-in and check-out, the way the new-booking form asks;
  // stored as the last night, like every booking.
  const originalOut = fmtDate(addDays(parseDate(booking.end_date), 1));
  const [stay, setStay] = useState({
    chaletId: booking.chalet_id,
    checkIn: booking.start_date,
    checkOut: originalOut,
    reprice: false,
  });
  const [form, setForm] = useState({
    guest_name: booking.guest_name,
    guest_phone: booking.guest_phone,
    guest_email: booking.guest_email,
    guests: String(booking.guests),
    notes: booking.notes ?? "",
    admin_note: booking.admin_note ?? "",
    total: String(booking.total),
    deposit: String(booking.deposit ?? 0),
    lang: (booking.lang === "ar" ? "ar" : "en") as "en" | "ar",
  });

  const lastNight =
    stay.checkIn && stay.checkOut && stay.checkOut > stay.checkIn
      ? fmtDate(addDays(parseDate(stay.checkOut), -1))
      : "";
  const nights = lastNight
    ? Math.round(
        (parseDate(lastNight).getTime() - parseDate(stay.checkIn).getTime()) / 86_400_000,
      ) + 1
    : 0;
  const stayChanged =
    stay.chaletId !== booking.chalet_id ||
    stay.checkIn !== booking.start_date ||
    stay.checkOut !== originalOut;
  const stayError =
    !stay.checkIn || !stay.checkOut
      ? t("errDates")
      : stay.checkOut <= stay.checkIn
        ? t("errOrder")
        : nights > 90
          ? t("errTooLong")
          : "";
  const quote = useQuote(stay.chaletId, stay.checkIn, lastNight, stayChanged && !stayError);
  // Repricing keeps a discount code's share: the same percentage of the new
  // price, or the same amount -- what admin_update_booking() does.
  const repriced = quote.data
    ? quote.data.total -
      (booking.discount_percent !== null && booking.discount_percent !== undefined
        ? discountAmount(quote.data.total, "percent", Number(booking.discount_percent))
        : Math.min(Number(booking.discount ?? 0), quote.data.total))
    : null;
  const busy = update.isPending || move.isPending;
  const error = move.error ?? update.error;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stayChanged && stayError) return;
    const guests = Number(form.guests);
    const total = Number(form.total);
    const deposit = Number(form.deposit);
    const repriced = stayChanged && stay.reprice;
    try {
      if (stayChanged) {
        await move.mutateAsync({
          id: booking.id,
          chaletId: stay.chaletId,
          start: stay.checkIn,
          end: lastNight,
          reprice: stay.reprice,
        });
      }
      await update.mutateAsync({
        id: booking.id,
        patch: {
          guest_name: form.guest_name.trim(),
          guest_phone: form.guest_phone.trim(),
          guest_email: form.guest_email.trim().toLowerCase(),
          guests: Number.isFinite(guests) && guests > 0 ? guests : booking.guests,
          notes: form.notes.trim() || null,
          admin_note: form.admin_note.trim() || null,
          // Repriced, the move has just set the total; sending the old one
          // back would undo it.
          ...(repriced
            ? {}
            : { total: Number.isFinite(total) && total >= 0 ? total : booking.total }),
          deposit: Number.isFinite(deposit) && deposit >= 0 ? deposit : booking.deposit,
          lang: form.lang,
        },
      });
      toast.success(stayChanged ? t("bookingMoved", { ref: booking.ref }) : t("saved"));
      onClose();
    } catch {
      // Shown in the form; see `error`.
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
      title={tr("editDetails")}
      description={
        <span className="font-mono" dir="ltr">
          {booking.ref}
        </span>
      }
      onClose={onClose}
      busy={busy}
      size="lg"
      footer={
        <>
          <Btn onClick={onClose} disabled={busy}>
            {tr("cancel")}
          </Btn>
          <Btn
            type="submit"
            form="edit-booking-form"
            variant="primary"
            busy={busy}
            disabled={stayChanged && !!stayError}
          >
            {busy ? t("saving") : tr("saveChanges")}
          </Btn>
        </>
      }
    >
      <form id="edit-booking-form" onSubmit={submit} className="space-y-6">
        {error && <ErrorNote>{errorText(error)}</ErrorNote>}

        {/* ------------------------------------------------------- stay */}
        <fieldset className="space-y-4">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("stayDetails")}
          </legend>
          {(chalets ?? []).length > 1 && (
            <Segmented
              label={t("chalet")}
              value={String(stay.chaletId)}
              onChange={(v) => setStay({ ...stay, chaletId: Number(v) })}
              options={(chalets ?? []).map((c) => ({
                value: String(c.id),
                label: lang === "en" ? c.name_en : c.name_ar,
              }))}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("checkInDate")}
              error={stayChanged ? stayError || undefined : undefined}
            >
              {(a) => (
                <input
                  {...a}
                  type="date"
                  value={stay.checkIn}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStay((s) => ({
                      ...s,
                      checkIn: v,
                      checkOut:
                        v && (!s.checkOut || s.checkOut <= v)
                          ? fmtDate(addDays(parseDate(v), 1))
                          : s.checkOut,
                    }));
                  }}
                  className={inputClass}
                />
              )}
            </Field>
            <Field label={t("checkOutDate")}>
              {(a) => (
                <input
                  {...a}
                  type="date"
                  min={stay.checkIn ? fmtDate(addDays(parseDate(stay.checkIn), 1)) : undefined}
                  value={stay.checkOut}
                  onChange={(e) => setStay({ ...stay, checkOut: e.target.value })}
                  className={inputClass}
                />
              )}
            </Field>
          </div>
          {nights > 0 && !stayError && (
            <p className="rounded-md bg-secondary px-3 py-2 text-sm">
              {t("stayLine", {
                days: nights === 1 ? t("oneDay") : t("days", { n: nights }),
                in: fmt(stay.checkIn),
                out: fmt(stay.checkOut),
              })}
            </p>
          )}
          {stayChanged && !stayError && (
            <label className="flex min-h-11 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                role="switch"
                checked={stay.reprice}
                onChange={(e) => setStay({ ...stay, reprice: e.target.checked })}
                className="admin-switch mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">{t("repriceNew")}</span>
                <span className="block text-xs text-muted-foreground" data-testid="reprice-hint">
                  {stay.reprice
                    ? repriced !== null
                      ? t("repriceTo", { amount: formatMoney(repriced, lang) })
                      : t("calculating")
                    : t("repriceKeep", { amount: formatMoney(Number(booking.total), lang) })}
                </span>
              </span>
            </label>
          )}
        </fieldset>

        {/* ------------------------------------------------------ guest */}
        <fieldset className="space-y-4">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("guestDetails")}
          </legend>
          <Field label={tr("fullName")}>
            {(a) => (
              <input
                {...a}
                value={form.guest_name}
                onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tr("phone")}>
              {(a) => (
                <input
                  {...a}
                  dir="ltr"
                  type="tel"
                  value={form.guest_phone}
                  onChange={(e) => setForm({ ...form, guest_phone: e.target.value })}
                  className={inputClass}
                />
              )}
            </Field>
            <Field label={tr("email")}>
              {(a) => (
                <input
                  {...a}
                  dir="ltr"
                  type="email"
                  value={form.guest_email}
                  onChange={(e) => setForm({ ...form, guest_email: e.target.value })}
                  className={inputClass}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tr("guests")}>
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={1}
                  max={20}
                  value={form.guests}
                  onChange={(e) => setForm({ ...form, guests: e.target.value })}
                  className={inputClass}
                />
              )}
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium">{t("emailLanguage")}</p>
              <Segmented
                label={t("emailLanguage")}
                value={form.lang}
                onChange={(v) => setForm({ ...form, lang: v })}
                options={[
                  { value: "en", label: t("english") },
                  { value: "ar", label: t("arabic") },
                ]}
              />
            </div>
          </div>
        </fieldset>

        {/* ------------------------------------------------------ price */}
        <fieldset className="space-y-4">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("priceAndNotes")}
          </legend>
          {booking.discount_code && (
            <p className="rounded-md bg-secondary px-3 py-2 text-sm" data-testid="edit-code">
              {t(Number(booking.deposit ?? 0) > 0 ? "bookedWithCodeKeep" : "bookedWithCodeLong", {
                code: booking.discount_code,
                amount: formatMoney(Number(booking.discount ?? 0), lang),
              })}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={`${tr("total")} (${booking.currency})`}
              hint={stayChanged && stay.reprice ? t("repriceSetsTotal") : undefined}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={0}
                  disabled={stayChanged && stay.reprice}
                  value={form.total}
                  onChange={(e) => setForm({ ...form, total: e.target.value })}
                  className={inputClass}
                />
              )}
            </Field>
            <Field label={`${t("deposit")} (${booking.currency})`} hint={t("depositWaiveHint")}>
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={0}
                  value={form.deposit}
                  onChange={(e) => setForm({ ...form, deposit: e.target.value })}
                  className={inputClass}
                />
              )}
            </Field>
          </div>

          <Field label={tr("notes")}>
            {(a) => (
              <textarea
                {...a}
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>

          <Field label={tr("internalNote")} hint={tr("internalNoteHint")}>
            {(a) => (
              <textarea
                {...a}
                rows={2}
                value={form.admin_note}
                onChange={(e) => setForm({ ...form, admin_note: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
        </fieldset>
      </form>
    </Modal>
  );
}
