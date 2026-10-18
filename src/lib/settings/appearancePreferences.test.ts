import test from "node:test";
import assert from "node:assert/strict";
import {
  readAppearancePreferences,
  persistAppearancePreferences,
  normalizeThemeMode,
  normalizeAccentColor,
  toInternalAuroraStyle,
  toExternalBgStyle,
  CALDRA_THEME_MODE_KEY,
  CALDRA_ACCENT_COLOR_KEY,
  CALDRA_BG_STYLE_KEY,
  CALDRA_SETTINGS_KEY,
  CALDRA_PLAN_KEY,
  CALDRA_OFFICIAL_BLUE,
  type StorageLike,
} from "./appearancePreferences.ts";

function createMockStorage(initial: Record<string, string> = {}): StorageLike {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  };
}

test("Critério 1: Primeiro acesso sem preferências inicia nativamente em Claro, Azul e Padrão (Free)", () => {
  const storage = createMockStorage(); // Vazio
  const prefs = readAppearancePreferences(storage, false /* isPro = false */);

  assert.equal(prefs.theme, "light", "Tema padrão deve ser 'light'");
  assert.equal(prefs.accent, "blue", "Cor de destaque padrão deve ser 'blue'");
  assert.equal(prefs.auroraStyle, "padrao", "Estilo de fundo deve ser 'padrao' para free");
  assert.equal(prefs.isProViolation, false);
});

test("Critério 1 (PRO): Primeiro acesso sem preferências com conta PRO inicia nativamente em Claro, Azul e Fluido", () => {
  const storage = createMockStorage({ [CALDRA_PLAN_KEY]: "pro" });
  const prefs = readAppearancePreferences(storage, true /* isPro = true */);

  assert.equal(prefs.theme, "light", "Tema padrão deve ser 'light'");
  assert.equal(prefs.accent, "blue", "Cor de destaque padrão deve ser 'blue'");
  assert.equal(prefs.auroraStyle, "fluido", "Estilo de fundo deve ser 'fluido' para PRO");
  assert.equal(prefs.isProViolation, false);
});

test("Critério 2: Persistência de alterações manuais no localStorage", () => {
  const storage = createMockStorage();

  persistAppearancePreferences(storage, {
    theme: "dark",
    accent: "blue",
    auroraStyle: "padrao",
  });

  assert.equal(storage.getItem(CALDRA_THEME_MODE_KEY), "dark");
  assert.equal(storage.getItem(CALDRA_ACCENT_COLOR_KEY), CALDRA_OFFICIAL_BLUE);
  assert.equal(storage.getItem(CALDRA_BG_STYLE_KEY), "default");

  // Reabre e relê do armazenamento
  const reloaded = readAppearancePreferences(storage, false);
  assert.equal(reloaded.theme, "dark");
  assert.equal(reloaded.accent, "blue");
  assert.equal(reloaded.auroraStyle, "padrao");
});

test("Critério 3: Validação de Segurança para o Estilo Fluido em contas Não-PRO", () => {
  // Usuário não-pro tenta forçar "fluid" no localStorage
  const storage = createMockStorage({
    [CALDRA_THEME_MODE_KEY]: "light",
    [CALDRA_ACCENT_COLOR_KEY]: "#0066FF",
    [CALDRA_BG_STYLE_KEY]: "fluid",
    [CALDRA_PLAN_KEY]: "free",
  });

  const prefs = readAppearancePreferences(storage, false /* isPro = false */);

  assert.equal(prefs.auroraStyle, "padrao", "Deve reverter automaticamente para 'padrao'");
  assert.equal(prefs.isProViolation, true, "Deve sinalizar violação de permissão PRO");
  assert.equal(storage.getItem(CALDRA_BG_STYLE_KEY), "default", "Deve corrigir a chave no storage");
});

test("Normalização de cores e formatos aceita aliases amigáveis e hexadecimais", () => {
  assert.equal(normalizeAccentColor("#0066FF"), "blue");
  assert.equal(normalizeAccentColor("#00CCFF"), "blue");
  assert.equal(normalizeAccentColor("blue"), "blue");
  assert.equal(normalizeAccentColor("#F59E0B"), "amber");
  assert.equal(normalizeAccentColor("amber"), "amber");
  assert.equal(normalizeAccentColor("#B22222"), "crimson");
  assert.equal(normalizeAccentColor("magenta"), "crimson");

  assert.equal(toInternalAuroraStyle("fluid"), "fluido");
  assert.equal(toInternalAuroraStyle("fluido"), "fluido");
  assert.equal(toInternalAuroraStyle("default"), "padrao");
  assert.equal(toInternalAuroraStyle("padrao"), "padrao");
  assert.equal(toExternalBgStyle("fluido"), "fluid");
  assert.equal(toExternalBgStyle("padrao"), "default");
});
