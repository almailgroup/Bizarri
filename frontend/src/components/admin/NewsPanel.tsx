import { useState } from "react";
import { Eye, EyeOff, Newspaper, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { dateLocale } from "@/lib/locale";
import { useAllNews, useDeleteNews, useSaveNews } from "@/lib/api";
import type { NewsRow } from "@/integrations/supabase/types";
import { DeleteConfirm } from "./DeleteConfirm";
import { useAdminT } from "./strings";
import { errorText, useToast } from "./toast";
import { Btn, Card, EmptyState, IconBtn, PanelHeader, SkeletonList, Tag, inputClass } from "./ui";

const BLANK = { title_en: "", title_ar: "", body_en: "", body_ar: "" };

export function NewsPanel() {
  const { tr, lang } = useI18n();
  const t = useAdminT();
  const toast = useToast();
  const { data: items, isLoading } = useAllNews(true);
  const save = useSaveNews();
  const remove = useDeleteNews();
  const [form, setForm] = useState(BLANK);
  const [pendingDelete, setPendingDelete] = useState<NewsRow | null>(null);
  const en = lang === "en";

  const publish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title_en.trim() && !form.title_ar.trim()) return;
    save.mutate(
      { ...form, published: true },
      {
        onSuccess: () => {
          setForm(BLANK);
          toast.success(en ? "News published" : "تم نشر الخبر");
        },
        onError: (err) => toast.error(errorText(err)),
      },
    );
  };

  return (
    <section>
      <PanelHeader
        title={en ? "News" : "الأخبار"}
        description={
          en
            ? "Posts appear on the News page in both languages."
            : "تظهر الأخبار في صفحة الأخبار باللغتين."
        }
      />

      <Card className="mb-6 p-5 sm:p-6">
        <form onSubmit={publish} className="grid gap-4 md:grid-cols-2">
          <input
            placeholder="Title (English)"
            aria-label="Title (English)"
            value={form.title_en}
            onChange={(e) => setForm({ ...form, title_en: e.target.value })}
            className={inputClass}
          />
          <input
            placeholder="العنوان (عربي)"
            aria-label="العنوان (عربي)"
            dir="rtl"
            value={form.title_ar}
            onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
            className={inputClass}
          />
          <textarea
            placeholder="Body (English)"
            aria-label="Body (English)"
            rows={3}
            value={form.body_en}
            onChange={(e) => setForm({ ...form, body_en: e.target.value })}
            className={inputClass}
          />
          <textarea
            placeholder="المحتوى (عربي)"
            aria-label="المحتوى (عربي)"
            dir="rtl"
            rows={3}
            value={form.body_ar}
            onChange={(e) => setForm({ ...form, body_ar: e.target.value })}
            className={inputClass}
          />
          <div className="md:col-span-2">
            <Btn
              type="submit"
              variant="primary"
              busy={save.isPending}
              disabled={!form.title_en.trim() && !form.title_ar.trim()}
              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              {en ? "Publish News" : "نشر الخبر"}
            </Btn>
          </div>
        </form>
      </Card>

      {isLoading ? (
        <SkeletonList rows={2} />
      ) : (items ?? []).length === 0 ? (
        <EmptyState icon={<Newspaper className="h-6 w-6" />}>{tr("noNews")}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {(items ?? []).map((n) => (
            <Card
              as="li"
              key={n.id}
              className="flex flex-wrap items-center justify-between gap-4 p-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Tag>{n.published ? (en ? "Published" : "منشور") : en ? "Draft" : "مسودة"}</Tag>
                  <span>
                    {new Date(n.published_at ?? n.created_at).toLocaleDateString(dateLocale(lang))}
                  </span>
                </div>
                <p className="mt-2 text-lg font-semibold">{n.title_en || n.title_ar}</p>
              </div>
              <div className="flex items-center gap-1">
                <Btn
                  size="sm"
                  onClick={() =>
                    save.mutate(
                      { ...n, published: !n.published },
                      {
                        onSuccess: () => toast.success(t("saved")),
                        onError: (err) => toast.error(errorText(err)),
                      },
                    )
                  }
                  icon={
                    n.published ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )
                  }
                >
                  {n.published ? (en ? "Unpublish" : "إلغاء النشر") : en ? "Publish" : "نشر"}
                </Btn>
                <IconBtn
                  tone="danger"
                  label={en ? "Delete news item" : "حذف الخبر"}
                  onClick={() => setPendingDelete(n)}
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
          title={t("deleteNewsTitle")}
          label={pendingDelete.title_en || pendingDelete.title_ar}
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
