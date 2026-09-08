import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useUpdateBookingDetails } from "@/lib/api";
import type { BookingRow } from "@/integrations/supabase/types";

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
  const { tr, lang } = useI18n();
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
      { onSuccess: onClose },
    );
  };

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={tr("editDetails")}
    >
      <form
        onSubmit={submit}
        className="animate-scale-in max-h-[90vh] w-full max-w-lg overflow-y-auto border border-border bg-background p-8"
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="font-display text-2xl">{tr("editDetails")}</h3>
            <p className="mt-1 font-mono text-xs text-muted-foreground" dir="ltr">
              {booking.ref}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr("close")}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {update.error && (
          <p className="mb-4 border border-destructive p-3 text-sm text-destructive">
            {(update.error as Error).message}
          </p>
        )}

        <div className="space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {tr("fullName")}
            </span>
            <input
              value={form.guest_name}
              onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
              className="mt-1 w-full border border-border bg-secondary px-3 py-2 outline-none focus:border-foreground"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {tr("phone")}
              </span>
              <input
                dir="ltr"
                value={form.guest_phone}
                onChange={(e) => setForm({ ...form, guest_phone: e.target.value })}
                className="mt-1 w-full border border-border bg-secondary px-3 py-2 outline-none focus:border-foreground"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {tr("email")}
              </span>
              <input
                dir="ltr"
                type="email"
                value={form.guest_email}
                onChange={(e) => setForm({ ...form, guest_email: e.target.value })}
                className="mt-1 w-full border border-border bg-secondary px-3 py-2 outline-none focus:border-foreground"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {tr("guests")}
              </span>
              <input
                type="number"
                min={1}
                max={20}
                value={form.guests}
                onChange={(e) => setForm({ ...form, guests: e.target.value })}
                className="mt-1 w-full border border-border bg-secondary px-3 py-2 outline-none focus:border-foreground"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {tr("total")} ({booking.currency})
              </span>
              <input
                type="number"
                min={0}
                value={form.total}
                onChange={(e) => setForm({ ...form, total: e.target.value })}
                className="mt-1 w-full border border-border bg-secondary px-3 py-2 outline-none focus:border-foreground"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {tr("notes")}
            </span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1 w-full border border-border bg-secondary px-3 py-2 outline-none focus:border-foreground"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {tr("internalNote")}
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground/70">
              {tr("internalNoteHint")}
            </span>
            <textarea
              rows={2}
              value={form.admin_note}
              onChange={(e) => setForm({ ...form, admin_note: e.target.value })}
              className="mt-1 w-full border border-border bg-secondary px-3 py-2 outline-none focus:border-foreground"
            />
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            disabled={update.isPending}
            className="flex-1 bg-black py-3 text-sm uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-50"
          >
            {update.isPending ? (lang === "en" ? "Saving…" : "جارٍ الحفظ…") : tr("saveChanges")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border border-border px-6 py-3 text-sm uppercase tracking-widest hover:bg-secondary"
          >
            {tr("cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
