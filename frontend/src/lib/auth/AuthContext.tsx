import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getMe } from "../api/endpoints";
import type { Me } from "../api/types";
import { supabase } from "./supabase";

interface AuthState {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  verifySignupOtp: (email: string, token: string) => Promise<void>;
  resendSignupOtp: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) queryClient.clear();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    // Only identity data is sent. There is no role field: roles live in the API database.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: displayName ? { display_name: displayName } : undefined },
    });
    if (error) throw new Error(error.message);
    return { needsConfirmation: data.session === null };
  }, []);

  const verifySignupOtp = useCallback(async (email: string, token: string) => {
    // On success Supabase returns a session; onAuthStateChange picks it up.
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
    if (error) throw new Error(error.message);
  }, []);

  const resendSignupOtp = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ session, loading, signIn, signUp, signOut, verifySignupOtp, resendSignupOtp }),
    [session, loading, signIn, signUp, signOut, verifySignupOtp, resendSignupOtp],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Role comes from the API (/me). Used only to shape navigation; the API enforces permissions. */
export function useMe(): { me: Me | undefined; isLoading: boolean } {
  const { session } = useAuth();
  const q = useQuery({ queryKey: ["me", session?.user.id], queryFn: getMe, enabled: !!session, staleTime: 60_000 });
  return { me: q.data, isLoading: q.isLoading };
}
