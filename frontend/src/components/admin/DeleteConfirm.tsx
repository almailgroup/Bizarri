import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAdminT } from "./strings";
import { Btn, ErrorNote, Modal } from "./ui";
import { errorText } from "./toast";

/**
 * "Are you sure?" with one click to answer.
 *
 * It used to make the admin type the word "Delete" first. That guards against
 * a stray click, but the trash button already opens this dialog, so a stray
 * click only ever got as far as a question -- and typing a word in English
 * was a strange thing to ask of an Arabic dashboard. Now it is Yes or Cancel.
 *
 * onConfirm is awaited: the dialog stays open with a spinner until the delete
 * has actually happened, and shows the reason if it did not, instead of
 * closing on the click and leaving the admin to wonder.
 */
export function DeleteConfirm({
  title,
  body,
  label,
  onCancel,
  onConfirm,
}: {
  title: string;
  body?: string;
  /** What is being deleted, e.g. "BZR-4K2M9X · Aisha". */
  label?: string;
  onCancel: () => void;
  onConfirm: () => Promise<unknown> | void;
}) {
  const t = useAdminT();
  const { tr } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="sm"
      busy={busy}
      footer={
        <>
          {/* Focus starts here, so Enter pressed out of habit cancels. */}
          <Btn onClick={onCancel} disabled={busy} data-autofocus>
            {tr("cancel")}
          </Btn>
          <Btn
            variant="danger"
            onClick={confirm}
            busy={busy}
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
          >
            {busy ? t("deleting") : t("yesDelete")}
          </Btn>
        </>
      }
    >
      {label && (
        <p className="mb-3 rounded-md bg-secondary px-3 py-2 font-mono text-sm" dir="ltr">
          {label}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{body ?? t("deleteGenericBody")}</p>
      {error && (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </Modal>
  );
}
