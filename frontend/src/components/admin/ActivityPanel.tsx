import {
  CalendarPlus,
  CheckCircle2,
  History,
  Home,
  Pencil,
  Settings as SettingsIcon,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { dateLocale } from "@/lib/locale";
import { useAuditLog } from "@/lib/api";
import type { AuditRow } from "@/integrations/supabase/types";
import { errorText } from "./toast";
import { Card, EmptyState, ErrorNote, PanelHeader, SkeletonList } from "./ui";

function describe(entry: AuditRow, lang: "en" | "ar"): string {
  const d = (entry.detail ?? {}) as Record<string, unknown>;
  const pair = (key: string): [unknown, unknown] | null =>
    Array.isArray(d[key]) ? (d[key] as [unknown, unknown]) : null;

  switch (entry.action) {
    case "booking.created":
      // A guest's request has no actor; one entered from the dashboard does.
      return entry.actor
        ? lang === "en"
          ? `Booking ${entry.entity_id} added — chalet ${d.chalet}, ${d.start} → ${d.end}`
          : `إضافة الحجز ${entry.entity_id} — شاليه ${d.chalet}، ${d.start} → ${d.end}`
        : lang === "en"
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

const ICON: Record<string, LucideIcon> = {
  "booking.created": CalendarPlus,
  "booking.status": CheckCircle2,
  "booking.deleted": Trash2,
  "booking.edited": Pencil,
  "settings.updated": SettingsIcon,
  "chalet.updated": Home,
};

export function ActivityPanel() {
  const { tr, lang } = useI18n();
  const { data: entries, isLoading, error, refetch } = useAuditLog(true);

  return (
    <section>
      <PanelHeader
        title={tr("activityLog")}
        description={
          lang === "en"
            ? "The last 200 admin actions — booking decisions and edits, settings and chalet changes."
            : "آخر 200 إجراء إداري — قرارات وتعديلات الحجوزات، وتغييرات الإعدادات والشاليهات."
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNote onRetry={() => refetch()}>{errorText(error)}</ErrorNote>
        </div>
      )}

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : (entries ?? []).length === 0 ? (
        <EmptyState icon={<History className="h-6 w-6" />}>{tr("noActivity")}</EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {(entries ?? []).map((entry) => {
              const Icon = ICON[entry.action] ?? History;
              return (
                <li key={entry.id} className="flex items-start gap-3 px-4 py-3 text-sm sm:px-5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words">{describe(entry, lang)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {entry.actor_email && <span dir="ltr">{entry.actor_email} · </span>}
                      <span dir="ltr">
                        {new Date(entry.created_at).toLocaleString(dateLocale(lang))}
                      </span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </section>
  );
}
