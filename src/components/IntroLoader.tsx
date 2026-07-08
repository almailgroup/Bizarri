import { useEffect, useState } from "react";
import logo from "@/assets/bizarri-logo-white.png";

export function IntroLoader() {
  const [hidden, setHidden] = useState(false);
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("bizarri_intro_seen")) {
      setHidden(true);
      return;
    }
    const t1 = setTimeout(() => setPhase(1), 200); // logo in
    const t2 = setTimeout(() => setPhase(2), 1700); // tagline in
    const t3 = setTimeout(() => setPhase(3), 3200); // fade out
    const t4 = setTimeout(() => {
      setHidden(true);
      sessionStorage.setItem("bizarri_intro_seen", "1");
    }, 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden transition-opacity duration-700 ${
        phase === 3 ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* radial vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.08),_transparent_60%)]" />

      {/* sweeping gold line */}
      <div className="absolute inset-y-0 left-0 right-0 flex items-center">
        <div
          className="h-px w-full bg-gradient-to-r from-transparent via-white/40 to-transparent origin-left"
          style={{ animation: "introSweep 1.6s cubic-bezier(.7,0,.2,1) 0.1s both" }}
        />
      </div>

      <div className="relative flex flex-col items-center gap-8 px-6 text-center">
        <p
          className={`text-[10px] md:text-xs tracking-[0.6em] uppercase text-white/40 transition-all duration-1000 ${
            phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
          }`}
        >
          A Member of Almail Group
        </p>

        <div
          className={`transition-all duration-1200 ${
            phase >= 1 ? "opacity-100 scale-100 blur-0" : "opacity-0 scale-90 blur-md"
          }`}
        >
          <img src={logo} alt="Bizarri Chalet" className="w-56 md:w-72" />
        </div>

        <div className="h-px w-32 bg-white/20 overflow-hidden">
          <div
            className="h-full bg-white"
            style={{ animation: "introFill 1.6s ease-out 0.5s both" }}
          />
        </div>

        <p
          className={`font-display text-2xl md:text-3xl text-white/80 italic tracking-wide transition-all duration-1000 ${
            phase >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          A Private Luxury Experience
        </p>
      </div>

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
