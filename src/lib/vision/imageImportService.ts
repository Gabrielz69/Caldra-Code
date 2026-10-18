/**
 * imageImportService — entrada da pipeline CHAMFER VISION.
 * Só aceita formatos realmente suportados; PDF ainda não é implementado
 * e é recusado explicitamente (nunca simulado).
 */

import { isAcceptedImage, loadImage, readAsDataUrl } from "./imagePreprocessor";

export type ImportedImage = {
  name: string;
  dataUrl: string;
  element: HTMLImageElement;
  widthPx: number;
  heightPx: number;
};

export async function importImage(file: File): Promise<ImportedImage> {
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf")
    throw new Error("PDF ainda não é suportado pelo CHAMFER VISION. Envie PNG, JPG ou WEBP.");
  if (!isAcceptedImage(file)) throw new Error("Formato não suportado. Use PNG, JPG, JPEG ou WEBP.");
  const dataUrl = await readAsDataUrl(file);
  const element = await loadImage(dataUrl);
  return {
    name: file.name,
    dataUrl,
    element,
    widthPx: element.naturalWidth,
    heightPx: element.naturalHeight,
  };
}
