import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { dateLocale } from "@/lib/locale";
import { LEGAL_UPDATED, type LegalDocument } from "@/lib/legal";
import { parseDate } from "@/lib/booking";

function useUpdated() {
  const { tr, lang } = useI18n();
  const date = parseDate(LEGAL_UPDATED).toLocaleDateString(dateLocale(lang), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return tr("lastUpdated").replace("{date}", date);
}

/**
 * A document's sections, each a heading over a list of clauses. Lists rather
 * than run-on paragraphs: the text this replaced ran sentences into one
 * another, and a guest looking for one rule had to read them all.
 *
 * Shared by the page and the popup on the booking form, so the two cannot
 * show different words.
 */
function LegalSections({
  doc,
  numbered,
  idPrefix,
  Heading,
}: {
  doc: LegalDocument;
  numbered: boolean;
  idPrefix: string;
  /** h2 on the page, where the title is the h1; h3 in the popup. */
  Heading: "h2" | "h3";
}) {
  return (
    <>
      {doc.sections.map((s, i) => (
        <section key={s.title} aria-labelledby={`${idPrefix}-${i}`}>
          <Heading id={`${idPrefix}-${i}`} className="font-display text-2xl">
            {numbered && <span className="tabular-nums">{i + 1}. </span>}
            {s.title}
          </Heading>
          <ul className="mt-5 space-y-4">
            {s.items.map((item) => (
              <li key={item} className="flex gap-3 leading-relaxed text-foreground/80">
                <span
                  className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** A policy page: its name, the title, when it last changed, then the text. */
export function LegalDoc({
  label,
  doc,
  numbered = true,
  footer,
}: {
  /** The page's name, above the title: "Terms & Conditions". */
  label: string;
  doc: LegalDocument;
  /** Number the sections 1, 2, 3...; off where they are excerpts. */
  numbered?: boolean;
  footer?: ReactNode;
}) {
  const updated = useUpdated();
  return (
    <section className="mx-auto max-w-3xl px-6 py-16 md:py-32">
      <p className="mb-6 text-xs uppercase tracking-[0.4em] text-muted-foreground">{label}</p>
      <h1 className="animate-fade-up font-display text-4xl md:text-5xl">{doc.title}</h1>
      <p className="mt-4 text-sm text-muted-foreground">{updated}</p>
      <p
        className="mt-8 animate-fade-up leading-relaxed text-foreground/80"
        style={{ animationDelay: "100ms" }}
      >
        {doc.intro}
      </p>
      <div className="mt-12 space-y-12">
        <LegalSections doc={doc} numbered={numbered} idPrefix="legal" Heading="h2" />
      </div>
      {footer && <div className="mt-16 border-t border-border pt-8">{footer}</div>}
    </section>
  );
}

/**
 * The same document in a popup over the booking form, so a guest can read
 * what they are accepting without leaving the form they have filled in.
 *
 * The title and the close button stay put while the text scrolls beneath
 * them; Escape, the button at the foot and the browser's Back all close it
 * (the form opens it as an entry of its own, as it does the code dialog).
 * Portalled to the body for the reason CodeDialog gives: the booking page
 * animates itself in, and a transformed ancestor would pin "fixed" to the
 * form instead of the screen.
 */
export function LegalDialog({
  doc,
  numbered = true,
  onClose,
}: {
  doc: LegalDocument;
  numbered?: boolean;
  onClose: () => void;
}) {
  const { tr } = useI18n();
  const updated = useUpdated();
  const titleId = useId();
  const closeBtn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Read through a ref: the effect below runs once, on opening, however
  // often the form behind re-renders with a new callback.
  const close = useRef(onClose);
  close.current = onClose;

  // Escape closes it; the page behind does not scroll; focus goes into the
  // dialog and back to whatever opened it afterwards; Tab stays inside.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'button, [href], [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      // The site's fade takes a second; a popup opened to read should not.
      className="animate-fade-in fixed inset-0 z-[70] flex items-end justify-center bg-black/60 [animation-duration:250ms] sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="legal-dialog"
        className="animate-scale-in flex max-h-[92dvh] w-full max-w-2xl flex-col border border-border bg-background [animation-duration:300ms] sm:max-h-[85vh]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-8 sm:py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-xl sm:text-2xl">
              {doc.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{updated}</p>
          </div>
          <button
            ref={closeBtn}
            type="button"
            onClick={onClose}
            aria-label={tr("close")}
            className="-me-2 inline-flex h-11 w-11 shrink-0 items-center justify-center hover:bg-secondary"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8">
          <p className="leading-relaxed text-foreground/80">{doc.intro}</p>
          <div className="mt-8 space-y-10">
            <LegalSections doc={doc} numbered={numbered} idPrefix={titleId} Heading="h3" />
          </div>
        </div>

        <div className="border-t border-border px-5 py-4 sm:px-8">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 w-full bg-foreground px-6 text-sm uppercase tracking-widest text-background transition-opacity hover:opacity-90"
          >
            {tr("close")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
