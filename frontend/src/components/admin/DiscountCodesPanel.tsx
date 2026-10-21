import { useMemo, useState } from "react";
import { Copy, Pencil, Plus, Shuffle, TicketPercent, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { dateLocale } from "@/lib/locale";
import {
  useBookings,
  useDeleteDiscountCode,
  useDiscountCodes,
  useSaveDiscountCode,
} from "@/lib/api";
import { fmtDate, formatMoney, parseDate } from "@/lib/booking";
import type { DiscountCodeRow } from "@/integrations/supabase/types";
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

/** No 0/O or 1/I: a code read out over the phone should not be misheard. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * Discount codes: what each takes off, how often it may be used, until when,
 * and how often it has been. A use is a booking holding the code that is
 * pending or accepted -- the same count the database makes -- so one turned
 * down gives its use back.
 */
export function DiscountCodesPanel() {
  const { tr, lang } = useI18n();
  const t = useAdminT();
  const toast = useToast();
  const { data: codes, isLoading, error, refetch } = useDiscountCodes(true);
  const { data: bookings } = useBookings(true);
  const save = useSaveDiscountCode();
  const remove = useDeleteDiscountCode();
  const [editing, setEditing] = useState<DiscountCodeRow | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DiscountCodeRow | null>(null);
  const today = fmtDate(new Date());

  const uses = useMemo(() => {
    const n = new Map<string, number>();
    for (const b of bookings ?? []) {
      if (!b.discount_code_id || (b.status !== "pending" && b.status !== "accepted")) continue;
      n.set(b.discount_code_id, (n.get(b.discount_code_id) ?? 0) + 1);
    }
    return n;
  }, [bookings]);

  const what = (c: DiscountCodeRow) =>
    c.kind === "percent"
      ? t("percentOffShort", { n: Number(c.value) })
      : t("amountOffShort", { amount: formatMoney(Number(c.value), lang) });
  const longDate = (iso: string) =>
    parseDate(iso).toLocaleDateString(dateLocale(lang), {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t("copied", { code }));
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <section>
      <PanelHeader
        title={t("discountCodes")}
        description={t("discountsHint")}
        actions={
          <Btn
            variant="primary"
            onClick={() => setEditing("new")}
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            {t("newCode")}
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
      ) : (codes ?? []).length === 0 ? (
        <EmptyState icon={<TicketPercent className="h-6 w-6" />}>{t("noCodes")}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {(codes ?? []).map((c) => {
            const n = uses.get(c.id) ?? 0;
            const usedUp = c.max_uses !== null && n >= c.max_uses;
            const expired = !!c.expires_on && c.expires_on < today;
            return (
              <Card
                as="li"
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-4 p-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-lg font-semibold tracking-wide" dir="ltr">
                      {c.code}
                    </p>
                    <IconBtn label={t("copyCode", { code: c.code })} onClick={() => copy(c.code)}>
                      <Copy className="h-4 w-4" />
                    </IconBtn>
                    {!c.active && <Tag>{t("offerOff")}</Tag>}
                    {usedUp && <Tag>{t("usedUp")}</Tag>}
                    {expired && <Tag>{t("codeExpired")}</Tag>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground" data-testid="code-summary">
                    <span className="font-medium text-foreground">{what(c)}</span> ·{" "}
                    {c.max_uses === null
                      ? t("usesNoLimit", { n })
                      : t("usesOf", { n, max: c.max_uses })}
                    {c.expires_on && <> · {t("codeUntil", { date: longDate(c.expires_on) })}</>}
                  </p>
                  {c.note && <p className="mt-1 text-sm text-muted-foreground">{c.note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={c.active}
                      disabled={save.isPending}
                      onChange={() =>
                        save.mutate(
                          { ...c, active: !c.active },
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
                  <IconBtn label={`${t("edit")} ${c.code}`} onClick={() => setEditing(c)}>
                    <Pencil className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn
                    tone="danger"
                    label={`${t("delete")} ${c.code}`}
                    onClick={() => setPendingDelete(c)}
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
        <DiscountCodeModal
          code={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {pendingDelete && (
        <DeleteConfirm
          title={t("deleteCodeTitle")}
          body={t("deleteCodeBody")}
          label={pendingDelete.code}
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

type Uses = "once" | "limited" | "unlimited";

/** Making or changing a code: everything about it. */
function DiscountCodeModal({ code, onClose }: { code?: DiscountCodeRow; onClose: () => void }) {
  const { tr } = useI18n();
  const t = useAdminT();
  const toast = useToast();
  const save = useSaveDiscountCode();
  const [form, setForm] = useState(() => ({
    code: code?.code ?? generateCode(),
    kind: (code?.kind ?? "percent") as "percent" | "amount",
    value: code ? String(Number(code.value)) : "",
    uses: (code
      ? code.max_uses === null
        ? "unlimited"
        : code.max_uses === 1
          ? "once"
          : "limited"
      : "once") as Uses,
    maxUses: code?.max_uses && code.max_uses > 1 ? String(code.max_uses) : "10",
    expiresOn: code?.expires_on ?? "",
    note: code?.note ?? "",
    active: code?.active ?? true,
  }));

  const normalised = form.code.trim().toUpperCase();
  const codeOk = /^[A-Z0-9_-]{3,32}$/.test(normalised);
  const value = Number(form.value);
  const valueOk =
    form.value.trim() !== "" &&
    Number.isFinite(value) &&
    value >= 0 &&
    (form.kind === "amount" || value <= 100);
  const max = Number(form.maxUses);
  const usesOk = form.uses !== "limited" || (Number.isInteger(max) && max >= 1);
  const valid = codeOk && valueOk && usesOk;

  // The database's own refusals, in words: a code that already exists is the
  // one an admin will meet.
  const explain = (err: unknown) => {
    const text = errorText(err);
    if (/discount_codes_code_key|duplicate key/.test(text)) return t("errCodeTaken");
    if (/discount_codes_code_format/.test(text)) return t("errCodeFormat");
    return text;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    save.mutate(
      {
        id: code?.id,
        code: normalised,
        kind: form.kind,
        value,
        max_uses: form.uses === "unlimited" ? null : form.uses === "once" ? 1 : max,
        expires_on: form.expiresOn || null,
        note: form.note,
        active: form.active,
      },
      {
        onSuccess: () => {
          toast.success(t("codeSaved"));
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      title={code ? t("editCode") : t("newCode")}
      onClose={onClose}
      busy={save.isPending}
      footer={
        <>
          <Btn onClick={onClose} disabled={save.isPending}>
            {tr("cancel")}
          </Btn>
          <Btn
            type="submit"
            form="discount-code-form"
            variant="primary"
            busy={save.isPending}
            disabled={!valid}
          >
            {save.isPending ? t("saving") : code ? tr("saveChanges") : t("createCode")}
          </Btn>
        </>
      }
    >
      <form id="discount-code-form" onSubmit={submit} className="space-y-5">
        {save.error && <ErrorNote>{explain(save.error)}</ErrorNote>}

        <Field
          label={t("codeLabel")}
          hint={t("codeHint")}
          error={form.code.trim() && !codeOk ? t("errCodeFormat") : undefined}
        >
          {(a) => (
            <div className="flex gap-2">
              <input
                {...a}
                dir="ltr"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                autoComplete="off"
                spellCheck={false}
                maxLength={32}
                className={`${inputClass} min-w-0 flex-1 font-mono uppercase tracking-wide`}
              />
              <Btn
                onClick={() => setForm({ ...form, code: generateCode() })}
                icon={<Shuffle className="h-4 w-4" aria-hidden="true" />}
                className="shrink-0"
              >
                {t("generateCode")}
              </Btn>
            </div>
          )}
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium">{t("discountKind")}</p>
          <Segmented
            label={t("discountKind")}
            value={form.kind}
            onChange={(v) => setForm({ ...form, kind: v })}
            options={[
              { value: "percent", label: t("kindPercent") },
              { value: "amount", label: t("kindAmount") },
            ]}
          />
        </div>
        <Field
          label={form.kind === "percent" ? t("percentValue") : t("amountValue")}
          hint={form.kind === "percent" ? t("percentZeroHint") : undefined}
          error={
            form.value.trim() !== "" && !valueOk
              ? form.kind === "percent"
                ? t("errPercent")
                : t("invalidPrice")
              : undefined
          }
        >
          {(a) => (
            <input
              {...a}
              type="number"
              min={0}
              max={form.kind === "percent" ? 100 : undefined}
              step={form.kind === "percent" ? "0.5" : "0.001"}
              inputMode="decimal"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              className={inputClass}
            />
          )}
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium">{t("usesLabel")}</p>
          <Segmented
            label={t("usesLabel")}
            value={form.uses}
            onChange={(v) => setForm({ ...form, uses: v })}
            options={[
              { value: "once", label: t("usesOnce") },
              { value: "limited", label: t("usesLimited") },
              { value: "unlimited", label: t("usesUnlimited") },
            ]}
          />
        </div>
        {form.uses === "limited" && (
          <Field label={t("maxUses")} error={!usesOk ? t("errUses") : undefined}>
            {(a) => (
              <input
                {...a}
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("expiresOn")} hint={t("expiresHint")}>
            {(a) => (
              <input
                {...a}
                type="date"
                value={form.expiresOn}
                onChange={(e) => setForm({ ...form, expiresOn: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
          <Field label={t("codeNote")}>
            {(a) => (
              <input
                {...a}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
        </div>

        {code && (
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
