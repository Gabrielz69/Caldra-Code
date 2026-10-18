/**
 * CALDRA CHAMFER — ÁREA DE TRANSFERÊNCIA GLOBAL (GLOBAL CLIPBOARD)
 *
 * Persistência unânime no localStorage entre todos os projetos do CHAMFER:
 *  - Chave unificada: "chamfer_cad_clipboard_v1" (com suporte a fallback);
 *  - Validade automática de 24 horas para itens não fixados;
 *  - Itens com isPinned: true NUNCA expiram e permanecem no topo da lista;
 *  - Miniatura gráfica vetorial (SVG preview) integrada;
 *  - Armazena formas relativas ao centro (0, 0) com suporte a peças agrupadas e cotas;
 *  - Permite colar instantaneamente em qualquer coordenada do mundo no canvas.
 */

import type { Dimension, Entity } from "./core";
import { bbox, dist, translate, uid } from "./core";
import type { GroupDef } from "./groups";

export const GLOBAL_CLIPBOARD_STORAGE_KEY = "chamfer_cad_clipboard_v1";
export const LEGACY_CLIPBOARD_STORAGE_KEY = "CHAMFER_GLOBAL_CLIPBOARD_V1";
export const CLIPBOARD_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 horas

export interface GlobalClipboardItem {
  id: string;
  title: string;
  entities: Entity[]; // geometrias com coordenadas relativas a (0, 0)
  groups?: GroupDef[];
  dims?: Dimension[];
  width: number;
  height: number;
  timestamp: number; // Date.now() de quando foi copiado
  createdAt: number;
  expiresAt: number;
  isPinned: boolean;
  previewSvg?: string; // string SVG completa para renderização vetorial
}

/**
 * Gera uma miniatura vetorial SVG precisa para o recorte.
 */
export function generateSvgPreview(
  entities: Entity[],
  width: number,
  height: number,
): string {
  const pad = Math.max(width, height) * 0.2 || 6;
  const minX = -width / 2 - pad;
  const minY = -height / 2 - pad;
  const vbW = Math.max(1, width + pad * 2);
  const vbH = Math.max(1, height + pad * 2);
  const sw = Math.max(0.7, Math.max(vbW, vbH) * 0.025);

  let elements = "";
  for (const e of entities) {
    if (e.type === "line") {
      elements += `<line x1="${e.x1.toFixed(2)}" y1="${e.y1.toFixed(2)}" x2="${e.x2.toFixed(2)}" y2="${e.y2.toFixed(2)}" stroke="#00E5FF" stroke-width="${sw.toFixed(2)}" stroke-linecap="round" />`;
    } else if (e.type === "circle") {
      elements += `<circle cx="${e.cx.toFixed(2)}" cy="${e.cy.toFixed(2)}" r="${e.r.toFixed(2)}" fill="rgba(0,229,255,0.06)" stroke="#00E5FF" stroke-width="${sw.toFixed(2)}" />`;
    } else if (e.type === "arc") {
      const startX = e.cx + e.r * Math.cos(e.startAngle);
      const startY = e.cy + e.r * Math.sin(e.startAngle);
      const endX = e.cx + e.r * Math.cos(e.endAngle);
      const endY = e.cy + e.r * Math.sin(e.endAngle);
      let diff = e.endAngle - e.startAngle;
      while (diff < 0) diff += Math.PI * 2;
      const largeArc = diff > Math.PI ? 1 : 0;
      elements += `<path d="M ${startX.toFixed(2)} ${startY.toFixed(2)} A ${e.r.toFixed(2)} ${e.r.toFixed(2)} 0 ${largeArc} 1 ${endX.toFixed(2)} ${endY.toFixed(2)}" fill="none" stroke="#00E5FF" stroke-width="${sw.toFixed(2)}" stroke-linecap="round" />`;
    } else if (e.type === "polyline") {
      const ptsStr = e.pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
      if (e.closed) {
        elements += `<polygon points="${ptsStr}" fill="rgba(0,229,255,0.08)" stroke="#00E5FF" stroke-width="${sw.toFixed(2)}" stroke-linejoin="round" />`;
      } else {
        elements += `<polyline points="${ptsStr}" fill="none" stroke="#00E5FF" stroke-width="${sw.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" />`;
      }
    } else if (e.type === "ellipse") {
      elements += `<ellipse cx="${e.cx.toFixed(2)}" cy="${e.cy.toFixed(2)}" rx="${e.rx.toFixed(2)}" ry="${e.ry.toFixed(2)}" fill="rgba(0,229,255,0.06)" stroke="#00E5FF" stroke-width="${sw.toFixed(2)}" />`;
    } else if (e.type === "text") {
      elements += `<text x="${e.x.toFixed(2)}" y="${e.y.toFixed(2)}" fill="#00E5FF" font-size="${e.size || 10}" text-anchor="middle">${e.text}</text>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX.toFixed(2)} ${minY.toFixed(2)} ${vbW.toFixed(2)} ${vbH.toFixed(2)}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${elements}</svg>`;
}

/**
 * Carrega todos os itens da Área de Transferência Global,
 * executando a limpeza automática de itens não fixados com mais de 24h.
 * Retorna os itens ordenados com fixados no topo.
 */
export function loadGlobalClipboard(): GlobalClipboardItem[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    let raw = localStorage.getItem(GLOBAL_CLIPBOARD_STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_CLIPBOARD_STORAGE_KEY);
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GlobalClipboardItem[];
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    // Itens fixados nunca expiram. Itens não fixados expiram após 24h do momento em que foram copiados.
    const valid = parsed.filter((item) => {
      if (item.isPinned) return true;
      const itemTime = item.timestamp ?? item.createdAt ?? 0;
      return now - itemTime < CLIPBOARD_EXPIRATION_MS && (item.expiresAt ? now < item.expiresAt : true);
    });

    // Garante que campos obrigatórios existam e gera previewSvg se faltar
    const normalized = valid.map((it) => {
      const ts = it.timestamp ?? it.createdAt ?? now;
      const preview = it.previewSvg || generateSvgPreview(it.entities, it.width, it.height);
      return {
        ...it,
        timestamp: ts,
        createdAt: it.createdAt ?? ts,
        expiresAt: it.expiresAt ?? ts + CLIPBOARD_EXPIRATION_MS,
        previewSvg: preview,
      };
    });

    // Ordenação: Itens fixados no topo (mais recentes primeiro), seguidos pelos não-fixados (mais recentes primeiro)
    normalized.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.timestamp ?? b.createdAt) - (a.timestamp ?? a.createdAt);
    });

    if (valid.length !== parsed.length) {
      saveGlobalClipboard(normalized);
    }
    return normalized;
  } catch (err) {
    console.warn("[GlobalClipboard] Erro ao carregar área de transferência:", err);
    return [];
  }
}

/**
 * Salva a lista de itens na chave global unificada do localStorage.
 */
export function saveGlobalClipboard(items: GlobalClipboardItem[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(GLOBAL_CLIPBOARD_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("chamfer:clipboard-updated"));
  } catch (err) {
    console.warn("[GlobalClipboard] Erro ao salvar área de transferência:", err);
  }
}

/**
 * Gera um título descritivo automático para as peças copiadas.
 */
function generateClipboardTitle(
  entities: Entity[],
  groups?: GroupDef[],
): string {
  if (entities.length === 0) return "Forma Vazia";
  if (entities.length === 1) {
    const e = entities[0];
    switch (e.type) {
      case "circle":
        return `Círculo Ø${(e.r * 2).toFixed(1)} mm`;
      case "arc":
        return `Arco R${e.r.toFixed(1)} mm`;
      case "line":
        return `Linha (${dist({ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }).toFixed(1)} mm)`;
      case "polyline":
        return e.closed
          ? `Polígono Fechado (${e.pts.length} lados)`
          : `Polilinha (${e.pts.length} pts)`;
      case "ellipse":
        return `Elipse ${(e.rx * 2).toFixed(0)}×${(e.ry * 2).toFixed(0)} mm`;
      case "text":
        return `Texto: "${e.text.slice(0, 15)}"`;
      default:
        return "Geometria CAD";
    }
  }

  // Verifica se é um grupo nomeado
  const firstGid = entities.find((e) => e.group)?.group;
  if (firstGid && groups) {
    const gdef = groups.find((g) => g.id === firstGid);
    if (gdef) return `${gdef.name} (${entities.length} peças)`;
    return `Peça Agrupada (${entities.length} formas)`;
  }

  const types = new Set(entities.map((e) => e.type));
  if (types.has("circle") && types.has("polyline")) {
    return `Peça com Furações (${entities.length} itens)`;
  }
  return `Seleção Mista (${entities.length} formas)`;
}

/**
 * Copia uma seleção de entidades para a Área de Transferência Global.
 * As coordenadas são normalizadas para o centro geométrico (0, 0).
 */
export function copyToGlobalClipboard(
  allEntities: Entity[],
  selectedIds: string[],
  allGroups: GroupDef[] = [],
  allDims: Dimension[] = [],
): GlobalClipboardItem | null {
  if (!selectedIds.length) return null;
  const selected = allEntities.filter((e) => selectedIds.includes(e.id));
  if (!selected.length) return null;

  // Calcula Bounding Box e Centro
  const b = bbox(selected);
  const cx = Number.isFinite(b.minX) ? (b.minX + b.maxX) / 2 : 0;
  const cy = Number.isFinite(b.minY) ? (b.minY + b.maxY) / 2 : 0;
  const width = Math.max(0.1, b.maxX - b.minX);
  const height = Math.max(0.1, b.maxY - b.minY);

  // Normaliza entidades relativas a (0, 0)
  const normalizedEntities: Entity[] = selected.map((e) => {
    const cloned: Entity = JSON.parse(JSON.stringify(e));
    return translate(cloned, -cx, -cy);
  });

  // Identifica grupos presentes na seleção
  const relevantGroupIds = new Set(
    selected.map((e) => e.group).filter(Boolean) as string[],
  );
  const relevantGroups = allGroups.filter((g) => relevantGroupIds.has(g.id));

  // Identifica cotas vinculadas exclusivamente à seleção
  const relevantDims = (Array.isArray(allDims) ? allDims : [])
    .filter(
      (d) =>
        Array.isArray(d?.refs) &&
        d.refs.some((r) => r.kind === "entity" && selectedIds.includes(r.id)),
    )
    .map((d) => JSON.parse(JSON.stringify(d)) as Dimension);

  const now = Date.now();
  const previewSvg = generateSvgPreview(normalizedEntities, width, height);

  const newItem: GlobalClipboardItem = {
    id: uid(),
    title: generateClipboardTitle(selected, relevantGroups),
    entities: normalizedEntities,
    groups: relevantGroups,
    dims: relevantDims,
    width,
    height,
    timestamp: now,
    createdAt: now,
    expiresAt: now + CLIPBOARD_EXPIRATION_MS,
    isPinned: false,
    previewSvg,
  };

  const existing = loadGlobalClipboard();
  // Insere no topo da lista (limite de 60 itens para manter performance)
  const updated = [newItem, ...existing.filter((it) => it.id !== newItem.id)].slice(0, 60);
  saveGlobalClipboard(updated);
  return newItem;
}

/**
 * Alterna o estado de fixação (📌) de um item.
 * Itens fixados não expiram. Ao desafixar, reinicia contagem de 24h.
 */
export function togglePinClipboardItem(itemId: string): GlobalClipboardItem[] {
  const items = loadGlobalClipboard();
  const now = Date.now();
  const updated = items.map((item) => {
    if (item.id !== itemId) return item;
    const nextPinned = !item.isPinned;
    return {
      ...item,
      isPinned: nextPinned,
      // Se acabou de desafixar, reinicia a contagem de 24h a partir de agora
      expiresAt: nextPinned ? item.expiresAt : now + CLIPBOARD_EXPIRATION_MS,
      timestamp: nextPinned ? item.timestamp : now,
    };
  });
  // Ordena com fixados no topo
  updated.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return (b.timestamp ?? b.createdAt) - (a.timestamp ?? a.createdAt);
  });
  saveGlobalClipboard(updated);
  return updated;
}

/**
 * Exclui um item da Área de Transferência.
 */
export function deleteClipboardItem(itemId: string): GlobalClipboardItem[] {
  const items = loadGlobalClipboard();
  const updated = items.filter((it) => it.id !== itemId);
  saveGlobalClipboard(updated);
  return updated;
}

/**
 * Limpa todos os itens não fixados.
 */
export function clearUnpinnedClipboard(): GlobalClipboardItem[] {
  const items = loadGlobalClipboard();
  const updated = items.filter((it) => it.isPinned);
  saveGlobalClipboard(updated);
  return updated;
}

/**
 * Instancia uma cópia das formas do item da Área de Transferência
 * centradas exatamente na coordenada `targetWorld` fornecida.
 * Gera novos identificadores únicos (IDs) para todas as entidades e grupos.
 */
export function instantiateClipboardItemAt(
  item: GlobalClipboardItem,
  targetWorld: { x: number; y: number },
  currentGroups: GroupDef[] = [],
): {
  newEntities: Entity[];
  newGroups: GroupDef[];
  newIds: string[];
} {
  // Mapa de IDs antigos para novos IDs para preservar integridade de grupos e referências
  const idMap = new Map<string, string>();
  item.entities.forEach((e) => {
    idMap.set(e.id, uid());
  });

  // Mapeia grupos para novos IDs de grupo
  const groupIdMap = new Map<string, string>();
  const createdGroups: GroupDef[] = [];
  if (item.groups && item.groups.length > 0) {
    item.groups.forEach((g) => {
      const nextGid = uid();
      groupIdMap.set(g.id, nextGid);
      createdGroups.push({
        id: nextGid,
        name: g.name,
      });
    });
  }

  // Translada de (0, 0) para o alvo desejado no canvas
  const newEntities: Entity[] = item.entities.map((e) => {
    const newId = idMap.get(e.id) || uid();
    const cloned: Entity = JSON.parse(JSON.stringify(e));
    const translated = translate(cloned, targetWorld.x, targetWorld.y);
    translated.id = newId;

    if (translated.group && groupIdMap.has(translated.group)) {
      translated.group = groupIdMap.get(translated.group);
    }
    return translated;
  });

  return {
    newEntities,
    newGroups: [...currentGroups, ...createdGroups],
    newIds: newEntities.map((e) => e.id),
  };
}

/**
 * Formata o tempo decorrido desde a cópia.
 */
export function formatRelativeTime(timestamp: number): string {
  const diff = Math.max(0, Date.now() - timestamp);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 45) return "Copiado agora";
  const mins = Math.floor(diff / (60 * 1000));
  if (mins < 60) return `Copiado há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Copiado há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Copiado há ${days}d`;
}

/**
 * Formata o tempo restante de validade de um item não fixado (24h).
 */
export function formatTimeRemaining(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "Expirando em instantes";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 1) {
    return `Expira em ${hours}h ${minutes}m`;
  }
  return `Expira em ${minutes}m`;
}
