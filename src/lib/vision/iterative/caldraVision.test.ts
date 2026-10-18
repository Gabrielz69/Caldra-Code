// @ts-nocheck
import { describe, it, expect } from "vitest";
import { VectorRasterizer } from "./vectorRasterizer";
import { VectorComparisonEngine } from "./vectorComparisonEngine";
import { GeometricConsensusEngine } from "./geometricConsensusEngine";
import { GeometryOptimizer } from "./geometryOptimizer";
import { VectorizationOrchestrator } from "./orchestrator";
import type { Prim } from "../geometryRecognizer";

describe("CALDRA VISION — VETORIZAÇÃO ITERATIVA AUTOCORRETIVA", () => {
  it("TESTE 1: VectorRasterizer gera máscara binária de linhas e círculos em software puro", () => {
    const width = 100;
    const height = 100;
    const prims: Prim[] = [
      { kind: "line", x1: 10, y1: 10, x2: 90, y2: 10, hole: false, quality: 1.0 },
      { kind: "circle", cx: 50, cy: 50, r: 20, hole: true, quality: 1.0 },
    ];

    const mask = VectorRasterizer.rasterize(prims, width, height, 2);
    expect(mask.length).toBe(width * height);

    // Deve haver pixels pintados na linha horizontal (y=10)
    expect(mask[10 * width + 50]).toBe(1);

    // Deve haver pixels pintados na borda do círculo (ex: cx=50, cy=30)
    expect(mask[30 * width + 50]).toBe(1);

    // Centro do círculo deve ser 0 (fundo)
    expect(mask[50 * width + 50]).toBe(0);
  });

  it("TESTE 2: VectorComparisonEngine calcula IoU exato e gera mapa de erros", () => {
    const width = 50;
    const height = 50;
    const maskA = new Uint8Array(width * height);
    const maskB = new Uint8Array(width * height);

    // Pinta um quadrado 10x10 em maskA
    for (let y = 10; y < 20; y++) {
      for (let x = 10; x < 20; x++) {
        maskA[y * width + x] = 1;
      }
    }

    // Pinta o mesmo quadrado em maskB
    for (let y = 10; y < 20; y++) {
      for (let x = 10; x < 20; x++) {
        maskB[y * width + x] = 1;
      }
    }

    // Máscaras idênticas
    const compIdentical = VectorComparisonEngine.compare(maskA, maskB, width, height);
    expect(compIdentical.iou).toBe(1.0);
    expect(compIdentical.missingPixelsRatio).toBe(0);
    expect(compIdentical.extraPixelsRatio).toBe(0);

    // Adiciona pixels extras em maskB (erro)
    maskB[30 * width + 30] = 1;
    const compDiff = VectorComparisonEngine.compare(maskA, maskB, width, height);
    expect(compDiff.iou).toBeLessThan(1.0);
    expect(compDiff.errorMap?.[30 * width + 30]).toBe(2); // extra pixel
  });

  it("TESTE 3: GeometricConsensusEngine funde linhas colineares e círculos concêntricos", () => {
    // Duas hipóteses de círculos próximos
    const cand1 = {
      id: "c1",
      method: "m1",
      scale: 1,
      parameters: {},
      visualScore: 0.9,
      geometricScore: 0.9,
      topologyScore: 1,
      complexityScore: 1,
      finalScore: 0.92,
      confidence: 0.9,
      prims: [{ kind: "circle" as const, cx: 100, cy: 100, r: 25, hole: false, quality: 0.9 }],
    };

    const cand2 = {
      id: "c2",
      method: "m2",
      scale: 1,
      parameters: {},
      visualScore: 0.92,
      geometricScore: 0.95,
      topologyScore: 1,
      complexityScore: 1,
      finalScore: 0.94,
      confidence: 0.95,
      prims: [
        { kind: "circle" as const, cx: 100.4, cy: 99.8, r: 25.1, hole: false, quality: 0.95 },
      ],
    };

    const consensus = GeometricConsensusEngine.formConsensus([cand1, cand2]);
    expect(consensus.length).toBe(1);
    expect(consensus[0].kind).toBe("circle");
    if (consensus[0].kind === "circle") {
      expect(consensus[0].cx).toBeCloseTo(100.2, 1);
      expect(consensus[0].cy).toBeCloseTo(99.9, 1);
      expect(consensus[0].r).toBeCloseTo(25.05, 1);
    }
  });

  it("TESTE 4: TechnicalGeometryPrior ortogonaliza linhas quase horizontais e fecha cantos", () => {
    // Linha quase horizontal com leve inclinação (ex: 0.5 graus)
    const cand = {
      id: "c1",
      method: "m1",
      scale: 1,
      parameters: {},
      visualScore: 0.9,
      geometricScore: 0.9,
      topologyScore: 1,
      complexityScore: 1,
      finalScore: 0.9,
      confidence: 0.9,
      prims: [
        { kind: "line" as const, x1: 10, y1: 50, x2: 150, y2: 50.3, hole: false, quality: 0.9 },
        {
          kind: "line" as const,
          x1: 150.8,
          y1: 51.1,
          x2: 150.8,
          y2: 120,
          hole: false,
          quality: 0.9,
        },
      ],
    };

    const consensus = GeometricConsensusEngine.formConsensus([cand], {
      angularToleranceDeg: 2.0,
      coincidenceTolerance: 3.0,
    });

    const l1 = consensus[0];
    const l2 = consensus[1];
    expect(l1.kind).toBe("line");
    expect(l2.kind).toBe("line");

    if (l1.kind === "line" && l2.kind === "line") {
      // Linha 1 deve ter sido ortogonalizada (y1 == y2)
      expect(l1.y1).toBeCloseTo(l1.y2, 5);
      // Linha 2 deve ter sido ortogonalizada (x1 == x2)
      expect(l2.x1).toBeCloseTo(l2.x2, 5);
      // Canto deve ter feito snap de fechamento
      expect(Math.hypot(l1.x2 - l2.x1, l1.y2 - l2.y1)).toBeLessThan(0.01);
    }
  });

  it("TESTE 5: GeometryOptimizer une múltiplos microsegmentos colineares em uma única linha contínua", () => {
    const fragmentedLines: Prim[] = [
      { kind: "line", x1: 0, y1: 0, x2: 30, y2: 0, hole: false, quality: 0.8 },
      { kind: "line", x1: 30, y1: 0, x2: 65, y2: 0, hole: false, quality: 0.8 },
      { kind: "line", x1: 65, y1: 0, x2: 100, y2: 0, hole: false, quality: 0.8 },
    ];

    const width = 120;
    const height = 40;
    const refMask = VectorRasterizer.rasterize(fragmentedLines, width, height, 2);

    const step = GeometryOptimizer.optimizeStep(fragmentedLines, refMask, width, height);

    // Os 3 segmentos colineares contíguos devem ter sido unificados em 1 único segmento de 0 a 100!
    const lines = step.optimizedPrims.filter((p) => p.kind === "line");
    expect(lines.length).toBe(1);
    if (lines[0].kind === "line") {
      expect(lines[0].x1).toBe(0);
      expect(lines[0].x2).toBe(100);
      expect(lines[0].y1).toBe(0);
      expect(lines[0].y2).toBe(0);
    }
  });

  it("TESTE 6: VectorizationOrchestrator executa loop completo com convergência em imagem técnica", () => {
    const width = 120;
    const height = 120;

    // Cria ImageData sintética com um retângulo e um furo circular
    const imgData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
    } as ImageData;
    // Inicializa tudo com branco (fundo)
    for (let i = 0; i < imgData.data.length; i += 4) {
      imgData.data[i] = 255;
      imgData.data[i + 1] = 255;
      imgData.data[i + 2] = 255;
      imgData.data[i + 3] = 255;
    }

    // Desenha traço preto do retângulo (20,20) a (100,100)
    const drawPixel = (x: number, y: number) => {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const idx = (y * width + x) * 4;
        imgData.data[idx] = 0;
        imgData.data[idx + 1] = 0;
        imgData.data[idx + 2] = 0;
      }
    };

    for (let x = 20; x <= 100; x++) {
      drawPixel(x, 20);
      drawPixel(x, 100);
    }
    for (let y = 20; y <= 100; y++) {
      drawPixel(20, y);
      drawPixel(100, y);
    }

    // Executa a nova arquitetura CALDRA Vision
    const progressLogs: string[] = [];
    const result = VectorizationOrchestrator.run(
      imgData,
      { maxIterations: 3, convergenceThreshold: 0.92 },
      (stage) => progressLogs.push(stage),
    );

    expect(result.prims.length).toBeGreaterThan(0);
    expect(result.globalConfidence).toBeGreaterThan(0.5);
    expect(result.iterations.length).toBeGreaterThan(0);
    expect(result.auditLog.engineVersion).toBe("CALDRA-VISION-2.0-ITERATIVE");
    expect(progressLogs.some((p) => p.includes("Analisando"))).toBe(true);
    expect(progressLogs.some((p) => p.includes("concluída"))).toBe(true);
  });
});
