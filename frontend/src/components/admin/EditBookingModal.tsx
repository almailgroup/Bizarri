import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useUpdateBookingDetails } from "@/lib/api";
import type { BookingRow } from "@/integrations/supabase/types";
import { useAdminT } from "./strings";
import { errorText, useToast } from "./toast";
import { Btn, ErrorNote, Field, Modal, inputClass } from "./ui";

/**
 * Direct field edits — guest details, a manual price override, and an
 * internal note. Dates aren't editable here: changing them would need the
 * same overlap and re-pricing checks request_booking() does, so a date
 * change goes through cancel-and-rebook instead of a silent field edit.
 */
export function EditBookingModal({
  booking,
  onClose,
}: {
  booking: BookingRow;
  onClose: () => void;
}) {
  const { tr } = useI18n();
  const t = useAdminT();
  const toast = useToast();
  const update = useUpdateBookingDetails();
  const [form, setForm] = useState({
    guest_name: booking.guest_name,
    guest_phone: booking.guest_phone,
    guest_email: booking.guest_email,
    guests: String(booking.guests),
    notes: booking.notes ?? "",
    admin_note: booking.admin_note ?? "",
    total: String(booking.total),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const guests = Number(form.guests);
    const total = Number(form.total);
    update.mutate(
      {
        id: booking.id,
        patch: {
          guest_name: form.guest_name.trim(),
          guest_phone: form.guest_phone.trim(),
          guest_email: form.guest_email.trim().toLowerCase(),
          guests: Number.isFinite(guests) && guests > 0 ? guests : booking.guests,
          notes: form.notes.trim() || null,
          admin_note: form.admin_note.trim() || null,
          total: Number.isFinite(total) && total >= 0 ? total : booking.total,
        },
      },
      {
        onSuccess: () => {
          toast.success(t("saved"));
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      title={tr("editDetails")}
      description={
        <span className="font-mono" dir="ltr">
          {booking.ref}
        </span>
      }
      onClose={onClose}
      busy={update.isPending}
      footer={
        <>
          <Btn onClick={onClose} disabled={update.isPending}>
            {tr("cancel")}
          </Btn>
          <Btn type="submit" form="edit-booking-form" variant="primary" busy={update.isPending}>
            {update.isPending ? t("saving") : tr("saveChanges")}
          </Btn>
        </>
      }
    >
      <form id="edit-booking-form" onSubmit={submit} className="space-y-4">
        {update.error && <ErrorNote>{errorText(update.error)}</ErrorNote>}

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
          <Field label={`${tr("total")} (${booking.currency})`}>
            {(a) => (
              <input
                {...a}
                type="number"
                min={0}
                value={form.total}
                onChange={(e) => setForm({ ...form, total: e.target.value })}
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
      </form>
    </Modal>
  );
}
