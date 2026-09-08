import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAllNews, useDeleteNews, useSaveNews } from "@/lib/api";
import type { NewsRow } from "@/integrations/supabase/types";
import { DeleteConfirm } from "./DeleteConfirm";

export function NewsPanel() {
  const { tr, lang } = useI18n();
  const { data: items } = useAllNews(true);
  const save = useSaveNews();
  const remove = useDeleteNews();
  const [form, setForm] = useState({ title_en: "", title_ar: "", body_en: "", body_ar: "" });
  const [pendingDelete, setPendingDelete] = useState<NewsRow | null>(null);

  return (
    <section>
      <h2 className="mb-6 font-display text-3xl">{lang === "en" ? "News" : "الأخبار"}</h2>

      {save.error && (
        <p className="mb-4 border border-destructive p-4 text-sm text-destructive">
          {(save.error as Error).message}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.title_en.trim() && !form.title_ar.trim()) return;
          save.mutate(
            { ...form, published: true },
            { onSuccess: () => setForm({ title_en: "", title_ar: "", body_en: "", body_ar: "" }) },
          );
        }}
        className="mb-6 grid gap-3 border border-border p-5 md:grid-cols-2"
      >
        <input
          placeholder="Title (English)"
          value={form.title_en}
          onChange={(e) => setForm({ ...form, title_en: e.target.value })}
          className="border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
        />
        <input
          placeholder="العنوان (عربي)"
          dir="rtl"
          value={form.title_ar}
          onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
          className="border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
        />
        <textarea
          placeholder="Body (English)"
          rows={3}
          value={form.body_en}
          onChange={(e) => setForm({ ...form, body_en: e.target.value })}
          className="border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
        />
        <textarea
          placeholder="المحتوى (عربي)"
          dir="rtl"
          rows={3}
          value={form.body_ar}
          onChange={(e) => setForm({ ...form, body_ar: e.target.value })}
          className="border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
        />
        <button
          type="submit"
          disabled={save.isPending}
          className="flex items-center justify-center gap-2 bg-black px-6 py-3 text-sm uppercase tracking-widest text-white disabled:opacity-50 md:col-span-2"
        >
          <Plus className="h-4 w-4" /> {lang === "en" ? "Publish News" : "نشر الخبر"}
        </button>
      </form>

      <ul className="space-y-3">
        {(items ?? []).length === 0 && (
          <li className="text-sm text-muted-foreground">{tr("noNews")}</li>
        )}
        {(items ?? []).map((n) => (
          <li
            key={n.id}
            className="flex items-start justify-between gap-4 border border-border p-5"
          >
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {new Date(n.published_at ?? n.created_at).toLocaleDateString()} ·{" "}
                {n.published
                  ? lang === "en"
                    ? "Published"
                    : "منشور"
                  : lang === "en"
                    ? "Draft"
                    : "مسودة"}
              </p>
              <p className="mt-1 font-display text-xl">{n.title_en || n.title_ar}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => save.mutate({ ...n, published: !n.published })}
                className="border border-border px-4 py-2 text-xs uppercase tracking-widest hover:bg-secondary"
              >
                {n.published
                  ? lang === "en"
                    ? "Unpublish"
                    : "إلغاء النشر"
                  : lang === "en"
                    ? "Publish"
                    : "نشر"}
              </button>
              <button
                onClick={() => setPendingDelete(n)}
                aria-label={lang === "en" ? "Delete news item" : "حذف الخبر"}
                className="p-2 text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {pendingDelete && (
        <DeleteConfirm
          label={pendingDelete.title_en || pendingDelete.title_ar}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            remove.mutate(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </section>
  );
}
