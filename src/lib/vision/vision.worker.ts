/// <reference lib="webworker" />
/**
 * Web Worker do CHAMFER VISION — mantém a UI fluida durante a vetorização.
 * O cancelamento é feito encerrando o worker (`terminate`) no cliente.
 */

import { runVisionPipeline, type VisionRequest } from "./pipeline";

type Incoming = { id: number; req: VisionRequest };

self.onmessage = (ev: MessageEvent<Incoming>) => {
  const { id, req } = ev.data;
  try {
    const result = runVisionPipeline(req, (p) =>
      (self as unknown as Worker).postMessage({ id, type: "progress", ...p }),
    );
    (self as unknown as Worker).postMessage({ id, type: "done", result });
  } catch (e) {
    (self as unknown as Worker).postMessage({
      id,
      type: "error",
      message: e instanceof Error ? e.message : "Falha na análise.",
    });
  }
};
