import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter } from "@tanstack/react-router";

import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { PageShell } from "@/components/PageShell";
import { IntroLoader } from "@/components/IntroLoader";

function NotFoundComponent() {
  const { tr, lang } = useI18n();
  return (
    <PageShell>
      <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
        <p className="font-display text-8xl">404</p>
        <h1 className="mt-6 font-display text-3xl md:text-4xl">
          {lang === "en" ? "This page doesn't exist" : "هذه الصفحة غير موجودة"}
        </h1>
        <p className="mt-4 text-muted-foreground">
          {lang === "en"
            ? "The link may be out of date. Try one of these instead."
            : "قد يكون الرابط قديماً. جرّب أحد هذه الروابط."}
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="bg-black px-8 py-4 text-sm uppercase tracking-widest text-white hover:opacity-90"
          >
            {tr("home")}
          </Link>
          <Link
            to="/booking"
            className="border border-border px-8 py-4 text-sm uppercase tracking-widest hover:bg-secondary"
          >
            {tr("bookNow")}
          </Link>
          <Link
            to="/contact"
            className="border border-border px-8 py-4 text-sm uppercase tracking-widest hover:bg-secondary"
          >
            {tr("contact")}
          </Link>
        </div>
      </section>
    </PageShell>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  // Deliberately free of app context: this renders when something below has
  // already failed, so it reads the language off the document instead.
  const ar = typeof document !== "undefined" && document.documentElement.lang === "ar";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-3xl">{ar ? "حدث خطأ ما" : "Something went wrong"}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="bg-black px-6 py-3 text-sm uppercase tracking-widest text-white hover:opacity-90"
          >
            {ar ? "إعادة المحاولة" : "Try again"}
          </button>
          <a
            href={import.meta.env.BASE_URL}
            className="border border-border px-6 py-3 text-sm uppercase tracking-widest hover:bg-secondary"
          >
            {ar ? "الرئيسية" : "Go home"}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <I18nProvider>
          <IntroLoader />
          <Outlet />
        </I18nProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
