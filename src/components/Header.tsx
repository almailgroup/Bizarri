import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import logo from "@/assets/bizarri-logo.png";
import logoWhite from "@/assets/bizarri-logo-white.png";

// Shown in the desktop bar. Rules and Privacy live in the footer and the
// full-screen menu — nine items in a row left nothing with any weight.
const primaryNav = [
  { to: "/", key: "home" as const },
  { to: "/about", key: "about" as const },
  { to: "/facilities", key: "facilities" as const },
  { to: "/photos", key: "photos" as const },
  { to: "/booking", key: "booking" as const },
  { to: "/almail-ai", key: "chatTitle" as const },
  { to: "/contact", key: "contact" as const },
];

const menuNav = [
  ...primaryNav.slice(0, 5),
  { to: "/news", key: "news" as const },
  { to: "/almail-ai", key: "chatTitle" as const },
  { to: "/rules", key: "rules" as const },
  { to: "/contact", key: "contact" as const },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { tr, lang, setLang } = useI18n();
  const location = useLocation();

  // The homepage hero is a full-bleed dark image; the bar sits on top of it
  // until the visitor scrolls, then picks up its solid background.
  const overHero = location.pathname === "/" && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock the page behind the full-screen menu, and let Escape close it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const linkTone = overHero
    ? "text-white/75 hover:text-white"
    : "text-foreground/70 hover:text-foreground";

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
          overHero
            ? "bg-transparent border-b border-transparent"
            : "border-b border-border/60 bg-background/80 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <Link
            to="/"
            className="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
            onClick={() => setOpen(false)}
            aria-label={tr("brand")}
          >
            <img
              src={overHero ? logoWhite : logo}
              alt="Bizarri"
              className="h-9 w-auto dark:hidden"
              width={609}
              height={183}
            />
            <img
              src={logoWhite}
              alt="Bizarri"
              className="hidden h-9 w-auto dark:block"
              width={609}
              height={183}
            />
          </Link>

          <nav className="hidden items-center gap-6 lg:flex xl:gap-8">
            {primaryNav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`whitespace-nowrap text-sm uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current ${linkTone}`}
                activeProps={{
                  className: overHero ? "text-white font-medium" : "text-foreground font-medium",
                }}
              >
                {tr(n.key)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              // Arabic is a first-class language here, not a setting buried in
              // a menu — the toggle stays reachable at every breakpoint.
              className={`flex items-center gap-1.5 border px-3 py-2 text-xs uppercase tracking-widest transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                overHero
                  ? "border-white/30 text-white hover:bg-white hover:text-black"
                  : "border-border hover:bg-foreground hover:text-background"
              }`}
              lang={lang === "en" ? "ar" : "en"}
            >
              <Globe className="h-3.5 w-3.5" />
              {tr("language")}
            </button>
            <button
              onClick={() => setOpen(true)}
              // Desktop already has the full nav — no duplicate entry point.
              className={`p-2.5 transition-colors lg:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                overHero ? "text-white hover:bg-white/10" : "hover:bg-secondary"
              }`}
              aria-label={tr("menu")}
              aria-expanded={open}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-[60] overflow-y-auto bg-black text-white"
          role="dialog"
          aria-modal="true"
          aria-label={tr("menu")}
        >
          <div className="sticky top-0 z-10 mx-auto flex h-20 max-w-7xl items-center justify-between bg-black px-6">
            <img src={logoWhite} alt="Bizarri" className="h-9" />
            <button
              onClick={() => setOpen(false)}
              className="p-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label={tr("close")}
              autoFocus
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex flex-col items-center gap-5 px-6 py-10">
            {menuNav.map((n, i) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="animate-fade-up font-display text-3xl tracking-tight transition-opacity hover:opacity-60 focus-visible:opacity-60 focus-visible:outline-none md:text-5xl"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {tr(n.key)}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
