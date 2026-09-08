import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Requires the word "Delete" to be typed, so a stray click cannot destroy a record. */
export function DeleteConfirm({
  label,
  onCancel,
  onConfirm,
}: {
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { tr } = useI18n();
  const [text, setText] = useState("");
  const ready = text.trim().toLowerCase() === "delete";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={tr("deleteConfirmTitle")}
    >
      <div className="animate-scale-in w-full max-w-md border border-border bg-background p-8">
        <h3 className="font-display text-2xl">{tr("deleteConfirmTitle")}</h3>
        <p className="mt-2 font-mono text-xs text-muted-foreground" dir="ltr">
          {label}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">{tr("deleteConfirmBody")}</p>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          dir="ltr"
          placeholder="Delete"
          className="mt-4 w-full border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
        />
        <div className="mt-6 flex gap-3">
          <button
            onClick={onConfirm}
            disabled={!ready}
            className="flex-1 bg-destructive py-3 text-sm uppercase tracking-widest text-destructive-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Trash2 className="h-4 w-4" /> {tr("deleteRequest")}
            </span>
          </button>
          <button
            onClick={onCancel}
            className="border border-border px-6 py-3 text-sm uppercase tracking-widest hover:bg-secondary"
          >
            {tr("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
