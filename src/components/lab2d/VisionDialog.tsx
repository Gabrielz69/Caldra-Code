import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuroraBackground } from "@/components/chameleon/Aurora";
import { toast } from "sonner";
import {
  Check,
  Circle as CircleIcon,
  Eraser,
  Image as ImageIcon,
  Loader2,
  MousePointerClick,
  RotateCw,
  Ruler,
  Scan,
  ScanText,
  Spline,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  buildParametric,
  parametricBounds,
  proposalValues,
  proposeParametric,
  type ParametricProposal,
  type ParamValues,
} from "@/lib/vision/parametricRecognizer";
import { detectDimensions, ocrKindLabel, type OcrCandidate } from "@/lib/vision/ocrService";
import { uid, type Entity } from "@/lib/lab2d/core";

import { CUT_COLOR, DIMENSION_COLOR, MARK_COLOR } from "@/lib/lab2d/technical";
import { importImage, type ImportedImage } from "@/lib/vision/imageImportService";
import type { Prim, Tolerance } from "@/lib/vision/geometryRecognizer";
import { toEntities, type VisionAnalysis } from "@/lib/vision/vectorizer";
import { countDuplicates, normalizeGeometry } from "@/lib/vision/geometryNormalizer";
import {
  calibrateByDimension,
  calibrateByMeasure,
  DEFAULT_CALIBRATION,
  type Calibration,
} from "@/lib/vision/scaleCalibrationService";
import { validateVector } from "@/lib/vision/vectorValidationService";
import {
  DEFAULT_LOGO,
  logoToEntities,
  type LogoAnalysis,
  type LogoOptions,
} from "@/lib/vision/logoPipeline";
import { pathToSvg } from "@/lib/lab2d/bezier";
import type { TurnPolicy } from "@/lib/vision/logoTracer";
import {
  DEFAULT_CENTERLINE,
  type CenterlineAnalysis,
  type CenterlineOptions,
} from "@/lib/vision/centerlinePipeline";
import {
  profileImage,
  suggestFromProfile,
  type ImageProfile,
  type VisionSuggestion,
} from "@/lib/vision/imageProfiler";
import {
  rasterForLogo,
  rasterForProfile,
  rasterForTecnico,
  rasterForTracado,
} from "@/lib/vision/rasterSource";
import { cancelVision, runVision } from "@/lib/vision/visionClient";
import { useVisionQuota } from "@/lib/vision/useVisionQuota";
import { VisionLimitDialog } from "./VisionLimitDialog";
import { buildQuality, type QualityItem } from "@/lib/vision/qualityReport";
import {
  addManualPoint,
  arcFrom3Points,
  closeManualContour,
  EMPTY_MANUAL,
  manualNodes,
  manualPointCount,
  manualToEntities,
  moveManualNode,
  removeLastManualPoint,
  snapPoint,
  snapTargets,
  type ManualState,
} from "@/lib/vision/manualTracer";

export type VisionImageLayer = {
  src: string;
  name: string;
  /** Largura/altura em mm do plano de fundo, já calibradas. */
  widthMm: number;
  heightMm: number;
  x: number;
  y: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
};

type Step = "importar" | "previa" | "analisando" | "resultado";
/** Técnico procura LINE/ARC/CIRCLE; logo preserva Bézier; traçado extrai linha central. */
type Mode = "tecnico" | "logo" | "tracado";
type Overlay = "original" | "vetor" | "ambos" | "diferenca";

/** CHAMFER VISION — imagem → vetor → geometria CAD editável. */
export function VisionDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (entities: Entity[], image: VisionImageLayer) => void;
}) {
  const [step, setStep] = useState<Step>("importar");
  const quota = useVisionQuota(open);
  const [limitOpen, setLimitOpen] = useState(false);
  const [img, setImg] = useState<ImportedImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // pré-visualização
  const [rotation, setRotation] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [zoom, setZoom] = useState(1);

  // análise
  const [mode, setMode] = useState<Mode>("tecnico");
  const [logoOpt, setLogoOpt] = useState<LogoOptions>(DEFAULT_LOGO);
  const [logo, setLogo] = useState<LogoAnalysis | null>(null);
  const [tolerance, setTolerance] = useState<Tolerance>("media");
  const [noise, setNoise] = useState(1);
  const [analysis, setAnalysis] = useState<VisionAnalysis | null>(null);
  const [centerOpt, setCenterOpt] = useState<CenterlineOptions>(DEFAULT_CENTERLINE);
  const [center, setCenter] = useState<CenterlineAnalysis | null>(null);
  const [overlay, setOverlay] = useState<Overlay>("ambos");

  // qualidade / pré-flight / processamento
  const [profile, setProfile] = useState<ImageProfile | null>(null);
  const [suggestion, setSuggestion] = useState<VisionSuggestion | null>(null);
  const [adaptive, setAdaptive] = useState(false);
  const [normalize, setNormalize] = useState(false);
  const [regularize, setRegularize] = useState(true);
  const [multiScale, setMultiScale] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; pct: number }>({
    stage: "Preparando",
    pct: 0,
  });
  const [focusBox, setFocusBox] = useState<QualityItem["box"] | null>(null);

  // A1 — reconstrução paramétrica
  const [paramValues, setParamValues] = useState<ParamValues | null>(null);
  const [paramRejected, setParamRejected] = useState(false);

  // A2 — OCR técnico
  const [ocr, setOcr] = useState<OcrCandidate[]>([]);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrStage, setOcrStage] = useState<{ stage: string; pct: number } | null>(null);

  // calibração
  const [cal, setCal] = useState<Calibration>(DEFAULT_CALIBRATION);
  const [widthMm, setWidthMm] = useState("");
  const [calMode, setCalMode] = useState<"dimensao" | "medida">("dimensao");
  const [calPts, setCalPts] = useState<{ x: number; y: number }[]>([]);
  const [realMm, setRealMm] = useState("100");

  // vetorização manual (histórico próprio; o desenho final entra no undo do CHAMFER)
  const [manualOn, setManualOn] = useState(false);
  const [manual, setManual] = useState<ManualState>(EMPTY_MANUAL);
  const [past, setPast] = useState<ManualState[]>([]);
  const [future, setFuture] = useState<ManualState[]>([]);
  const [snapTol, setSnapTol] = useState(10);

  const pushManual = useCallback(
    (next: ManualState) => {
      setPast((p) => [...p.slice(-40), manual]);
      setFuture([]);
      setManual(next);
    },
    [manual],
  );

  const undoManual = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1]!;
      setFuture((f) => [manual, ...f]);
      setManual(prev);
      return p.slice(0, -1);
    });
  }, [manual]);

  const redoManual = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      setPast((p) => [...p, manual]);
      setManual(f[0]!);
      return f.slice(1);
    });
  }, [manual]);

  const reset = useCallback(() => {
    cancelVision();
    setStep("importar");
    setImg(null);
    setError(null);
    setRotation(0);
    setOpacity(1);
    setZoom(1);
    setAnalysis(null);
    setLogo(null);
    setCenter(null);
    setLogoOpt(DEFAULT_LOGO);
    setCenterOpt(DEFAULT_CENTERLINE);
    setCal(DEFAULT_CALIBRATION);
    setWidthMm("");
    setCalPts([]);
    setManualOn(false);
    setManual(EMPTY_MANUAL);
    setPast([]);
    setFuture([]);
    setProfile(null);
    setSuggestion(null);
    setAdaptive(false);
    setNormalize(false);
    setMultiScale(false);
    setFocusBox(null);
    setParamValues(null);
    setParamRejected(false);
    setOcr([]);
    setOcrBusy(false);
    setOcrStage(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const pick = async (file: File) => {
    setError(null);
    try {
      const imported = await importImage(file);
      setImg(imported);
      setStep("previa");
      // relatório pré-flight: rápido, na thread principal, sem aplicar nada
      try {
        const p = profileImage(rasterForProfile(imported.element));
        setProfile(p);
        setSuggestion(suggestFromProfile(p));
      } catch {
        setProfile(null);
        setSuggestion(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao importar imagem.");
    }
  };

  /** Aplica a sugestão do pré-flight — só quando o usuário confirma. */
  const useSuggestion = () => {
    if (!suggestion) return;
    setMode(suggestion.mode);
    setTolerance(suggestion.tolerance);
    setNoise(suggestion.noise);
    setAdaptive(suggestion.adaptive);
    setNormalize(suggestion.normalize);
    setMultiScale(profile?.small ?? false);
    setLogoOpt((o) => ({
      ...o,
      threshold: suggestion.threshold,
      invert: suggestion.invert,
      upscale: suggestion.upscale,
      blur: suggestion.blur,
      turdsize: suggestion.turdsize,
      alphamax: suggestion.alphamax,
      opttolerance: suggestion.opttolerance,
      turnpolicy: suggestion.turnpolicy,
    }));
    setCenterOpt((o) => ({
      ...o,
      invert: suggestion.invert,
      blur: suggestion.blur,
      tolerance: suggestion.tolerance,
    }));
    toast.success("Sugestão aplicada. Ajuste o que quiser antes de continuar.");
  };

  /** Executa a pipeline no Web Worker; devolve true quando houve resultado. */
  const analyze = useCallback(
    async (silent: boolean) => {
      if (!img) return false;
      if (!silent) {
        setStep("analisando");
        setProgress({ stage: "Preparando imagem", pct: 2 });
        setError(null);
      }
      try {
        if (mode === "logo") {
          const pixels = rasterForLogo(img.element, logoOpt, multiScale);
          const res = await runVision(
            { mode: "logo", pixels, opt: logoOpt, multiScale },
            silent ? undefined : setProgress,
          );
          if (res.mode !== "logo") return false;
          const ok = res.analysis.stats.contours + res.analysis.stats.holes > 0;
          if (silent) {
            if (ok) setLogo(res.analysis);
            return ok;
          }
          setAnalysis(null);
          setCenter(null);
          setLogo(ok ? res.analysis : null);
          if (!ok) setError("Nenhum contorno encontrado. Ajuste o limiar ou inverta tinta/fundo.");
          setStep("resultado");
          return ok;
        }

        if (mode === "tracado") {
          const opt = { ...centerOpt, rotationDeg: rotation };
          const pixels = rasterForTracado(img.element, opt);
          const res = await runVision(
            { mode: "tracado", pixels, opt },
            silent ? undefined : setProgress,
          );
          if (res.mode !== "tracado") return false;
          setLogo(null);
          setCenter(res.analysis);
          if (res.analysis.prims.length) setAnalysis(res.analysis);
          else if (!silent) setAnalysis(null);
          if (!silent) {
            if (!res.analysis.prims.length)
              setError(
                "Nenhum traço central encontrado. Ajuste brilho, contraste ou o limiar adaptativo — ou use a vetorização manual.",
              );
            setStep("resultado");
          }
          return res.analysis.prims.length > 0;
        }

        const opt = {
          tolerance,
          noise,
          rotationDeg: rotation,
          adaptive,
          normalize,
          regularize,
          hq: true,
        };
        const pixels = rasterForTecnico(img.element, opt);
        const res = await runVision(
          { mode: "tecnico", pixels, opt },
          silent ? undefined : setProgress,
        );
        if (res.mode !== "tecnico") return false;
        const ok = res.analysis.prims.length > 0;
        if (silent) {
          if (ok) setAnalysis(res.analysis);
          return ok;
        }
        setLogo(null);
        setCenter(null);
        setAnalysis(ok ? res.analysis : null);
        if (!ok) setError("Não foi possível reconhecer toda a geometria desta imagem.");
        setStep("resultado");
        return ok;
      } catch (e) {
        if (!silent) {
          setError(e instanceof Error ? e.message : "Falha na análise.");
          setStep("resultado");
        }
        return false;
      }
    },
    [
      img,
      mode,
      logoOpt,
      multiScale,
      centerOpt,
      rotation,
      tolerance,
      noise,
      adaptive,
      normalize,
      regularize,
    ],
  );

  /** Vetorização no modo TÉCNICO consome a cota diária do plano Free. */
  const run = () => {
    if (mode === "tecnico" && !quota.unlimited) {
      if (quota.exhausted) {
        setLimitOpen(true);
        return;
      }
      void (async () => {
        const ok = await quota.consume();
        if (!ok) {
          setLimitOpen(true);
          return;
        }
        void analyze(false);
      })();
      return;
    }
    void analyze(false);
  };

  const cancelRun = () => {
    cancelVision();
    setStep("previa");
    setError("Análise cancelada.");
  };

  // reanalisa ao mudar parâmetros do modo logo
  useEffect(() => {
    if (step !== "resultado" || !img || mode !== "logo") return;
    const t = setTimeout(() => void analyze(true), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoOpt, multiScale]);

  // reanalisa ao mudar parâmetros do modo traçado
  useEffect(() => {
    if (step !== "resultado" || !img || mode !== "tracado") return;
    const t = setTimeout(() => void analyze(true), 240);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerOpt]);

  // reanalisa ao mudar tolerância/ruído/binarização já no resultado
  useEffect(() => {
    if (step !== "resultado" || !img || !analysis || mode !== "tecnico") return;
    const t = setTimeout(() => void analyze(true), 160);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tolerance, noise, adaptive, normalize, regularize]);

  const geoRef = logo ?? analysis;
  const calibrated = cal.method !== "padrao";

  const manualEntities = useMemo<Entity[]>(() => {
    if (!geoRef || !manualPointCount(manual)) return [];
    return manualToEntities(manual, {
      mmPerPx: cal.mmPerPx,
      origin: { x: geoRef.contentPx.x, y: geoRef.contentPx.y },
      layer: "corte",
    });
  }, [manual, geoRef, cal]);

  const targets = useMemo(() => snapTargets(analysis?.prims ?? []), [analysis]);

  const rawEntities = useMemo<Entity[]>(
    () =>
      logo
        ? // cada cor da paleta vira uma camada técnica distinta
          logoToEntities(logo, cal, "corte", (_sw, i) => (i === 0 ? "corte" : "marcacao"))
        : analysis
          ? toEntities(analysis, cal)
          : [],
    [analysis, logo, cal],
  );

  const normalized = useMemo(
    () =>
      logo
        ? // curvas nunca passam pelo normalizador de polilinhas
          {
            entities: [...rawEntities, ...manualEntities],
            report: { removedTiny: 0, nearlyClosed: [] as unknown[] },
          }
        : normalizeGeometry([...rawEntities, ...manualEntities], { autoClose: false }),
    [rawEntities, manualEntities, logo],
  );

  const duplicates = useMemo(() => countDuplicates(rawEntities), [rawEntities]);
  const validation = useMemo(() => validateVector(normalized.entities, cal), [normalized, cal]);
  const quality = useMemo(
    () => (analysis ? buildQuality(analysis.prims, cal.mmPerPx) : null),
    [analysis, cal],
  );

  /* A1 — proposta paramétrica: só no modo técnico, só com escala calibrada. */
  const proposal = useMemo<ParametricProposal | null>(() => {
    if (mode !== "tecnico" || !analysis || logo) return null;
    if (cal.method === "padrao") return null;
    return proposeParametric(
      analysis.prims,
      cal.mmPerPx,
      { x: analysis.contentPx.x, y: analysis.contentPx.y },
      analysis.tolerancePx * cal.mmPerPx,
    );
  }, [mode, analysis, logo, cal]);

  useEffect(() => {
    setParamValues(null);
    setParamRejected(false);
  }, [proposal]);

  const paramEntities = useMemo<Entity[]>(
    () => (proposal && paramValues ? buildParametric(proposal, paramValues, "corte") : []),
    [proposal, paramValues],
  );

  /* A2 — cotas aprovadas viram texto na camada COTA. */
  const ocrEntities = useMemo<Entity[]>(() => {
    const geo = logo ?? analysis;
    if (!geo) return [];
    const s2 = cal.mmPerPx;
    return ocr
      .filter((c) => c.approved)
      .map((c) => ({
        id: uid(),
        layer: "cota",
        type: "text" as const,
        x: (c.box.x * geo.imagePx.w - geo.contentPx.x) * s2,
        y: ((c.box.y + c.box.h) * geo.imagePx.h - geo.contentPx.y) * s2,
        text: c.text,
        size: Math.max(2, c.box.h * geo.imagePx.h * s2),
      }));
  }, [ocr, analysis, logo, cal]);

  const runOcr = async () => {
    if (!img || ocrBusy) return;
    setOcrBusy(true);
    setOcrStage({ stage: "Carregando OCR", pct: 4 });
    try {
      const found = await detectDimensions(img.element, {
        onProgress: (stage, pct) => setOcrStage({ stage, pct }),
      });
      setOcr(found);
      toast[found.length ? "success" : "error"](
        found.length
          ? `${found.length} cota(s) candidata(s). Confirme uma a uma.`
          : "Nenhuma cota reconhecida nesta imagem.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no OCR.");
    } finally {
      setOcrBusy(false);
      setOcrStage(null);
    }
  };

  const applyDimension = () => {
    const geo = logo ?? analysis;
    if (!geo) return;
    const w = Number(widthMm.replace(",", "."));
    const next = calibrateByDimension(geo.contentPx, { widthMm: w });
    if (!next) {
      toast.error("Informe uma largura válida em mm.");
      return;
    }
    setCal(next);
    toast.success(`Escala: ${next.mmPerPx.toFixed(4)} mm/px`);
  };

  const applyMeasure = () => {
    if (calPts.length < 2) {
      toast.error("Selecione dois pontos na imagem.");
      return;
    }
    const next = calibrateByMeasure(calPts[0]!, calPts[1]!, Number(realMm.replace(",", ".")));
    if (!next) {
      toast.error("Distância real inválida.");
      return;
    }
    setCal(next);
    toast.success(`Escala: ${next.mmPerPx.toFixed(4)} mm/px`);
  };

  const create = () => {
    if (!img || (!analysis && !logo)) return;
    // template aceito: a geometria vetorizada original é preservada em CONSTRUÇÃO
    const base = paramEntities.length
      ? [...paramEntities, ...normalized.entities.map((e) => ({ ...e, layer: "construcao" }))]
      : normalized.entities;
    const list = [...base, ...ocrEntities];
    if (!list.length) {
      toast.error("Nada para inserir.");
      return;
    }
    if (manualEntities.length && !calibrated) {
      toast.error("Calibre a escala antes de criar a geometria manual.");
      return;
    }

    const s = cal.mmPerPx;
    const geo = (logo ?? analysis)!;
    onCreate(list, {
      src: img.dataUrl,
      name: img.name,
      widthMm: geo.imagePx.w * s,
      heightMm: geo.imagePx.h * s,
      x: -geo.contentPx.x * s,
      y: -geo.contentPx.y * s,
      opacity: 0.35,
      visible: true,
      locked: true,
    });
    toast.success(`${list.length} entidades criadas no plano.`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="vision-dialog flex max-h-[70dvh] w-[min(90vw,36rem)] max-w-none flex-col overflow-y-auto border p-4 shadow-2xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            CHAMFER VISION
            <span className="ml-2 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Imagem → Vetor
            </span>
            {quota.unlimited ? (
              <span className="pro-surface ml-2 rounded-full px-2 py-0.5 align-middle font-mono text-[9px] tracking-[0.18em] text-pro uppercase">
                Vision ilimitado
              </span>
            ) : (
              <span className="ml-2 rounded-full border border-line px-2 py-0.5 align-middle font-mono text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
                Vision hoje {quota.used}/{quota.limit}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        {step === "importar" && (
          <label className="metal flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-12 text-center">
            <Upload className="size-6 text-accent" />
            <span className="text-sm">Importar imagem</span>
            <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              PNG · JPG · JPEG · WEBP
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void pick(f);
              }}
            />
          </label>
        )}

        {step === "previa" && img && (
          <div className="flex min-h-0 flex-col gap-3">
            <div
              className="relative flex aspect-[4/3] w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white"
              style={{ maxHeight: "45vh" }}
            >
              <img
                src={img.dataUrl}
                alt={`Pré-visualização de ${img.name}`}
                style={{ transform: `rotate(${rotation}deg) scale(${zoom})`, opacity }}
                className="mx-auto block h-full w-full max-h-[45vh] object-contain object-center transition-transform"
              />
              {ocr.map((c) => (
                <div
                  key={c.id}
                  className="pointer-events-none absolute rounded-[3px] border"
                  style={{
                    left: `${c.box.x * 100}%`,
                    top: `${c.box.y * 100}%`,
                    width: `${c.box.w * 100}%`,
                    height: `${c.box.h * 100}%`,
                    borderColor: c.approved ? DIMENSION_COLOR : MARK_COLOR,
                    background: c.approved ? `${DIMENSION_COLOR}22` : "transparent",
                  }}
                />
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <Slider label="Zoom" value={zoom} min={0.4} max={3} step={0.05} onChange={setZoom} />
              <Slider
                label="Opacidade"
                value={opacity}
                min={0.2}
                max={1}
                step={0.05}
                onChange={setOpacity}
              />
            </div>

            <Section title="Modo de vetorização" icon={Spline}>
              <div className="grid grid-cols-3 gap-2">
                <Toggle
                  active={mode === "tecnico"}
                  onClick={() => setMode("tecnico")}
                  label="técnico"
                />
                <Toggle
                  active={mode === "logo"}
                  onClick={() => setMode("logo")}
                  label="logo (curvas)"
                />
                <Toggle
                  active={mode === "tracado"}
                  onClick={() => setMode("tracado")}
                  label="traçado (centro)"
                />
              </div>
              <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
                {mode === "tecnico"
                  ? "Reconhece linhas, arcos e círculos de desenhos técnicos."
                  : mode === "logo"
                    ? "Preserva curvas de Bézier reais — exporta SPLINE, sem microsegmentos."
                    : "Extrai a LINHA CENTRAL do traço à mão — um traço, uma polilinha. Fotografe de cima, paralelo ao papel, com luz uniforme."}
              </p>
              {Math.min(img.widthPx, img.heightPx) < 600 && (
                <p className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-500">
                  Imagem de baixa resolução detectada. O resultado pode ter bordas imprecisas.
                  Prefira a maior versão disponível.
                </p>
              )}
            </Section>

            <Section title="Cotas na imagem (OCR)" icon={ScanText}>
              <div className="flex flex-wrap items-center gap-2">
                <Chip
                  icon={ScanText}
                  label={ocrBusy ? "lendo…" : "Detectar cotas (OCR)"}
                  onClick={() => void runOcr()}
                />
                {ocr.length > 0 && (
                  <>
                    <Chip
                      icon={Check}
                      label="Aprovar todas"
                      onClick={() => setOcr((l) => l.map((c) => ({ ...c, approved: true })))}
                    />
                    <Chip icon={Eraser} label="Limpar" onClick={() => setOcr([])} />
                  </>
                )}
              </div>
              {ocrStage && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="brand-gradient h-full transition-all"
                    style={{ width: `${Math.max(4, ocrStage.pct)}%` }}
                  />
                </div>
              )}
              <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
                Leitura 100% no seu aparelho. Em foto de desenho à mão a precisão é limitada —
                confira e corrija cada texto antes de aplicar. Nada entra no desenho sem
                confirmação.
              </p>
              {ocr.map((c) => (
                <div
                  key={c.id}
                  className="metal flex flex-wrap items-center gap-2 rounded-2xl p-2.5"
                >
                  <input
                    value={c.text}
                    onChange={(e) =>
                      setOcr((l) =>
                        l.map((o) => (o.id === c.id ? { ...o, text: e.target.value } : o)),
                      )
                    }
                    aria-label="Texto reconhecido"
                    className="w-24 rounded-lg border border-border bg-background/60 px-2 py-1 font-mono text-[11px]"
                  />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {ocrKindLabel(c.kind)}
                    {c.mm != null ? ` · ${c.mm.toFixed(2)} mm` : ""} · {c.confidence}%
                  </span>
                  <div className="ml-auto flex gap-1">
                    {c.mm != null && (
                      <Toggle
                        active={false}
                        onClick={() => {
                          setRealMm(String(c.mm));
                          setCalMode("medida");
                          toast.success("Medida enviada para a calibração por dois pontos.");
                        }}
                        label="usar como escala"
                      />
                    )}
                    <Toggle
                      active={c.approved}
                      onClick={() =>
                        setOcr((l) =>
                          l.map((o) => (o.id === c.id ? { ...o, approved: !o.approved } : o)),
                        )
                      }
                      label={c.approved ? "aprovada" : "aprovar"}
                    />
                  </div>
                </div>
              ))}
            </Section>

            {profile && suggestion && (
              <Section title="Análise da imagem" icon={Scan}>
                <ul className="space-y-0.5 font-mono text-[10px] text-muted-foreground">
                  <li>
                    {profile.widthPx} × {profile.heightPx} px analisados
                    {profile.small ? " · resolução baixa" : " · resolução adequada"}
                  </li>
                  <li>
                    contraste {Math.round(profile.contrast * 100)}% · ruído{" "}
                    {Math.round(profile.noise * 100)}% · traço médio {profile.strokePx.toFixed(1)}{" "}
                    px
                  </li>
                  <li>
                    fundo {profile.uniformBackground ? "uniforme" : "irregular"} ·{" "}
                    {profile.flatArt ? "arte chapada" : "tons contínuos"}
                  </li>
                </ul>
                <p className="font-mono text-[10px] text-accent">
                  Sugestão: modo {suggestion.mode} · tolerância {suggestion.tolerance} · limiar{" "}
                  {suggestion.threshold}
                  {suggestion.adaptive ? " · adaptativo" : ""}
                  {suggestion.normalize ? " · normalizar" : ""}
                </p>
                <ul className="space-y-0.5 font-mono text-[10px] text-muted-foreground">
                  {suggestion.reasons.map((r, i) => (
                    <li key={i}>· {r}</li>
                  ))}
                </ul>
                <Chip icon={Check} label="Usar sugestão" onClick={useSuggestion} />
              </Section>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Chip
                icon={RotateCw}
                label="Girar 90°"
                onClick={() => setRotation((r) => (r + 90) % 360)}
              />
              <span className="font-mono text-[10px] text-muted-foreground">
                {img.widthPx} × {img.heightPx} px
              </span>
              <button
                onClick={run}
                className="brand-gradient ml-auto rounded-xl px-4 py-2 font-display text-sm font-semibold text-background"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === "analisando" && (
          <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl py-14">
            <AuroraBackground className="-z-10" />
            <Loader2 className="size-6 animate-spin text-accent" />
            <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              {progress.stage}…
            </p>
            <div className="h-1.5 w-56 overflow-hidden rounded-full bg-secondary">
              <div
                className="brand-gradient h-full transition-all"
                style={{ width: `${Math.max(4, Math.min(100, progress.pct))}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {Math.round(progress.pct)}%
            </span>
            <Chip icon={X} label="Cancelar" onClick={cancelRun} />
          </div>
        )}

        {step === "resultado" && img && logo && (
          <>
            <p className="font-mono text-[10px] tracking-[0.2em] text-accent uppercase">
              Contornos de Bézier
            </p>
            <LogoCanvas img={img} logo={logo} overlay={overlay} />
            <div className="flex flex-wrap items-center gap-1">
              {(["original", "vetor", "ambos"] as Overlay[]).map((o) => (
                <Toggle key={o} active={overlay === o} onClick={() => setOverlay(o)} label={o} />
              ))}
            </div>
            <LogoStats logo={logo} cal={cal} entities={normalized.entities} />
            <LogoControls opt={logoOpt} onChange={(o) => setLogoOpt({ ...logoOpt, ...o })} />

            <Section title="Multi-escala" icon={Scan}>
              <Toggle
                active={multiScale}
                onClick={() => setMultiScale((v) => !v)}
                label="traçar em 1× / 2× / 4× e escolher o melhor"
              />
            </Section>

            <Section title="Escala" icon={Ruler}>
              <div className="flex items-center gap-2">
                <input
                  value={widthMm}
                  onChange={(e) => setWidthMm(e.target.value)}
                  inputMode="decimal"
                  placeholder="Largura real (mm)"
                  className="metal w-40 rounded-xl px-3 py-2 text-sm outline-none"
                />
                <button
                  onClick={applyDimension}
                  className="rounded-xl border border-border px-3 py-2 text-xs"
                >
                  Aplicar
                </button>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">{cal.note}</p>
            </Section>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setStep("previa")}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm transition-colors hover:bg-secondary"
              >
                Voltar
              </button>
              <button
                disabled={!normalized.entities.length}
                onClick={create}
                className="brand-gradient flex-1 rounded-xl py-2.5 font-display text-sm font-semibold text-background disabled:opacity-40"
              >
                Criar geometria
              </button>
            </div>
          </>
        )}

        {step === "resultado" && img && !logo && analysis && (
          <>
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] tracking-[0.2em] text-accent uppercase">
                {mode === "tracado" ? "Linhas centrais" : "Geometria Técnica Autocorretiva"}
              </p>
              {analysis.auditLog && (
                <span className="rounded-md bg-accent/15 px-2 py-0.5 font-mono text-[9px] font-medium text-accent">
                  CALDRA VISION · {(analysis.iterations?.length ?? 1) - 1} iterações · Score{" "}
                  {((analysis.bestScore ?? 0.95) * 100).toFixed(0)}%
                </span>
              )}
            </div>

            <PreviewCanvas
              focus={focusBox}
              img={img}
              analysis={analysis}
              overlay={overlay}
              rotation={rotation}
              manual={manualOn ? manual : null}
              snapTol={snapTol}
              targets={targets}
              calPts={calMode === "medida" ? calPts : []}
              onPick={(p) => {
                if (manualOn) pushManual(addManualPoint(manual, snapPoint(p, targets, snapTol)));
                else if (calMode === "medida")
                  setCalPts((prev) => (prev.length >= 2 ? [p] : [...prev, p]));
              }}
              onMoveNode={(shape, index, p) =>
                pushManual(moveManualNode(manual, shape, index, snapPoint(p, targets, snapTol)))
              }
            />

            <div className="flex flex-wrap items-center gap-1">
              {(["original", "vetor", "ambos", "diferenca"] as Overlay[]).map((o) => (
                <Toggle
                  key={o}
                  active={overlay === o}
                  onClick={() => setOverlay(o)}
                  label={o === "ambos" ? "sobrepor" : o === "diferenca" ? "mapa de erro" : o}
                />
              ))}
            </div>

            {proposal && !paramRejected && (
              <Section title="Reconstrução paramétrica" icon={Ruler}>
                <div className="metal space-y-2 rounded-2xl p-3">
                  <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">
                    {proposal.title}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {proposal.summary} · encaixe ±{proposal.fitMm.toFixed(1)} mm
                  </p>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-1">
                      {proposal.fields.map((f) => {
                        const v = (paramValues ?? proposalValues(proposal))[f.key] ?? 0;
                        return (
                          <label
                            key={f.key}
                            className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground"
                          >
                            <span className="flex-1 truncate">{f.label}</span>
                            <input
                              type="number"
                              step={f.integer ? 1 : 0.1}
                              value={v}
                              onChange={(e) =>
                                setParamValues((prev) => ({
                                  ...(prev ?? proposalValues(proposal)),
                                  [f.key]: Number(e.target.value),
                                }))
                              }
                              className="w-24 rounded-lg border border-border bg-background/60 px-2 py-1 text-right font-mono text-[11px] text-foreground"
                            />
                            <span className="w-6">{f.unit}</span>
                          </label>
                        );
                      })}
                    </div>
                    <ParamPreview
                      entities={buildParametric(proposal, paramValues ?? proposalValues(proposal))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Toggle
                      active={!!paramValues}
                      onClick={() => setParamValues(proposalValues(proposal))}
                      label={paramValues ? "template aceito" : "aceitar template"}
                    />
                    <Toggle
                      active={false}
                      onClick={() => {
                        setParamValues(null);
                        setParamRejected(true);
                      }}
                      label="rejeitar"
                    />
                  </div>
                  {paramValues && (
                    <p className="font-mono text-[10px] text-muted-foreground">
                      A geometria vetorizada original entra intacta na camada CONSTRUÇÃO; o template
                      editável vai para CORTE.
                    </p>
                  )}
                </div>
              </Section>
            )}

            {ocrEntities.length > 0 && (
              <p className="metal rounded-2xl p-3 font-mono text-[10px] text-muted-foreground">
                {ocrEntities.length} cota(s) de OCR aprovada(s) · camada COTA
              </p>
            )}

            <Stats analysis={analysis} cal={cal} entities={normalized.entities} />

            {mode === "tracado" && center && (
              <>
                <p className="metal rounded-2xl p-3 font-mono text-[10px] text-muted-foreground">
                  {center.centerline.strokes} traços centrais · {center.centerline.lines} linhas ·{" "}
                  {center.centerline.arcs} arcos · {center.centerline.circles} círculos ·{" "}
                  {center.centerline.polylines} polilinhas · camada CORTE
                </p>
                <Section title="Foto de papel" icon={ImageIcon}>
                  <div className="grid grid-cols-2 gap-2">
                    <Slider
                      label={`Brilho ${centerOpt.brightness}`}
                      value={centerOpt.brightness}
                      min={-80}
                      max={80}
                      step={1}
                      onChange={(v) => setCenterOpt({ ...centerOpt, brightness: v })}
                    />
                    <Slider
                      label={`Contraste ${centerOpt.contrast}`}
                      value={centerOpt.contrast}
                      min={-60}
                      max={90}
                      step={1}
                      onChange={(v) => setCenterOpt({ ...centerOpt, contrast: v })}
                    />
                    <Slider
                      label={`Limiar adaptativo ${centerOpt.bias}`}
                      value={centerOpt.bias}
                      min={2}
                      max={40}
                      step={1}
                      onChange={(v) => setCenterOpt({ ...centerOpt, bias: v })}
                    />
                    <Slider
                      label={`Suavizar ${centerOpt.blur}px`}
                      value={centerOpt.blur}
                      min={0}
                      max={3}
                      step={1}
                      onChange={(v) => setCenterOpt({ ...centerOpt, blur: v })}
                    />
                    <Slider
                      label={`Traço mínimo ${centerOpt.minBranchPct}%`}
                      value={centerOpt.minBranchPct}
                      min={0.3}
                      max={6}
                      step={0.1}
                      onChange={(v) => setCenterOpt({ ...centerOpt, minBranchPct: v })}
                    />
                    <Slider
                      label={`Fechar vãos ${centerOpt.gapPct}%`}
                      value={centerOpt.gapPct}
                      min={0}
                      max={4}
                      step={0.1}
                      onChange={(v) => setCenterOpt({ ...centerOpt, gapPct: v })}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Toggle
                      active={centerOpt.invert}
                      onClick={() => setCenterOpt({ ...centerOpt, invert: !centerOpt.invert })}
                      label="inverter tinta"
                    />
                    {(["baixa", "media", "alta"] as Tolerance[]).map((t) => (
                      <Toggle
                        key={t}
                        active={centerOpt.tolerance === t}
                        onClick={() => setCenterOpt({ ...centerOpt, tolerance: t })}
                        label={t}
                      />
                    ))}
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Fotografe de cima, paralelo ao papel — correção de perspectiva não faz parte
                    desta versão.
                  </p>
                </Section>
              </>
            )}

            {mode === "tecnico" && (
              <>
                <Section title="Tolerância" icon={Spline}>
                  <div className="flex gap-1">
                    {(["baixa", "media", "alta"] as Tolerance[]).map((t) => (
                      <Toggle
                        key={t}
                        active={tolerance === t}
                        onClick={() => setTolerance(t)}
                        label={t}
                      />
                    ))}
                  </div>
                </Section>

                <Section title="Binarização" icon={Scan}>
                  <div className="flex flex-wrap items-center gap-1">
                    <Toggle
                      active={adaptive}
                      onClick={() => setAdaptive((v) => !v)}
                      label="limiar adaptativo"
                    />
                    <Toggle
                      active={normalize}
                      onClick={() => setNormalize((v) => !v)}
                      label="normalizar contraste"
                    />
                    <Toggle
                      active={regularize}
                      onClick={() => setRegularize((v) => !v)}
                      label="regularizar"
                    />
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Adaptativo compensa iluminação irregular. Regularizar ortogonaliza e fecha
                    círculos apenas dentro da tolerância.
                  </p>
                </Section>

                {quality && (
                  <Section title="Qualidade" icon={Check}>
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
                      <span className="text-accent">Score {quality.score}/100</span>
                      <span>desvio máx {quality.maxDevMm.toFixed(2)} mm</span>
                      <span>médio {quality.avgDevMm.toFixed(2)} mm</span>
                      <span>
                        {quality.counts.detectada} detectadas · {quality.counts.convertida}{" "}
                        convertidas · {quality.counts.aproximada} aproximadas
                      </span>
                    </div>
                    {quality.low.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-mono text-[10px] text-amber-500">
                          {quality.low.length} entidade(s) de baixa confiança
                        </p>
                        <div className="flex max-h-24 flex-wrap gap-1 overflow-auto">
                          {quality.low.slice(0, 24).map((it) => (
                            <button
                              key={it.index}
                              onClick={() => setFocusBox(it.box)}
                              className="rounded-lg border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              #{it.index + 1} {it.kind} · {it.devMm.toFixed(2)} mm
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </Section>
                )}

                <Section title="Limpeza" icon={Eraser}>
                  <div className="flex flex-wrap items-center gap-1">
                    {[0, 1, 2].map((n) => (
                      <Toggle
                        key={n}
                        active={noise === n}
                        onClick={() => setNoise(n)}
                        label={n === 0 ? "sem ruído" : n === 1 ? "limpar ruído" : "limpar forte"}
                      />
                    ))}
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {duplicates} duplicadas · {normalized.report.removedTiny} minúsculas
                    </span>
                  </div>
                  {normalized.report.nearlyClosed.length > 0 && (
                    <p className="font-mono text-[10px] text-amber-500">
                      {normalized.report.nearlyClosed.length} contorno(s) quase fechado(s) — revise
                      após inserir.
                    </p>
                  )}
                </Section>
              </>
            )}

            <Section title="Escala" icon={Ruler}>
              <div className="flex gap-1">
                <Toggle
                  active={calMode === "dimensao"}
                  onClick={() => setCalMode("dimensao")}
                  label="dimensões"
                />
                <Toggle
                  active={calMode === "medida"}
                  onClick={() => setCalMode("medida")}
                  label="2 pontos"
                />
              </div>
              {calMode === "dimensao" ? (
                <div className="flex items-center gap-2">
                  <input
                    value={widthMm}
                    onChange={(e) => setWidthMm(e.target.value)}
                    inputMode="decimal"
                    placeholder="Largura real (mm)"
                    className="metal w-40 rounded-xl px-3 py-2 text-sm outline-none"
                  />
                  <button
                    onClick={applyDimension}
                    className="rounded-xl border border-border px-3 py-2 text-xs"
                  >
                    Aplicar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {calPts.length}/2 pontos
                  </span>
                  <input
                    value={realMm}
                    onChange={(e) => setRealMm(e.target.value)}
                    inputMode="decimal"
                    className="metal w-24 rounded-xl px-3 py-2 text-sm outline-none"
                  />
                  <button
                    onClick={applyMeasure}
                    className="rounded-xl border border-border px-3 py-2 text-xs"
                  >
                    Calibrar
                  </button>
                </div>
              )}
              <p className="font-mono text-[10px] text-muted-foreground">{cal.note}</p>
            </Section>

            <Section title="Validação" icon={Check}>
              <ul className="space-y-0.5 font-mono text-[10px]">
                <li>
                  ✓ {validation.counts.lines} linhas · {validation.counts.circles} círculos ·{" "}
                  {validation.counts.arcs} arcos
                </li>
                <li>✓ {validation.counts.closed} contornos fechados · unidade mm · 1:1</li>
                {validation.issues.map((i, idx) => (
                  <li key={idx} className="text-amber-500">
                    ⚠ {i.message}
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Vetorização manual" icon={MousePointerClick}>
              <div className="flex flex-wrap items-center gap-1">
                <Toggle
                  active={manualOn}
                  onClick={() => setManualOn(!manualOn)}
                  label={manualOn ? "ativa" : "vetorizar manualmente"}
                />
                {manualOn && (
                  <>
                    <Toggle
                      active={manual.mode === "linha"}
                      onClick={() => setManual({ ...manual, mode: "linha", pending: [] })}
                      label="linha"
                    />
                    <Toggle
                      active={manual.mode === "arco"}
                      onClick={() => setManual({ ...manual, mode: "arco", pending: [] })}
                      label="arco (3 pontos)"
                    />
                    <Chip
                      icon={CircleIcon}
                      label="Fechar contorno"
                      onClick={() => pushManual(closeManualContour(manual))}
                    />
                    <Chip
                      icon={Undo2}
                      label="Remover ponto"
                      onClick={() => pushManual(removeLastManualPoint(manual))}
                    />
                    <Chip icon={Undo2} label="Desfazer" onClick={undoManual} />
                    <Chip icon={RotateCw} label="Refazer" onClick={redoManual} />
                  </>
                )}
              </div>
              {manualOn && (
                <>
                  <Slider
                    label={`Captura (snap) ${snapTol}px`}
                    value={snapTol}
                    min={0}
                    max={40}
                    step={1}
                    onChange={setSnapTol}
                  />
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {manualPointCount(manual)} pontos · {manualEntities.length} entidades ·{" "}
                    {manual.mode === "arco" ? `arco ${manual.pending.length}/3` : "linha encadeada"}{" "}
                    · arraste um ponto para movê-lo · role para dar zoom
                  </p>
                  {!calibrated && (
                    <p className="font-mono text-[10px] text-amber-500">
                      Calibre a escala antes de criar geometria manual — os pontos precisam nascer
                      em mm.
                    </p>
                  )}
                </>
              )}
            </Section>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setStep("previa")}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm transition-colors hover:bg-secondary"
              >
                Voltar
              </button>
              <button
                disabled={!normalized.entities.length || (!!manualEntities.length && !calibrated)}
                onClick={create}
                className="brand-gradient flex-1 rounded-xl py-2.5 font-display text-sm font-semibold text-background disabled:opacity-40"
              >
                Criar geometria
              </button>
            </div>
          </>
        )}

        {step === "resultado" && img && !logo && !analysis && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Não foi possível reconhecer a geometria desta imagem. Ajuste os parâmetros e tente de
              novo, ou vetorize manualmente sobre a imagem.
            </p>
            <div className="flex flex-wrap gap-1">
              {(["baixa", "media", "alta"] as Tolerance[]).map((t) => (
                <Toggle
                  key={t}
                  active={tolerance === t}
                  onClick={() => {
                    setTolerance(t);
                    void run();
                  }}
                  label={t}
                />
              ))}
              <Chip
                icon={MousePointerClick}
                label="Vetorizar manualmente"
                onClick={() => {
                  setManualOn(true);
                  setAnalysis({
                    prims: [],
                    stats: { lines: 0, circles: 0, arcs: 0, polylines: 0, contours: 0, holes: 0 },
                    imagePx: { w: img.widthPx, h: img.heightPx },
                    contentPx: { x: 0, y: 0, w: img.widthPx, h: img.heightPx },
                    tolerancePx: 1,
                  });
                  setError(null);
                }}
              />
            </div>
            <button
              onClick={() => setStep("previa")}
              className="w-full rounded-xl border border-border py-2.5 text-sm transition-colors hover:bg-secondary"
            >
              Voltar
            </button>
          </div>
        )}
      </DialogContent>
      <VisionLimitDialog open={limitOpen} onOpenChange={setLimitOpen} />
    </Dialog>
  );
}

/* ------------------------------------------------------------ auxiliares */

function PreviewCanvas({
  img,
  analysis,
  overlay,
  rotation,
  manual,
  snapTol,
  targets,
  calPts,
  focus,
  onPick,
  onMoveNode,
}: {
  img: ImportedImage;
  analysis: VisionAnalysis;
  overlay: Overlay;
  rotation: number;
  manual: ManualState | null;
  snapTol: number;
  targets: { x: number; y: number }[];
  calPts: { x: number; y: number }[];
  focus: { x: number; y: number; w: number; h: number } | null;
  onPick: (p: { x: number; y: number }) => void;
  onMoveNode: (shape: number, index: number, p: { x: number; y: number }) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const { w, h } = analysis.imagePx;
  const [view, setView] = useState({ x: 0, y: 0, w, h });
  const drag = useRef<{
    sx: number;
    sy: number;
    vx: number;
    vy: number;
    moved: boolean;
    node: { shape: number; index: number } | null;
  } | null>(null);

  useEffect(() => setView({ x: 0, y: 0, w, h }), [w, h]);

  // "ir até a entidade": enquadra a caixa recebida com folga
  useEffect(() => {
    if (!focus) return;
    const pad = Math.max(focus.w, focus.h, w / 40) * 0.8;
    const bw = Math.max(focus.w + pad * 2, w / 20);
    const bh = bw * (h / w);
    setView({
      x: focus.x + focus.w / 2 - bw / 2,
      y: focus.y + focus.h / 2 - bh / 2,
      w: bw,
      h: bh,
    });
  }, [focus, w, h]);

  const toImage = useCallback(
    (clientX: number, clientY: number) => {
      const svg = ref.current;
      if (!svg) return { x: 0, y: 0 };
      const r = svg.getBoundingClientRect();
      return {
        x: view.x + ((clientX - r.left) / r.width) * view.w,
        y: view.y + ((clientY - r.top) / r.height) * view.h,
      };
    },
    [view],
  );

  // zoom por roda com âncora no cursor (listener nativo, não passivo)
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const r = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const k = Math.min(4, Math.max(0.25, Math.exp(dy * 0.0015)));
      const nw = Math.min(w * 4, Math.max(w / 20, v.w * k));
      const nh = nw * (v.h / v.w);
      const px = v.x + ((e.clientX - r.left) / r.width) * v.w;
      const py = v.y + ((e.clientY - r.top) / r.height) * v.h;
      setView({
        x: px - (px - v.x) * (nw / v.w),
        y: py - (py - v.y) * (nh / v.h),
        w: nw,
        h: nh,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [w]);

  const nodes = manual ? manualNodes(manual) : [];
  const nodeR = Math.max(2, view.w / 160);

  const down = (e: React.PointerEvent) => {
    const p = toImage(e.clientX, e.clientY);
    let node: { shape: number; index: number } | null = null;
    if (manual) {
      let bd = nodeR * 2;
      for (const n of nodes) {
        const d = Math.hypot(n.p.x - p.x, n.p.y - p.y);
        if (d <= bd) {
          bd = d;
          node = { shape: n.shape, index: n.index };
        }
      }
    }
    drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false, node };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    if (d.node) {
      onMoveNode(d.node.shape, d.node.index, toImage(e.clientX, e.clientY));
      return;
    }
    const svg = ref.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    setView((v) => ({ ...v, x: d.vx - (dx / r.width) * v.w, y: d.vy - (dy / r.height) * v.h }));
  };

  const up = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    onPick(toImage(e.clientX, e.clientY));
  };

  return (
    <div className="h-[42vh] max-h-[42vh] min-h-[200px] w-full shrink-0 overflow-hidden rounded-2xl border border-border bg-white">
      <svg
        ref={ref}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="block h-full w-full touch-none"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        role="img"
        aria-label="Pré-visualização da vetorização"
      >
        {overlay !== "vetor" && (
          <image
            href={img.dataUrl}
            x={0}
            y={0}
            width={w}
            height={h}
            opacity={overlay === "ambos" ? 0.45 : overlay === "diferenca" ? 0.2 : 1}
            transform={rotation ? `rotate(${rotation} ${w / 2} ${h / 2})` : undefined}
            preserveAspectRatio="none"
          />
        )}
        {overlay !== "original" && (
          <g
            fill="none"
            stroke={overlay === "diferenca" ? "#f43f5e" : CUT_COLOR}
            strokeWidth={Math.max(overlay === "diferenca" ? 1.2 : 0.6, view.w / 500)}
          >
            {analysis.prims.map((p, i) => (
              <PrimShape key={i} p={p} />
            ))}
          </g>
        )}
        {manual && (
          <g fill="none" stroke={MARK_COLOR} strokeWidth={Math.max(0.8, view.w / 400)}>
            {manual.shapes.map((sh, i) => (
              <ManualShapeView key={i} shape={sh} />
            ))}
            {manual.pending.length > 1 && (
              <polyline
                points={manual.pending.map((p) => `${p.x},${p.y}`).join(" ")}
                strokeDasharray={`${view.w / 90} ${view.w / 90}`}
              />
            )}
          </g>
        )}
        {manual && snapTol > 0 && (
          <g
            fill="none"
            stroke={DIMENSION_COLOR}
            opacity={0.5}
            strokeWidth={Math.max(0.4, view.w / 900)}
          >
            {targets.map((t, i) => (
              <circle key={i} cx={t.x} cy={t.y} r={nodeR * 0.9} />
            ))}
          </g>
        )}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.p.x} cy={n.p.y} r={nodeR} fill={MARK_COLOR} />
            <text
              x={n.p.x + nodeR * 1.4}
              y={n.p.y - nodeR}
              fontSize={nodeR * 2.6}
              fill={MARK_COLOR}
            >
              P{i + 1}
            </text>
          </g>
        ))}
        {calPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={nodeR} fill={DIMENSION_COLOR} />
        ))}
      </svg>
    </div>
  );
}

/** Desenho de uma forma manual: polilinha reta ou arco por 3 pontos. */
function ManualShapeView({ shape }: { shape: NonNullable<ManualState["shapes"][number]> }) {
  if (shape.kind === "arc") {
    const [a, b, c] = shape.pts;
    if (!a || !b || !c) return null;
    const fit = arcFrom3Points(a, b, c);
    if (!fit) return <polyline points={`${a.x},${a.y} ${c.x},${c.y}`} />;
    let sweep = fit.a1 - fit.a0;
    while (sweep < 0) sweep += Math.PI * 2;
    const x0 = fit.cx + fit.r * Math.cos(fit.a0);
    const y0 = fit.cy + fit.r * Math.sin(fit.a0);
    const x1 = fit.cx + fit.r * Math.cos(fit.a1);
    const y1 = fit.cy + fit.r * Math.sin(fit.a1);
    return (
      <path d={`M ${x0} ${y0} A ${fit.r} ${fit.r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x1} ${y1}`} />
    );
  }
  const pts = shape.pts.map((p) => `${p.x},${p.y}`).join(" ");
  return shape.closed ? <polygon points={pts} /> : <polyline points={pts} />;
}

/** Prévia do traçado de logo: curvas reais, furos em âmbar. */
function LogoCanvas({
  img,
  logo,
  overlay,
}: {
  img: ImportedImage;
  logo: LogoAnalysis;
  overlay: Overlay;
}) {
  const { w, h } = logo.imagePx;
  const ref = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, w, h });
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  useEffect(() => setView({ x: 0, y: 0, w, h }), [w, h]);

  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const r = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const k = Math.min(4, Math.max(0.25, Math.exp(dy * 0.0015)));
      const nw = Math.min(w * 4, Math.max(w / 20, v.w * k));
      const nh = nw * (v.h / v.w);
      const px = v.x + ((e.clientX - r.left) / r.width) * v.w;
      const py = v.y + ((e.clientY - r.top) / r.height) * v.h;
      setView({
        x: px - (px - v.x) * (nw / v.w),
        y: py - (py - v.y) * (nh / v.h),
        w: nw,
        h: nh,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [w]);

  return (
    <div className="h-[42vh] max-h-[42vh] min-h-[200px] w-full shrink-0 overflow-hidden rounded-2xl border border-border bg-white">
      <svg
        ref={ref}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="block h-full w-full touch-none"
        role="img"
        aria-label="Prévia do traçado por curvas"
        onPointerDown={(e) => {
          drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          const el = ref.current;
          if (!d || !el) return;
          const r = el.getBoundingClientRect();
          setView((v) => ({
            ...v,
            x: d.vx - ((e.clientX - d.sx) / r.width) * v.w,
            y: d.vy - ((e.clientY - d.sy) / r.height) * v.h,
          }));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        {overlay !== "vetor" && (
          <image
            href={img.dataUrl}
            x={0}
            y={0}
            width={w}
            height={h}
            opacity={overlay === "ambos" ? 0.35 : 1}
            preserveAspectRatio="none"
          />
        )}
        {overlay !== "original" && (
          <g fill="none" strokeWidth={Math.max(1, view.w / 500)}>
            {logo.layers.flatMap((l, li) =>
              l.paths.map((t, i) => (
                <path
                  key={`${li}-${i}`}
                  d={pathToSvg(t.start, t.segs, true)}
                  stroke={t.hole ? MARK_COLOR : CUT_COLOR}
                />
              )),
            )}
          </g>
        )}
      </svg>
    </div>
  );
}

function LogoStats({
  logo,
  cal,
  entities,
}: {
  logo: LogoAnalysis;
  cal: Calibration;
  entities: Entity[];
}) {
  const s = cal.mmPerPx;
  return (
    <div className="metal grid grid-cols-2 gap-1 rounded-2xl p-3 font-mono text-[10px] text-muted-foreground">
      <span>{logo.stats.contours} contornos</span>
      <span>{logo.stats.holes} furos</span>
      <span>{logo.stats.curves} curvas</span>
      <span>{logo.stats.segments} segmentos</span>
      <span className="col-span-2 text-foreground">
        {(logo.contentPx.w * s).toFixed(1)} × {(logo.contentPx.h * s).toFixed(1)} mm ·{" "}
        {entities.length} entidades · SPLINE no DXF
      </span>
    </div>
  );
}

const TURN_POLICIES: TurnPolicy[] = ["minority", "majority", "black", "white", "left", "right"];

function LogoControls({
  opt,
  onChange,
}: {
  opt: LogoOptions;
  onChange: (o: Partial<LogoOptions>) => void;
}) {
  return (
    <>
      <Section title="Pré-processamento" icon={ImageIcon}>
        <div className="grid grid-cols-2 gap-2">
          <Slider
            label={`Ampliação ${opt.upscale}×`}
            value={opt.upscale}
            min={1}
            max={4}
            step={1}
            onChange={(v) => onChange({ upscale: v })}
          />
          <Slider
            label={`Suavizar (JPG) ${opt.blur}px`}
            value={opt.blur}
            min={0}
            max={3}
            step={1}
            onChange={(v) => onChange({ blur: v })}
          />
          <Slider
            label={`Limiar ${opt.threshold}`}
            value={opt.threshold}
            min={20}
            max={235}
            step={1}
            onChange={(v) => onChange({ threshold: v })}
          />
          <Slider
            label={`Fechar furos ${opt.closeHoles}`}
            value={opt.closeHoles}
            min={0}
            max={3}
            step={1}
            onChange={(v) => onChange({ closeHoles: v })}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <Toggle
            active={opt.invert}
            onClick={() => onChange({ invert: !opt.invert })}
            label="inverter tinta"
          />
          <Toggle
            active={opt.detectCircles}
            onClick={() => onChange({ detectCircles: !opt.detectCircles })}
            label="furos redondos → círculo"
          />
        </div>
      </Section>

      <Section title="Traçado" icon={Spline}>
        <div className="grid grid-cols-2 gap-2">
          <Slider
            label={`Poeira (turdsize) ${opt.turdsize}`}
            value={opt.turdsize}
            min={0}
            max={12}
            step={1}
            onChange={(v) => onChange({ turdsize: v })}
          />
          <Slider
            label={`Cantos (alphamax) ${opt.alphamax.toFixed(2)}`}
            value={opt.alphamax}
            min={0}
            max={1.34}
            step={0.02}
            onChange={(v) => onChange({ alphamax: v })}
          />
          <Slider
            label={`Fidelidade (opttolerance) ${opt.opttolerance.toFixed(2)}`}
            value={opt.opttolerance}
            min={0.05}
            max={1}
            step={0.05}
            onChange={(v) => onChange({ opttolerance: v })}
          />
          <Slider
            label={`Cores ${opt.colors}`}
            value={opt.colors}
            min={1}
            max={6}
            step={1}
            onChange={(v) => onChange({ colors: v })}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {TURN_POLICIES.map((t) => (
            <Toggle
              key={t}
              active={opt.turnpolicy === t}
              onClick={() => onChange({ turnpolicy: t })}
              label={t}
            />
          ))}
        </div>
      </Section>
    </>
  );
}

function PrimShape({ p }: { p: Prim }) {
  if (p.kind === "line") return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} />;
  if (p.kind === "circle") return <circle cx={p.cx} cy={p.cy} r={p.r} />;
  if (p.kind === "arc") {
    const x0 = p.cx + p.r * Math.cos(p.a0);
    const y0 = p.cy + p.r * Math.sin(p.a0);
    const x1 = p.cx + p.r * Math.cos(p.a1);
    const y1 = p.cy + p.r * Math.sin(p.a1);
    let sweep = p.a1 - p.a0;
    while (sweep < 0) sweep += Math.PI * 2;
    return <path d={`M ${x0} ${y0} A ${p.r} ${p.r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x1} ${y1}`} />;
  }
  return (
    <polyline
      points={
        p.pts.map((q) => `${q.x},${q.y}`).join(" ") +
        (p.closed && p.pts[0] ? ` ${p.pts[0].x},${p.pts[0].y}` : "")
      }
    />
  );
}

function ParamPreview({ entities }: { entities: Entity[] }) {
  const b = parametricBounds(entities);
  const pad = Math.max(b.w, b.h) * 0.06;
  return (
    <svg
      viewBox={`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`}
      className="h-28 w-28 rounded-xl border border-border bg-background/40"
    >
      {entities.map((e) =>
        e.type === "circle" ? (
          <circle
            key={e.id}
            cx={e.cx}
            cy={e.cy}
            r={e.r}
            fill="none"
            stroke={CUT_COLOR}
            strokeWidth={Math.max(b.w, b.h) / 160}
          />
        ) : e.type === "polyline" ? (
          <polygon
            key={e.id}
            points={e.pts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={CUT_COLOR}
            strokeWidth={Math.max(b.w, b.h) / 160}
          />
        ) : null,
      )}
    </svg>
  );
}

function Stats({
  analysis,
  cal,
  entities,
}: {
  analysis: VisionAnalysis;
  cal: Calibration;
  entities: Entity[];
}) {
  const s = cal.mmPerPx;
  return (
    <div className="metal grid grid-cols-2 gap-1 rounded-2xl p-3 font-mono text-[10px] text-muted-foreground">
      <span>{analysis.stats.lines} linhas</span>
      <span>{analysis.stats.circles} círculos</span>
      <span>{analysis.stats.arcs} arcos</span>
      <span>{analysis.stats.polylines} polilinhas</span>
      <span>{analysis.stats.contours} contornos</span>
      <span>{analysis.stats.holes} furos</span>
      <span className="col-span-2 text-foreground">
        {(analysis.contentPx.w * s).toFixed(1)} × {(analysis.contentPx.h * s).toFixed(1)} mm ·{" "}
        {entities.length} entidades
      </span>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Ruler;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        <Icon className="size-3" /> {title}
      </p>
      {children}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl px-2.5 py-1.5 font-mono text-[10px] tracking-wider uppercase transition-colors ${
        active
          ? "vision-control border-accent text-accent"
          : "vision-control text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function Chip({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof RotateCw;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="vision-control flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-mono text-[10px] tracking-wider uppercase text-muted-foreground transition-colors hover:text-foreground"
    >
      <Icon className="size-3" /> {label}
    </button>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const decimals = (() => {
    const s = String(step);
    const i = s.indexOf(".");
    return i < 0 ? 0 : s.length - i - 1;
  })();
  const fmt = (v: number) => v.toFixed(decimals);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const n = Number(draft.replace(",", "."));
    setEditing(false);
    if (!Number.isFinite(n)) return;
    const snapped = Math.round((n - min) / step) * step + min;
    onChange(Number(Math.min(max, Math.max(min, snapped)).toFixed(decimals)));
  };

  return (
    <label className="space-y-1">
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
        {editing ? (
          <input
            autoFocus
            value={draft}
            inputMode="decimal"
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setEditing(false);
              }
            }}
            aria-label={`Valor de ${label}`}
            className="w-16 rounded-md border border-accent bg-transparent px-1 py-0.5 text-right font-mono text-[10px] outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(fmt(value));
              setEditing(true);
            }}
            aria-label={`Editar valor de ${label}`}
            className="rounded-md px-1 py-0.5 font-mono text-[10px] text-accent transition-colors hover:bg-accent/10"
          >
            {fmt(value)}
          </button>
        )}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
    </label>
  );
}

export const VISION_ICONS = { ImageIcon, Scan, CircleIcon, X };
