import { useEffect, useRef, useState } from "react";
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
}: {
  email: string;
  verified: boolean;
  onVerified: (email: string) => void;
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
    <div className="border border-border p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{tr("verifyEmail")}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {sent ? tr("codeSent").replace("{email}", email.trim()) : tr("verifyEmailHint")}
      </p>

      {!sent ? (
        <button
          type="button"
          onClick={request}
          disabled={!usable || send.isPending}
          className="mt-3 border border-foreground px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-foreground hover:text-background disabled:opacity-40"
        >
          {send.isPending ? tr("sendingCode") : tr("sendCode")}
        </button>
      ) : (
        <div className="mt-3 flex flex-wrap items-start gap-3">
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
            className="w-36 border border-border bg-secondary px-4 py-3 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-foreground"
          />
          <button
            type="button"
            onClick={confirm}
            disabled={code.length !== 6 || check.isPending}
            className="border border-foreground px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-foreground hover:text-background disabled:opacity-40"
          >
            {tr("verifyCode")}
          </button>
          <button
            type="button"
            onClick={request}
            disabled={send.isPending}
            className="-my-2 px-1 py-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-40"
          >
            {tr("resendCode")}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
