/**
 * visionClient — executa a pipeline no Web Worker com progresso e cancelamento.
 * Se o navegador não suportar módulos em worker, roda na thread principal
 * (mesmo resultado, apenas sem o ganho de fluidez).
 */

import {
  runVisionPipeline,
  type VisionProgress,
  type VisionRequest,
  type VisionResult,
} from "./pipeline";

let worker: Worker | null = null;
let seq = 0;

function ensureWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === "undefined") return null;
  try {
    worker = new Worker(new URL("./vision.worker.ts", import.meta.url), { type: "module" });
    return worker;
  } catch {
    worker = null;
    return null;
  }
}

/** Encerra a análise em andamento. */
export function cancelVision() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

export function runVision(
  req: VisionRequest,
  onProgress?: (p: VisionProgress) => void,
): Promise<VisionResult> {
  const w = ensureWorker();
  if (!w)
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(runVisionPipeline(req, onProgress));
        } catch (e) {
          reject(e instanceof Error ? e : new Error("Falha na análise."));
        }
      }, 0);
    });

  const id = ++seq;
  return new Promise((resolve, reject) => {
    const onMessage = (
      ev: MessageEvent<
        | { id: number; type: "progress"; stage: string; pct: number }
        | { id: number; type: "done"; result: VisionResult }
        | { id: number; type: "error"; message: string }
      >,
    ) => {
      const d = ev.data;
      if (d.id !== id) return;
      if (d.type === "progress") {
        onProgress?.({ stage: d.stage, pct: d.pct });
        return;
      }
      w.removeEventListener("message", onMessage);
      if (d.type === "done") resolve(d.result);
      else reject(new Error(d.message));
    };
    w.addEventListener("message", onMessage);
    w.addEventListener("error", () => reject(new Error("Falha na análise em segundo plano.")), {
      once: true,
    });
    w.postMessage({ id, req });
  });
}
