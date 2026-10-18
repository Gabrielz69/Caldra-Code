/**
 * SESSÃO — a conta é OPCIONAL. O CALDRA funciona 100% offline sem login;
 * a conta serve para carregar o plano entre aparelhos, resgatar código de
 * ativação e permitir a exclusão de conta exigida pela loja.
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

type AuthValue = {
  session: Session | null;
  user: User | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  signUp: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ ok: boolean; message: string }>;
  signInWithGoogle: () => Promise<{ ok: boolean; message: string }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthValue | null>(null);

const humanize = (message: string): string => {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("already registered"))
    return "Este e-mail já tem conta. Entre em vez de cadastrar.";
  if (m.includes("password")) return "A senha precisa de ao menos 6 caracteres.";
  if (m.includes("email")) return "Verifique o e-mail informado.";
  return message;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data: got }) => {
      setSession(got.session);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      ready,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        return error
          ? { ok: false, message: humanize(error.message) }
          : { ok: true, message: "Bem-vindo de volta." };
      },
      signUp: async (email, password, name) => {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name.trim() },
          },
        });
        return error
          ? { ok: false, message: humanize(error.message) }
          : { ok: true, message: "Conta criada. Confira seu e-mail se a confirmação for pedida." };
      },
      signInWithGoogle: async () => {
        const result = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin,
        });
        if (result.error) return { ok: false, message: "Não foi possível entrar com o Google." };
        return { ok: true, message: "" };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
