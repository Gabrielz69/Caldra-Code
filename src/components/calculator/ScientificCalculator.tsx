import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Delete,
  Beaker,
  ChevronDown,
  Divide,
  Equal,
  Grid2X2,
  History,
  Percent,
  Pi,
  Repeat2,
  Settings,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  evaluateExpression,
  formatResult,
  toFraction,
  type AngleMode,
} from "@/lib/calculator/engine";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/lib/settings/SettingsProvider";

const HISTORY_KEY = "caldra.calculator.history";
const PREFS_KEY = "caldra.calculator.preferences";
type HistoryItem = { expression: string; result: string; value: number; at: number };
type Tool = "constants" | "fractions" | "roots" | "matrix" | "conversion" | null;

const keyClass = "calc-key min-w-0 active:scale-[0.96]";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}

function CalcKey({
  label,
  sub,
  ariaLabel,
  onClick,
  className,
  children,
}: {
  label?: string;
  sub?: string;
  ariaLabel?: string;
  onClick: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      onClick={onClick}
      className={cn(keyClass, className)}
    >
      {children ?? (
        <>
          <span className="calc-key-main">{label}</span>
          {sub && <span className="calc-key-sub">{sub}</span>}
        </>
      )}
    </button>
  );
}

export function ScientificCalculator() {
  /* Ângulo e casas decimais vêm das preferências centrais do CALDRA:
     um único lugar de verdade, aplicado antes do primeiro cálculo. */
  const { calcAngle, setCalcAngle, calcPlaces, setCalcPlaces } = useSettings();
  const angleMode = calcAngle as AngleMode;
  const setAngleMode = setCalcAngle;
  const decimalPlaces = calcPlaces;
  const setDecimalPlaces = setCalcPlaces;
  const [expression, setExpression] = useState("");
  const [value, setValue] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [shift, setShift] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tool, setTool] = useState<Tool>(null);
  const [haptics, setHaptics] = useState(true);
  const [sound, setSound] = useState(false);
  const [matrix, setMatrix] = useState([1, 0, 0, 1]);
  const [convertValue, setConvertValue] = useState("1");

  useEffect(() => {
    const prefs = readJson(PREFS_KEY, { haptics: true, sound: false });
    setHaptics(prefs.haptics);
    setSound(prefs.sound);
    setHistory(readJson<HistoryItem[]>(HISTORY_KEY, []));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({ haptics, sound }));
  }, [haptics, sound]);

  const feedback = useCallback(() => {
    if (haptics && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
    if (sound && typeof window !== "undefined") {
      const AudioCtx =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.frequency.value = 620;
        gain.gain.value = 0.025;
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.025);
      }
    }
  }, [haptics, sound]);

  const append = useCallback(
    (token: string) => {
      feedback();
      setError("");
      setExpression((current) => (current === "0" ? token : current + token));
    },
    [feedback],
  );
  const clear = () => {
    feedback();
    setExpression("");
    setValue(null);
    setError("");
  };
  const backspace = () => {
    feedback();
    setExpression((current) => current.slice(0, -1));
    setError("");
  };
  const calculate = useCallback(() => {
    feedback();
    try {
      const next = evaluateExpression(expression, angleMode);
      const shown = formatResult(next, decimalPlaces);
      setValue(next);
      setError("");
      const item = { expression, result: shown, value: next, at: Date.now() };
      setHistory((items) => {
        const updated = [item, ...items].slice(0, 30);
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível calcular");
    }
  }, [angleMode, decimalPlaces, expression, feedback]);

  const functionKey = (normal: string, shifted: string) => {
    append(`${shift ? shifted : normal}(`);
    if (shift) setShift(false);
  };
  const displayed = error || (value === null ? "" : formatResult(value, decimalPlaces));
  const toolTitle = tool
    ? (
        {
          constants: "Constantes",
          fractions: "Frações",
          roots: "Raízes",
          matrix: "Matriz 2 × 2",
          conversion: "Conversão",
        } as const
      )[tool]
    : "";
  const matrixDet = (matrix[0] ?? 0) * (matrix[3] ?? 0) - (matrix[1] ?? 0) * (matrix[2] ?? 0);
  const converted = Number(convertValue.replace(",", "."));

  return (
    <div className="calculator-theme min-h-[100dvh] bg-calc-page px-2 py-3 text-calc-text sm:px-5 sm:py-6 lg:grid lg:place-items-center">
      <main className="calc-shell mx-auto w-full max-w-[760px] overflow-hidden rounded-[28px] border border-calc-border bg-calc-shell p-3 shadow-calc sm:p-5">
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-1 py-2 sm:px-2">
          <Link to="/" aria-label="Voltar ao início" className="calc-icon-button">
            <ArrowLeft />
          </Link>
          <div className="min-w-0 pt-0.5">
            <h1 className="truncate text-[18px] font-semibold sm:text-[21px]">
              Calculadora Científica
            </h1>
          </div>
          <button
            type="button"
            aria-label="Configurações da calculadora"
            onClick={() => setSettingsOpen(true)}
            className="calc-icon-button"
          >
            <Settings />
          </button>
        </header>

        <section
          aria-label="Display da calculadora"
          className="calc-display mt-2 rounded-[19px] border border-calc-border bg-calc-display px-4 py-4 sm:px-5"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0 overflow-x-auto whitespace-nowrap font-mono text-[14px] text-calc-expression sm:text-[17px]">
              {expression || "\u00A0"}
            </div>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="flex shrink-0 items-center gap-2 text-[12px] text-calc-muted sm:text-sm"
            >
              <History className="size-4" /> Histórico <ArrowRight className="size-3.5" />
            </button>
          </div>
          <div
            className={cn(
              "mt-3 min-h-[60px] truncate text-right font-mono text-[clamp(2.3rem,10vw,3.7rem)] leading-none font-medium text-calc-result",
              error && "text-calc-error text-[clamp(1rem,5vw,1.45rem)]",
            )}
          >
            {displayed}
          </div>
          <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <div className="flex rounded-full border border-calc-line bg-calc-recess p-0.5">
              {(["RAD", "DEG", "GRAD"] as AngleMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAngleMode(mode)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[11px] text-calc-muted sm:px-4",
                    angleMode === mode &&
                      "border border-calc-cyan bg-calc-active text-calc-cyan shadow-calc-glow",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            <label className="ml-auto flex items-center gap-1 text-[11px] text-calc-muted sm:text-sm">
              <select
                aria-label="Casas decimais"
                value={decimalPlaces}
                onChange={(e) => setDecimalPlaces(Number(e.target.value))}
                className="appearance-none bg-transparent text-right outline-none"
              >
                {[2, 4, 6, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} casas decimais
                  </option>
                ))}
              </select>
              <ChevronDown className="size-3.5" />
            </label>
          </div>
        </section>

        <section aria-label="Teclado científico" className="mt-4 grid grid-cols-5 gap-2 sm:gap-2.5">
          <CalcKey
            onClick={() => {
              feedback();
              setShift((v) => !v);
            }}
            ariaLabel="Alternar Shift"
            className={cn("calc-key-shift", shift && "is-active")}
          >
            <span className="text-base">⇧</span>
            <span className="text-[13px] font-semibold">SHIFT</span>
          </CalcKey>
          <CalcKey label="C" onClick={clear} />
          <CalcKey onClick={backspace} ariaLabel="Apagar último caractere">
            <Delete className="size-5" />
          </CalcKey>
          <CalcKey label="(" onClick={() => append("(")} />
          <CalcKey label=")" onClick={() => append(")")} />

          <CalcKey
            label={shift ? "sin⁻¹" : "sin"}
            sub={shift ? "sin" : "sin⁻¹"}
            onClick={() => functionKey("sin", "asin")}
          />
          <CalcKey
            label={shift ? "cos⁻¹" : "cos"}
            sub={shift ? "cos" : "cos⁻¹"}
            onClick={() => functionKey("cos", "acos")}
          />
          <CalcKey
            label={shift ? "tan⁻¹" : "tan"}
            sub={shift ? "tan" : "tan⁻¹"}
            onClick={() => functionKey("tan", "atan")}
          />
          <CalcKey
            label={shift ? "10ˣ" : "log"}
            sub={shift ? "log" : "10ˣ"}
            onClick={() => (shift ? (append("10^("), setShift(false)) : functionKey("log", "log"))}
          />
          <CalcKey
            label={shift ? "eˣ" : "ln"}
            sub={shift ? "ln" : "eˣ"}
            onClick={() => functionKey("ln", "exp")}
          />

          {["7", "8", "9"].map((n) => (
            <CalcKey key={n} label={n} onClick={() => append(n)} />
          ))}
          <CalcKey onClick={() => append("÷")} ariaLabel="Dividir" className="calc-key-operator">
            <Divide className="size-5" />
          </CalcKey>
          <CalcKey
            onClick={() => append("×")}
            ariaLabel="Multiplicar"
            className="calc-key-operator"
          >
            <X className="size-5" />
          </CalcKey>

          {["4", "5", "6"].map((n) => (
            <CalcKey key={n} label={n} onClick={() => append(n)} />
          ))}
          <CalcKey label="−" onClick={() => append("−")} className="calc-key-operator" />
          <CalcKey label="+" onClick={() => append("+")} className="calc-key-operator" />

          {["1", "2", "3"].map((n) => (
            <CalcKey key={n} label={n} onClick={() => append(n)} />
          ))}
          <CalcKey label="xʸ" onClick={() => append("^")} className="calc-key-operator" />
          <CalcKey label="√" onClick={() => append("sqrt(")} className="calc-key-operator" />

          <CalcKey label="0" onClick={() => append("0")} className="col-span-2" />
          <CalcKey label="," onClick={() => append(",")} />
          <CalcKey
            onClick={() => {
              if (shift) {
                append("!");
                setShift(false);
              } else append("%");
            }}
            ariaLabel={shift ? "Fatorial" : "Porcentagem"}
          >
            {shift ? <span className="calc-key-main">x!</span> : <Percent className="size-5" />}
          </CalcKey>
          <CalcKey onClick={calculate} ariaLabel="Calcular resultado" className="calc-key-equals">
            <Equal className="size-6" />
          </CalcKey>
        </section>

        <section
          aria-label="Ferramentas rápidas"
          className="mt-4 grid grid-cols-5 divide-x divide-calc-line rounded-[17px] border border-calc-line bg-calc-recess px-1 py-2"
        >
          {[
            ["constants", <Pi key="i" />, "Constantes"],
            [
              "fractions",
              <span key="i" className="text-lg leading-none">
                ᵃ⁄ᵦ
              </span>,
              "Frações",
            ],
            [
              "roots",
              <span key="i" className="text-lg leading-none">
                √x
              </span>,
              "Raízes",
            ],
            ["matrix", <Grid2X2 key="i" />, "Matriz"],
            ["conversion", <Repeat2 key="i" />, "Conversão"],
          ].map(([id, icon, label]) => (
            <button
              key={String(id)}
              type="button"
              onClick={() => setTool(id as Tool)}
              className="flex min-w-0 flex-col items-center gap-1 px-0.5 py-1.5 text-calc-muted transition-colors active:scale-95 hover:text-calc-cyan [&>svg]:size-5"
            >
              <span className="text-calc-icon">{icon}</span>
              <span className="truncate text-[9px] sm:text-[12px]">{label}</span>
            </button>
          ))}
        </section>
      </main>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="calculator-theme max-h-[75dvh] w-[min(92vw,430px)] overflow-y-auto border-calc-border bg-calc-shell text-calc-text">
          <DialogHeader>
            <DialogTitle>Histórico</DialogTitle>
            <DialogDescription className="text-calc-muted">
              Toque em um cálculo para reutilizá-lo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {history.length === 0 ? (
              <p className="py-8 text-center text-sm text-calc-muted">Nenhum cálculo ainda.</p>
            ) : (
              history.map((item) => (
                <button
                  key={item.at}
                  type="button"
                  onClick={() => {
                    setExpression(item.expression);
                    setValue(item.value);
                    setHistoryOpen(false);
                  }}
                  className="w-full rounded-xl border border-calc-line bg-calc-display p-3 text-left"
                >
                  <span className="block truncate font-mono text-xs text-calc-muted">
                    {item.expression}
                  </span>
                  <span className="mt-1 block font-mono text-lg text-calc-result">
                    {item.result}
                  </span>
                  <span className="text-[10px] text-calc-muted">
                    {new Date(item.at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </button>
              ))
            )}
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setHistory([]);
                localStorage.removeItem(HISTORY_KEY);
              }}
              className="text-sm text-calc-muted"
            >
              Limpar histórico
            </button>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="calculator-theme w-[min(92vw,430px)] border-calc-border bg-calc-shell text-calc-text">
          <DialogHeader>
            <DialogTitle>Configurações</DialogTitle>
            <DialogDescription className="text-calc-muted">
              Preferências exclusivas da calculadora.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <SettingRow label="Feedback tátil" icon={<Beaker />}>
              <Switch checked={haptics} onCheckedChange={setHaptics} />
            </SettingRow>
            <SettingRow label="Som das teclas" icon={sound ? <Volume2 /> : <VolumeX />}>
              <Switch checked={sound} onCheckedChange={setSound} />
            </SettingRow>
            <div>
              <p className="mb-2 text-sm text-calc-muted">Modo de ângulo</p>
              <div className="grid grid-cols-3 gap-2">
                {(["RAD", "DEG", "GRAD"] as AngleMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setAngleMode(m)}
                    className={cn(
                      "rounded-lg border border-calc-line p-2 text-sm",
                      angleMode === m && "border-calc-cyan text-calc-cyan",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm text-calc-muted">Casas decimais</p>
              <div className="grid grid-cols-4 gap-2">
                {[2, 4, 6, 8].map((n) => (
                  <button
                    key={n}
                    onClick={() => setDecimalPlaces(n)}
                    className={cn(
                      "rounded-lg border border-calc-line p-2 text-sm",
                      decimalPlaces === n && "border-calc-cyan text-calc-cyan",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={tool !== null} onOpenChange={(open) => !open && setTool(null)}>
        <DialogContent className="calculator-theme w-[min(92vw,430px)] border-calc-border bg-calc-shell text-calc-text">
          <DialogHeader>
            <DialogTitle>{toolTitle}</DialogTitle>
            <DialogDescription className="text-calc-muted">
              Ferramenta rápida da calculadora científica.
            </DialogDescription>
          </DialogHeader>
          {tool === "constants" && (
            <div className="grid grid-cols-2 gap-2">
              <ToolButton
                label="π — Pi"
                onClick={() => {
                  append("π");
                  setTool(null);
                }}
              />
              <ToolButton
                label="e — Euler"
                onClick={() => {
                  append("e");
                  setTool(null);
                }}
              />
            </div>
          )}
          {tool === "fractions" && (
            <div className="rounded-xl border border-calc-line bg-calc-display p-4 text-center">
              <p className="text-sm text-calc-muted">Resultado como fração</p>
              <p className="mt-2 font-mono text-2xl text-calc-result">{toFraction(value ?? 0)}</p>
            </div>
          )}
          {tool === "roots" && (
            <div className="grid grid-cols-2 gap-2">
              <ToolButton
                label="Raiz quadrada"
                onClick={() => {
                  append("sqrt(");
                  setTool(null);
                }}
              />
              <ToolButton
                label="Raiz cúbica"
                onClick={() => {
                  append("cbrt(");
                  setTool(null);
                }}
              />
            </div>
          )}
          {tool === "matrix" && (
            <div>
              <div className="mx-auto grid max-w-48 grid-cols-2 gap-2">
                {matrix.map((n, i) => (
                  <input
                    key={i}
                    aria-label={`Valor ${i + 1} da matriz`}
                    type="number"
                    value={n}
                    onChange={(e) =>
                      setMatrix((current) =>
                        current.map((v, j) => (j === i ? Number(e.target.value) : v)),
                      )
                    }
                    className="rounded-lg border border-calc-line bg-calc-display p-3 text-center font-mono"
                  />
                ))}
              </div>
              <p className="mt-4 text-center text-sm text-calc-muted">
                Determinante: <strong className="text-calc-result">{matrixDet}</strong>
              </p>
            </div>
          )}
          {tool === "conversion" && (
            <div className="space-y-3">
              <input
                value={convertValue}
                onChange={(e) => setConvertValue(e.target.value)}
                inputMode="decimal"
                aria-label="Valor para conversão"
                className="w-full rounded-lg border border-calc-line bg-calc-display p-3 font-mono"
              />
              <div className="grid grid-cols-2 gap-2 text-center text-sm">
                <div className="rounded-lg border border-calc-line p-3">
                  <span className="text-calc-muted">mm → pol</span>
                  <strong className="mt-1 block font-mono text-calc-result">
                    {Number.isFinite(converted) ? formatResult(converted / 25.4, 4) : "—"}
                  </strong>
                </div>
                <div className="rounded-lg border border-calc-line p-3">
                  <span className="text-calc-muted">pol → mm</span>
                  <strong className="mt-1 block font-mono text-calc-result">
                    {Number.isFinite(converted) ? formatResult(converted * 25.4, 4) : "—"}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-calc-line bg-calc-display p-3">
      <span className="flex items-center gap-2 text-sm [&>svg]:size-4">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}
function ToolButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-calc-line bg-calc-display p-4 text-sm transition-colors hover:border-calc-cyan hover:text-calc-cyan"
    >
      {label}
    </button>
  );
}
