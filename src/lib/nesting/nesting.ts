/**
 * NESTING — MODO CHAPA (funções puras).
 *
 * Aninhamento por retângulo envolvente (bounding box) com algoritmo de
 * prateleiras (shelf / first-fit decreasing), rotação opcional de 90°,
 * folga entre peças e margem de borda. Nada aqui depende de UI.
 *
 * A abordagem por bbox é conservadora de propósito: nunca promete
 * aproveitamento que a máquina não consegue entregar.
 */

export type NestPart = {
  id: string;
  name: string;
  /** Extensão real da peça em mm. */
  w: number;
  h: number;
  quantity: number;
  /** Peças com veio/direção de laminação não podem girar. */
  allowRotate?: boolean;
};

export type NestOptions = {
  sheetW: number;
  sheetH: number;
  /** Folga entre peças (kerf + segurança) em mm. */
  gap: number;
  /** Margem morta da borda da chapa em mm. */
  margin: number;
  /** Permite girar 90° quando a peça não proíbe. */
  rotate: boolean;
};

export type Placement = {
  partId: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  index: number;
};

export type NestedSheet = {
  placements: Placement[];
  /** Área útil ocupada pelas peças (mm²). */
  usedMm2: number;
  /** Altura da última prateleira usada (mm) — indica a sobra aproveitável. */
  usedHeight: number;
};

export type NestResult = {
  sheets: NestedSheet[];
  sheetW: number;
  sheetH: number;
  /** Total de peças posicionadas. */
  placed: number;
  /** Peças que não cabem em nenhuma chapa (mesmo girando). */
  rejected: { name: string; w: number; h: number; quantity: number }[];
  /** Aproveitamento médio (0–1) sobre todas as chapas usadas. */
  utilization: number;
  /** Sobra total em mm² e em m². */
  scrapMm2: number;
  totalAreaMm2: number;
};

const EPS = 1e-9;

type Shelf = { y: number; h: number; cursorX: number };

/** Aninha as peças. Determinístico: a mesma entrada devolve o mesmo plano. */
export function nestParts(parts: NestPart[], opts: NestOptions): NestResult {
  const { sheetW, sheetH, gap, margin, rotate } = opts;
  const usableW = sheetW - margin * 2;
  const usableH = sheetH - margin * 2;

  const rejected: NestResult["rejected"] = [];
  const queue: { part: NestPart; index: number }[] = [];

  for (const p of parts) {
    const fitsDirect = p.w <= usableW + EPS && p.h <= usableH + EPS;
    const canRotate = rotate && p.allowRotate !== false;
    const fitsRotated = canRotate && p.h <= usableW + EPS && p.w <= usableH + EPS;
    if (!fitsDirect && !fitsRotated) {
      rejected.push({ name: p.name, w: p.w, h: p.h, quantity: Math.max(1, p.quantity) });
      continue;
    }
    for (let i = 0; i < Math.max(1, Math.round(p.quantity)); i++)
      queue.push({ part: p, index: i + 1 });
  }

  // maior primeiro: reduz buracos entre prateleiras
  queue.sort((a, b) => {
    const ah = Math.max(a.part.w, a.part.h);
    const bh = Math.max(b.part.w, b.part.h);
    if (Math.abs(bh - ah) > EPS) return bh - ah;
    return b.part.w * b.part.h - a.part.w * a.part.h;
  });

  const sheets: NestedSheet[] = [];
  const shelvesPerSheet: Shelf[][] = [];

  const openSheet = () => {
    sheets.push({ placements: [], usedMm2: 0, usedHeight: 0 });
    shelvesPerSheet.push([]);
    return sheets.length - 1;
  };

  for (const item of queue) {
    const p = item.part;
    const canRotate = rotate && p.allowRotate !== false;
    let done = false;

    for (let s = 0; s < sheets.length && !done; s++) {
      done = tryPlace(s, p, item.index, canRotate);
    }
    if (!done) {
      const s = openSheet();
      done = tryPlace(s, p, item.index, canRotate);
      if (!done) rejected.push({ name: p.name, w: p.w, h: p.h, quantity: 1 });
    }
  }

  function tryPlace(sheetIndex: number, p: NestPart, index: number, canRotate: boolean): boolean {
    const shelves = shelvesPerSheet[sheetIndex]!;
    const sheet = sheets[sheetIndex]!;

    const options: { w: number; h: number; rotated: boolean }[] = [
      { w: p.w, h: p.h, rotated: false },
    ];
    if (canRotate && Math.abs(p.w - p.h) > EPS) options.push({ w: p.h, h: p.w, rotated: true });

    // 1) tenta encaixar numa prateleira existente (menor desperdício de altura)
    let best: { shelf: Shelf; opt: (typeof options)[number]; waste: number } | null = null;
    for (const shelf of shelves) {
      for (const opt of options) {
        const needX = shelf.cursorX + (shelf.cursorX > margin ? gap : 0) + opt.w;
        if (needX > margin + usableW + EPS) continue;
        if (opt.h > shelf.h + EPS) continue;
        const waste = shelf.h - opt.h;
        if (!best || waste < best.waste) best = { shelf, opt, waste };
      }
    }
    if (best) {
      const { shelf, opt } = best;
      const x = shelf.cursorX + (shelf.cursorX > margin ? gap : 0);
      sheet.placements.push({
        partId: p.id,
        name: p.name,
        x,
        y: shelf.y,
        w: opt.w,
        h: opt.h,
        rotated: opt.rotated,
        index,
      });
      shelf.cursorX = x + opt.w;
      sheet.usedMm2 += opt.w * opt.h;
      sheet.usedHeight = Math.max(sheet.usedHeight, shelf.y + shelf.h - margin);
      return true;
    }

    // 2) abre uma nova prateleira
    const top = shelves.length
      ? shelves[shelves.length - 1]!.y + shelves[shelves.length - 1]!.h + gap
      : margin;
    for (const opt of options) {
      if (opt.w > usableW + EPS) continue;
      if (top + opt.h > margin + usableH + EPS) continue;
      const shelf: Shelf = { y: top, h: opt.h, cursorX: margin };
      shelves.push(shelf);
      sheet.placements.push({
        partId: p.id,
        name: p.name,
        x: margin,
        y: top,
        w: opt.w,
        h: opt.h,
        rotated: opt.rotated,
        index,
      });
      shelf.cursorX = margin + opt.w;
      sheet.usedMm2 += opt.w * opt.h;
      sheet.usedHeight = Math.max(sheet.usedHeight, top + opt.h - margin);
      return true;
    }
    return false;
  }

  const totalAreaMm2 = sheets.length * sheetW * sheetH;
  const usedMm2 = sheets.reduce((a, s) => a + s.usedMm2, 0);

  return {
    sheets,
    sheetW,
    sheetH,
    placed: sheets.reduce((a, s) => a + s.placements.length, 0),
    rejected: mergeRejected(rejected),
    utilization: totalAreaMm2 > 0 ? usedMm2 / totalAreaMm2 : 0,
    scrapMm2: Math.max(0, totalAreaMm2 - usedMm2),
    totalAreaMm2,
  };
}

function mergeRejected(list: NestResult["rejected"]): NestResult["rejected"] {
  const map = new Map<string, NestResult["rejected"][number]>();
  for (const r of list) {
    const key = `${r.name}|${r.w}|${r.h}`;
    const prev = map.get(key);
    if (prev) prev.quantity += r.quantity;
    else map.set(key, { ...r });
  }
  return [...map.values()];
}

/** Área total consumida em m² — base do custo de material do nesting. */
export const sheetAreaM2 = (result: NestResult) => result.totalAreaMm2 * 1e-6;
