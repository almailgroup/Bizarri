import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useLookupBooking } from "@/lib/api";
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
 * Guests get a reference on confirmation; this is how they use it later.
 * Shown both at the bottom of the booking page and on its own /reservation
 * page, which the header links to.
 */
export function BookingLookup({ heading = true }: { heading?: boolean }) {
  const { tr, lang } = useI18n();
  const lookup = useLookupBooking();
  const [ref, setRef] = useState("");
  const [email, setEmail] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  // localStorage is not available during SSR, so read it after mount.
  useEffect(() => {
    const last = readLastRef();
    if (last) {
      setRef(last);
      setPrefilled(true);
    }
  }, []);

  const found = lookup.data?.[0];
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

  return (
    <div>
      {heading && <h2 className="font-display text-2xl">{tr("checkBooking")}</h2>}
      <p className="mt-2 text-sm text-muted-foreground">{tr("checkBookingHint")}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!ref.trim() || !email.trim()) return;
          lookup.mutate({ ref, email });
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
          className="min-w-[10rem] flex-1 border border-border bg-secondary px-4 py-3 font-mono outline-none focus:border-foreground"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={tr("email")}
          dir="ltr"
          aria-label={tr("email")}
          className="min-w-[12rem] flex-1 border border-border bg-secondary px-4 py-3 outline-none focus:border-foreground"
        />
        <button
          type="submit"
          disabled={lookup.isPending}
          className="border border-foreground px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
        >
          {tr("checkStatus")}
        </button>
      </form>

      {prefilled && <p className="mt-3 text-xs text-muted-foreground">{tr("savedRefNote")}</p>}

      {lookup.isSuccess && !found && (
        <p className="mt-4 text-sm text-muted-foreground">{tr("bookingNotFound")}</p>
      )}
      {lookup.isError && (
        <p className="mt-4 text-sm text-destructive">{(lookup.error as Error).message}</p>
      )}
      {found && (
        <div className="mt-5 border border-border p-6">
          <p className="font-mono text-xs text-muted-foreground" dir="ltr">
            {found.ref}
          </p>
          <p className="mt-2 font-display text-2xl">{statusLabel(found.status)}</p>
          <p className="mt-2 text-sm text-muted-foreground" dir="ltr">
            Chalet {found.chalet_id} · {found.start_date} → {found.end_date} ({found.days}{" "}
            {tr("nightsLabel")}) · {formatMoney(Number(found.total), lang)}
          </p>
        </div>
      )}
    </div>
  );
}
