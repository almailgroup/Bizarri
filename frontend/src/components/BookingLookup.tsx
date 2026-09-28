import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useLookupBooking, useLookupBookingByPhone } from "@/lib/api";
import { formatMoney } from "@/lib/booking";
import type { BookingRow } from "@/integrations/supabase/types";

const LAST_REF_KEY = "bizarri:lastRef";

type Found = Pick<
  BookingRow,
  "ref" | "status" | "chalet_id" | "start_date" | "end_date" | "days" | "total" | "currency"
>;

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
 * Two ways in, because guests lose things.
 *
 * The reference is the reliable one. The phone number is there for the guest
 * who deleted the email, and it deliberately asks for nothing they had to be
 * told — which does mean anyone who knows a number can see the stay behind
 * it. That trade was made knowingly; see lookup_booking_by_phone() in the
 * migration.
 */
export function BookingLookup({ heading = true }: { heading?: boolean }) {
  const { tr, lang } = useI18n();
  const [mode, setMode] = useState<"ref" | "phone">("ref");
  const byRef = useLookupBooking();
  const byPhone = useLookupBookingByPhone();
  const [ref, setRef] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  // localStorage is not available during SSR, so read it after mount.
  useEffect(() => {
    const last = readLastRef();
    if (last) {
      setRef(last);
      setPrefilled(true);
    }
  }, []);

  const active = mode === "ref" ? byRef : byPhone;
  const results = (active.data ?? []) as Found[];
  const found = results[0];

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

  const switchTo = (next: "ref" | "phone") => {
    if (next === mode) return;
    setMode(next);
    // Results belong to the mode that produced them; leaving them on screen
    // under the other tab reads as an answer to a question nobody asked.
    byRef.reset();
    byPhone.reset();
  };

  const tab = (value: "ref" | "phone", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => switchTo(value)}
      // flex-1 with a floor: the two sit side by side where they fit and take
      // a full row each where they do not, rather than wrapping to two
      // different widths.
      className={`min-w-[11rem] flex-1 px-5 py-3 text-sm uppercase tracking-widest transition-colors ${
        mode === value
          ? "bg-foreground text-background"
          : "border border-border text-muted-foreground hover:bg-secondary"
      }`}
    >
      {label}
    </button>
  );

  const field =
    "min-w-[10rem] flex-1 border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground";
  const submitButton = (
    <button
      type="submit"
      disabled={active.isPending}
      className="border border-foreground px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
    >
      {tr("checkStatus")}
    </button>
  );

  return (
    <div>
      {heading && <h2 className="font-display text-2xl">{tr("checkBooking")}</h2>}

      <p className="mt-2 text-sm text-muted-foreground" id="lookup-how">
        {tr("lookupHow")}
      </p>
      <div role="tablist" aria-labelledby="lookup-how" className="mt-3 flex flex-wrap gap-2">
        {tab("ref", tr("lookupByRef"))}
        {tab("phone", tr("lookupByPhone"))}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {mode === "ref" ? tr("checkBookingHint") : tr("checkByPhoneHint")}
      </p>

      {mode === "ref" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!ref.trim() || !email.trim()) return;
            byRef.mutate({ ref, email });
          }}
          className="mt-5 flex flex-wrap gap-3"
        >
          <input
            value={ref}
            onChange={(e) => {
              setRef(e.target.value);
              setPrefilled(false);
            }}
            placeholder="BZR-XXXXXX"
            dir="ltr"
            aria-label={tr("bookingRef")}
            className={`${field} font-mono`}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={tr("email")}
            dir="ltr"
            aria-label={tr("email")}
            className={`${field} min-w-[12rem]`}
          />
          {submitButton}
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!phone.trim()) return;
            byPhone.mutate({ phone });
          }}
          className="mt-5 flex flex-wrap gap-3"
        >
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+965 XXXXXXXX"
            dir="ltr"
            aria-label={tr("phone")}
            className={`${field} min-w-[12rem]`}
          />
          {submitButton}
        </form>
      )}

      {prefilled && mode === "ref" && (
        <p className="mt-3 text-xs text-muted-foreground">{tr("savedRefNote")}</p>
      )}

      {active.isSuccess && !found && (
        <p className="mt-4 text-sm text-muted-foreground">
          {mode === "ref" ? tr("bookingNotFound") : tr("bookingNotFoundPhone")}
        </p>
      )}
      {active.isError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {(active.error as Error).message}
        </p>
      )}

      {/* A number can carry more than one stay, so the phone path lists them
          all rather than silently showing whichever came back first. */}
      {results.map((b) => (
        <div key={b.ref} className="mt-5 border border-border p-6">
          <p className="font-mono text-xs text-muted-foreground" dir="ltr">
            {b.ref}
          </p>
          <p className="mt-2 font-display text-2xl">{statusLabel(b.status)}</p>
          <p className="mt-2 text-sm text-muted-foreground" dir="ltr">
            Chalet {b.chalet_id} · {b.start_date} → {b.end_date} ({b.days} {tr("nightsLabel")}) ·{" "}
            {formatMoney(Number(b.total), lang)}
          </p>
        </div>
      ))}
    </div>
  );
}
