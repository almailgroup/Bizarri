import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useChalets, useUpdateChalet } from "@/lib/api";
import type { ChaletRow } from "@/integrations/supabase/types";
import { useAdminT } from "./strings";
import { errorText, useToast } from "./toast";
import { Btn, Card, Field, PanelHeader, inputClass } from "./ui";

export function ChaletsPanel() {
  const { tr, lang } = useI18n();
  const { data: chalets } = useChalets();

  return (
    <section>
      <PanelHeader
        title={tr("chaletsMgmt")}
        description={
          lang === "en"
            ? "Turning a chalet off hides it from the booking page immediately — existing requests for it are untouched."
            : "إيقاف شاليه يخفيه فوراً عن صفحة الحجز — الطلبات الحالية له تبقى كما هي."
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {(chalets ?? []).map((c) => (
          <ChaletCard key={c.id} chalet={c} />
        ))}
      </div>
    </section>
  );
}

function ChaletCard({ chalet }: { chalet: ChaletRow }) {
  const { tr } = useI18n();
  const t = useAdminT();
  const toast = useToast();
  const update = useUpdateChalet();
  const [nameEn, setNameEn] = useState(chalet.name_en);
  const [nameAr, setNameAr] = useState(chalet.name_ar);

  useEffect(() => {
    setNameEn(chalet.name_en);
    setNameAr(chalet.name_ar);
  }, [chalet.name_en, chalet.name_ar]);

  const dirty = nameEn !== chalet.name_en || nameAr !== chalet.name_ar;
  const feedback = {
    onSuccess: () => toast.success(t("saved")),
    onError: (err: unknown) => toast.error(errorText(err)),
  };

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          Chalet {chalet.id} · {chalet.slug}
        </p>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            role="switch"
            checked={chalet.active}
            disabled={update.isPending}
            onChange={(e) =>
              update.mutate({ id: chalet.id, patch: { active: e.target.checked } }, feedback)
            }
            className="admin-switch"
          />
          <span>{tr("chaletActive")}</span>
        </label>
      </div>

      {!chalet.active && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {tr("chaletInactive")}
        </p>
      )}

      <div className="space-y-4">
        <Field label={tr("displayNameEn")}>
          {(a) => (
            <input
              {...a}
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className={inputClass}
            />
          )}
        </Field>
        <Field label={tr("displayNameAr")}>
          {(a) => (
            <input
              {...a}
              dir="rtl"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className={inputClass}
            />
          )}
        </Field>
      </div>

      <Btn
        variant="primary"
        className="mt-5"
        disabled={!dirty}
        busy={update.isPending && !!update.variables?.patch.name_en}
        onClick={() =>
          update.mutate(
            { id: chalet.id, patch: { name_en: nameEn.trim(), name_ar: nameAr.trim() } },
            feedback,
          )
        }
      >
        {tr("save")}
      </Btn>
    </Card>
  );
}
