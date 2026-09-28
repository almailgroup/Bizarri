import { Link, useMatchRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

/**
 * The logo, wherever it appears, goes home.
 *
 * On the homepage the router has nowhere to navigate, so the click would
 * otherwise do nothing at all — which reads as a broken logo to anyone who has
 * scrolled down. There it scrolls back to the top instead.
 */
export function BrandHomeLink({
  className,
  onNavigate,
  children,
}: {
  className?: string;
  /** Runs on every click, e.g. to close the menu the logo sits in. */
  onNavigate?: () => void;
  children: ReactNode;
}) {
  const { tr, lang } = useI18n();
  // Asked of the router rather than compared as a string: home is /en or /ar
  // now, and it moved once already.
  const matchRoute = useMatchRoute();
  const atHome = !!matchRoute({ to: "/$lang", params: { lang } });

  return (
    <Link
      to="/$lang"
      params={{ lang }}
      className={className}
      aria-label={tr("brand")}
      onClick={(e) => {
        onNavigate?.();
        if (!atHome) return;
        e.preventDefault();
        window.scrollTo({
          top: 0,
          // Honour the OS setting: a long smooth scroll is exactly the kind of
          // motion people disable it for.
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        });
      }}
    >
      {children}
    </Link>
  );
}
