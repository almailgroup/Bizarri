import { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_RATES, type Rates } from "@/lib/booking";
import { useRates, useSaveRates } from "@/lib/api";
import { useAdminT } from "./strings";
import { errorText, useToast } from "./toast";
import { Btn, Card, PanelHeader, cx, inputClass } from "./ui";

export function RatesPanel() {
  const { tr, lang } = useI18n();
  const t = useAdminT();
  const toast = useToast();
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

  const fields: { key: keyof Rates; label: string; hint: string; muted?: boolean }[] = [
    {
      key: "fullWeek",
      label: tr("fullWeekPkg"),
      // Unreachable since the booking page stopped offering a free-form
      // range: every stay it can produce is one day, Sun-Wed or Thu-Sat, and
      // none of those is a week. quote_stay() still prices an exact Sun-Sat
      // at this rate, so an admin entering a stay by hand gets it.
      hint: lang === "en" ? "Not offered on the site" : "غير معروضة على الموقع",
      muted: true,
    },
    {
      key: "weekday",
      label: tr("weekdayPkg"),
      hint: lang === "en" ? "Sun – Wed · 4 days" : "الأحد – الأربعاء · 4 أيام",
    },
    {
      key: "weekend",
      label: tr("weekendPkg"),
      // Not "if it matches exactly" any more: a weekend cannot be booked in
      // pieces, so this is what every Thu-Sat costs, alone or inside a longer
      // stay. It is the only price a guest can reach for those three days.
      hint: lang === "en" ? "Thu – Sat · always, as one" : "الخميس – السبت · دائماً، ككتلة واحدة",
    },
    {
      key: "dailyWeekday",
      label: tr("weekdayNight"),
      hint: lang === "en" ? "Any single Sun – Wed" : "أي يوم من الأحد إلى الأربعاء",
    },
    {
      key: "dailyWeekend",
      label: tr("weekendNight"),
      // Kept rather than hidden: nothing a guest can book reaches it, since a
      // weekend day only ever appears inside a whole Thu-Sat, but a custom
      // day price can still break a block back to daily rates, and it is what
      // a loose weekend night would cost if the rule were ever relaxed.
      hint: lang === "en" ? "Not used — see above" : "غير مستخدم — انظر أعلاه",
      muted: true,
    },
  ];

  const persist = (value: Rates) =>
    save.mutate(value, {
      onSuccess: () => toast.success(t("saved")),
      onError: (err) => toast.error(errorText(err)),
    });

  return (
    <section>
      <PanelHeader
        title={tr("packageRates")}
        description={
          lang === "en"
            ? "Applied when a stay matches a package exactly. Other stays use the per-day fallback rates; a custom daily price always wins."
            : "تُطبَّق عندما تطابق الإقامة باقة تماماً. الإقامات الأخرى تستخدم الأسعار اليومية الاحتياطية؛ السعر المخصص له الأولوية دائماً."
        }
      />

      {/* The rule the panel cannot show by laying out five equal boxes: the
          weekend is not a package a stay may or may not match, it is the only
          way those three days are sold. */}
      <p className="mb-6 rounded-md border-s-4 border-foreground/20 bg-background px-4 py-3 text-sm text-muted-foreground shadow-xs">
        {lang === "en"
          ? "Sun – Wed is sold by the day, and one day is a booking. Thu – Sat is not: it is one three-day stay at the weekend rate, whether it is taken alone or on the end of a longer one, and a guest cannot book part of it. That is why the daily weekend rate no longer prices anything — only a custom day price can break a weekend back into separate days."
          : "تُباع أيام الأحد إلى الأربعاء باليوم، ويوم واحد يُعدّ حجزاً. أما الخميس إلى السبت فلا: هي إقامة واحدة من ثلاثة أيام بسعر نهاية الأسبوع، سواء حُجزت وحدها أو ضمن إقامة أطول، ولا يمكن للضيف حجز جزء منها. لذلك لم يعد السعر اليومي لنهاية الأسبوع يُسعّر شيئاً — ولا يكسر نهاية الأسبوع إلى أيام منفصلة إلا سعر يومي مخصص."}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {fields.map((f) => (
          <Card key={f.key} className={cx("p-5", f.muted && "opacity-60")}>
            {/* The unused one stays editable — it is still the fallback a
                custom day price falls back to — but it should not read as one
                of the four numbers that price a stay today. */}
            <label className="block">
              <span className="block text-sm font-medium">{f.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{f.hint}</span>
              <div className="relative mt-3">
                <input
                  type="number"
                  min={0}
                  value={rates[f.key]}
                  onChange={(e) => setDraft({ ...rates, [f.key]: Number(e.target.value) })}
                  className={cx(inputClass, "pe-12 text-lg font-semibold tabular-nums")}
                />
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {lang === "en" ? "KD" : "د.ك"}
                </span>
              </div>
            </label>
          </Card>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Btn
          variant="primary"
          onClick={() => persist(rates)}
          busy={save.isPending}
          icon={<Save className="h-4 w-4" aria-hidden="true" />}
        >
          {tr("save")}
        </Btn>
        <Btn
          onClick={() => {
            setDraft(DEFAULT_RATES);
            persist(DEFAULT_RATES);
          }}
          disabled={save.isPending}
          icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
        >
          {tr("reset")}
        </Btn>
      </div>
    </section>
  );
}
