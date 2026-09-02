import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import logo from "@/assets/bizarri-logo-white.png";

// Trimmed from 4s. Long enough to land the brand, short enough that a guest
// heading for /booking isn't held at the door.
const PHASE_TAGLINE = 1100;
const PHASE_FADE = 2100;
const PHASE_DONE = 2800;

export function IntroLoader() {
  const { tr, dir } = useI18n();
  const [hidden, setHidden] = useState(false);
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const dismiss = useCallback(() => {
    timers.current.forEach(clearTimeout);
    setHidden(true);
    try {
      sessionStorage.setItem("bizarri_intro_seen", "1");
    } catch {
      /* private mode — the intro simply replays */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let seen = false;
    try {
      seen = sessionStorage.getItem("bizarri_intro_seen") === "1";
    } catch {
      seen = false;
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduced) {
      setHidden(true);
      return;
    }

    timers.current = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), PHASE_TAGLINE),
      setTimeout(() => setPhase(3), PHASE_FADE),
      setTimeout(dismiss, PHASE_DONE),
    ];
    return () => timers.current.forEach(clearTimeout);
  }, [dismiss]);

  // Any key dismisses, so keyboard users aren't trapped behind the splash.
  useEffect(() => {
    if (hidden) return;
    const onKey = () => dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hidden, dismiss]);

  if (hidden) return null;

  return (
    <div
      role="presentation"
      onClick={dismiss}
      className={`fixed inset-0 z-[100] flex cursor-pointer items-center justify-center overflow-hidden bg-black transition-opacity duration-700 ${
        phase === 3 ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* radial vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.08),_transparent_60%)]" />

      {/* sweeping light line */}
      <div className="absolute inset-y-0 left-0 right-0 flex items-center">
        <div
          className="h-px w-full origin-left bg-gradient-to-r from-transparent via-white/40 to-transparent"
          style={{ animation: "introSweep 1.4s cubic-bezier(.7,0,.2,1) 0.1s both" }}
        />
      </div>

      <div className="relative flex flex-col items-center gap-8 px-6 text-center">
        <p
          className={`text-[10px] uppercase tracking-[0.6em] text-white/40 transition-all duration-700 md:text-xs ${
            phase >= 1 ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
          }`}
        >
          {tr("introMember")}
        </p>

        <div
          className={`transition-all duration-1000 ${
            phase >= 1 ? "scale-100 opacity-100 blur-0" : "scale-90 opacity-0 blur-md"
          }`}
        >
          <img src={logo} alt="Bizarri Chalet" className="w-56 md:w-72" />
        </div>

        <div className="h-px w-32 overflow-hidden bg-white/20">
          <div
            className="h-full bg-white"
            style={{ animation: "introFill 1.4s ease-out 0.4s both" }}
          />
        </div>

        <p
          className={`font-display text-2xl italic tracking-wide text-white/80 transition-all duration-700 md:text-3xl ${
            phase >= 2 ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          {tr("introTagline")}
        </p>
      </div>

      <button
        onClick={dismiss}
        className={`absolute bottom-8 ${dir === "rtl" ? "left-8" : "right-8"} text-[10px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none`}
      >
        {tr("skip")}
      </button>

      <style>{`
        @keyframes introFill { from { width: 0; } to { width: 100%; } }
        @keyframes introSweep {
          from { transform: scaleX(0); opacity: 0; }
          50% { opacity: 1; }
          to { transform: scaleX(1); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
