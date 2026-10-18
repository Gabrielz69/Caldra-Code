/**
 * scaleCalibrationService — px → mm.
 *
 * A geometria final do CHAMFER NUNCA é armazenada em pixels: este serviço
 * define o fator utilizado pelo geometryNormalizer.
 */

export type Calibration = {
  /** Milímetros por pixel. */
  mmPerPx: number;
  method: "dimensao" | "medida" | "padrao";
  note: string;
};

export const DEFAULT_CALIBRATION: Calibration = {
  mmPerPx: 1,
  method: "padrao",
  note: "1 px = 1 mm (não calibrado)",
};

/** A) definir largura/altura reais do conteúdo detectado. */
export function calibrateByDimension(
  contentPx: { w: number; h: number },
  target: { widthMm?: number; heightMm?: number },
): Calibration | null {
  if (target.widthMm && contentPx.w > 0)
    return {
      mmPerPx: target.widthMm / contentPx.w,
      method: "dimensao",
      note: `Largura definida: ${target.widthMm} mm`,
    };
  if (target.heightMm && contentPx.h > 0)
    return {
      mmPerPx: target.heightMm / contentPx.h,
      method: "dimensao",
      note: `Altura definida: ${target.heightMm} mm`,
    };
  return null;
}

/** B) calibrar por dois pontos e a distância real entre eles. */
export function calibrateByMeasure(
  a: { x: number; y: number },
  b: { x: number; y: number },
  realMm: number,
): Calibration | null {
  const px = Math.hypot(a.x - b.x, a.y - b.y);
  if (px < 1 || !(realMm > 0)) return null;
  return {
    mmPerPx: realMm / px,
    method: "medida",
    note: `${px.toFixed(1)} px = ${realMm} mm`,
  };
}
