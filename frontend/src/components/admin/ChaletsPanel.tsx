import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useChalets, useUpdateChalet } from "@/lib/api";
import type { ChaletRow } from "@/integrations/supabase/types";

export function ChaletsPanel() {
  const { tr, lang } = useI18n();
  const { data: chalets } = useChalets();

  return (
    <section>
      <h2 className="mb-2 font-display text-3xl">{tr("chaletsMgmt")}</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        {lang === "en"
          ? "Turning a chalet off hides it from the booking page immediately — existing requests for it are untouched."
          : "إيقاف شاليه يخفيه فوراً عن صفحة الحجز — الطلبات الحالية له تبقى كما هي."}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {(chalets ?? []).map((c) => (
          <ChaletCard key={c.id} chalet={c} />
        ))}
      </div>
    </section>
  );
}

function ChaletCard({ chalet }: { chalet: ChaletRow }) {
  const { tr } = useI18n();
  const update = useUpdateChalet();
  const [nameEn, setNameEn] = useState(chalet.name_en);
  const [nameAr, setNameAr] = useState(chalet.name_ar);

  useEffect(() => {
    setNameEn(chalet.name_en);
    setNameAr(chalet.name_ar);
  }, [chalet.name_en, chalet.name_ar]);

  const dirty = nameEn !== chalet.name_en || nameAr !== chalet.name_ar;

  return (
    <div className="border border-border p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Chalet {chalet.id} · {chalet.slug}
        </p>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={chalet.active}
            disabled={update.isPending}
            onChange={(e) => update.mutate({ id: chalet.id, patch: { active: e.target.checked } })}
            className="h-4 w-4 disabled:opacity-50"
          />
          <span className="text-xs uppercase tracking-widest">{tr("chaletActive")}</span>
        </label>
      </div>

      {!chalet.active && (
        <p className="mb-4 border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          {tr("chaletInactive")}
        </p>
      )}

      <label className="block">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          {tr("displayNameEn")}
        </span>
        <input
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          className="mt-1 w-full border border-border bg-secondary px-3 py-2 outline-none focus:border-foreground"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          {tr("displayNameAr")}
        </span>
        <input
          dir="rtl"
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          className="mt-1 w-full border border-border bg-secondary px-3 py-2 outline-none focus:border-foreground"
        />
      </label>

      <button
        disabled={!dirty || update.isPending}
        onClick={() =>
          update.mutate({
            id: chalet.id,
            patch: { name_en: nameEn.trim(), name_ar: nameAr.trim() },
          })
        }
        className="mt-4 bg-black px-6 py-2.5 text-xs uppercase tracking-widest text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
      >
        {tr("save")}
      </button>
    </div>
  );
}
