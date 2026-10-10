import { requireLang } from "@/lib/lang-route";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ExternalLink,
  Globe,
  History,
  Home,
  Inbox,
  LayoutDashboard,
  Lock,
  LogOut,
  Newspaper,
  PartyPopper,
  Settings as SettingsIcon,
  Tags,
  X,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useBookings, useIsAdmin } from "@/lib/api";
import logoWhite from "@/assets/bizarri-logo-white.png";
import { OverviewPanel } from "@/components/admin/OverviewPanel";
import { AvailabilityPanel, type BookingPrefill } from "@/components/admin/AvailabilityPanel";
import { NewBookingModal } from "@/components/admin/NewBookingModal";
import { ToastProvider } from "@/components/admin/toast";
import { useAdminT } from "@/components/admin/strings";
import { RatesPanel } from "@/components/admin/RatesPanel";
import { RequestsPanel } from "@/components/admin/RequestsPanel";
import { ChaletsPanel } from "@/components/admin/ChaletsPanel";
import { NewsPanel } from "@/components/admin/NewsPanel";
import { SettingsPanel } from "@/components/admin/SettingsPanel";
import { OccasionsPanel } from "@/components/admin/OccasionsPanel";
import { ActivityPanel } from "@/components/admin/ActivityPanel";

const TABS = [
  "overview",
  "requests",
  "availability",
  "rates",
  "occasions",
  "chalets",
  "news",
  "settings",
  "activity",
] as const;
type Tab = (typeof TABS)[number];

/**
 * The open tab is in the address, so each tab is a history entry: Back from
 * Requests returns to the Overview it was opened from rather than leaving the
 * dashboard for whatever page came before it, and a reload stays where it
 * was. The overview is the default and is left out of the address.
 */
export const Route = createFileRoute("/admin/$lang")({
  component: Admin,
  beforeLoad: requireLang,
  // q is a search for the requests list, so the calendar can open a booking.
  validateSearch: (s: Record<string, unknown>): { tab?: Tab; q?: string } => {
    const tab = TABS.includes(s.tab as Tab) && s.tab !== "overview" ? (s.tab as Tab) : undefined;
    const q =
      tab === "requests" && typeof s.q === "string" && s.q.trim() ? s.q.slice(0, 80) : undefined;
    return { ...(tab ? { tab } : {}), ...(q ? { q } : {}) };
  },
});

function Admin() {
  const { session, loading } = useAuth();
  const { data: isAdmin, isLoading: checking } = useIsAdmin(!!session);

  if (loading) return <Splash />;
  if (!session) return <SignIn />;
  if (checking) return <Splash />;
  if (!isAdmin) return <NotAuthorised />;
  return <Dashboard />;
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <img src={logoWhite} alt="Bizarri" className="h-12 w-auto animate-pulse" />
    </div>
  );
}

function SignIn() {
  const { tr, lang } = useI18n();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="absolute end-5 top-5 flex items-center gap-2">
        <LangToggle />
        <Link
          to="/$lang"
          params={{ lang }}
          aria-label={tr("close")}
          className="flex min-h-11 items-center border border-white/20 p-2.5 text-white/70 transition-colors hover:border-white/60 hover:text-white"
        >
          <X className="h-5 w-5" />
        </Link>
      </div>

      <form onSubmit={submit} className="animate-fade-up w-full max-w-sm">
        <img src={logoWhite} alt="Bizarri" className="mx-auto mb-10 h-14 w-auto" />
        <p className="mb-2 text-center text-xs uppercase tracking-[0.4em] text-white/40">
          {tr("admin")}
        </p>
        <h1 className="mb-8 text-center font-display text-3xl">{tr("login")}</h1>

        <label className="block">
          <span className="text-xs uppercase tracking-widest text-white/60">{tr("email")}</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            className="mt-2 w-full border border-white/20 bg-white/5 px-4 py-3 outline-none focus:border-white"
            autoFocus
          />
        </label>

        <label className="mt-5 block">
          <span className="text-xs uppercase tracking-widest text-white/60">{tr("password")}</span>
          <div className="relative mt-2">
            <Lock className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
              className="w-full border border-white/20 bg-white/5 py-3 pe-4 ps-10 outline-none focus:border-white"
            />
          </div>
        </label>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-8 w-full bg-white py-4 text-sm uppercase tracking-widest text-black hover:bg-white/90 disabled:opacity-50"
        >
          {busy ? (lang === "en" ? "Signing in…" : "جارٍ الدخول…") : tr("login")}
        </button>
      </form>
    </div>
  );
}

/**
 * The site header's toggle is not on these screens, so without this the admin
 * panel is a one-way door into whichever language you arrived in. It navigates
 * like every other language switch: same page, other language.
 */
function LangToggle({ className = "" }: { className?: string }) {
  const { tr, lang, setLang } = useI18n();
  return (
    <button
      onClick={() => setLang(lang === "en" ? "ar" : "en")}
      lang={lang === "en" ? "ar" : "en"}
      className={`flex min-h-11 items-center gap-2 border border-white/25 px-3 text-xs uppercase tracking-widest transition-colors hover:bg-white hover:text-black ${className}`}
    >
      <Globe className="h-3.5 w-3.5" />
      {tr("language")}
    </button>
  );
}

function NotAuthorised() {
  const { tr, lang } = useI18n();
  const { signOut, session } = useAuth();
  const email = session?.user?.email ?? "";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black px-6 text-center text-white">
      <img src={logoWhite} alt="Bizarri" className="h-12 w-auto" />
      <p className="max-w-sm text-white/70">
        {lang === "en"
          ? "This account does not have chalet management access."
          : "هذا الحساب لا يملك صلاحية إدارة الشاليه."}
      </p>
      {/* Which account was refused. Signing in with the wrong one of two
          addresses looks identical to not being an admin at all, and the
          owner cannot tell them apart without this. It is the reader's own
          address, so it discloses nothing they do not already know. */}
      {email && (
        <p className="font-mono text-sm text-white/40" dir="ltr">
          {email}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <LangToggle className="px-6" />
        <Link
          to="/$lang"
          params={{ lang }}
          className="border border-white/30 px-6 py-3 text-sm uppercase tracking-widest hover:bg-white hover:text-black"
        >
          {tr("backToSite")}
        </Link>
        <button
          onClick={signOut}
          className="border border-white/30 px-6 py-3 text-sm uppercase tracking-widest hover:bg-white hover:text-black"
        >
          {lang === "en" ? "Sign out" : "تسجيل الخروج"}
        </button>
      </div>
    </div>
  );
}

function Dashboard() {
  const { tr, lang } = useI18n();
  const t = useAdminT();
  const { session, signOut } = useAuth();
  const { data: bookings } = useBookings(true);
  const search = Route.useSearch();
  const tab: Tab = search.tab ?? "overview";
  const navigate = Route.useNavigate();
  const setTab = (next: Tab, q?: string) => {
    if (next !== tab || q !== search.q)
      navigate({ search: next === "overview" ? {} : { tab: next, ...(q ? { q } : {}) } });
  };
  const [chaletId, setChaletId] = useState(1);
  const [newBooking, setNewBooking] = useState<Partial<BookingPrefill> | null>(null);
  const pending = (bookings ?? []).filter((b) => b.status === "pending").length;

  // On a phone the tabs are a strip that scrolls sideways; keep the open one
  // in view, or arriving on Settings leaves its own tab off the edge.
  const navRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    navRef.current
      ?.querySelector<HTMLElement>('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tab]);

  const tabs: { key: Tab; label: string; icon: LucideIcon }[] = [
    { key: "overview", label: tr("overview"), icon: LayoutDashboard },
    { key: "requests", label: tr("requests"), icon: Inbox },
    { key: "availability", label: tr("availability"), icon: CalendarDays },
    { key: "rates", label: tr("packageRates"), icon: Tags },
    { key: "occasions", label: tr("specialOccasions"), icon: PartyPopper },
    { key: "chalets", label: tr("chaletsMgmt"), icon: Home },
    { key: "news", label: lang === "en" ? "News" : "الأخبار", icon: Newspaper },
    { key: "settings", label: tr("siteSettings"), icon: SettingsIcon },
    { key: "activity", label: tr("activityLog"), icon: History },
  ];

  return (
    <ToastProvider>
      <div className="admin-ui min-h-screen bg-secondary/50">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-black text-white">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-4">
              {/* The logo goes back to the site, as it does everywhere else on
                  it. The labelled link next to it is for anyone who would not
                  think to try the logo. */}
              <Link
                to="/$lang"
                params={{ lang }}
                aria-label={tr("backToSite")}
                className="shrink-0"
              >
                <img src={logoWhite} alt="Bizarri" className="h-8 w-auto" />
              </Link>
              <span className="hidden h-6 w-px bg-white/20 sm:block" aria-hidden="true" />
              <span className="hidden text-sm font-medium text-white/80 sm:inline">
                {tr("dashboard")}
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-3">
              <span
                className="hidden text-xs text-white/50 lg:inline"
                dir="ltr"
                title={t("signedInAs")}
              >
                {session?.user.email}
              </span>
              <LangToggle />
              <Link
                to="/$lang"
                params={{ lang }}
                className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{tr("viewSite")}</span>
                <span className="sr-only sm:hidden">{tr("viewSite")}</span>
              </Link>
              <button
                onClick={signOut}
                className="-me-2 flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{tr("logout")}</span>
                <span className="sr-only sm:hidden">{tr("logout")}</span>
              </button>
            </div>
          </div>
        </header>

        <div className="lg:flex">
          {/* One nav, two shapes: a sidebar on a wide screen, a strip of tabs
              that scrolls sideways on a phone. One set of buttons either way,
              so there is never a hidden twin of each tab. */}
          <nav
            aria-label={t("menu")}
            className="sticky top-16 z-30 border-b border-border bg-background lg:h-[calc(100vh-4rem)] lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-e"
          >
            <div
              ref={navRef}
              className="flex gap-1 overflow-x-auto px-3 py-2 lg:flex-col lg:overflow-visible lg:px-3 lg:py-5"
            >
              {tabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  aria-current={tab === key}
                  className={`flex min-h-10 shrink-0 items-center gap-3 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors ${
                    tab === key
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {label}
                  {key === "requests" && pending > 0 && (
                    <span
                      aria-hidden="true"
                      className={`ms-auto rounded-full px-2 py-0.5 text-xs tabular-nums ${
                        tab === key ? "bg-background/20" : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {pending}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </nav>

          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
            <div className="mx-auto max-w-6xl">
              {tab === "overview" && (
                <OverviewPanel
                  onNewBooking={() => setNewBooking({})}
                  onOpenTab={(x) => setTab(x)}
                />
              )}
              {tab === "requests" && (
                <RequestsPanel
                  key={search.q ?? ""}
                  initialQuery={search.q ?? ""}
                  onNewBooking={() => setNewBooking({})}
                />
              )}
              {tab === "availability" && (
                <AvailabilityPanel
                  chaletId={chaletId}
                  onChaletChange={setChaletId}
                  onNewBooking={(prefill) => setNewBooking(prefill)}
                  onOpenBooking={(ref) => setTab("requests", ref)}
                />
              )}
              {tab === "rates" && <RatesPanel />}
              {tab === "occasions" && <OccasionsPanel />}
              {tab === "chalets" && <ChaletsPanel />}
              {tab === "news" && <NewsPanel />}
              {tab === "settings" && <SettingsPanel />}
              {tab === "activity" && <ActivityPanel />}
            </div>
          </main>
        </div>

        {newBooking && (
          <NewBookingModal
            prefill={{ chaletId, ...newBooking }}
            onClose={() => setNewBooking(null)}
          />
        )}
      </div>
    </ToastProvider>
  );
}
