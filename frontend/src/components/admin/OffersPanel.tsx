import { useState } from "react";
import { BadgePercent, Pencil, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAllOffers, useChalets, useDeleteOffer, useSaveOffer } from "@/lib/api";
import {
  daysBetween,
  fmtDate,
  formatMoney,
  formatSpan,
  parseDate,
  weekendIsWhole,
} from "@/lib/booking";
import type { OfferRow } from "@/integrations/supabase/types";
import { DeleteConfirm } from "./DeleteConfirm";
import { useAdminT } from "./strings";
import { errorText, useToast } from "./toast";
import {
  Btn,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  IconBtn,
  Modal,
  PanelHeader,
  Segmented,
  SkeletonList,
  Tag,
  inputClass,
} from "./ui";

/** What the calendar hands over when its selection becomes an offer. */
export type OfferPrefill = { chaletId?: number | null; start?: string; end?: string };

/**
 * Offers: dates the owner sells at one price for the whole stay, listed on
 * the Offers page. Separate from Special Occasions, which are the premium
 * windows (Eid and the like) booked under their own option on the booking
 * page.
 */
export function OffersPanel() {
  const { tr, lang } = useI18n();
  const t = useAdminT();
  const toast = useToast();
  const { data: items, isLoading, error, refetch } = useAllOffers(true);
  const { data: chalets } = useChalets();
  const save = useSaveOffer();
  const remove = useDeleteOffer();
  const [editing, setEditing] = useState<OfferRow | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OfferRow | null>(null);
  const today = fmtDate(new Date());

  const title = (o: OfferRow) =>
    (lang === "en" ? o.title_en : o.title_ar || o.title_en) || t("untitledOffer");
  const chaletName = (id: number | null) => {
    if (id === null) return t("bothChalets");
    const c = (chalets ?? []).find((x) => x.id === id);
    return c ? (lang === "en" ? c.name_en : c.name_ar) : `#${id}`;
  };

  return (
    <section>
      <PanelHeader
        title={t("offers")}
        description={t("offersHint")}
        actions={
          <Btn
            variant="primary"
            onClick={() => setEditing("new")}
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            {t("newOffer")}
          </Btn>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNote onRetry={() => refetch()}>{errorText(error)}</ErrorNote>
        </div>
      )}

      {isLoading ? (
        <SkeletonList rows={2} />
      ) : (items ?? []).length === 0 ? (
        <EmptyState icon={<BadgePercent className="h-6 w-6" />}>{t("noOffers")}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {(items ?? []).map((o) => {
            const from = parseDate(o.start_date);
            const to = parseDate(o.end_date);
            const n = daysBetween(from, to);
            return (
              <Card
                as="li"
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-4 p-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold">{title(o)}</p>
                    {!o.active && <Tag>{t("offerOff")}</Tag>}
                    {o.end_date < today && <Tag>{t("offerEnded")}</Tag>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatSpan(from, to, lang)} · {n === 1 ? t("oneDay") : t("days", { n })} ·{" "}
                    {chaletName(o.chalet_id)} ·{" "}
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
                            onError: (err) => toast.error(errorText(err)),
                          },
                        )
                      }
                      className="admin-switch"
                    />
                    {tr("activeLabel")}
                  </label>
                  <IconBtn label={`${t("edit")} ${title(o)}`} onClick={() => setEditing(o)}>
                    <Pencil className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn
                    tone="danger"
                    label={`${t("delete")} ${title(o)}`}
                    onClick={() => setPendingDelete(o)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </div>
              </Card>
            );
          })}
        </ul>
      )}

      {editing && (
        <OfferModal
          offer={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {pendingDelete && (
        <DeleteConfirm
          title={t("deleteOfferTitle")}
          label={`${title(pendingDelete)} · ${formatSpan(
            parseDate(pendingDelete.start_date),
            parseDate(pendingDelete.end_date),
            lang,
          )}`}
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

/**
 * Making or changing an offer: its dates, the chalet (or both), the price for
 * the whole stay, and an optional title in each language. Opened from the
 * Offers tab, and from the calendar with its selection filled in.
 */
export function OfferModal({
  offer,
  prefill,
  onClose,
}: {
  offer?: OfferRow;
  prefill?: OfferPrefill;
  onClose: () => void;
}) {
  const { tr, lang } = useI18n();
  const t = useAdminT();
  const toast = useToast();
  const { data: chalets } = useChalets();
  const save = useSaveOffer();
  const [form, setForm] = useState({
    title_en: offer?.title_en ?? "",
    title_ar: offer?.title_ar ?? "",
    chalet: (offer ? offer.chalet_id : (prefill?.chaletId ?? null)) as number | null,
    start_date: offer?.start_date ?? prefill?.start ?? "",
    end_date: offer?.end_date ?? prefill?.end ?? prefill?.start ?? "",
    price: offer ? String(offer.price) : "",
    active: offer?.active ?? true,
  });

  const from = form.start_date ? parseDate(form.start_date) : null;
  const to = form.end_date ? parseDate(form.end_date) : null;
  const n = from && to && to >= from ? daysBetween(from, to) : 0;
  const datesError =
    !from || !to
      ? t("errOfferDates")
      : to < from
        ? t("errOfferOrder")
        : n > 90
          ? t("errTooLong")
          : !weekendIsWhole(from, to)
            ? t("errOfferWeekend")
            : "";
  const priceOk = form.price.trim() !== "" && Number(form.price) >= 0;
  const valid = !datesError && priceOk;

  // The database's own refusals, in words rather than constraint names.
  const explain = (err: unknown) => {
    const text = errorText(err);
    if (/offers_weekend_whole/.test(text)) return t("errOfferWeekend");
    if (/offers_dates_ordered/.test(text)) return t("errOfferOrder");
    if (/offers_at_most_90_days/.test(text)) return t("errTooLong");
    return text;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    save.mutate(
      {
        id: offer?.id,
        title_en: form.title_en,
        title_ar: form.title_ar,
        chalet_id: form.chalet,
        start_date: form.start_date,
        end_date: form.end_date,
        price: Number(form.price),
        active: form.active,
      },
      {
        onSuccess: () => {
          toast.success(t("offerSaved"));
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      title={offer ? t("editOffer") : t("newOffer")}
      onClose={onClose}
      busy={save.isPending}
      footer={
        <>
          <Btn onClick={onClose} disabled={save.isPending}>
            {tr("cancel")}
          </Btn>
          <Btn
            type="submit"
            form="offer-form"
            variant="primary"
            busy={save.isPending}
            disabled={!valid}
          >
            {save.isPending ? t("saving") : offer ? tr("saveChanges") : t("createOffer")}
          </Btn>
        </>
      }
    >
      <form id="offer-form" onSubmit={submit} className="space-y-4">
        {save.error && <ErrorNote>{explain(save.error)}</ErrorNote>}

        {(chalets ?? []).length > 1 && (
          <Segmented
            label={t("chalet")}
            value={form.chalet === null ? "both" : String(form.chalet)}
            onChange={(v) => setForm({ ...form, chalet: v === "both" ? null : Number(v) })}
            options={[
              { value: "both", label: t("bothChalets") },
              ...(chalets ?? []).map((c) => ({
                value: String(c.id),
                label: lang === "en" ? c.name_en : c.name_ar,
              })),
            ]}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("offerFirstDay")}
            error={form.start_date || form.end_date ? datesError || undefined : undefined}
          >
            {(a) => (
              <input
                {...a}
                type="date"
                value={form.start_date}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({
                    ...f,
                    start_date: v,
                    end_date: v && (!f.end_date || f.end_date < v) ? v : f.end_date,
                  }));
                }}
                className={inputClass}
              />
            )}
          </Field>
          <Field label={t("offerLastDay")}>
            {(a) => (
              <input
                {...a}
                type="date"
                min={form.start_date || undefined}
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
        </div>
        {from && to && !datesError && (
          <p className="rounded-md bg-secondary px-3 py-2 text-sm" data-testid="offer-span">
            {formatSpan(from, to, lang)} · {n === 1 ? t("oneDay") : t("days", { n })}
          </p>
        )}

        <Field
          label={`${t("offerPrice")} (KWD)`}
          error={form.price.trim() !== "" && !priceOk ? t("invalidPrice") : undefined}
        >
          {(a) => (
            <input
              {...a}
              type="number"
              min={0}
              step="0.001"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className={inputClass}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("offerTitleEn")} hint={t("offerTitleHint")}>
            {(a) => (
              <input
                {...a}
                value={form.title_en}
                onChange={(e) => setForm({ ...form, title_en: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
          <Field label={t("offerTitleAr")}>
            {(a) => (
              <input
                {...a}
                dir="rtl"
                value={form.title_ar}
                onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
        </div>

        {offer && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              role="switch"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="admin-switch"
            />
            {tr("activeLabel")}
          </label>
        )}
      </form>
    </Modal>
  );
}
