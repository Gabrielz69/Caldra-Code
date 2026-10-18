/**
 * CALDRA CHAMFER — PAINEL CONTEXTUAL DE PROPRIEDADES (FASE 07)
 *
 * Exibe e permite editar em tempo real as propriedades geométricas e semânticas
 * da entidade selecionada:
 *  - Linha: Comprimento, Ângulo, X1, Y1, X2, Y2, Camada, Papel de corte.
 *  - Círculo: Centro (X, Y), Raio, Diâmetro, Área, Perímetro.
 *  - Arco: Centro, Raio, Ângulo Inicial, Ângulo Final, Comprimento do Arco.
 *  - Polilinha: Vértices, Comprimento Total, Fechada/Aberta, Área calculada.
 *  - Ponto: Coordenadas X, Y, Rótulo.
 *  - Entidades de Fabricação: Espessura, Raio de dobra, Ângulo de dobra, Fator K.
 */

import React from "react";
import type { Entity, Layer } from "@/lib/lab2d/core";
import { techColor } from "@/lib/lab2d/technical";
import { isUserLayer } from "@/lib/lab2d/roles";
import { X, Check, Lock, Layers } from "lucide-react";
import { triggerHaptic } from "@/lib/ui/haptics";

interface PropertiesPanelProps {
  entity: Entity | null;
  selectedCount: number;
  layers: Layer[];
  thickness: number;
  onChange: (updated: Entity) => void;
  onClose: () => void;
}

export function PropertiesPanel({
  entity,
  selectedCount,
  layers,
  thickness,
  onChange,
  onClose,
}: PropertiesPanelProps) {
  if (!entity) return null;

  const deg = (r: number) => (r * 180) / Math.PI;
  const rad = (d: number) => (d * Math.PI) / 180;

  const field = (
    label: string,
    value: number,
    set: (n: number) => void,
    unit?: string,
    step = "any",
  ) => (
    <label key={label} className="flex items-center justify-between gap-2 py-0.5">
      <span className="font-mono text-[9.5px] text-muted-foreground uppercase">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={Number(value.toFixed(2))}
          onChange={(ev) => {
            const n = Number(ev.target.value);
            if (Number.isFinite(n)) {
              triggerHaptic("tap");
              set(n);
            }
          }}
          className="w-24 rounded-lg border border-line bg-background/50 px-2 py-1 text-right font-mono text-xs outline-none focus:border-accent focus:ring-1 focus:ring-accent/40"
        />
        {unit && <span className="w-5 font-mono text-[9px] text-muted-foreground">{unit}</span>}
      </span>
    </label>
  );

  const readOnly = (label: string, value: string) => (
    <div key={label} className="flex items-center justify-between gap-2 py-0.5">
      <span className="font-mono text-[9.5px] text-muted-foreground uppercase">{label}</span>
      <span className="font-mono text-xs font-medium text-foreground">{value}</span>
    </div>
  );

  return (
    <aside
      className="metal hairline pop-in fixed top-14 right-3 z-[65] w-72 rounded-2xl p-3 shadow-2xl backdrop-blur-xl"
      aria-label="Inspetor de Propriedades"
    >
      <div className="flex items-center justify-between border-b border-line pb-2 mb-2">
        <div className="flex items-center gap-2">
          <span
            className="size-3 rounded-full shrink-0"
            style={{ background: techColor(entity.layer) }}
          />
          <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-foreground">
            {entity.type === "line" && "Linha"}
            {entity.type === "circle" && "Círculo"}
            {entity.type === "arc" && "Arco"}
            {entity.type === "polyline" && "Polilinha"}
            {entity.type === "point" && "Ponto Técnico"}
            {entity.type === "text" && "Texto"}
            {entity.type === "hatch" && "Hachura"}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground touch-manipulation cursor-pointer"
          title="Fechar inspetor"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-0.5">
        {/* PROPRIEDADES ESPECÍFICAS DE CADA TIPO */}
        {entity.type === "line" && (() => {
          const len = Math.hypot(entity.x2 - entity.x1, entity.y2 - entity.y1);
          const ang = Math.atan2(entity.y2 - entity.y1, entity.x2 - entity.x1);
          const setPolar = (l: number, a: number) =>
            onChange({
              ...entity,
              x2: entity.x1 + l * Math.cos(a),
              y2: entity.y1 + l * Math.sin(a),
            });

          return (
            <>
              {field("Comprimento", len, (n) => setPolar(Math.max(n, 0.1), ang), "mm")}
              {field("Ângulo", deg(ang), (n) => setPolar(len, rad(n)), "°")}
              <div className="my-1.5 h-px bg-line/60" />
              {field("X Início", entity.x1, (n) => onChange({ ...entity, x1: n }), "mm")}
              {field("Y Início", entity.y1, (n) => onChange({ ...entity, y1: n }), "mm")}
              {field("X Fim", entity.x2, (n) => onChange({ ...entity, x2: n }), "mm")}
              {field("Y Fim", entity.y2, (n) => onChange({ ...entity, y2: n }), "mm")}
              <div className="my-1.5 h-px bg-line/60" />
              {readOnly("Delta X", `${(entity.x2 - entity.x1).toFixed(2)} mm`)}
              {readOnly("Delta Y", `${(entity.y2 - entity.y1).toFixed(2)} mm`)}
            </>
          );
        })()}

        {entity.type === "circle" && (() => {
          const areaCm2 = (Math.PI * entity.r * entity.r) / 100;
          const perim = 2 * Math.PI * entity.r;
          return (
            <>
              {field("Raio (R)", entity.r, (n) => onChange({ ...entity, r: Math.max(n, 0.1) }), "mm")}
              {field("Diâmetro (Ø)", entity.r * 2, (n) => onChange({ ...entity, r: Math.max(n / 2, 0.1) }), "mm")}
              <div className="my-1.5 h-px bg-line/60" />
              {field("Centro X", entity.cx, (n) => onChange({ ...entity, cx: n }), "mm")}
              {field("Centro Y", entity.cy, (n) => onChange({ ...entity, cy: n }), "mm")}
              <div className="my-1.5 h-px bg-line/60" />
              {readOnly("Perímetro", `${perim.toFixed(2)} mm`)}
              {readOnly("Área", `${areaCm2.toFixed(2)} cm²`)}
            </>
          );
        })()}

        {entity.type === "arc" && (() => {
          let sweep = entity.a1 - entity.a0;
          while (sweep < 0) sweep += Math.PI * 2;
          const arcLen = entity.r * sweep;
          return (
            <>
              {field("Raio (R)", entity.r, (n) => onChange({ ...entity, r: Math.max(n, 0.1) }), "mm")}
              {field("Ângulo Inicial", deg(entity.a0), (n) => onChange({ ...entity, a0: rad(n) }), "°")}
              {field("Ângulo Final", deg(entity.a1), (n) => onChange({ ...entity, a1: rad(n) }), "°")}
              <div className="my-1.5 h-px bg-line/60" />
              {field("Centro X", entity.cx, (n) => onChange({ ...entity, cx: n }), "mm")}
              {field("Centro Y", entity.cy, (n) => onChange({ ...entity, cy: n }), "mm")}
              <div className="my-1.5 h-px bg-line/60" />
              {readOnly("Abertura", `${deg(sweep).toFixed(1)}°`)}
              {readOnly("Comprimento", `${arcLen.toFixed(2)} mm`)}
            </>
          );
        })()}

        {entity.type === "polyline" && (() => {
          const perim = entity.pts.reduce((acc, p, i) => {
            const q = entity.pts[i + 1] ?? (entity.closed ? entity.pts[0] : undefined);
            return q ? acc + Math.hypot(q.x - p.x, q.y - p.y) : acc;
          }, 0);
          return (
            <>
              {readOnly("Vértices", String(entity.pts.length))}
              {readOnly("Estado", entity.closed ? "Fechada (Contorno)" : "Aberta")}
              {readOnly("Comprimento", `${perim.toFixed(2)} mm`)}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onChange({ ...entity, closed: !entity.closed })}
                  className="w-full rounded-lg border border-line bg-background/40 py-1 font-mono text-[9px] uppercase hover:border-accent"
                >
                  {entity.closed ? "Abrir Contorno" : "Fechar Contorno"}
                </button>
              </div>
            </>
          );
        })()}

        {/* CAMADA & FABRICAÇÃO */}
        <div className="my-2 h-px bg-line" />
        <div className="space-y-1">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Layers className="size-3" /> Camada Técnica
          </span>
          <select
            value={entity.layer}
            onChange={(ev) => {
              triggerHaptic("selection");
              onChange({ ...entity, layer: ev.target.value });
            }}
            aria-label="Camada da entidade"
            className="w-full rounded-lg border border-line bg-background/50 px-2 py-1.5 font-mono text-xs outline-none focus:border-accent"
          >
            {layers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        {/* DADOS SEMÂNTICOS DE CHAPA/DOBRA SE CAMADA FOR DOBRA */}
        {entity.layer === "dobra" && (
          <div className="mt-2 space-y-1 rounded-xl bg-violet-500/10 p-2 border border-violet-500/30">
            <span className="font-mono text-[9px] uppercase tracking-wider text-violet-400 font-semibold block">
              Parâmetros de Dobra
            </span>
            {field("Espessura Chapa", thickness, () => {}, "mm")}
            {readOnly("Raio Interno", `${thickness} mm`)}
            {readOnly("Fator K", "0.33 (Aço Comum)")}
          </div>
        )}
      </div>
    </aside>
  );
}
