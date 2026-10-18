/**
 * LXDS ANALYSIS MODE — leitura e inspeção de arquivos .lxds do CypCut.
 *
 * O LXDS é um CONTÊINER ZIP com partes XML e blobs binários. Este módulo
 * SÓ LÊ e apresenta o que está declarado em XML. As partes binárias
 * (Shapes2D/data.bin, Geometry2D/data.bin) NÃO são reconstruídas nem
 * interpretadas por tentativa e erro: apenas o endereço e o tamanho são
 * registrados.
 *
 * LXDS ≠ DXF. O DXF é intercâmbio geométrico; o LXDS é o projeto do
 * ecossistema CypCut (geometria + parâmetros de processo). Nada aqui
 * escreve LXDS — é referência técnica e QA.
 */

export type LxdsPart = { name: string; size: number; compressed: boolean };

export type LxdsLayer = { handle: string; name: string; flag: string; color: string };

export type LxdsShape = {
  handle: string;
  klass: string;
  layer: string;
  dataAddr: string;
  geoAddr: string;
};

export type LxdsAnalysis = {
  app: string;
  appVersion: string;
  savedAt: string;
  docType: string;
  handleSeed: string;
  docId: string;
  extents: { minX: number; minY: number; maxX: number; maxY: number } | null;
  layers: LxdsLayer[];
  shapes: LxdsShape[];
  parts: LxdsPart[];
  /** Blocos de parâmetro técnico presentes em Technical/content.xml. */
  technicalBlocks: string[];
  /** Poucos parâmetros de processo, só para leitura humana. */
  technicalHighlights: { key: string; value: string }[];
  md5: { part: string; value: string }[];
  warnings: string[];
};

/* --------------------------------------------------------------- ZIP puro */

const dv = (b: ArrayBuffer) => new DataView(b);

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream })
    .DecompressionStream;
  if (!DS) throw new Error("Este navegador não descomprime partes DEFLATE do LXDS.");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DS("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Lê o diretório central do ZIP — sem dependências externas. */
export async function readZip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const v = dv(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= 0 && i > buf.byteLength - 66000; i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Arquivo não é um contêiner ZIP válido (LXDS esperado).");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  const dec = new TextDecoder();

  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const cmtLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    p += 46 + nameLen + extraLen + cmtLen;

    const lNameLen = v.getUint16(local + 26, true);
    const lExtraLen = v.getUint16(local + 28, true);
    const start = local + 30 + lNameLen + lExtraLen;
    const raw = new Uint8Array(buf, start, csize);
    if (!name.endsWith("/")) out.set(name, method === 0 ? raw : await inflateRaw(raw));
  }
  return out;
}

/* ------------------------------------------------------------------- XML */

const parse = (text: string) =>
  new DOMParser().parseFromString(text, "application/xml").documentElement;

const attr = (el: Element | null | undefined, name: string) => el?.getAttribute(name) ?? "";

/* -------------------------------------------------------------- análise */

const TECH_KEYS = [
  "WorkSpeed",
  "CutGap",
  "MicroLen",
  "LiftHeight",
  "SlowLeadSpeed",
  "SlowEndSpeed",
  "ArcTolerance",
  "CornerTolerance",
];

export async function analyzeLxds(buf: ArrayBuffer): Promise<LxdsAnalysis> {
  const files = await readZip(buf);
  const dec = new TextDecoder();
  const text = (n: string) => {
    const f = files.get(n);
    return f ? dec.decode(f) : "";
  };
  const warnings: string[] = [];

  const info = text("info.xml") ? parse(text("info.xml")) : null;
  const root = text("content.xml") ? parse(text("content.xml")) : null;
  const model = text("Model2D/content.xml") ? parse(text("Model2D/content.xml")) : null;
  const layersXml = text("Layers/content.xml") ? parse(text("Layers/content.xml")) : null;
  const shapesXml = text("Shapes2D/content.xml") ? parse(text("Shapes2D/content.xml")) : null;
  const techXml = text("Technical/content.xml") ? parse(text("Technical/content.xml")) : null;

  if (!root) warnings.push("content.xml ausente — contêiner incompleto.");
  if (!shapesXml) warnings.push("Shapes2D/content.xml ausente — sem índice de entidades.");

  const app = info?.querySelector("Application");
  const saved = info?.querySelector("SavedBy");

  const min = model?.querySelector("ExtMin");
  const max = model?.querySelector("ExtMax");
  const extents =
    min && max
      ? {
          minX: Number(attr(min, "X")),
          minY: Number(attr(min, "Y")),
          maxX: Number(attr(max, "X")),
          maxY: Number(attr(max, "Y")),
        }
      : null;

  const layers: LxdsLayer[] = [...(layersXml?.querySelectorAll("Layer") ?? [])].map((l) => ({
    handle: attr(l, "Handle"),
    name: attr(l, "Name"),
    flag: attr(l, "LayerFlag"),
    color: attr(l, "Color"),
  }));

  const shapes: LxdsShape[] = [...(shapesXml?.children ?? [])]
    .filter((c) => c.tagName !== "MD5")
    .map((s) => ({
      handle: attr(s, "Handle"),
      klass: s.tagName,
      layer: attr(s, "LayerName"),
      dataAddr: attr(s, "DataAddr"),
      geoAddr: attr(s, "GeoAddr"),
    }));

  const technicalBlocks = techXml
    ? [...new Set([...techXml.querySelectorAll("*")].map((e) => e.tagName))].sort()
    : [];

  const technicalHighlights: { key: string; value: string }[] = [];
  if (techXml) {
    const cam = techXml.querySelector("CamParams");
    const cut = techXml.querySelector("LayerCutParams");
    for (const k of TECH_KEYS) {
      const v = attr(cam, k) || attr(cut, k);
      if (v) technicalHighlights.push({ key: k, value: v });
    }
  }

  const md5: { part: string; value: string }[] = [];
  for (const part of ["Shapes2D", "Geometry2D"]) {
    const x = text(`${part}/content.xml`);
    const m = x && parse(x).querySelector("MD5")?.textContent;
    if (m) md5.push({ part, value: m });
  }

  const parts: LxdsPart[] = [...files.entries()].map(([name, data]) => ({
    name,
    size: data.byteLength,
    compressed: false,
  }));

  const declaredLayers = new Set(layers.map((l) => l.name));
  for (const s of shapes)
    if (s.layer && !declaredLayers.has(s.layer))
      warnings.push(`Entidade ${s.handle} referencia layer não declarada: ${s.layer}.`);

  return {
    app: attr(app, "AppName") || "?",
    appVersion: attr(app, "AppVer") || "?",
    savedAt: attr(saved, "SaveTime") || "?",
    docType: attr(root, "DocType") || "?",
    handleSeed: attr(root?.querySelector("Header") ?? null, "HandleSeed"),
    docId: attr(root?.querySelector("Header") ?? null, "ID"),
    extents,
    layers,
    shapes,
    parts,
    technicalBlocks,
    technicalHighlights,
    md5,
    warnings,
  };
}

/** Tamanho da peça em mm segundo as extensões declaradas no Model2D. */
export const lxdsSize = (a: LxdsAnalysis) =>
  a.extents ? { w: a.extents.maxX - a.extents.minX, h: a.extents.maxY - a.extents.minY } : null;
