import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Supabase Auth session.
 *
 * This replaces the previous client-side password check, which shipped the
 * password in the JS bundle and could be bypassed by setting a sessionStorage
 * flag. Being signed in is now necessary but not sufficient: every admin action
 * is additionally gated server-side by RLS, which tests membership of the
 * `admins` table. A non-admin who signs in sees nothing.
 */
interface AuthValue {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        userIdRef.current = data.session?.user.id ?? null;
        setSession(data.session);
      })
      .catch(() => {
        /* offline or misconfigured — treat as signed out */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      // Drop every cached query when the identity changes. Otherwise the
      // is_admin answer and the previous admin's booking list — guest names,
      // phones and emails — survive sign-out into the next session. Keyed on
      // the user id so routine token refreshes do not clear the cache.
      const nextId = next?.user.id ?? null;
      if (nextId !== userIdRef.current) {
        userIdRef.current = nextId;
        queryClient.clear();
      }
      setSession(next);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw new Error(error.message);
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
