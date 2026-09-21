import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAllOccasions, useDeleteOccasion, useSaveOccasion } from "@/lib/api";
import { formatMoney } from "@/lib/booking";
import type { SpecialOccasionRow } from "@/integrations/supabase/types";
import { DeleteConfirm } from "./DeleteConfirm";

const BLANK = { name_en: "", name_ar: "", start_date: "", end_date: "", price: "900" };

export function OccasionsPanel() {
  const { tr, lang } = useI18n();
  const { data: items } = useAllOccasions(true);
  const save = useSaveOccasion();
  const remove = useDeleteOccasion();
  const [form, setForm] = useState(BLANK);
  const [pendingDelete, setPendingDelete] = useState<SpecialOccasionRow | null>(null);

  // The DB refuses overlapping active windows; say so in plain language
  // rather than surfacing the raw exclusion-constraint text.
  const saveError = save.error
    ? /exclusion|occasions_no_overlap/i.test((save.error as Error).message)
      ? tr("occasionOverlaps")
      : (save.error as Error).message
    : null;

  const valid =
    form.name_en.trim().length > 0 &&
    form.start_date !== "" &&
    form.end_date !== "" &&
    form.end_date >= form.start_date &&
    Number(form.price) >= 0;

  return (
    <section>
      <h2 className="mb-2 text-3xl font-semibold">{tr("specialOccasions")}</h2>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{tr("occasionsHint")}</p>

      {saveError && (
        <p className="mb-4 border border-destructive p-4 text-sm text-destructive">{saveError}</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          save.mutate(
            { ...form, price: Number(form.price), active: true },
            { onSuccess: () => setForm(BLANK) },
          );
        }}
        className="mb-8 grid gap-3 border border-border p-5 md:grid-cols-2"
      >
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {tr("occasionName")}
          </span>
          <input
            value={form.name_en}
            onChange={(e) => setForm({ ...form, name_en: e.target.value })}
            placeholder="Eid Al-Fitr"
            className="mt-2 w-full border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {tr("occasionNameAr")}
          </span>
          <input
            value={form.name_ar}
            dir="rtl"
            onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
            placeholder="عيد الفطر"
            className="mt-2 w-full border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {tr("startDate")}
          </span>
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            className="mt-2 w-full border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {tr("endDate")}
          </span>
          <input
            type="date"
            value={form.end_date}
            min={form.start_date || undefined}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            className="mt-2 w-full border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {tr("priceLabel")}
          </span>
          <input
            type="number"
            min={0}
            step="0.001"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="mt-2 w-full border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={!valid || save.isPending}
          className="flex items-center justify-center gap-2 self-end bg-black px-6 py-3 text-sm uppercase tracking-widest text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> {tr("addOccasion")}
        </button>
      </form>

      <ul className="space-y-3">
        {(items ?? []).length === 0 && (
          <li className="text-sm text-muted-foreground">{tr("noOccasions")}</li>
        )}
        {(items ?? []).map((o) => (
          <li
            key={o.id}
            className="flex flex-wrap items-center justify-between gap-4 border border-border p-5"
          >
            <div>
              <p className="text-xl font-semibold">
                {lang === "en" ? o.name_en : o.name_ar || o.name_en}
              </p>
              <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                {o.start_date} → {o.end_date} · {formatMoney(Number(o.price), lang)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs uppercase tracking-widest">
                <input
                  type="checkbox"
                  checked={o.active}
                  disabled={save.isPending}
                  onChange={() => save.mutate({ ...o, active: !o.active })}
                  className="h-4 w-4 accent-black"
                />
                {tr("activeLabel")}
              </label>
              <button
                onClick={() => setPendingDelete(o)}
                aria-label={`${tr("deleteRequest")} ${o.name_en}`}
                className="p-2 text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {pendingDelete && (
        <DeleteConfirm
          label={pendingDelete.name_en}
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
