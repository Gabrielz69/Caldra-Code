/**
 * RENDERER CALDRA — apresentação da geometria paramétrica.
 *
 * Recebe GEOMETRIA (malha + arestas + bounds em mm), nunca parâmetros.
 * Câmera, rotação, zoom e enquadramento vivem aqui; a peça nunca é alterada
 * por interação. Sombreamento por normal real (key + fill + rim), superfície
 * interna com material próprio e espessura visível nas aberturas.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Vec3 } from "@/lib/geometry/types";
import { centerOf, fitRadius, type Camera, type WireModel } from "@/lib/viz3d/wire";
import { FACE_MATERIALS } from "@/lib/viz3d/shading";
import { TECHNICAL_LIGHTING } from "@/lib/viz3d/technicalConfig";
import {
  VISIBILITY_POLICY,
  compareSurfaceDepth,
  deduplicateEdges,
  filterEdgesForMode,
  projectLine,
  toCameraPoint,
  visibleLineSegments,
  type ProjectedTriangle,
  type VisibilityPolicy,
} from "@/lib/viz3d/visibility";
import { entityIndexOf, pickEdgeIndex, pickFaceIndex, refLabel } from "@/lib/viz3d/selection";
import type { GeometryRef } from "@/lib/geometry/refs";
import { cameraForView, type EdgeMode, type ViewPresetId } from "@/lib/viz3d/cameraPresets";
import { cn } from "@/lib/utils";

type Props = {
  model: WireModel;
  className?: string;
  interactive?: boolean;
  autoSpin?: boolean;
  /** Modo de arraste primário: 'orbit' (rotação 3D) ou 'pan' (translação espacial) */
  mode?: "orbit" | "pan";
  /** progresso 0..1 de "abertura" da peça (3D → planificação) */
  unfold?: number;
  /** padrão técnico persistente; oclusão espacial é opt-in */
  lineVisibility?: Extract<VisibilityPolicy, "technical-persistent" | "real-occlusion">;
  /** vista padrão aplicada à câmera (não altera geometria) */
  view?: ViewPresetId;
  /** muda de valor para reenquadrar/reaplicar a vista atual */
  viewNonce?: number;
  /** modo de aresta — apenas apresentação */
  edgeMode?: EdgeMode;
  /** Linhas de referência (eixos pontilhados de centro/geratriz). Default: true, exceto quando edgeMode === 'shaded'. */
  showRefLines?: boolean;
  /**
   * SELEÇÃO (Fase F): resolve o índice de uma aresta/face para a referência
   * canônica de origem. Quando ausente, a peça não é selecionável.
   */
  refForEdge?: ((index: number) => GeometryRef | null) | undefined;
  refForFace?: ((index: number) => GeometryRef | null) | undefined;
  /** Referência(s) destacada(s) (seleção 3D ou foco vindo do 2D/parâmetros). */
  highlightRef?: GeometryRef | readonly GeometryRef[] | null | undefined;
  /** Toque/clique sem arraste sobre entidade mapeável (null = toque no vazio). */
  onSelectRef?: ((ref: GeometryRef | null) => void) | undefined;
};

const VB = 200;

/** Iluminação técnica uniforme baseada na normal física real */
const KEY = TECHNICAL_LIGHTING.keyLight;
const FILL = TECHNICAL_LIGHTING.fillLight;
const MAT = FACE_MATERIALS;

export function Wire3D({
  model,
  className,
  interactive = false,
  autoSpin = false,
  mode = "orbit",
  unfold = 0,
  lineVisibility = "technical-persistent",
  view,
  viewNonce = 0,
  edgeMode = "shaded-edges",
  showRefLines,
  refForEdge,
  refForFace,
  highlightRef = null,
  onSelectRef,
}: Props) {
  const [cam, setCam] = useState<Camera>(() =>
    view ? cameraForView(view) : { yaw: 0.7, pitch: 0.4, zoom: 1, panX: 0, panY: 0 },
  );
  const drag = useRef<{ x: number; y: number } | null>(null);
  const dragMode = useRef<"orbit" | "pan">("orbit");
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const resume = useRef(0);

  /* vista padrão / reenquadramento: só orientação e zoom de fit */
  useEffect(() => {
    if (!view) return;
    setCam(cameraForView(view));
  }, [view, viewNonce]);
  const host = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(true);

  /* pausa automática fora da viewport / aba oculta */
  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((ents) => setVisible(ents[0]?.isIntersecting ?? true), {
      threshold: 0.05,
    });
    io.observe(el);
    const onVis = () => setVisible(!document.hidden && true);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  /* rotação automática 360° contínua (sem salto ao completar a volta) */
  useEffect(() => {
    if (!autoSpin || !visible) return;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      if (!drag.current && t > resume.current)
        setCam((c) => ({ ...c, yaw: (c.yaw + dt * 0.32) % (Math.PI * 2) }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoSpin, visible]);

  useEffect(() => {
    const el = host.current;
    if (!el || !interactive) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const dy = ev.deltaY * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 100 : 1);
      setCam((c) => ({ ...c, zoom: Math.min(4.5, Math.max(0.35, c.zoom * Math.exp(-dy * 0.0015))) }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [interactive]);

  /* enquadramento automático a partir do bounding box real (mm) */
  const fit = useMemo(() => {
    if (!model || !model.bounds) {
      return { center: { x: 0, y: 0, z: 0 }, scale: 1 };
    }
    const c = centerOf(model.bounds);
    const r = fitRadius(model.bounds);
    return { center: c, scale: (VB * 0.4) / (r > 1e-6 ? r : 1) };
  }, [model]);

  const k = 1 - unfold * 0.9;
  const { faces, edges, refs } = useMemo(() => {
    if (!model || !model.faces || !model.bounds) {
      return { faces: [], edges: [], refs: [] };
    }
    const kk = fit.scale * cam.zoom;
    const panX = cam.panX ?? 0;
    const panY = cam.panY ?? 0;
    const cache = new Map<string, Vec3>();
    const cp = (p: Vec3) => {
      const key = `${p.x}|${p.y}|${p.z}`;
      let c = cache.get(key);
      if (!c) {
        c = toCameraPoint(
          { x: p.x - fit.center.x, y: (p.y - fit.center.y) * k, z: p.z - fit.center.z },
          cam,
        );
        cache.set(key, c);
      }
      return c;
    };

    // "polygon offset": prioridade de profundidade por tipo de face, sem
    // mexer em nenhum vértice — apenas política de desenho.
    const BIAS: Record<string, number> = { inner: -0.6, cap: -0.3, rim: 0.3, outer: 0 };
    const span = Math.max(1e-6, fitRadius(model.bounds));

    type Tri = ProjectedTriangle & { d: string; fill: string };
    const f: Tri[] = [];

    model.faces.forEach((face, idx) => {
      const cs = face.pts.map(cp);
      if (cs.length < 3) return;
      // normal real da malha (espaço de modelo), corrigida pela escala de
      // planificação e levada ao espaço de câmera — nunca derivada da tela.
      const mn = face.n ?? { x: 0, y: 1, z: 0 };
      const sy = k > 1e-6 ? 1 / k : 1;
      const nl = Math.hypot(mn.x, mn.y * sy, mn.z) || 1;
      const cn = toCameraPoint({ x: mn.x / nl, y: (mn.y * sy) / nl, z: mn.z / nl }, cam);
      const nx = cn.x;
      const ny = cn.y;
      const nz = cn.z;
      // Visibilidade da superfície interna: regra geométrica determinística.
      // A parede interna só é observável quando sua normal (que aponta para
      // dentro da peça) está voltada ao observador — isto é, a parede do lado
      // oposto, vista através da boca aberta. A parede interna próxima fica
      // atrás da superfície externa e não é desenhada.
      if (face.kind === "inner" && nz <= 0) return;
      // dupla face: a superfície interna é iluminada pela normal invertida
      const s = nz < 0 ? -1 : 1;
      const key = Math.max(0, nx * s * KEY.x + ny * s * KEY.y + nz * s * KEY.z);
      const fill = Math.max(0, nx * s * FILL.x + ny * s * FILL.y + nz * s * FILL.z);
      const rim = Math.pow(1 - Math.abs(nz), 3);
      const m = MAT[face.kind] ?? MAT["outer"]!;
      // difuso + preenchimento + reflexo especular discreto (metal semiacetinado)
      const spec = Math.pow(key, 16) * 0.25;
      const lum = m.amb + m.gain * (0.82 * Math.pow(key, 0.85) + 0.22 * fill) + spec + 0.12 * rim;
      const pct = Math.max(0, Math.min(100, lum * 100));
      const paint = `color-mix(in oklab, ${m.hi} ${pct.toFixed(1)}%, ${m.base})`;
      // desempate por GRUPO de casca: em corpos que se cruzam (tubo × ramal),
      // o ramal é sempre o corpo externo na junção — vence empates de
      // profundidade sem mover nenhum vértice.
      const bias = ((BIAS[face.kind] ?? 0) + (face.g ?? 0) * 0.75) * span * 0.002;

      // Triangulação determinística em leque, apenas na representação: nenhum
      // ponto é movido. A PROFUNDIDADE continua sendo a da face inteira, para
      // que os triângulos de um mesmo polígono nunca se intercalem com os de
      // polígonos vizinhos (origem de listras e do efeito fantasma).
      const depths = cs.map((point) => point.z + bias);
      const minDepth = Math.min(...depths);
      const maxDepth = Math.max(...depths);
      const centerDepth = depths.reduce((acc, depth) => acc + depth, 0) / depths.length;
      const a = cs[0]!;
      const passIndex = face.kind === "inner" ? 0 : face.kind === "cap" ? 1 : face.kind === "outer" ? 2 : 3;

      for (let i = 1; i + 1 < cs.length; i++) {
        const b = cs[i]!;
        const c = cs[i + 1]!;
        const pA = { x: a.x * kk + panX, y: -a.y * kk + panY, z: a.z + bias };
        const pB = { x: b.x * kk + panX, y: -b.y * kk + panY, z: b.z + bias };
        const pC = { x: c.x * kk + panX, y: -c.y * kk + panY, z: c.z + bias };
        const xs = [pA.x, pB.x, pC.x];
        const ys = [pA.y, pB.y, pC.y];
        f.push({
          id: `face:${idx}:${i - 1}`,
          d: [a, b, c].map((p) => `${(p.x * kk + panX).toFixed(2)},${(-p.y * kk + panY).toFixed(2)}`).join(" "),
          pts: [pA, pB, pC],
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys),
          minDepth,
          maxDepth,
          centerDepth,
          priority: idx,
          pass: passIndex,
          kind: face.kind,
          fill: paint,
        });
      }
    });

    // ordenação estável: empates resolvidos pelo índice, sem cintilação
    f.sort(compareSurfaceDepth);

    // 1. Filtragem global por modo de visualização 3D (Seções 4, 5, 6, 7):
    // SOMB: 0 arestas (superfície contínua limpa)
    // SOMB+AR: somente arestas reais/tecnicamente significativas (sem triangulação interna)
    // ARAME: estrutura completa, incluindo malha matemática
    const filtered = filterEdgesForMode(
      model.edges,
      model.edgeKinds,
      model.edgeTags,
      edgeMode,
    );

    // 2. Deduplicação na camada de apresentação (Seção 14):
    // Elimina arestas duplicadas, coincidentes ou sobrepostas geradas por faces adjacentes
    const deduped = deduplicateEdges(
      filtered.edges,
      filtered.kinds,
      filtered.tags,
      filtered.originalIndices,
      span * 1e-4,
    );

    // 3. Oclusão de profundidade e projeção (Seção 16):
    // No modo SOMB+AR, a superfície frontal metálica oclui arestas traseiras (elimina linhas flutuantes)
    const effectiveVisibility =
      lineVisibility ?? (edgeMode === "shaded-edges" ? "real-occlusion" : "technical-persistent");

    // Apenas faces externas e de borda atuam como oclusores para as linhas
    const occluders = f.filter(
      (tri) => (tri.pass === 2 || tri.pass === 3) && tri.pts[0] && tri.pts[1] && tri.pts[2],
    );

    const depthEpsilon = span * 1e-4;
    const e = deduped.edges.flatMap((edge, index) => {
      const origIndex = deduped.originalIndices[index] ?? index;
      return visibleLineSegments(
        projectLine(`edge:${origIndex}`, edge, cp, kk, panX, panY),
        effectiveVisibility,
        occluders,
        depthEpsilon,
      );
    });

    const shouldShowRefs = showRefLines ?? (edgeMode !== "shaded");
    const r = shouldShowRefs
      ? (model.refLines ?? []).flatMap((edge, index) =>
          visibleLineSegments(
            projectLine(`reference:${index}`, edge, cp, kk, panX, panY),
            VISIBILITY_POLICY.reference,
            occluders,
            depthEpsilon,
          ),
        )
      : [];

    return { faces: f, edges: e, refs: r };
  }, [model, cam, fit, k, lineVisibility, edgeMode, showRefLines]);

  const maxDepth = Math.max(1, ...edges.flatMap((e) => [Math.abs(e.z1), Math.abs(e.z2)]));

  /*
   * Destaque de seleção: entidades cuja origem canônica é `highlightRef`.
   * Camada "selection" — acima de superfícies e arestas, nunca substitui as
   * cores técnicas nem depende apenas de cor (rótulo textual acompanha).
   */
  const highlightRefs = useMemo<readonly GeometryRef[]>(
    () => (highlightRef == null ? [] : Array.isArray(highlightRef) ? highlightRef : [highlightRef]),
    [highlightRef],
  );
  const hasHighlight = highlightRefs.length > 0;
  const selectedEdges = useMemo(
    () =>
      hasHighlight && refForEdge
        ? edges.filter((e) => {
            const r = refForEdge(entityIndexOf(e.id));
            return r != null && highlightRefs.includes(r);
          })
        : [],
    [edges, hasHighlight, highlightRefs, refForEdge],
  );
  const selectedFaces = useMemo(
    () =>
      hasHighlight && refForFace
        ? faces.filter((f) => {
            const r = refForFace(f.priority);
            return r != null && highlightRefs.includes(r);
          })
        : [],
    [faces, hasHighlight, highlightRefs, refForFace],
  );
  const labelAnchor = selectedEdges[0]
    ? {
        x: (selectedEdges[0].x1 + selectedEdges[0].x2) / 2,
        y: (selectedEdges[0].y1 + selectedEdges[0].y2) / 2,
      }
    : selectedFaces[0]?.pts && selectedFaces[0].pts.length >= 3
      ? {
        x: ((selectedFaces[0].pts[0]?.x ?? 0) + (selectedFaces[0].pts[2]?.x ?? 0)) / 2,
        y: ((selectedFaces[0].pts[0]?.y ?? 0) + (selectedFaces[0].pts[2]?.y ?? 0)) / 2,
      }
    : null;

  const onDragStart = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive && ev.pointerType === "touch") return; // toque continua servindo ao card
    const isPan = ev.button === 1 || ev.button === 2 || ev.shiftKey || ev.ctrlKey || mode === "pan";
    dragMode.current = isPan ? "pan" : "orbit";
    drag.current = { x: ev.clientX, y: ev.clientY };
    downAt.current = { x: ev.clientX, y: ev.clientY };
    ev.currentTarget.setPointerCapture(ev.pointerId);
  };

  /* Toque/clique SEM arraste = seleção; arraste continua sendo rotação ou pan. */
  const onTapSelect = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (!onSelectRef || !downAt.current) return;
    const moved = Math.hypot(ev.clientX - downAt.current.x, ev.clientY - downAt.current.y);
    downAt.current = null;
    if (moved > 8) return;
    const svg = host.current;
    if (!svg) return;
    try {
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
      const faceIdx = refForFace ? pickFaceIndex(faces, pt.x, pt.y) : null;
      if (faceIdx !== null) {
        const ref = refForFace!(faceIdx);
        if (ref) {
          onSelectRef(ref);
          return;
        }
      }
      const edgeIdx = refForEdge ? pickEdgeIndex(edges, pt.x, pt.y, 4) : null;
      const ref = edgeIdx !== null ? refForEdge!(edgeIdx) : null;
      onSelectRef(ref);
    } catch {
      // ignore
    }
  };

  return (
    <svg
      ref={host}
      viewBox={`${-VB / 2} ${-VB / 2} ${VB} ${VB}`}
      className={cn(
        "select-none",
        interactive
          ? mode === "pan"
            ? "touch-none cursor-move"
            : "touch-none cursor-grab active:cursor-grabbing"
          : "touch-auto",
        className,
      )}
      role="img"
      aria-label="Modelo tridimensional paramétrico da peça"
      onContextMenu={(ev) => {
        if (interactive) ev.preventDefault();
      }}
      onDoubleClick={() => {
        if (!interactive) return;
        setCam((c) => ({ ...c, panX: 0, panY: 0, zoom: 1 }));
      }}
      onPointerDown={onDragStart}
      onPointerMove={(ev) => {
        if (!drag.current) return;
        const dx = ev.clientX - drag.current.x;
        const dy = ev.clientY - drag.current.y;
        drag.current = { x: ev.clientX, y: ev.clientY };

        if (dragMode.current === "pan") {
          const svg = host.current;
          const rect = svg?.getBoundingClientRect();
          const factor = rect && rect.width > 0 ? VB / rect.width : 1;
          setCam((c) => ({
            ...c,
            panX: (c.panX ?? 0) + dx * factor,
            panY: (c.panY ?? 0) + dy * factor,
          }));
        } else {
          setCam((c) => ({
            ...c,
            yaw: c.yaw + dx * 0.008,
            pitch: interactive
              ? Math.max(-Math.PI / 2, Math.min(Math.PI / 2, c.pitch + dy * 0.006))
              : c.pitch,
          }));
        }
      }}
      onPointerUp={(ev) => {
        drag.current = null;
        resume.current = performance.now() + 900;
        onTapSelect(ev);
      }}
      onPointerLeave={() => {
        drag.current = null;
        resume.current = performance.now() + 900;
      }}
    >
      <g>
        {edgeMode !== "wireframe" &&
          faces.map((f) => (
            <polygon
              key={f.id}
              data-entity-id={f.id}
              data-category="surface"
              points={f.d}
              fill={f.fill}
              stroke={f.fill}
              strokeWidth={0.3}
              strokeLinejoin="round"
            />
          ))}
        {(showRefLines ?? (edgeMode !== "shaded")) &&
          refs.map((e) => (
            <line
              key={e.id}
              data-entity-id={e.id}
              data-category="reference"
              x1={e.x1.toFixed(2)}
              y1={e.y1.toFixed(2)}
              x2={e.x2.toFixed(2)}
              y2={e.y2.toFixed(2)}
              stroke="var(--solid-edge)"
              strokeWidth={0.5}
              strokeOpacity={0.45}
              strokeDasharray="4 3 1 3"
            />
          ))}
        {edgeMode !== "shaded" &&
          edges.map((e) => (
            <line
              key={e.id}
              data-entity-id={e.id}
              data-category="edge"
              x1={e.x1.toFixed(2)}
              y1={e.y1.toFixed(2)}
              x2={e.x2.toFixed(2)}
              y2={e.y2.toFixed(2)}
              stroke="var(--solid-edge)"
              strokeWidth={0.6}
              strokeOpacity={
                edgeMode === "wireframe"
                  ? (0.45 + 0.45 * (((e.z1 + e.z2) / 2 + maxDepth) / (2 * maxDepth))).toFixed(3)
                  : (0.18 + 0.42 * (((e.z1 + e.z2) / 2 + maxDepth) / (2 * maxDepth))).toFixed(3)
              }
              strokeLinecap="round"
            />
          ))}
        {hasHighlight && (selectedEdges.length > 0 || selectedFaces.length > 0) && (
          <g data-category="selection" pointerEvents="none">
            {selectedFaces.map((f) => (
              <polygon
                key={`sel:${f.id}`}
                data-entity-id={f.id}
                data-category="selection"
                points={f.d}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={0.9}
                strokeLinejoin="round"
              />
            ))}
            {selectedEdges.map((e) => (
              <line
                key={`sel:${e.id}`}
                data-entity-id={e.id}
                data-category="selection"
                x1={e.x1.toFixed(2)}
                y1={e.y1.toFixed(2)}
                x2={e.x2.toFixed(2)}
                y2={e.y2.toFixed(2)}
                stroke="var(--accent)"
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            ))}
            {labelAnchor && (
              <text
                data-category="selection"
                x={labelAnchor.x.toFixed(2)}
                y={(labelAnchor.y - 3).toFixed(2)}
                textAnchor="middle"
                fontSize={7}
                fontFamily="var(--font-mono, monospace)"
                fill="var(--accent)"
                stroke="var(--background)"
                strokeWidth={2.2}
                paintOrder="stroke"
              >
                {highlightRefs.length === 1
                  ? (highlightRefs[0] ? refLabel(highlightRefs[0]) : "")
                  : `${highlightRefs.length} entidades · ${highlightRefs[0] ? refLabel(highlightRefs[0]) : ""}`}
              </text>
            )}
          </g>
        )}
      </g>
    </svg>
  );
}
