/**
 * CONSENTIMENTO DE USO ANÔNIMO.
 *
 * Exigência de loja: nada de telemetria sem opt-in explícito, e o usuário
 * precisa poder desligar a qualquer momento. Guardamos localmente (funciona
 * offline) e espelhamos no perfil quando há sessão.
 */

import { supabase } from "@/integrations/supabase/client";

const KEY = "caldra.analytics.consent";

export function readConsent(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export async function setConsent(value: boolean): Promise<void> {
  try {
    window.localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    /* armazenamento indisponível */
  }
  try {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from("profiles").upsert({ id: data.user.id, analytics_consent: value });
    }
  } catch {
    /* offline: o valor local basta */
  }
}
