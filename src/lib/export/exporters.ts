/** Exportação de desenhos: PNG (alta resolução) e PDF (folha técnica). */

export type SheetInfo = {
  pieceName: string;
  project: string;
  material: string;
  thickness: string;
  quantity: string;
  notes?: string;
};

function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clone);
}

export async function exportSvgAsPng(
  svg: SVGSVGElement,
  filename: string,
  scale = 3,
): Promise<void> {
  const source = serializeSvg(svg);
  const rect = svg.getBoundingClientRect();
  const width = Math.max(rect.width, 800);
  const height = Math.max(rect.height, 600);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas indisponível."));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((out) => {
        if (!out) return reject(new Error("Falha ao gerar PNG."));
        const a = document.createElement("a");
        a.href = URL.createObjectURL(out);
        a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
        URL.revokeObjectURL(url);
        resolve();
      }, "image/png");
    };
    img.onerror = () => reject(new Error("Falha ao renderizar o desenho."));
    img.src = url;
  });
}

/** Gera uma folha técnica imprimível (Salvar como PDF no diálogo de impressão). */
export function exportSvgAsPdf(svg: SVGSVGElement, info: SheetInfo, rows: string[][]) {
  const source = serializeSvg(svg);
  const win = window.open("", "_blank", "width=1024,height=768");
  if (!win) throw new Error("Bloqueio de pop-up impediu a geração do PDF.");
  const table = rows.map(([k, v]) => `<tr><td>${k}</td><td class="num">${v}</td></tr>`).join("");
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${info.pieceName} — CALDRA</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: ui-sans-serif, system-ui, sans-serif; color:#10151c; margin:0; }
  header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1px solid #10151c; padding-bottom:6px; }
  h1 { font-size:16px; margin:0; letter-spacing:.06em; }
  .sub { font-size:10px; letter-spacing:.18em; text-transform:uppercase; color:#5b6672; }
  main { display:grid; grid-template-columns: 1fr 240px; gap:12px; margin-top:10px; }
  .draw { border:1px solid #c7ced6; padding:6px; }
  .draw svg { width:100%; height:auto; }
  table { width:100%; border-collapse:collapse; font-size:10px; }
  td { border-bottom:1px solid #e2e7ec; padding:3px 4px; }
  td.num { text-align:right; font-family: ui-monospace, monospace; }
  .box { border:1px solid #c7ced6; padding:8px; margin-bottom:8px; }
  .box h2 { font-size:10px; text-transform:uppercase; letter-spacing:.14em; margin:0 0 6px; color:#5b6672; }
  footer { margin-top:8px; font-size:9px; color:#5b6672; display:flex; justify-content:space-between; }
</style></head><body>
<header>
  <div><h1>CALDRA</h1><div class="sub">Traçado e Planificação Zero Fresta</div></div>
  <div style="text-align:right"><div style="font-size:13px;font-weight:600">${info.pieceName}</div><div class="sub">${info.project}</div></div>
</header>
<main>
  <div class="draw">${source}</div>
  <div>
    <div class="box"><h2>Peça</h2><table>
      <tr><td>Material</td><td class="num">${info.material}</td></tr>
      <tr><td>Espessura</td><td class="num">${info.thickness}</td></tr>
      <tr><td>Quantidade</td><td class="num">${info.quantity}</td></tr>
    </table></div>
    <div class="box"><h2>Dimensões e cálculos</h2><table>${table}</table></div>
    <div class="box"><h2>Observações</h2><div style="font-size:10px">${info.notes ?? "—"}</div></div>
  </div>
</main>
<footer><span>Desenvolvimento por triangulação · unidades em mm</span><span>${new Date().toLocaleDateString("pt-BR")}</span></footer>
</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}
