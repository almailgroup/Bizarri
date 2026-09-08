import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, LogOut, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/lib/api";
import logoWhite from "@/assets/bizarri-logo-white.png";
import { OverviewPanel } from "@/components/admin/OverviewPanel";
import { AvailabilityPanel } from "@/components/admin/AvailabilityPanel";
import { RatesPanel } from "@/components/admin/RatesPanel";
import { RequestsPanel } from "@/components/admin/RequestsPanel";
import { ChaletsPanel } from "@/components/admin/ChaletsPanel";
import { NewsPanel } from "@/components/admin/NewsPanel";
import { SettingsPanel } from "@/components/admin/SettingsPanel";
import { ActivityPanel } from "@/components/admin/ActivityPanel";
import { useChalets } from "@/lib/api";

export const Route = createFileRoute("/admin")({ component: Admin });

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
      <img src={logoWhite} alt="Bizarri" className="h-10 w-auto animate-pulse" />
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
      <Link
        to="/"
        aria-label={tr("close")}
        className="absolute end-5 top-5 border border-white/20 p-2.5 text-white/70 transition-colors hover:border-white/60 hover:text-white"
      >
        <X className="h-5 w-5" />
      </Link>

      <form onSubmit={submit} className="animate-fade-up w-full max-w-sm">
        <img src={logoWhite} alt="Bizarri" className="mx-auto mb-10 h-12 w-auto" />
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

function NotAuthorised() {
  const { lang } = useI18n();
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black px-6 text-center text-white">
      <img src={logoWhite} alt="Bizarri" className="h-10 w-auto" />
      <p className="max-w-sm text-white/70">
        {lang === "en"
          ? "This account does not have chalet management access."
          : "هذا الحساب لا يملك صلاحية إدارة الشاليه."}
      </p>
      <button
        onClick={signOut}
        className="border border-white/30 px-6 py-3 text-sm uppercase tracking-widest hover:bg-white hover:text-black"
      >
        {lang === "en" ? "Sign out" : "تسجيل الخروج"}
      </button>
    </div>
  );
}

type Tab =
  "overview" | "requests" | "availability" | "rates" | "chalets" | "news" | "settings" | "activity";

function Dashboard() {
  const { tr, lang } = useI18n();
  const { session, signOut } = useAuth();
  const { data: chalets } = useChalets();
  const [tab, setTab] = useState<Tab>("overview");
  const [chaletId, setChaletId] = useState(1);

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: tr("overview") },
    { key: "requests", label: tr("requests") },
    { key: "availability", label: tr("availability") },
    { key: "rates", label: tr("packageRates") },
    { key: "chalets", label: tr("chaletsMgmt") },
    { key: "news", label: lang === "en" ? "News" : "الأخبار" },
    { key: "settings", label: tr("siteSettings") },
    { key: "activity", label: tr("activityLog") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-black text-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-4">
            <img src={logoWhite} alt="Bizarri" className="h-8 w-auto" />
            <span className="hidden text-xs uppercase tracking-[0.4em] text-white/60 sm:inline">
              {tr("dashboard")}
            </span>
          </div>
          <div className="flex items-center gap-5">
            <span className="hidden text-xs text-white/50 md:inline" dir="ltr">
              {session?.user.email}
            </span>
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-xs uppercase tracking-widest hover:text-white/70"
            >
              <LogOut className="h-4 w-4" /> {tr("logout")}
            </button>
          </div>
        </div>
      </header>

      <nav className="border-b border-border bg-secondary">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key}
              className={`whitespace-nowrap border-b-2 px-4 py-4 text-xs uppercase tracking-widest transition-colors ${
                tab === t.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {tab === "availability" && (
        <div className="border-b border-border bg-secondary/60">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-6 py-3">
            <span className="me-2 text-xs uppercase tracking-widest text-muted-foreground">
              {tr("pickChalet")}
            </span>
            {(chalets ?? []).map((c) => (
              <button
                key={c.id}
                onClick={() => setChaletId(c.id)}
                aria-pressed={chaletId === c.id}
                className={`px-4 py-2 text-xs uppercase tracking-widest transition-colors ${
                  chaletId === c.id
                    ? "bg-foreground text-background"
                    : "border border-border hover:bg-background"
                }`}
              >
                {lang === "en" ? c.name_en : c.name_ar}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-6 py-12">
        {tab === "overview" && <OverviewPanel />}
        {tab === "requests" && <RequestsPanel />}
        {tab === "availability" && <AvailabilityPanel chaletId={chaletId} />}
        {tab === "rates" && <RatesPanel />}
        {tab === "chalets" && <ChaletsPanel />}
        {tab === "news" && <NewsPanel />}
        {tab === "settings" && <SettingsPanel />}
        {tab === "activity" && <ActivityPanel />}
      </main>
    </div>
  );
}
