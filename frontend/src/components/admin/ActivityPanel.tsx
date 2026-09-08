import { useI18n } from "@/lib/i18n";
import { useAuditLog } from "@/lib/api";
import type { AuditRow } from "@/integrations/supabase/types";

function describe(entry: AuditRow, lang: "en" | "ar"): string {
  const d = (entry.detail ?? {}) as Record<string, unknown>;
  const pair = (key: string): [unknown, unknown] | null =>
    Array.isArray(d[key]) ? (d[key] as [unknown, unknown]) : null;

  switch (entry.action) {
    case "booking.created":
      return lang === "en"
        ? `New request ${entry.entity_id} — chalet ${d.chalet}, ${d.start} → ${d.end}`
        : `طلب جديد ${entry.entity_id} — شاليه ${d.chalet}، ${d.start} → ${d.end}`;
    case "booking.status":
      return lang === "en"
        ? `${entry.entity_id}: status ${d.from} → ${d.to}`
        : `${entry.entity_id}: الحالة ${d.from} → ${d.to}`;
    case "booking.deleted":
      return lang === "en" ? `Deleted ${entry.entity_id}` : `تم حذف ${entry.entity_id}`;
    case "booking.edited": {
      const fields = Object.keys(d);
      return lang === "en"
        ? `${entry.entity_id}: edited ${fields.join(", ")}`
        : `${entry.entity_id}: تعديل ${fields.join("، ")}`;
    }
    case "settings.updated":
      return lang === "en"
        ? `Site settings "${entry.entity_id}" updated`
        : `تحديث إعدادات "${entry.entity_id}"`;
    case "chalet.updated": {
      const active = pair("active");
      if (active) {
        return active[1]
          ? lang === "en"
            ? `Chalet ${entry.entity_id} turned on`
            : `تفعيل الشاليه ${entry.entity_id}`
          : lang === "en"
            ? `Chalet ${entry.entity_id} turned off`
            : `إيقاف الشاليه ${entry.entity_id}`;
      }
      return lang === "en"
        ? `Chalet ${entry.entity_id} updated`
        : `تحديث الشاليه ${entry.entity_id}`;
    }
    default:
      return `${entry.action} — ${entry.entity_id ?? ""}`;
  }
}

export function ActivityPanel() {
  const { tr, lang } = useI18n();
  const { data: entries, isLoading, error } = useAuditLog(true);

  return (
    <section>
      <h2 className="mb-2 font-display text-3xl">{tr("activityLog")}</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        {lang === "en"
          ? "The last 200 admin actions — booking decisions and edits, settings and chalet changes."
          : "آخر ٢٠٠ إجراء إداري — قرارات وتعديلات الحجوزات، وتغييرات الإعدادات والشاليهات."}
      </p>

      {error && (
        <p className="mb-4 border border-destructive p-4 text-sm text-destructive">
          {(error as Error).message}
        </p>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">…</p>}
      {!isLoading && (entries ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">{tr("noActivity")}</p>
      )}

      <ul className="divide-y divide-border border-y border-border">
        {(entries ?? []).map((entry) => (
          <li key={entry.id} className="flex items-start justify-between gap-4 py-3 text-sm">
            <span>{describe(entry, lang)}</span>
            <span className="shrink-0 text-xs text-muted-foreground" dir="ltr">
              {new Date(entry.created_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
