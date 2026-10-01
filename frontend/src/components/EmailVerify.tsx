import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSendEmailCode, useVerifyEmailCode } from "@/lib/api";

const VALID = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

/**
 * Proves the guest can read the address they typed, before the booking is
 * made. A mistyped address used to fail silently: the request went through,
 * the confirmation bounced, and nobody found out until the guest rang.
 *
 * The code never reaches the browser. It is minted and mailed server-side;
 * all this does is collect six digits and ask the database whether they match.
 */
export function EmailVerify({
  email,
  verified,
  onVerified,
  autoSend = false,
  heading = true,
}: {
  email: string;
  verified: boolean;
  onVerified: (email: string) => void;
  /**
   * Ask for the code on mount instead of waiting for a tap.
   *
   * For the dialog that opens on Submit: the guest has already said they want
   * to book, so a "Send code" button there is one more press between them and
   * the thing they just asked for. Inline on the form it stays off, because
   * there the code is requested before anyone has committed to anything.
   */
  autoSend?: boolean;
  /** Off inside the dialog, which has its own and says the same thing. */
  heading?: boolean;
}) {
  const { tr } = useI18n();
  const { lang } = useI18n();
  const send = useSendEmailCode();
  const check = useVerifyEmailCode();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [mailDown, setMailDown] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const usable = VALID.test(email.trim());

  // Editing the address invalidates everything already on screen: the code in
  // the box belongs to the old address, and so does any error about it.
  useEffect(() => {
    setSent(false);
    setCode("");
    setError("");
  }, [email]);

  const request = async () => {
    setError("");
    try {
      const { emailConfigured } = await send.mutateAsync({ email: email.trim(), lang });
      if (!emailConfigured) {
        setMailDown(true);
        return;
      }
      setSent(true);
      // Focus follows the step, so a keyboard or screen-reader user is not
      // left hunting for the box that just appeared.
      setTimeout(() => codeRef.current?.focus(), 0);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Once per mount, and only when there is an address worth sending to. The
  // ref rather than a dependency on `sent`: a failed send leaves sent false,
  // and retrying it forever is how a down mail service becomes a loop.
  const asked = useRef(false);
  useEffect(() => {
    if (!autoSend || verified || asked.current || !usable) return;
    asked.current = true;
    void request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend, verified, usable]);

  const confirm = async () => {
    setError("");
    try {
      const ok = await check.mutateAsync({ email: email.trim(), code });
      if (ok) onVerified(email.trim());
      else setError(tr("codeWrong"));
    } catch (err) {
      // Expired, or the attempts are spent — both arrive as an exception and
      // both mean: ask for a new code.
      setError((err as Error).message);
      setSent(false);
      setCode("");
    }
  };

  if (verified) {
    return (
      <p className="flex items-center gap-2 border border-border bg-secondary p-4 text-sm">
        <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{tr("emailConfirmed")}</span>
        <span className="text-muted-foreground" dir="ltr">
          {email}
        </span>
      </p>
    );
  }

  if (mailDown) {
    return (
      <p role="alert" className="border border-destructive p-4 text-sm text-destructive">
        {tr("emailNotConfigured")}
      </p>
    );
  }

  return (
    <div className={heading ? "border border-border p-4" : ""}>
      {heading && (
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {tr("verifyEmail")}
        </p>
      )}
      <p className={`text-sm text-muted-foreground ${heading ? "mt-2" : ""}`}>
        {sent ? tr("codeSent").replace("{email}", email.trim()) : tr("verifyEmailHint")}
      </p>

      {sent && (
        <input
          ref={codeRef}
          value={code}
          // A numeric keypad on a phone, but type="text": type="number"
          // strips leading zeros, and a code like 004821 must survive.
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          dir="ltr"
          aria-label={tr("enterCode")}
          aria-invalid={!!error}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
            setError("");
          }}
          placeholder="000000"
          className="mx-auto mt-4 block w-44 border border-border bg-secondary px-4 py-3 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-foreground"
        />
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* The commonest reason a code "never arrives" is that it did, into a
          folder nobody thought to look in. Said once the code is on its way,
          not before, when it would only be noise. */}
      {sent && !error && <p className="mt-3 text-sm text-muted-foreground">{tr("checkSpam")}</p>}

      {sent && (
        <div className="mt-1 flex justify-center">
          <button
            type="button"
            onClick={request}
            disabled={send.isPending}
            className="px-1 py-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-40"
          >
            {tr("resendCode")}
          </button>
        </div>
      )}

      {/* The one action, full width and last in the box, so the dialog's Cancel
          sits directly beneath it and the pair reads as a pair. Everything that
          explains the step -- the box to type in, the spam note, the retry --
          comes above, in the order it is needed. */}
      <button
        type="button"
        onClick={sent ? confirm : request}
        disabled={sent ? code.length !== 6 || check.isPending : !usable || send.isPending}
        className="mt-3 w-full border border-foreground px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-foreground hover:text-background disabled:opacity-40"
      >
        {sent ? tr("verifyCode") : send.isPending ? tr("sendingCode") : tr("sendCode")}
      </button>
    </div>
  );
}

/**
 * The confirmation code, asked for at the moment it is needed.
 *
 * A dialog rather than a step in the form: the guest has filled everything in
 * and pressed Submit, so this is the last thing standing between them and
 * their request, and it should read that way rather than as another field.
 * It asks for the code as it opens -- see autoSend.
 */
export function CodeDialog({
  email,
  onClose,
  onVerified,
}: {
  email: string;
  onClose: () => void;
  onVerified: (email: string) => void;
}) {
  const { tr } = useI18n();

  // Escape closes it, and the page behind does not scroll while it is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Portalled to the body, not rendered where it is written.
  //
  // The booking page animates itself in, and a transform on an ancestor makes
  // that ancestor the containing block for position: fixed -- so "inset-0"
  // covered the whole 1,485px form rather than the screen. Centring in that
  // put the dialog's heading and its code box 700px above the top of the
  // window, reachable by no scroll: what was left on a phone was a Confirm
  // button for a code with nowhere visible to type it.
  //
  // Inside: scrolling on the backdrop, centring on a wrapper at least as tall
  // as the screen, so a dialog taller than the viewport scrolls from its top
  // rather than being centred past it.
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[70] overflow-y-auto bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label={tr("verifyEmail")}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="animate-scale-in w-full max-w-md border border-border bg-background p-5 sm:p-8">
          <h3 className="font-display text-2xl">{tr("verifyEmail")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{tr("codeBeforeSubmit")}</p>

          <div className="mt-4">
            <EmailVerify
              email={email}
              verified={false}
              onVerified={onVerified}
              autoSend
              heading={false}
            />
          </div>

          {/* Directly under Confirm, and quieter than it: same width, border
              only, so the pair at the foot of the dialog reads as go-ahead
              first, back out second. */}
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full border border-border px-6 py-3 text-sm uppercase tracking-widest hover:bg-secondary"
          >
            {tr("cancel")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
