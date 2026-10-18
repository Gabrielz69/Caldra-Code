import type { AppLanguage } from "@/lib/settings/SettingsProvider";

const PT = {
  tracing: "Traçagem",
  studies: "Estudos",
  home: "Início",
  projects: "Projetos",
  more: "Mais",
  calculator: "Calculadora",
  settings: "Configurações",
  profile: "Perfil",
  master: "Modo Mestre",
  library: "Biblioteca",
  history: "Histórico",
  favorites: "Favoritos",
  workshop: "Oficina",
  help: "Ajuda",
  closeMenu: "Fechar menu",
  moreOptions: "Mais opções",
} as const;

type MessageKey = keyof typeof PT;
const MESSAGES: Record<AppLanguage, Partial<Record<MessageKey, string>>> = {
  pt: PT,
  en: {
    tracing: "Layout",
    studies: "Studies",
    home: "Home",
    projects: "Projects",
    more: "More",
    calculator: "Calculator",
    settings: "Settings",
    profile: "Profile",
    master: "Master Mode",
    library: "Library",
    history: "History",
    favorites: "Favorites",
    workshop: "Workshop",
    help: "Help",
    closeMenu: "Close menu",
    moreOptions: "More options",
  },
  es: {
    tracing: "Trazado",
    studies: "Estudios",
    home: "Inicio",
    projects: "Proyectos",
    more: "Más",
    calculator: "Calculadora",
    settings: "Configuración",
    profile: "Perfil",
    master: "Modo Maestro",
    library: "Biblioteca",
    history: "Historial",
    favorites: "Favoritos",
    workshop: "Taller",
    help: "Ayuda",
    closeMenu: "Cerrar menú",
    moreOptions: "Más opciones",
  },
};

export function translate(language: AppLanguage, key: MessageKey): string {
  return MESSAGES[language][key] ?? PT[key];
}
