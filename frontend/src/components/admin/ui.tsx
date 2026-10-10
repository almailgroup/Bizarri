/**
 * The dashboard's building blocks.
 *
 * One place for what a button, a card, a status badge and a dialog look like,
 * so the nine panels stop drifting apart. The public site is square-cornered
 * by design; the dashboard sets its own radius on its root (see .admin-ui in
 * styles.css), so `rounded-*` here is soft without touching a guest page.
 */
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import type { BookingStatus } from "@/integrations/supabase/types";
import { useAdminT } from "./strings";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ button */

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-foreground text-background hover:bg-foreground/85 shadow-sm",
  secondary: "border border-border bg-background text-foreground hover:bg-secondary",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
};
const SIZE: Record<Size, string> = {
  sm: "min-h-10 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
};

export const Btn = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
    busy?: boolean;
    icon?: ReactNode;
  }
>(function Btn(
  { variant = "secondary", size = "md", busy, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});

/** A square icon button, 44px so it is a comfortable target on a phone. */
export function IconBtn({
  label,
  children,
  className,
  tone = "neutral",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: "neutral" | "danger" }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-40",
        tone === "danger"
          ? "hover:bg-red-50 hover:text-destructive"
          : "hover:bg-secondary hover:text-foreground",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------- containers */

export function Card({
  children,
  className,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  return (
    <As className={cx("rounded-lg border border-border bg-background shadow-xs", className)}>
      {children}
    </As>
  );
}

/** Title, one line of explanation, and the panel's own actions on the end. */
export function PanelHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
      {icon && <span className="text-muted-foreground/70">{icon}</span>}
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-secondary", className)} />;
}

/** Placeholder rows while a list loads, shaped like the list it stands in for. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  const t = useAdminT();
  return (
    <div className="space-y-3" role="status" aria-label={t("loading")}>
      {Array.from({ length: rows }, (_, i) => (
        <Card key={i} className="p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-5 w-48" />
          <Skeleton className="mt-3 h-3 w-full max-w-md" />
        </Card>
      ))}
    </div>
  );
}

export function ErrorNote({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  const t = useAdminT();
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <span>{children}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-10 rounded-md px-3 font-medium underline underline-offset-4"
        >
          {t("retry")}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ status */

const STATUS_STYLE: Record<BookingStatus, { badge: string; dot: string }> = {
  pending: { badge: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  accepted: { badge: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  rejected: { badge: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
  cancelled: { badge: "bg-secondary text-muted-foreground ring-border", dot: "bg-neutral-400" },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const t = useAdminT();
  const s = STATUS_STYLE[status];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        s.badge,
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden="true" />
      {t(status)}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ fields */

export const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-foreground focus:ring-2 focus:ring-foreground/10 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/10";

/**
 * Label, control, and the line under it: a hint, or the error when there is
 * one. The control is passed as a render function so it gets the ids that
 * tie the three together for a screen reader.
 */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: (a: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error || hint;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        "aria-invalid": !!error,
        "aria-describedby": note ? noteId : undefined,
      })}
      {note && (
        <p
          id={noteId}
          className={cx("mt-1.5 text-xs", error ? "text-destructive" : "text-muted-foreground")}
        >
          {note}
        </p>
      )}
    </div>
  );
}

/** A row of mutually exclusive choices, as pressed toggle buttons. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-lg bg-secondary p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "min-h-10 rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-50",
            value === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- modal */

/**
 * A dialog, portalled to the body.
 *
 * Portalled because a transformed ancestor becomes the containing block for
 * position: fixed (the booking page learned this the hard way). Escape and a
 * click on the backdrop close it, focus moves in on open and back on close,
 * and the page behind does not scroll.
 */
export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
  busy = false,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** While true, nothing closes it: a half-sent request should not vanish. */
  busy?: boolean;
}) {
  const t = useAdminT();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose);
  close.current = busy ? () => {} : onClose;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // The control marked for it, else the first field, else the first button.
    const first =
      panel.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel.current?.querySelector<HTMLElement>(
        "input, select, textarea, button:not([data-close])",
      );
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      // Keep Tab inside the dialog.
      if (e.key === "Tab" && panel.current) {
        const items = [
          ...panel.current.querySelectorAll<HTMLElement>(
            "button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])",
          ),
        ].filter((el) => !el.hasAttribute("disabled"));
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      before?.focus?.();
    };
  }, []);

  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return createPortal(
    <div
      className="admin-ui animate-fade-in fixed inset-0 z-[70] overflow-y-auto bg-black/50 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && close.current()}
    >
      <div
        className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-6"
        onMouseDown={(e) => e.target === e.currentTarget && close.current()}
      >
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cx(
            "animate-scale-in w-full rounded-t-xl bg-background shadow-2xl sm:rounded-xl",
            width,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h3 id={titleId} className="text-lg font-semibold">
                {title}
              </h3>
              {description && (
                <div className="mt-1 text-sm text-muted-foreground">{description}</div>
              )}
            </div>
            <IconBtn
              label={t("dismiss")}
              onClick={() => close.current()}
              data-close
              className="-me-2 -mt-1"
            >
              <X className="h-5 w-5" />
            </IconBtn>
          </div>
          {children && <div className="px-5 py-5 sm:px-6">{children}</div>}
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-border bg-secondary/40 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 rounded-b-xl">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
