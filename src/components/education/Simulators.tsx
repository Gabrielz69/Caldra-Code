import { useState } from "react";
import { Panel, SectionLabel } from "@/components/chameleon/ui";

const num = (n: number, d = 1) =>
  Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d })
    : "—";

function Field({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="t-caption text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--accent)]"
      />
      <span className="font-mono text-[11px] text-accent">{num(value, 0)}</span>
    </label>
  );
}

/** Triângulo retângulo interativo — catetos, hipotenusa e ângulo. */
export function TriangleSim() {
  const [a, setA] = useState(400);
  const [b, setB] = useState(300);
  const h = Math.hypot(a, b);
  const ang = (Math.atan2(b, a) * 180) / Math.PI;

  const s = 140 / Math.max(a, b);
  const x0 = 20;
  const y0 = 150;

  return (
    <Panel className="p-4">
      <SectionLabel>Simulador — triângulo retângulo</SectionLabel>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <svg viewBox="0 0 200 170" className="w-full rounded-xl border border-line bg-card/40">
          <polygon
            points={`${x0},${y0} ${x0 + a * s},${y0} ${x0},${y0 - b * s}`}
            fill="var(--accent)"
            fillOpacity="0.1"
            stroke="var(--accent)"
            strokeWidth="1.2"
          />
          <path
            d={`M${x0 + 10},${y0} L${x0 + 10},${y0 - 10} L${x0},${y0 - 10}`}
            fill="none"
            stroke="currentColor"
            strokeWidth=".7"
            opacity=".6"
          />
          <text
            x={x0 + (a * s) / 2}
            y={y0 + 12}
            className="fill-current"
            fontSize="8"
            textAnchor="middle"
            opacity=".7"
          >
            a
          </text>
          <text
            x={x0 - 8}
            y={y0 - (b * s) / 2}
            className="fill-current"
            fontSize="8"
            textAnchor="middle"
            opacity=".7"
          >
            b
          </text>
        </svg>
        <div className="space-y-3">
          <Field label="Cateto a (mm)" value={a} min={50} max={800} onChange={setA} />
          <Field label="Cateto b (mm)" value={b} min={50} max={800} onChange={setB} />
          <div className="rounded-lg border border-accent/20 bg-accent/[0.06] px-3 py-2 font-mono text-[11px] text-accent">
            <div>
              d = √({num(a, 0)}² + {num(b, 0)}²)
            </div>
            <div className="mt-1 text-base">d = {num(h)} mm</div>
            <div className="mt-1 opacity-80">ângulo = {num(ang)}°</div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/** Arco, corda e flecha — raio e ângulo derivados das medidas da peça. */
export function ArcSim() {
  const [r, setR] = useState(300);
  const [ang, setAng] = useState(90);

  const rad = (ang * Math.PI) / 180;
  const chord = 2 * r * Math.sin(rad / 2);
  const sagitta = r * (1 - Math.cos(rad / 2));
  const arc = r * rad;

  const s = 120 / r;
  const cx = 100;
  const cy = 130;
  const p1 = {
    x: cx + r * s * Math.cos(Math.PI / 2 + rad / 2),
    y: cy - r * s * Math.sin(Math.PI / 2 + rad / 2),
  };
  const p2 = {
    x: cx + r * s * Math.cos(Math.PI / 2 - rad / 2),
    y: cy - r * s * Math.sin(Math.PI / 2 - rad / 2),
  };

  return (
    <Panel className="p-4">
      <SectionLabel>Simulador — arco, corda e flecha</SectionLabel>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <svg viewBox="0 0 200 150" className="w-full rounded-xl border border-line bg-card/40">
          <path
            d={`M${p1.x},${p1.y} A${r * s},${r * s} 0 ${ang > 180 ? 1 : 0} 1 ${p2.x},${p2.y}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.6"
          />
          <line
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="currentColor"
            strokeWidth="1"
            opacity=".7"
          />
          <line
            x1={cx}
            y1={cy}
            x2={cx}
            y2={cy - r * s}
            stroke="currentColor"
            strokeWidth=".6"
            strokeDasharray="3 3"
            opacity=".5"
          />
          <circle cx={cx} cy={cy} r="1.6" className="fill-current" />
        </svg>
        <div className="space-y-3">
          <Field label="Raio (mm)" value={r} min={100} max={800} onChange={setR} />
          <Field label="Ângulo (°)" value={ang} min={10} max={300} onChange={setAng} />
          <div className="rounded-lg border border-accent/20 bg-accent/[0.06] px-3 py-2 font-mono text-[11px] text-accent">
            <div>corda = {num(chord)} mm</div>
            <div>flecha = {num(sagitta)} mm</div>
            <div>arco = {num(arc)} mm</div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
