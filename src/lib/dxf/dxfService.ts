/**
 * dxfService — SERIALIZADOR/PARSER DXF ÚNICO DO CALDRA.
 *
 * Este é o único lugar do projeto que escreve bytes de DXF. Todo caminho de
 * exportação (Exportar → DXF, perfis Técnico/Produção/CypCut) termina aqui,
 * através de `src/lib/dxf/exportService.ts`.
 *
 * Estrutura emitida: HEADER, TABLES (LTYPE, LAYER, APPID), ENTITIES, EOF,
 * com handles, marcadores de subclasse (AcDbEntity/AcDbLine/...) e dados
 * estendidos (XDATA) por entidade.
 *
 * A versão declarada no $ACADVER acompanha SEMPRE as entidades realmente
 * emitidas: LWPOLYLINE/SPLINE/XDATA exigem formato moderno (AC1018/R2004).
 */

export type DxfPoint = { x: number; y: number };

/** Par bruto de dados estendidos (XDATA) dentro de um APPID. */
export type DxfXdataPair = { code: number; value: string | number };

/** Bloco XDATA de uma entidade: aplicativo + pares na ordem de escrita. */
export type DxfXdata = { appId: string; pairs: DxfXdataPair[] };

type WithMeta = { xdata?: DxfXdata[] };

export type DxfEntity =
  | ({ type: "LINE"; layer: string; start: DxfPoint; end: DxfPoint } & WithMeta)
  | ({ type: "LWPOLYLINE"; layer: string; points: DxfPoint[]; closed: boolean } & WithMeta)
  | ({ type: "CIRCLE"; layer: string; center: DxfPoint; radius: number } & WithMeta)
  | ({
      type: "ARC";
      layer: string;
      center: DxfPoint;
      radius: number;
      startAngle: number;
      endAngle: number;
    } & WithMeta)
  | ({
      /** Spline cúbica em forma de Bézier por partes. */
      type: "SPLINE";
      layer: string;
      /** 3n+1 pontos de controle. */
      controls: DxfPoint[];
      closed: boolean;
    } & WithMeta);

export type DxfLayer = { name: string; color: number; trueColor?: number };

export type DxfDocument = {
  layers: DxfLayer[];
  entities: DxfEntity[];
  /** APPIDs declarados na tabela (além dos usados pelas entidades). */
  appIds?: string[];
};

const g = (code: number, value: string | number) => `${code}\n${value}\n`;

const SUBCLASS: Record<DxfEntity["type"], string[]> = {
  LINE: ["AcDbLine"],
  LWPOLYLINE: ["AcDbPolyline"],
  CIRCLE: ["AcDbCircle"],
  ARC: ["AcDbCircle", "AcDbArc"],
  SPLINE: ["AcDbSpline"],
};

function writeXdata(e: DxfEntity): string {
  let out = "";
  for (const block of e.xdata ?? []) {
    out += g(1001, block.appId);
    for (const p of block.pairs) out += g(p.code, p.value);
  }
  return out;
}

function writeBody(e: DxfEntity): string {
  switch (e.type) {
    case "LINE":
      return (
        g(10, e.start.x.toFixed(4)) +
        g(20, e.start.y.toFixed(4)) +
        g(30, "0.0") +
        g(11, e.end.x.toFixed(4)) +
        g(21, e.end.y.toFixed(4)) +
        g(31, "0.0")
      );
    case "LWPOLYLINE":
      return (
        g(90, e.points.length) +
        g(70, e.closed ? 1 : 0) +
        e.points.map((p) => g(10, p.x.toFixed(4)) + g(20, p.y.toFixed(4))).join("")
      );
    case "CIRCLE":
      return (
        g(10, e.center.x.toFixed(4)) +
        g(20, e.center.y.toFixed(4)) +
        g(30, "0.0") +
        g(40, e.radius.toFixed(4))
      );
    case "ARC":
      return (
        g(10, e.center.x.toFixed(4)) +
        g(20, e.center.y.toFixed(4)) +
        g(30, "0.0") +
        g(40, e.radius.toFixed(4)) +
        // o marcador AcDbArc separa raio/centro dos ângulos
        g(100, "AcDbArc") +
        g(50, e.startAngle.toFixed(4)) +
        g(51, e.endAngle.toFixed(4))
      );
    case "SPLINE": {
      const n = Math.max(1, Math.floor((e.controls.length - 1) / 3));
      // nós de Bézier por partes: 0,0,0,0, 1,1,1, ..., n,n,n,n
      const knots: number[] = [0, 0, 0, 0];
      for (let i = 1; i < n; i++) knots.push(i, i, i);
      knots.push(n, n, n, n);
      return (
        g(210, "0.0") +
        g(220, "0.0") +
        g(230, "1.0") +
        g(70, 8 + (e.closed ? 1 : 0)) + // 8 = planar, 1 = fechada
        g(71, 3) +
        g(72, knots.length) +
        g(73, e.controls.length) +
        g(74, 0) +
        knots.map((k) => g(40, k.toFixed(4))).join("") +
        e.controls.map((p) => g(10, p.x.toFixed(4)) + g(20, p.y.toFixed(4)) + g(30, "0.0")).join("")
      );
    }
  }
}

function writeEntity(e: DxfEntity, handle: string): string {
  const subclasses = SUBCLASS[e.type];
  let out = g(0, e.type) + g(5, handle) + g(100, "AcDbEntity") + g(8, e.layer);
  // ARC escreve o segundo marcador no meio do corpo
  out += g(100, subclasses[0]!);
  out += writeBody(e);
  out += writeXdata(e);
  return out;
}

/**
 * Versão DXF compatível com as entidades realmente emitidas.
 * LWPOLYLINE, SPLINE e XDATA exigem formato moderno; declaramos AC1018
 * (R2004), estável e aceito por CAM/CypCut. R12 (AC1009) só permanece
 * para arquivos com LINE/CIRCLE/ARC puros e sem dados estendidos.
 */
export function dxfVersionFor(doc: DxfDocument): "AC1018" | "AC1009" {
  const modern = doc.entities.some(
    (e) => e.type === "LWPOLYLINE" || e.type === "SPLINE" || (e.xdata?.length ?? 0) > 0,
  );
  return modern || (doc.appIds?.length ?? 0) > 0 ? "AC1018" : "AC1009";
}

/** APPIDs realmente necessários: os declarados no documento + os usados. */
export function appIdsOf(doc: DxfDocument): string[] {
  const ids = new Set<string>(["ACAD", ...(doc.appIds ?? [])]);
  for (const e of doc.entities) for (const x of e.xdata ?? []) ids.add(x.appId);
  return [...ids];
}

export function exportDxf(doc: DxfDocument): string {
  const layers = doc.layers.length ? doc.layers : [{ name: "0", color: 7 }];
  const appIds = appIdsOf(doc);
  let handle = 0x100;
  const next = () => (++handle).toString(16).toUpperCase();

  let out = "";
  out += g(0, "SECTION") + g(2, "HEADER");
  out += g(9, "$ACADVER") + g(1, dxfVersionFor(doc));
  out += g(9, "$INSUNITS") + g(70, 4); // 4 = milímetros
  out += g(9, "$MEASUREMENT") + g(70, 1); // 1 = métrico
  out += g(9, "$LUNITS") + g(70, 2);
  out += g(0, "ENDSEC");

  out += g(0, "SECTION") + g(2, "TABLES");

  // LTYPE — CONTINUOUS é o tipo de linha referenciado por todas as layers
  out += g(0, "TABLE") + g(2, "LTYPE") + g(5, next()) + g(100, "AcDbSymbolTable") + g(70, 1);
  out +=
    g(0, "LTYPE") +
    g(5, next()) +
    g(100, "AcDbSymbolTableRecord") +
    g(100, "AcDbLinetypeTableRecord") +
    g(2, "CONTINUOUS") +
    g(70, 0) +
    g(3, "Solid line") +
    g(72, 65) +
    g(73, 0) +
    g(40, "0.0");
  out += g(0, "ENDTAB");

  out +=
    g(0, "TABLE") + g(2, "LAYER") + g(5, next()) + g(100, "AcDbSymbolTable") + g(70, layers.length);
  for (const l of layers) {
    out +=
      g(0, "LAYER") +
      g(5, next()) +
      g(100, "AcDbSymbolTableRecord") +
      g(100, "AcDbLayerTableRecord") +
      g(2, l.name) +
      g(70, 0) +
      g(62, l.color) +
      g(6, "CONTINUOUS");
    // cor técnica real (AutoCAD true color) — preserva a convenção visual do CHAMFER
    if (l.trueColor !== undefined) out += g(420, l.trueColor);
  }
  out += g(0, "ENDTAB");

  // APPID — sem o registro do aplicativo o XDATA é descartado na leitura
  out +=
    g(0, "TABLE") + g(2, "APPID") + g(5, next()) + g(100, "AcDbSymbolTable") + g(70, appIds.length);
  for (const id of appIds) {
    out +=
      g(0, "APPID") +
      g(5, next()) +
      g(100, "AcDbSymbolTableRecord") +
      g(100, "AcDbRegAppTableRecord") +
      g(2, id) +
      g(70, 0);
  }
  out += g(0, "ENDTAB") + g(0, "ENDSEC");

  out += g(0, "SECTION") + g(2, "ENTITIES");
  for (const e of doc.entities) out += writeEntity(e, next());
  out += g(0, "ENDSEC") + g(0, "EOF");
  return out;
}

type Pair = { code: number; value: string };

function tokenize(text: string): Pair[] {
  const lines = text.split(/\r\n|\r|\n/);
  const pairs: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number((lines[i] ?? "").trim());
    if (Number.isNaN(code)) continue;
    pairs.push({ code, value: lines[i + 1] ?? "" });
  }
  return pairs;
}

export function importDxf(text: string): DxfDocument {
  const pairs = tokenize(text);
  const entities: DxfEntity[] = [];
  const layers = new Map<string, DxfLayer>();

  let inEntities = false;
  let current: { type: string; data: Map<number, string[]> } | null = null;

  const flush = () => {
    if (!current) return;
    const d = current.data;
    const num = (c: number, idx = 0, fallback = 0) => {
      const v = d.get(c)?.[idx];
      return v === undefined ? fallback : Number(v);
    };
    const layer = d.get(8)?.[0] ?? "0";
    if (!layers.has(layer)) layers.set(layer, { name: layer, color: 7 });

    switch (current.type) {
      case "LINE":
        entities.push({
          type: "LINE",
          layer,
          start: { x: num(10), y: num(20) },
          end: { x: num(11), y: num(21) },
        });
        break;
      case "CIRCLE":
        entities.push({
          type: "CIRCLE",
          layer,
          center: { x: num(10), y: num(20) },
          radius: num(40),
        });
        break;
      case "ARC":
        entities.push({
          type: "ARC",
          layer,
          center: { x: num(10), y: num(20) },
          radius: num(40),
          startAngle: num(50),
          endAngle: num(51),
        });
        break;
      case "LWPOLYLINE":
      case "POLYLINE": {
        const xs = d.get(10) ?? [];
        const ys = d.get(20) ?? [];
        const points = xs.map((x, i) => ({ x: Number(x), y: Number(ys[i] ?? 0) }));
        if (points.length >= 2) {
          entities.push({
            type: "LWPOLYLINE",
            layer,
            points,
            closed: (num(70) & 1) === 1,
          });
        }
        break;
      }
      case "SPLINE": {
        const xs = d.get(10) ?? [];
        const ys = d.get(20) ?? [];
        const controls = xs.map((x, i) => ({ x: Number(x), y: Number(ys[i] ?? 0) }));
        if (controls.length >= 4)
          entities.push({ type: "SPLINE", layer, controls, closed: (num(70) & 1) === 1 });
        break;
      }
      default:
        break; // TEXT, INSERT: suporte futuro
    }
    current = null;
  };

  const SUPPORTED = ["LINE", "CIRCLE", "ARC", "LWPOLYLINE", "POLYLINE", "SPLINE"];

  for (let i = 0; i < pairs.length; i++) {
    const { code, value } = pairs[i]!;
    const v = value.trim();
    if (code === 0 && v === "SECTION") {
      const next = pairs[i + 1];
      inEntities = next?.code === 2 && next.value.trim() === "ENTITIES";
      continue;
    }
    if (code === 0 && v === "ENDSEC") {
      flush();
      inEntities = false;
      continue;
    }
    if (!inEntities) continue;

    if (code === 0) {
      flush();
      if (v === "VERTEX") continue; // vértices agregam na polilinha anterior
      if (SUPPORTED.includes(v)) current = { type: v, data: new Map() };
      continue;
    }
    if (current) {
      const arr = current.data.get(code) ?? [];
      arr.push(v);
      current.data.set(code, arr);
    }
  }
  flush();

  return { layers: [...layers.values()], entities };
}

export function downloadDxf(doc: DxfDocument, filename: string) {
  const blob = new Blob([exportDxf(doc)], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".dxf") ? filename : `${filename}.dxf`;
  a.click();
  URL.revokeObjectURL(url);
}
