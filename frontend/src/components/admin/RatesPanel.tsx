import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_RATES, type Rates } from "@/lib/booking";
import { useRates, useSaveRates } from "@/lib/api";

export function RatesPanel() {
  const { tr, lang } = useI18n();
  const { data: stored } = useRates();
  const save = useSaveRates();
  const [draft, setDraft] = useState<Rates | null>(null);

  useEffect(() => {
    if (stored) {
      setDraft({
        fullWeek: stored.fullWeek,
        weekend: stored.weekend,
        weekday: stored.weekday,
        dailyWeekday: stored.dailyWeekday,
        dailyWeekend: stored.dailyWeekend,
      });
    }
  }, [stored]);

  const rates = draft ?? DEFAULT_RATES;

  const fields: { key: keyof Rates; label: string; hint: string }[] = [
    {
      key: "fullWeek",
      label: tr("fullWeekPkg"),
      hint: lang === "en" ? "Sun – Sat · 7 days" : "الأحد – السبت · ٧ أيام",
    },
    {
      key: "weekday",
      label: tr("weekdayPkg"),
      hint: lang === "en" ? "Sun – Wed · 4 days" : "الأحد – الأربعاء · ٤ أيام",
    },
    {
      key: "weekend",
      label: tr("weekendPkg"),
      hint: lang === "en" ? "Thu – Sat · 3 days" : "الخميس – السبت · ٣ أيام",
    },
    {
      key: "dailyWeekday",
      label: tr("weekdayNight"),
      hint: lang === "en" ? "Fallback rate" : "السعر الاحتياطي",
    },
    {
      key: "dailyWeekend",
      label: tr("weekendNight"),
      hint: lang === "en" ? "Fallback rate" : "السعر الاحتياطي",
    },
  ];

  return (
    <section>
      <h2 className="mb-2 font-display text-3xl">{tr("packageRates")}</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        {lang === "en"
          ? "Applied when a stay matches a package exactly. Other stays use the per-day fallback rates; a custom daily price always wins."
          : "تُطبَّق عندما تطابق الإقامة باقة تماماً. الإقامات الأخرى تستخدم الأسعار اليومية الاحتياطية؛ السعر المخصص له الأولوية دائماً."}
      </p>

      {save.error && (
        <p className="mb-4 border border-destructive p-4 text-sm text-destructive">
          {(save.error as Error).message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {fields.map((f) => (
          <label key={f.key} className="block border border-border p-5">
            <span className="block text-xs uppercase tracking-widest text-muted-foreground">
              {f.label}
            </span>
            <span className="mt-1 block text-[11px] text-muted-foreground/70">{f.hint}</span>
            <input
              type="number"
              min={0}
              value={rates[f.key]}
              onChange={(e) => setDraft({ ...rates, [f.key]: Number(e.target.value) })}
              className="mt-3 w-full border border-border bg-secondary px-3 py-2 font-display text-xl outline-none focus:border-foreground"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={() => save.mutate(rates)}
          disabled={save.isPending}
          className="bg-black px-8 py-3 text-sm uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-50"
        >
          {tr("save")}
        </button>
        <button
          onClick={() => {
            setDraft(DEFAULT_RATES);
            save.mutate(DEFAULT_RATES);
          }}
          disabled={save.isPending}
          className="border border-border px-6 py-3 text-sm uppercase tracking-widest hover:bg-secondary disabled:opacity-50"
        >
          {tr("reset")}
        </button>
        {save.isSuccess && !save.isPending && (
          <span className="text-sm text-muted-foreground">✓</span>
        )}
      </div>
    </section>
  );
}
