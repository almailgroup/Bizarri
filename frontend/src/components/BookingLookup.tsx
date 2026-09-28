import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useLookupBooking, type FoundBooking, type LookupBy } from "@/lib/api";
import { formatMoney } from "@/lib/booking";

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

  const tabs: { key: LookupBy; label: string }[] = [
    { key: "ref", label: tr("lookupByRef") },
    { key: "email", label: tr("lookupByEmail") },
    { key: "phone", label: tr("lookupByPhone") },
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
      {/* One per row on a phone, so no label is squeezed or wrapped. */}
      <div role="tablist" aria-labelledby="lookup-how" className="mt-3 grid gap-2 sm:grid-cols-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={by === t.key}
            onClick={() => switchTo(t.key)}
            className={`px-4 py-3 text-sm uppercase tracking-widest transition-colors ${
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
        <button
          type="submit"
          disabled={lookup.isPending || !value.trim()}
          className="border border-foreground px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
        >
          {tr("checkStatus")}
        </button>
      </form>

      {prefilled && by === "ref" && (
        <p className="mt-3 text-xs text-muted-foreground">{tr("savedRefNote")}</p>
      )}

      {lookup.isSuccess && !found && (
        <p className="mt-4 text-sm text-muted-foreground">{field.empty}</p>
      )}
      {lookup.isError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {(lookup.error as Error).message}
        </p>
      )}

      {/* An address or a number can carry more than one stay, so they are all
          listed rather than whichever came back first. */}
      {results.map((b) => (
        <div key={b.ref} className="mt-5 border border-border p-5 sm:p-6">
          <p className="font-mono text-xs text-muted-foreground" dir="ltr">
            {b.ref}
          </p>
          <p className="mt-2 font-display text-2xl">{statusLabel(b.status)}</p>
          <p className="mt-2 text-sm text-muted-foreground" dir="ltr">
            Chalet {b.chalet_id} · {b.start_date} → {b.end_date}
          </p>
          <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
            {b.days} {tr("nightsLabel")} · {formatMoney(Number(b.total), lang)}
          </p>
        </div>
      ))}
    </div>
  );
}
