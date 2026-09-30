import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useLookupBooking, type FoundBooking, type LookupBy } from "@/lib/api";
import { formatMoney, formatSpan, parseDate } from "@/lib/booking";

const LAST_REF_KEY = "bizarri:lastRef";

/** Remember the reference so a returning guest does not have to find the email. */
export function rememberBookingRef(ref: string) {
  try {
    localStorage.setItem(LAST_REF_KEY, ref);
  } catch {
    // Private browsing and blocked site data both throw; the lookup still
    // works, the guest just types the reference themselves.
  }
}

function readLastRef(): string {
  try {
    return localStorage.getItem(LAST_REF_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Three ways in, because guests lose things.
 *
 * Each asks for one field. Asking for two would make the "I have lost it"
 * case worse, and that case is the only reason this page exists. Only the
 * reference is a secret; the other two show a stay to anyone who knows the
 * address or the number, which is a trade made knowingly — see the notes on
 * the lookup functions in the migration.
 */
export function BookingLookup({ heading = true }: { heading?: boolean }) {
  const { tr, lang } = useI18n();
  const [by, setBy] = useState<LookupBy>("ref");
  const lookup = useLookupBooking();
  const [values, setValues] = useState<Record<LookupBy, string>>({
    ref: "",
    email: "",
    phone: "",
  });
  const [prefilled, setPrefilled] = useState(false);

  // localStorage is not available during SSR, so read it after mount.
  useEffect(() => {
    const last = readLastRef();
    if (last) {
      setValues((v) => ({ ...v, ref: last }));
      setPrefilled(true);
    }
  }, []);

  const results = (lookup.data ?? []) as FoundBooking[];
  const found = results[0];
  const value = values[by];

  /**
   * Bring the answer to the guest.
   *
   * On a phone the form sits near the bottom of the first screen, so a result
   * rendered under it is off-screen: the guest taps Check status, nothing
   * appears to happen, and the page looks broken. Scrolling to the answer is
   * the whole interaction on a small screen. aria-live covers the same gap for
   * a screen reader, which otherwise hears nothing either.
   */
  const answerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!lookup.isSuccess && !lookup.isError) return;
    const el = answerRef.current;
    if (!el) return;
    // Only when it is actually out of sight: on a desktop the answer is
    // already visible and scrolling under someone is its own annoyance. The
    // test is whether the first card is readable, not whether its top edge is
    // on screen -- one that begins above the fold and ends below it shows the
    // reference and the status and cuts the dates and the price, which is the
    // half the guest came for.
    //
    // The card by name, not the first child: that is the screen-reader-only
    // count, a clipped 1px box, which always measures as comfortably in view.
    const card = el.querySelector("[data-result]");
    if (!card) return;
    const r = card.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [lookup.isSuccess, lookup.isError, lookup.data]);

  const statusLabel = (s: string) =>
    s === "accepted"
      ? tr("statusAccepted")
      : s === "rejected"
        ? tr("statusRejected")
        : s === "cancelled"
          ? lang === "en"
            ? "Cancelled"
            : "ملغى"
          : tr("statusPending");

  const switchTo = (next: LookupBy) => {
    if (next === by) return;
    setBy(next);
    // Results belong to the question that produced them; leaving them on
    // screen under another tab reads as an answer to one nobody asked.
    lookup.reset();
  };

  const tabs: { key: LookupBy; label: string; full: string }[] = [
    { key: "ref", label: tr("lookupByRefShort"), full: tr("lookupByRef") },
    { key: "email", label: tr("lookupByEmailShort"), full: tr("lookupByEmail") },
    { key: "phone", label: tr("lookupByPhoneShort"), full: tr("lookupByPhone") },
  ];

  const field = {
    ref: {
      hint: tr("checkByRefHint"),
      placeholder: "BZR-XXXXXX",
      type: "text",
      mode: undefined,
      auto: undefined,
      label: tr("bookingRef"),
      empty: tr("bookingNotFoundRef"),
      mono: true,
    },
    email: {
      hint: tr("checkByEmailHint"),
      placeholder: "you@example.com",
      type: "email",
      mode: "email" as const,
      auto: "email",
      label: tr("email"),
      empty: tr("bookingNotFoundEmail"),
      mono: false,
    },
    phone: {
      hint: tr("checkByPhoneHint"),
      placeholder: "+965 XXXXXXXX",
      type: "tel",
      mode: "tel" as const,
      auto: "tel",
      label: tr("phone"),
      empty: tr("bookingNotFoundPhone"),
      mono: false,
    },
  }[by];

  return (
    <div>
      {heading && <h2 className="font-display text-2xl">{tr("checkBooking")}</h2>}

      <p className="mt-2 text-sm text-muted-foreground" id="lookup-how">
        {tr("lookupHow")}
      </p>
      {/* One row at every width. The short label is what fits three across on
          a phone; the full phrase stays as the accessible name, so a screen
          reader still hears "Booking reference" rather than "Reference". */}
      <div role="tablist" aria-labelledby="lookup-how" className="mt-3 grid grid-cols-3 gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={by === t.key}
            aria-label={t.full}
            onClick={() => switchTo(t.key)}
            className={`px-2 py-3 text-xs uppercase tracking-widest transition-colors sm:px-4 sm:text-sm ${
              by === t.key
                ? "bg-foreground text-background"
                : "border border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{field.hint}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return;
          lookup.mutate({ by, value: value.trim() });
        }}
        className="mt-4 flex flex-col gap-3 sm:flex-row"
      >
        <input
          // Keyed by mode so switching tabs gives a genuinely new input
          // rather than one carrying the old type and autofill behaviour.
          key={by}
          type={field.type}
          inputMode={field.mode}
          autoComplete={field.auto}
          value={value}
          onChange={(e) => {
            setValues({ ...values, [by]: e.target.value });
            if (by === "ref") setPrefilled(false);
          }}
          placeholder={field.placeholder}
          dir="ltr"
          aria-label={field.label}
          className={`min-w-0 flex-1 border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground ${
            field.mono ? "font-mono" : ""
          }`}
        />
        {/* Filled, not outlined. Stacked under three outlined tabs and an
            outlined input on a phone, an outlined submit is the fourth box in
            a column of boxes and stops looking like the thing to press. */}
        <button
          type="submit"
          disabled={lookup.isPending || !value.trim()}
          className="bg-foreground px-6 py-3 text-sm uppercase tracking-widest text-background transition-colors hover:opacity-90 disabled:bg-secondary disabled:text-muted-foreground"
        >
          {lookup.isPending ? tr("lookupSearching") : tr("checkStatus")}
        </button>
      </form>

      {prefilled && by === "ref" && (
        <p className="mt-3 text-xs text-muted-foreground">{tr("savedRefNote")}</p>
      )}

      <div ref={answerRef} aria-live="polite">
        {lookup.isSuccess && !found && (
          <p className="mt-4 text-sm text-muted-foreground">{field.empty}</p>
        )}
        {lookup.isError && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {(lookup.error as Error).message}
          </p>
        )}

        {/* Said out loud for a screen reader, which has no card to look at.
            Sighted guests have the cards themselves. */}
        {results.length > 0 && (
          <p className="sr-only">
            {results.length === 1
              ? tr("lookupOne")
              : tr("lookupMany").replace("{n}", String(results.length))}
          </p>
        )}

        {/* An address or a number can carry more than one stay, so they are all
            listed rather than whichever came back first. */}
        {results.map((b) => (
          <div key={b.ref} data-result className="mt-5 border border-border p-4 sm:p-6">
            {/* Reference, then status, then the stay -- each on its own line.
                Set side by side, "Pending / waiting list" is long enough to
                wrap the pair on a phone, which left one card with the
                reference beside the status and the next with it underneath.
                A stack is the same shape whatever it says. */}
            <p className="font-mono text-xs text-muted-foreground">
              {/* dir on the paragraph would left-align it, and on the Arabic
                  page that leaves the reference hanging off the side of a card
                  whose every other line is right-aligned. An inline span sets
                  the direction of the reference without moving it. */}
              <span dir="ltr">{b.ref}</span>
            </p>
            {/* The status is the answer, so it gets the weight the reference
                used to carry -- in the colours the admin panel already uses
                for the same three words, so the two sides of a booking do not
                describe it differently. */}
            <p className="mt-2">
              <span
                className={`inline-block px-3 py-1.5 text-xs uppercase tracking-widest ${
                  b.status === "accepted"
                    ? "bg-foreground text-background"
                    : b.status === "rejected" || b.status === "cancelled"
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-secondary text-foreground"
                }`}
              >
                {statusLabel(b.status)}
              </span>
            </p>

            {/* "2026-10-08 → 2026-10-10" is how the row is stored, not how a
                stay is read. This is the same span, in the same words the
                calendar offered it in. */}
            <p className="mt-3 font-display text-xl sm:text-2xl">
              {formatSpan(parseDate(b.start_date), parseDate(b.end_date), lang)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {b.days} {tr("nightsLabel")} · {formatMoney(Number(b.total), lang)} · {tr("chaletNo")}{" "}
              {b.chalet_id}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
