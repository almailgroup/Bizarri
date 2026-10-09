import { Link, useMatchRoute, type LinkProps } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Menu, X, Globe, Ticket } from "lucide-react";
import { useI18n, type TrKey } from "@/lib/i18n";
import { BrandHomeLink } from "@/components/BrandHomeLink";
import logo from "@/assets/bizarri-logo.png";
import logoWhite from "@/assets/bizarri-logo-white.png";

// Home, About and Almail AI were removed from the site navigation; the logo
// still links home and the assistant is reachable from the chat widget.
// Typed as the router's own paths rather than plain strings, so a nav entry
// that has not been moved under /$lang is a compile error. It was not, and
// these five silently kept sending Arabic readers to the English page.
type NavPath = Extract<LinkProps["to"], `/${string}/$lang`>;

const primaryNav: { to: NavPath; key: TrKey }[] = [
  { to: "/facilities/$lang", key: "facilities" },
  { to: "/photos/$lang", key: "photos" },
  { to: "/offers/$lang", key: "offers" },
  { to: "/packages/$lang", key: "packages" },
  { to: "/booking/$lang", key: "booking" },
  { to: "/contact/$lang", key: "contact" },
];

// Everything in the bar up to Booking, then the pages that only the menu
// carries. Counted by name rather than by position: a fifth header entry
// once pushed Booking out of the phone menu by sitting before it.
const menuNav: { to: NavPath; key: TrKey }[] = [
  ...primaryNav.slice(0, primaryNav.findIndex((n) => n.key === "booking") + 1),
  { to: "/reservation/$lang", key: "yourReservation" },
  { to: "/news/$lang", key: "news" },
  { to: "/rules/$lang", key: "rules" },
  { to: "/contact/$lang", key: "contact" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const { tr, lang, setLang } = useI18n();
  const matchRoute = useMatchRoute();
  const sentinel = useRef<HTMLDivElement>(null);

  // The homepage hero is a full-bleed dark image; the bar sits on top of it
  // until the visitor scrolls, then picks up its solid background.
  const overHero = !!matchRoute({ to: "/$lang", params: { lang } }) && atTop;

  /**
   * Whether the top of the page is still in view.
   *
   * Watched with an observer rather than counted from scroll events, because
   * the page can move without firing one. The router restores a scroll
   * position on the way back to a page, the intro releases the body's overflow
   * lock when it finishes, and the hero image changes the page's height when
   * it finally loads. Any of those leaves a scroll-event tally holding a stale
   * answer -- which looks like a white bar sitting over a hero that is plainly
   * still there, and stays that way until something scrolls.
   *
   * The sentinel is a strip at the very top of the document, so "intersecting"
   * is the question being asked rather than a number to compare against.
   */
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setAtTop(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
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
      {/* Absolute with no positioned ancestor, so it is pinned to the top of
          the document rather than the viewport: it leaves view precisely when
          the page has scrolled past the bar's own height. Zero width and
          aria-hidden -- it is a measurement, not content. */}
      <div ref={sentinel} aria-hidden className="absolute top-0 h-20 w-0" />
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
          overHero
            ? "bg-transparent border-b border-transparent"
            : "border-b border-border/60 bg-background/80 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <BrandHomeLink
            className="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
            onNavigate={() => setOpen(false)}
          >
            <img
              src={overHero ? logoWhite : logo}
              alt="Bizarri"
              className="h-11 w-auto"
              width={1400}
              height={510}
            />
          </BrandHomeLink>

          <nav className="hidden items-center gap-6 lg:flex xl:gap-8">
            {primaryNav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                params={{ lang }}
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
            {/* A shortcut rather than another nav item: returning guests come
                back to check a status, not to browse. */}
            <Link
              to="/reservation/$lang"
              params={{ lang }}
              className={`hidden items-center gap-1.5 border px-3 py-2 text-xs uppercase tracking-widest transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current sm:flex ${
                overHero
                  ? "border-white/30 text-white hover:bg-white hover:text-black"
                  : "border-border hover:bg-foreground hover:text-background"
              }`}
            >
              <Ticket className="h-3.5 w-3.5" />
              {tr("yourReservation")}
            </Link>
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
            <BrandHomeLink onNavigate={() => setOpen(false)}>
              <img src={logoWhite} alt="Bizarri" className="h-11" />
            </BrandHomeLink>
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
                params={{ lang }}
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
