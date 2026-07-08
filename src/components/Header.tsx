import { Link, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import logo from "@/assets/bizarri-logo.png";
import logoWhite from "@/assets/bizarri-logo-white.png";

const navItems = [
  { to: "/", key: "home" as const },
  { to: "/about", key: "about" as const },
  { to: "/facilities", key: "facilities" as const },
  { to: "/photos", key: "photos" as const },
  { to: "/booking", key: "booking" as const },
  { to: "/news", key: "news" as const },
  { to: "/almail-ai", key: "chatTitle" as const },
  { to: "/rules", key: "rules" as const },
  { to: "/contact", key: "contact" as const },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const { tr, lang, setLang } = useI18n();
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <img src={logo} alt="Bizarri" className="h-9 dark:hidden" />
            <img src={logoWhite} alt="Bizarri" className="h-9 hidden dark:block" />
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            {navItems.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="text-sm tracking-wide uppercase text-foreground/70 hover:text-foreground transition-colors"
                activeProps={{ className: "text-foreground font-medium" }}
              >
                {tr(n.key)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-widest border border-border hover:bg-foreground hover:text-background transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              {tr("language")}
            </button>
            <button
              onClick={() => setOpen(true)}
              className="p-2.5 hover:bg-secondary transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black text-white animate-fade-in overflow-y-auto">
          <div className="sticky top-0 bg-black max-w-7xl mx-auto px-6 h-20 flex items-center justify-between z-10">
            <img src={logoWhite} alt="Bizarri" className="h-9" />
            <button onClick={() => setOpen(false)} className="p-2.5" aria-label="Close menu">
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="px-6 py-10 flex flex-col gap-5 items-center">
            {navItems.map((n, i) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="font-display text-3xl md:text-5xl tracking-tight hover:opacity-60 transition-opacity animate-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {tr(n.key)}
              </Link>
            ))}
            <button
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="mt-8 px-6 py-3 border border-white/30 text-sm tracking-widest uppercase hover:bg-white hover:text-black transition-colors"
            >
              {tr("language")}
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
