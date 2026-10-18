import type { WireParams } from "@/lib/viz3d/wire";

/** Primitivas 2D em milímetros para as vistas ortográficas. */
export type Prim =
  | { k: "poly"; pts: [number, number][]; closed?: boolean; fill?: boolean; dash?: boolean }
  | { k: "circle"; cx: number; cy: number; r: number; dash?: boolean; fill?: boolean }
  | { k: "rect"; x: number; y: number; w: number; h: number; dash?: boolean; fill?: boolean };

export type OrthoViews = {
  /** Vista frontal: origem no centro da base, Y para cima (mm). */
  front: Prim[];
  /** Planta: origem no centro, Y = profundidade (mm). */
  plan: Prim[];
  /** Cotas exibidas: chave do parâmetro + rótulo. */
  dims: { key: keyof WireParams; label: string }[];
};

const rect = (w: number, h: number, cx = 0, cy = 0, dash = false, fill = true): Prim => ({
  k: "rect",
  x: cx - w / 2,
  y: cy - h / 2,
  w,
  h,
  dash,
  fill,
});

const trapezoid = (wb: number, wt: number, h: number, off = 0, fill = true): Prim => ({
  k: "poly",
  pts: [
    [-wb / 2, 0],
    [wb / 2, 0],
    [wt / 2 + off, h],
    [-wt / 2 + off, h],
  ],
  closed: true,
  fill,
});

/** Constrói vista frontal + planta coerentes com a geometria de cada peça. */
export function buildViews(slug: string, p: WireParams): OrthoViews {
  const d1 = p.d1;
  const d2 = p.d2;
  const h = p.h;
  const e = p.e ?? 0;
  const r1 = d1 / 2;
  const r2 = d2 / 2;

  const dimsFull: OrthoViews["dims"] = [
    { key: "d1", label: "Ø/A base" },
    { key: "d2", label: "Ø/A topo" },
    { key: "h", label: "H altura" },
  ];
  const withE: OrthoViews["dims"] = [...dimsFull, { key: "e", label: "E offset" }];

  const circPlan = (r: number, cx = 0, cy = 0, dash = false, fill = true): Prim => ({
    k: "circle",
    cx,
    cy,
    r,
    dash,
    fill,
  });

  switch (slug) {
    case "cilindro":
    case "dutos":
      return {
        front: [rect(d1, h, 0, h / 2)],
        plan: [circPlan(r1), circPlan(Math.max(r1 - d1 * 0.03, 1), 0, 0, true, false)],
        dims: [
          { key: "d1", label: "Ø base" },
          { key: "h", label: "H altura" },
        ],
      };

    case "cone":
      return {
        front: [trapezoid(d1, 0, h)],
        plan: [circPlan(r1), circPlan(r1 * 0.06, 0, 0, true, false)],
        dims: [
          { key: "d1", label: "Ø base" },
          { key: "h", label: "H altura" },
        ],
      };

    case "tronco-de-cone":
    case "reducao-circular":
      return {
        front: [trapezoid(d1, d2, h)],
        plan: [circPlan(r1), circPlan(r2, 0, 0, true, false)],
        dims: dimsFull,
      };

    case "cone-excentrico":
      return {
        front: [trapezoid(d1, d2, h, e || r1 - r2)],
        plan: [circPlan(r1), circPlan(r2, e || r1 - r2, 0, true, false)],
        dims: withE,
      };

    case "quadrado-redondo":
      return {
        front: [trapezoid(d1, d2, h, e)],
        plan: [rect(d1, d1), circPlan(r2, e, 0, true, false)],
        dims: withE,
      };

    case "redondo-quadrado":
    case "transicoes":
      return {
        front: [trapezoid(d1, d2, h, e)],
        plan: [circPlan(r1), rect(d2, d2, e, 0, true, false)],
        dims: withE,
      };

    case "boca-de-lobo":
      return {
        front: [
          {
            k: "poly",
            pts: [
              [-r1, 0],
              [r1, 0],
              [r1, h],
              [-r1, h * 0.35],
            ],
            closed: true,
            fill: true,
          },
        ],
        plan: [circPlan(r1)],
        dims: [
          { key: "d1", label: "Ø tubo" },
          { key: "h", label: "H maior" },
        ],
      };

    case "te":
    case "interseccoes":
      return {
        front: [
          rect(d1, h, 0, h / 2),
          rect(h * 0.45, d2, d1 / 2 + (h * 0.45) / 2, h / 2, false, true),
        ],
        plan: [circPlan(r1), rect(h * 0.45, d2, d1 / 2 + (h * 0.45) / 2, 0, true, false)],
        dims: dimsFull,
      };

    case "y":
      return {
        front: [
          rect(d1, h * 0.45, 0, (h * 0.45) / 2),
          trapezoid(d1, d2 * 2.2, h * 0.55, 0, false),
          {
            k: "poly",
            pts: [
              [-r1 * 0.8 - r2, h],
              [-r1 * 0.8 - r2, h * 0.45],
            ],
            closed: false,
          },
          {
            k: "poly",
            pts: [
              [r1 * 0.8 + r2, h],
              [r1 * 0.8 + r2, h * 0.45],
            ],
            closed: false,
          },
        ],
        plan: [
          circPlan(r1),
          circPlan(r2, -r1 * 0.8, 0, true, false),
          circPlan(r2, r1 * 0.8, 0, true, false),
        ],
        dims: dimsFull,
      };

    case "curva-de-gomos": {
      const R = d1;
      const pts: [number, number][] = [];
      const inner: [number, number][] = [];
      const gomos = 5;
      for (let i = 0; i <= gomos; i++) {
        const a = (i / gomos) * (Math.PI / 2);
        pts.push([(R + r2) * Math.sin(a), (R + r2) * (1 - Math.cos(a))]);
        inner.unshift([(R - r2) * Math.sin(a), (R - r2) * (1 - Math.cos(a)) + 2 * r2]);
      }
      return {
        front: [{ k: "poly", pts: [...pts, ...inner], closed: true, fill: true }],
        plan: [circPlan(r2, 0, 0), circPlan(r2, R, 0, true, false)],
        dims: [
          { key: "d1", label: "R curva" },
          { key: "d2", label: "Ø tubo" },
        ],
      };
    }

    case "flanges":
      return {
        front: [rect(d1, h * 0.12, 0, (h * 0.12) / 2)],
        plan: [
          circPlan(r1),
          circPlan(r2, 0, 0, true, false),
          ...Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            const cx = ((r1 + r2) / 2) * Math.cos(a);
            const cy = ((r1 + r2) / 2) * Math.sin(a);
            return circPlan(r1 * 0.08, cx, cy, false, false);
          }),
        ],
        dims: [
          { key: "d1", label: "Ø externo" },
          { key: "d2", label: "Ø furo" },
        ],
      };

    case "tampas":
      return {
        front: [rect(d1, h * 0.15, 0, (h * 0.15) / 2), rect(d1 * 0.98, h * 0.04, 0, h * 0.17)],
        plan: [circPlan(r1), circPlan(r1 * 0.94, 0, 0, true, false)],
        dims: [
          { key: "d1", label: "Ø tampa" },
          { key: "h", label: "H aba" },
        ],
      };

    case "calotas": {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 24; i++) {
        const a = Math.PI - (i / 24) * Math.PI;
        pts.push([r1 * Math.cos(a), h * Math.sin(a)]);
      }
      return {
        front: [{ k: "poly", pts, closed: true, fill: true }],
        plan: [circPlan(r1), circPlan(r1 * 0.55, 0, 0, true, false)],
        dims: [
          { key: "d1", label: "Ø base" },
          { key: "h", label: "H calota" },
        ],
      };
    }

    case "chamines":
      return {
        front: [
          trapezoid(d1, d1 * 0.85, h / 2),
          {
            k: "poly",
            pts: [
              [-(d1 * 0.85) / 2, h / 2],
              [(d1 * 0.85) / 2, h / 2],
              [d2 / 2, h],
              [-d2 / 2, h],
            ],
            closed: true,
            fill: true,
          },
        ],
        plan: [circPlan(r1), circPlan(r2, 0, 0, true, false)],
        dims: dimsFull,
      };

    default:
      return {
        front: [trapezoid(d1, d2, h, e)],
        plan: [circPlan(r1), circPlan(r2, e, 0, true, false)],
        dims: withE,
      };
  }
}
