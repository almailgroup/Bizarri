/**
 * Short confirmations and failures for dashboard actions.
 *
 * Before this, each panel said "saved" its own way, or not at all: a blocked
 * day changed colour and that was the whole answer, and a failure was a red
 * paragraph somewhere above the fold. Every action now reports here, in the
 * same corner, in the same words, and a screen reader hears it too.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { useAdminT } from "./strings";
import { cx } from "./ui";

type Tone = "success" | "error";
interface Toast {
  id: number;
  tone: Tone;
  message: string;
}

interface Api {
  success: (message: string) => void;
  error: (message: string) => void;
}

const Ctx = createContext<Api | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (tone: Tone, message: string) => {
      const id = next.current++;
      // At most three on screen; the oldest gives way.
      setToasts((ts) => [...ts.slice(-2), { id, tone, message }]);
      // Errors stay longer: they are the ones somebody needs to read.
      window.setTimeout(() => dismiss(id), tone === "error" ? 8000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<Api>(
    () => ({ success: (m) => push("success", m), error: (m) => push("error", m) }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {createPortal(<Toasts toasts={toasts} onDismiss={dismiss} />, document.body)}
    </Ctx.Provider>
  );
}

function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  const t = useAdminT();
  return (
    <div
      className="admin-ui pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 sm:items-end"
      aria-live="polite"
      role="status"
    >
      {toasts.map((x) => (
        <div
          key={x.id}
          data-toast={x.tone}
          className={cx(
            "animate-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg",
            x.tone === "success"
              ? "border-emerald-200 bg-background text-foreground"
              : "border-red-200 bg-red-50 text-red-900",
          )}
        >
          {x.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          )}
          <p className="min-w-0 flex-1 break-words">{x.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(x.id)}
            aria-label={t("dismiss")}
            className="-m-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast(): Api {
  const api = useContext(Ctx);
  // Outside the provider (a panel rendered on its own in a test) toasts are
  // simply dropped rather than crashing the panel.
  return api ?? { success: () => {}, error: () => {} };
}

/** The message of whatever was thrown. api.ts already prefixes what failed. */
export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
