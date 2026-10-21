import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { dateLocale } from "@/lib/locale";
import { LEGAL_UPDATED, type LegalDocument } from "@/lib/legal";
import { parseDate } from "@/lib/booking";

/**
 * A policy page: the document's title, when it last changed, a short
 * introduction, then its sections, each a heading over a list of clauses.
 * Lists rather than run-on paragraphs: the text this replaced ran sentences
 * into one another, and a guest looking for one rule had to read them all.
 */
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
  const { tr, lang } = useI18n();
  const updated = parseDate(LEGAL_UPDATED).toLocaleDateString(dateLocale(lang), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <section className="mx-auto max-w-3xl px-6 py-16 md:py-32">
      <p className="mb-6 text-xs uppercase tracking-[0.4em] text-muted-foreground">{label}</p>
      <h1 className="animate-fade-up font-display text-4xl md:text-5xl">{doc.title}</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        {tr("lastUpdated").replace("{date}", updated)}
      </p>
      <p
        className="mt-8 animate-fade-up leading-relaxed text-foreground/80"
        style={{ animationDelay: "100ms" }}
      >
        {doc.intro}
      </p>

      <div className="mt-12 space-y-12">
        {doc.sections.map((s, i) => (
          <section key={s.title} aria-labelledby={`legal-${i}`}>
            <h2 id={`legal-${i}`} className="font-display text-2xl">
              {numbered && <span className="tabular-nums">{i + 1}. </span>}
              {s.title}
            </h2>
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
      </div>

      {footer && <div className="mt-16 border-t border-border pt-8">{footer}</div>}
    </section>
  );
}
