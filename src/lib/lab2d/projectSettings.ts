/**
 * Gerenciamento de configurações do projeto e experiência CAD do CHAMFER.
 * Permite configurar salvamento automático, intervalos, unidades e preferências
 * antes da inicialização do workspace de modelagem.
 */

export type ChamferSettings = {
  /** Salvamento automático ativo ou manual */
  autoSave: boolean;
  /** Intervalo de salvamento automático em segundos */
  autoSaveIntervalSec: number;
  /** Recuperação de desastre e restauração de sessão */
  recoveryEnabled: boolean;
  /** Unidade métrica padrão */
  unit: "mm" | "cm" | "pol";
  /** Preferência de exibição visual */
  viewPreference: "technical" | "solid" | "wireframe";
  /** Exibir grade CAD ao inicializar */
  showGridOnLoad: boolean;
  /** Snap magnético ativo ao inicializar */
  snapOnLoad: boolean;
  /** Precisão de cotagem (casas decimais) */
  dimPrecision: number;
};

export const DEFAULT_CHAMFER_SETTINGS: ChamferSettings = {
  autoSave: true,
  autoSaveIntervalSec: 30,
  recoveryEnabled: true,
  unit: "mm",
  viewPreference: "technical",
  showGridOnLoad: true,
  snapOnLoad: true,
  dimPrecision: 1,
};

const GLOBAL_STORAGE_KEY = "caldra.chamfer.global_settings";
const PROJECT_STORAGE_PREFIX = "caldra.chamfer.project_settings:";

export function getChamferSettings(projectId?: string): ChamferSettings {
  try {
    let raw: string | null = null;
    if (projectId) {
      raw = window.localStorage.getItem(`${PROJECT_STORAGE_PREFIX}${projectId}`);
    }
    if (!raw) {
      raw = window.localStorage.getItem(GLOBAL_STORAGE_KEY);
    }
    if (!raw) return { ...DEFAULT_CHAMFER_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CHAMFER_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_CHAMFER_SETTINGS };
  }
}

export function saveChamferSettings(
  settings: Partial<ChamferSettings>,
  projectId?: string,
): ChamferSettings {
  try {
    const current = getChamferSettings(projectId);
    const updated: ChamferSettings = {
      ...current,
      ...settings,
    };
    if (projectId) {
      window.localStorage.setItem(
        `${PROJECT_STORAGE_PREFIX}${projectId}`,
        JSON.stringify(updated),
      );
    } else {
      window.localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(updated));
    }
    // Dispara evento para sincronizar instâncias ativas
    window.dispatchEvent(
      new CustomEvent("chamfer-settings-changed", {
        detail: { projectId, settings: updated },
      }),
    );
    return updated;
  } catch {
    return { ...DEFAULT_CHAMFER_SETTINGS, ...settings };
  }
}
