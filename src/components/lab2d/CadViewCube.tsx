/**
 * CALDRA CHAMFER — VIEW CUBE CAD PROFISSIONAL
 *
 * View Cube interativo compacto para navegação e orientação espacial 3D:
 * - Faces: SUP (Top), FR (Front), LAT (Right), ESQ (Left), POST (Back), INF (Bottom)
 * - Vértices/cantos de acesso rápido para projeções Isométricas (ISO)
 * - Rosa dos ventos / bússola (N, L, S, O)
 * - Botão Home para restaurar vista isométrica padrão
 * - Rotação sincronizada com a câmera 3D ou orientação canônica por preset
 */

import React, { useMemo } from "react";
import { Home, Compass } from "lucide-react";
import type { ViewPresetId } from "@/lib/viz3d/cameraPresets";
import { cn } from "@/lib/utils";

interface CadViewCubeProps {
  activePreset: ViewPresetId;
  onSelectPreset: (preset: ViewPresetId) => void;
  cameraRotation?: { x: number; y: number; z: number };
  className?: string;
}

export function CadViewCube({
  activePreset,
  onSelectPreset,
  cameraRotation,
  className,
}: CadViewCubeProps) {
  // Rotação do cubo baseada na câmera ou no preset ativo
  const transformStyle = useMemo(() => {
    if (cameraRotation) {
      // Converte rotação da câmera (radianos) para rotação visual do cubo
      const degX = -(cameraRotation.x * 180) / Math.PI;
      const degY = -(cameraRotation.y * 180) / Math.PI;
      const degZ = (cameraRotation.z * 180) / Math.PI;
      return `rotateX(${degX.toFixed(1)}deg) rotateY(${degY.toFixed(1)}deg) rotateZ(${degZ.toFixed(1)}deg)`;
    }

    switch (activePreset) {
      case "front":
        return "rotateX(0deg) rotateY(0deg)";
      case "right":
      case "side":
        return "rotateX(0deg) rotateY(-90deg)";
      case "left":
        return "rotateX(0deg) rotateY(90deg)";
      case "back":
        return "rotateX(0deg) rotateY(180deg)";
      case "top":
        return "rotateX(-90deg) rotateY(0deg)";
      case "bottom":
        return "rotateX(90deg) rotateY(0deg)";
      case "iso":
      default:
        return "rotateX(-30deg) rotateY(45deg)";
    }
  }, [cameraRotation, activePreset]);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center select-none pointer-events-auto",
        className,
      )}
    >
      {/* BOTÃO HOME (RESET ISO) */}
      <button
        type="button"
        onClick={() => onSelectPreset("iso")}
        title="Restaurar Vista Isométrica (Home)"
        aria-label="Restaurar Vista Isométrica"
        className="absolute -top-2 -left-2 z-30 flex size-5.5 items-center justify-center rounded-md border border-slate-700/80 bg-slate-900/90 text-slate-300 shadow-md transition-colors hover:border-red-500/60 hover:bg-slate-800 hover:text-red-400"
      >
        <Home className="size-3" />
      </button>

      {/* ÁREA 3D COM PERSPECTIVA */}
      <div
        className="relative size-[76px] cursor-pointer"
        style={{ perspective: "450px" }}
      >
        {/* DISCO / BÚSSOLA DE BASE */}
        <div className="absolute inset-0 -bottom-1 flex items-center justify-center pointer-events-none opacity-40">
          <div className="size-[72px] rounded-full border border-dashed border-slate-600 flex items-center justify-center">
            <span className="absolute top-0 text-[7px] font-mono font-bold text-slate-400">N</span>
            <span className="absolute right-0.5 text-[7px] font-mono font-bold text-slate-400">L</span>
            <span className="absolute bottom-0 text-[7px] font-mono font-bold text-slate-400">S</span>
            <span className="absolute left-0.5 text-[7px] font-mono font-bold text-slate-400">O</span>
          </div>
        </div>

        {/* CUBO 3D */}
        <div
          className="relative size-full transition-transform duration-300 ease-out"
          style={{
            transformStyle: "preserve-3d",
            transform: transformStyle,
          }}
        >
          {/* FACE FRONTAL: FR */}
          <div
            onClick={() => onSelectPreset("front")}
            className={cn(
              "absolute inset-3 flex items-center justify-center rounded-xs border font-mono text-[9px] font-bold tracking-wider uppercase transition-colors shadow-inner",
              activePreset === "front"
                ? "border-red-500 bg-red-950/80 text-red-300"
                : "border-slate-600 bg-slate-800/90 text-slate-200 hover:border-red-400 hover:bg-slate-700",
            )}
            style={{ transform: "translateZ(26px)" }}
            title="Vista Frontal (FR)"
          >
            FR
          </div>

          {/* FACE TRASEIRA: POST */}
          <div
            onClick={() => onSelectPreset("back")}
            className={cn(
              "absolute inset-3 flex items-center justify-center rounded-xs border font-mono text-[9px] font-bold tracking-wider uppercase transition-colors shadow-inner",
              activePreset === "back"
                ? "border-red-500 bg-red-950/80 text-red-300"
                : "border-slate-600 bg-slate-800/90 text-slate-200 hover:border-red-400 hover:bg-slate-700",
            )}
            style={{ transform: "rotateY(180deg) translateZ(26px)" }}
            title="Vista Posterior (POST)"
          >
            POST
          </div>

          {/* FACE SUPERIOR: SUP */}
          <div
            onClick={() => onSelectPreset("top")}
            className={cn(
              "absolute inset-3 flex items-center justify-center rounded-xs border font-mono text-[9px] font-bold tracking-wider uppercase transition-colors shadow-inner",
              activePreset === "top"
                ? "border-red-500 bg-red-950/80 text-red-300"
                : "border-slate-600 bg-slate-800/90 text-slate-200 hover:border-red-400 hover:bg-slate-700",
            )}
            style={{ transform: "rotateX(90deg) translateZ(26px)" }}
            title="Vista Superior (SUP)"
          >
            SUP
          </div>

          {/* FACE INFERIOR: INF */}
          <div
            onClick={() => onSelectPreset("bottom")}
            className={cn(
              "absolute inset-3 flex items-center justify-center rounded-xs border font-mono text-[9px] font-bold tracking-wider uppercase transition-colors shadow-inner",
              activePreset === "bottom"
                ? "border-red-500 bg-red-950/80 text-red-300"
                : "border-slate-600 bg-slate-800/90 text-slate-200 hover:border-red-400 hover:bg-slate-700",
            )}
            style={{ transform: "rotateX(-90deg) translateZ(26px)" }}
            title="Vista Inferior (INF)"
          >
            INF
          </div>

          {/* FACE DIREITA: LAT */}
          <div
            onClick={() => onSelectPreset("right")}
            className={cn(
              "absolute inset-3 flex items-center justify-center rounded-xs border font-mono text-[9px] font-bold tracking-wider uppercase transition-colors shadow-inner",
              activePreset === "right" || activePreset === "side"
                ? "border-red-500 bg-red-950/80 text-red-300"
                : "border-slate-600 bg-slate-800/90 text-slate-200 hover:border-red-400 hover:bg-slate-700",
            )}
            style={{ transform: "rotateY(90deg) translateZ(26px)" }}
            title="Vista Lateral Direita (LAT)"
          >
            LAT
          </div>

          {/* FACE ESQUERDA: ESQ */}
          <div
            onClick={() => onSelectPreset("left")}
            className={cn(
              "absolute inset-3 flex items-center justify-center rounded-xs border font-mono text-[9px] font-bold tracking-wider uppercase transition-colors shadow-inner",
              activePreset === "left"
                ? "border-red-500 bg-red-950/80 text-red-300"
                : "border-slate-600 bg-slate-800/90 text-slate-200 hover:border-red-400 hover:bg-slate-700",
            )}
            style={{ transform: "rotateY(-90deg) translateZ(26px)" }}
            title="Vista Lateral Esquerda (ESQ)"
          >
            ESQ
          </div>
        </div>
      </div>
    </div>
  );
}
