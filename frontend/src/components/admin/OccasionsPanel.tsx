import { useState } from "react";
import { PartyPopper, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAllOccasions, useDeleteOccasion, useSaveOccasion } from "@/lib/api";
import { formatMoney, formatSpan, parseDate } from "@/lib/booking";
import type { SpecialOccasionRow } from "@/integrations/supabase/types";
import { DeleteConfirm } from "./DeleteConfirm";
import { useAdminT } from "./strings";
import { errorText, useToast } from "./toast";
import {
  Btn,
  Card,
  EmptyState,
  Field,
  IconBtn,
  PanelHeader,
  SkeletonList,
  Tag,
  inputClass,
} from "./ui";

const BLANK = { name_en: "", name_ar: "", start_date: "", end_date: "", price: "900" };

export function OccasionsPanel() {
  const { tr, lang } = useI18n();
  const t = useAdminT();
  const toast = useToast();
  const { data: items, isLoading } = useAllOccasions(true);
  const save = useSaveOccasion();
  const remove = useDeleteOccasion();
  const [form, setForm] = useState(BLANK);
  const [pendingDelete, setPendingDelete] = useState<SpecialOccasionRow | null>(null);

  // The DB refuses overlapping active windows; say so in plain language
  // rather than surfacing the raw exclusion-constraint text.
  const explain = (err: unknown) =>
    /exclusion|occasions_no_overlap/i.test(errorText(err))
      ? tr("occasionOverlaps")
      : errorText(err);

  const valid =
    form.name_en.trim().length > 0 &&
    form.start_date !== "" &&
    form.end_date !== "" &&
    form.end_date >= form.start_date &&
    Number(form.price) >= 0;

  return (
    <section>
      <PanelHeader title={tr("specialOccasions")} description={tr("occasionsHint")} />

      <Card className="mb-6 p-5 sm:p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            save.mutate(
              { ...form, price: Number(form.price), active: true },
              {
                onSuccess: () => {
                  setForm(BLANK);
                  toast.success(t("saved"));
                },
                onError: (err) => toast.error(explain(err)),
              },
            );
          }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          <Field label={tr("occasionName")}>
            {(a) => (
              <input
                {...a}
                value={form.name_en}
                onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                placeholder="Eid Al-Fitr"
                className={inputClass}
              />
            )}
          </Field>
          <Field label={tr("occasionNameAr")}>
            {(a) => (
              <input
                {...a}
                value={form.name_ar}
                dir="rtl"
                onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                placeholder="عيد الفطر"
                className={inputClass}
              />
            )}
          </Field>
          <Field label={tr("priceLabel")}>
            {(a) => (
              <input
                {...a}
                type="number"
                min={0}
                step="0.001"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
          <Field label={tr("startDate")}>
            {(a) => (
              <input
                {...a}
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
          <Field label={tr("endDate")}>
            {(a) => (
              <input
                {...a}
                type="date"
                value={form.end_date}
                min={form.start_date || undefined}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
          <div className="flex items-end">
            <Btn
              type="submit"
              variant="primary"
              busy={save.isPending}
              disabled={!valid}
              className="w-full"
              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              {tr("addOccasion")}
            </Btn>
          </div>
        </form>
      </Card>

      {isLoading ? (
        <SkeletonList rows={2} />
      ) : (items ?? []).length === 0 ? (
        <EmptyState icon={<PartyPopper className="h-6 w-6" />}>{tr("noOccasions")}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {(items ?? []).map((o) => (
            <Card
              as="li"
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-4 p-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold">
                    {lang === "en" ? o.name_en : o.name_ar || o.name_en}
                  </p>
                  {!o.active && <Tag>{lang === "en" ? "Off" : "متوقف"}</Tag>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatSpan(parseDate(o.start_date), parseDate(o.end_date), lang)} ·{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(Number(o.price), lang)}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={o.active}
                    disabled={save.isPending}
                    onChange={() =>
                      save.mutate(
                        { ...o, active: !o.active },
                        {
                          onSuccess: () => toast.success(t("saved")),
                          onError: (err) => toast.error(explain(err)),
                        },
                      )
                    }
                    className="admin-switch"
                  />
                  {tr("activeLabel")}
                </label>
                <IconBtn
                  tone="danger"
                  label={`${t("delete")} ${o.name_en}`}
                  onClick={() => setPendingDelete(o)}
                >
                  <Trash2 className="h-4 w-4" />
                </IconBtn>
              </div>
            </Card>
          ))}
        </ul>
      )}

      {pendingDelete && (
        <DeleteConfirm
          title={t("deleteOccasionTitle")}
          label={pendingDelete.name_en}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await remove.mutateAsync(pendingDelete.id);
            setPendingDelete(null);
            toast.success(t("deleted"));
          }}
        />
      )}
    </section>
  );
}
