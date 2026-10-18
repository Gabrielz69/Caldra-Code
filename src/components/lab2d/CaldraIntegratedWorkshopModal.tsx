/**
 * CALDRA — ESTÚDIO DA OFICINA DIGITAL INTEGRADA
 * (CAD PARAMÉTRICO, CATÁLOGO COSTA FERRO, DOSSIÊ MULTI-VISTAS, LISTA DE CORTE 1D/2D, BOM E ORÇAMENTO)
 *
 * Conecta em tempo real o Modelo Central de Projeto (`ParametricProjectModel`)
 * ao CHAMFER CAD e à Oficina Digital. Qualquer alteração de medida (ex: 6000mm -> 5400mm),
 * perfil comercial Costa Ferro, ferragem ou encaixe (45°/90°) recalcula instantaneamente:
 *  - Desenho Técnico Multi-Vistas ABNT (Frontal, Lateral cotadas lado a lado + Isométrica 2.5D);
 *  - Lista de Corte de Bancada + Aproveitamento de Barras de 6000mm (1D Bar Nesting);
 *  - Lista de Materiais Consolidada (BOM Comercial Costa Ferro + Ferragens + Consumíveis);
 *  - Orçamento Comercial Detalhado e Emissão de Proposta Técnica (PDF / WhatsApp / CSV).
 */

import React, { useMemo, useState } from "react";
import {
  Boxes,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  MessageSquare,
  Moon,
  PenTool,
  Printer,
  Receipt,
  Scissors,
  Sliders,
  Sun,
  X,
} from "lucide-react";
import type { Entity } from "@/lib/lab2d/core";
import {
  getAllCostaFerroMaterials,
  savePriceOverride,
} from "@/lib/library/costaFerroCatalog";
import {
  DEFAULT_PROJECT_MODEL,
  deriveProjectDossier,
  type CornerJointType,
  type GateInfillType,
  type OperationMode,
  type ParametricProjectModel,
  type PartTemplateId,
  type StructureTemplateId,
} from "@/lib/projects/parametricWorkstationModel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type WorkshopStudioTab =
  | 1
  | 2
  | 3
  | 4
  | 5
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "parametros"
  | "dossie"
  | "corte"
  | "materiais"
  | "orcamento";

interface CaldraIntegratedWorkshopModalProps {
  open: boolean;
  onClose: () => void;
  canvasEntities?: Entity[];
  projectName?: string;
  onInsertEntitiesToCad?: (entities: Entity[], replaceAll?: boolean) => void;
  embedded?: boolean;
  initialTab?: WorkshopStudioTab;
}

const STRUCTURE_TEMPLATES: { id: StructureTemplateId; label: string; desc: string }[] = [
  {
    id: "portao-correr",
    label: "Portão de Correr Industrial / Residencial",
    desc: "Quadro em Metalon, travessa, fechamento grade/lambril, roldanas e trilho",
  },
  {
    id: "portao-basculante",
    label: "Portão Basculante com Caixa de Contrapeso",
    desc: "Folha móvel, colunas laterais, braços estabilizadores e kit cabos/roldanas",
  },
  {
    id: "grade-industrial",
    label: "Grade / Gradil Metálico de Proteção",
    desc: "Quadro perimetral em Metalon/Cantoneira com montantes verticais modulados",
  },
  {
    id: "bancada-industrial",
    label: "Bancada Pesada de Oficina / Soldagem",
    desc: "Estrutura tubular reforçada, tampo em chapa grossa e prateleira inferior",
  },
  {
    id: "escada-reta-industrial",
    label: "Escada Reta Metálica com Guarda-Corpo",
    desc: "Longarinas em perfil estrutural, degraus em chapa xadrez e corrimão duplo",
  },
  {
    id: "canvas-estrutura",
    label: "Estrutura Traçada no Canvas CHAMFER",
    desc: "Converte linhas e quadros desenhados no CAD em barras de 6000mm Costa Ferro",
  },
];

const PART_TEMPLATES: { id: PartTemplateId; label: string; desc: string }[] = [
  {
    id: "flange-industrial",
    label: "Flange / Disco Anelar Furado (Caldeiraria)",
    desc: "Anel em chapa grossa com círculo de furação (PCD) e corte CNC Plasma/Laser",
  },
  {
    id: "chapa-base-nervurada",
    label: "Sapata / Chapa de Base com Nervuras (Gussets)",
    desc: "Base furada para chumbadores Parabolt + 4 nervuras chanfradas a 45°",
  },
  {
    id: "reducao-quadrado-redondo",
    label: "Transição Quadrado para Redondo (Traçagem)",
    desc: "Planificação em duas metades com linhas de dobra por triangulação",
  },
  {
    id: "suporte-dobrado-u",
    label: "Suporte Dobrado em U (Prensa Dobradeira)",
    desc: "Desenvolvimento plano com compensação de dobra (Fator K=0,40)",
  },
  {
    id: "canvas-custom",
    label: "Peça Recortada do Canvas CHAMFER",
    desc: "Lê automaticamente perímetro de corte, furos, dobras e área do desenho atual",
  },
];

const fmtBRL = (val: number) =>
  val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CaldraIntegratedWorkshopModal({
  open,
  onClose,
  canvasEntities = [],
  projectName,
  onInsertEntitiesToCad,
  embedded = false,
  initialTab = 1,
}: CaldraIntegratedWorkshopModalProps) {
  const [activeTab, setActiveTab] = useState<WorkshopStudioTab>(initialTab);
  const [priceTick, setPriceTick] = useState(0);
  const [drawingViewMode, setDrawingViewMode] = useState<"dark-cad" | "white-sheet">("dark-cad");

  const [model, setModel] = useState<ParametricProjectModel>(() => ({
    ...DEFAULT_PROJECT_MODEL,
    projectName: projectName || DEFAULT_PROJECT_MODEL.projectName,
  }));

  const materials = useMemo(() => {
    void priceTick;
    return getAllCostaFerroMaterials();
  }, [priceTick]);

  // Perfis organizados por categoria do catálogo Costa Ferro
  const squareTubes = useMemo(
    () => materials.filter((m) => m.category === "TUBO_QUADRADO_METALON"),
    [materials],
  );
  const rectTubes = useMemo(
    () => materials.filter((m) => m.category === "TUBO_RETANGULAR_METALON"),
    [materials],
  );
  const roundTubes = useMemo(
    () =>
      materials.filter(
        (m) =>
          m.category === "TUBO_REDONDO_INDUSTRIAL" ||
          m.category === "TUBO_CONDUCAO_DIN_SCH",
      ),
    [materials],
  );
  const structuralAndAngles = useMemo(
    () =>
      materials.filter(
        (m) =>
          m.category === "PERFIL_ESTRUTURAL" ||
          m.category === "CANTONEIRA_BARRA",
      ),
    [materials],
  );
  const sheetMaterials = useMemo(
    () => materials.filter((m) => m.category === "CHAPA_ACO"),
    [materials],
  );

  const tubeProfiles = useMemo(
    () => materials.filter((m) => m.category !== "CHAPA_ACO"),
    [materials],
  );

  // FONTE ÚNICA DE VERDADE: deriva tudo em tempo real a partir de `model`
  const dossier = useMemo(() => {
    void priceTick;
    return deriveProjectDossier(model, canvasEntities);
  }, [model, canvasEntities, priceTick]);

  if (!open && !embedded) return null;

  const updateModel = (patch: Partial<ParametricProjectModel>) => {
    setModel((prev) => ({ ...prev, ...patch }));
  };

  const handleSelectMode = (mode: OperationMode) => {
    if (mode === "ESTRUTURA_MONTAGEM") {
      updateModel({
        mode,
        projectName:
          model.structureTemplate === "portao-correr"
            ? `Portão de Correr ${model.widthMm}×${model.heightMm}mm`
            : model.projectName,
      });
    } else {
      updateModel({
        mode,
        projectName:
          model.partTemplate === "flange-industrial"
            ? `Flange Industrial Ø${model.outerDiameterMm}mm`
            : model.projectName,
      });
    }
  };

  // Mapeamento normalizado de aba ativa
  const isTab1 = activeTab === 1 || activeTab === "1" || activeTab === "parametros";
  const isTab2 = activeTab === 2 || activeTab === "2" || activeTab === "dossie";
  const isTab3 = activeTab === 3 || activeTab === "3" || activeTab === "corte";
  const isTab4 = activeTab === 4 || activeTab === "4" || activeTab === "materiais";
  const isTab5 = activeTab === 5 || activeTab === "5" || activeTab === "orcamento";

  // Exportar CSV da Lista de Corte + BOM
  const handleDownloadCutListCsv = () => {
    const lines: string[] = [
      `PROJETO;${model.projectName};CODIGO;${model.projectCode};REVISAO;${model.revision}`,
      `MODO;${model.mode};PESO TOTAL (KG);${dossier.totalWeightKg};ORCAMENTO FINAL;${dossier.budget.finalClientPriceBRL}`,
      "",
      "LISTA DE CORTE DE PERFIS E TUBOS (CATÁLOGO COSTA FERRO)",
      "TAG;PECA / POSICAO;PERFIL COSTA FERRO;QTD;COMPR. UNIT (MM);ANGULO ESQ;ANGULO DIR;PESO TOTAL (KG);OBSERVACOES",
    ];
    for (const c of dossier.cutList) {
      lines.push(
        `${c.tag};${c.name};${c.profileName};${c.quantity};${c.unitLengthMm};${c.cutAngleLeftDeg}°;${c.cutAngleRightDeg}°;${c.totalWeightKg};${c.notes}`,
      );
    }
    lines.push("");
    lines.push("PLANO DE APROVEITAMENTO DE BARRAS DE 6000MM");
    lines.push("PERFIL;BARRA #;CORTES ALOCADOS;USADO (MM);SOBRA / RETALHO (MM);APROVEITAMENTO (%)");
    for (const plan of dossier.barNestingPlans) {
      for (const bar of plan.bars) {
        const cutsDesc = bar.cuts.map((x) => `${x.tag}:${x.lengthMm}mm`).join(" + ");
        lines.push(
          `${plan.profileName};Barra ${bar.barNumber};${cutsDesc};${bar.usedLengthMm};${bar.offcutMm};${bar.utilizationPct}%`,
        );
      }
    }
    lines.push("");
    lines.push("LISTA DE MATERIAIS CONSOLIDADA (BOM COMERCIAL)");
    lines.push("CODIGO;CATEGORIA;DESCRICAO;QTD;UNIDADE;PESO (KG);UNITARIO (R$);SUBTOTAL (R$)");
    for (const b of dossier.bom) {
      lines.push(
        `${b.code};${b.category};${b.description};${b.quantity};${b.unit};${b.totalWeightKg};${b.unitPriceBRL};${b.subtotalBRL}`,
      );
    }

    const blob = new Blob([`\uFEFF${lines.join("\n")}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${model.projectCode.toLowerCase()}_dossie_corte_bom.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Planilha CSV de Corte, Aproveitamento de Barras e BOM exportada!");
  };

  // Download SVG
  const handleDownloadSvg = () => {
    const contentToDownload =
      drawingViewMode === "dark-cad"
        ? dossier.darkTechnicalBoardSvg
        : dossier.multiViewSvg;
    const blob = new Blob([contentToDownload], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${model.projectCode.toLowerCase()}_quadro_tecnico.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Quadro Técnico Multi-Vistas exportado em SVG vetorial!");
  };

  // Mensagem comercial para WhatsApp
  const generateProposalText = () => {
    return [
      `*PROPOSTA COMERCIAL — CALDRA OFICINA DIGITAL*`,
      `*Projeto:* ${model.projectName}`,
      `*Cliente / Obra:* ${model.clientName}`,
      `*Código:* ${model.projectCode} (Rev. ${model.revision})`,
      `*Data:* ${new Date().toLocaleDateString("pt-BR")}`,
      "",
      `*ESPECIFICAÇÕES TÉCNICAS:*`,
      `- Dimensões Gerais: ${model.widthMm} × ${model.heightMm} mm${model.depthMm ? ` × ${model.depthMm} mm` : ""}`,
      `- Peso Total Estrutural: ${dossier.totalWeightKg.toFixed(2)} kg`,
      `- Barras Comerciais Costa Ferro (6000mm): ${dossier.totalBars6mCount} barras`,
      `- Chapas Comerciais: ${dossier.totalSheetsCount} chapa(s) (${dossier.totalSurfaceAreaM2} m²)`,
      "",
      `*RESUMO DE VALORES:*`,
      `- Materiais, Perfis e Chapas: ${fmtBRL(dossier.budget.profilesCostBRL + dossier.budget.sheetsCostBRL)}`,
      `- Ferragens e Insumos: ${fmtBRL(dossier.budget.hardwareCostBRL + dossier.budget.consumablesCostBRL)}`,
      `- Mão de Obra de Fabricação (${model.laborHoursCutWeld}h): ${fmtBRL(dossier.budget.laborCostBRL)}`,
      `- Pintura / Tratamento e Corte: ${fmtBRL(dossier.budget.paintingCostBRL + dossier.budget.cncCuttingCostBRL)}`,
      `- Frete e Instalação: ${fmtBRL(dossier.budget.installationCostBRL)}`,
      `--------------------------------------`,
      `*VALOR FINAL SUGERIDO: ${fmtBRL(dossier.budget.finalClientPriceBRL)}*`,
      `Valor médio por kg: ${fmtBRL(dossier.budget.pricePerKgBRL)}/kg`,
      "",
      `_Gerado pela Oficina Digital Integrada CALDRA · Caldeiraria, Serralheria e Traçagem_`,
    ].join("\n");
  };

  const handleCopyProposal = () => {
    navigator.clipboard.writeText(generateProposalText());
    toast.success("Proposta comercial copiada para a área de transferência!");
  };

  // Impressão / PDF Nativo via iframe oculto
  const handlePrintFullDossier = () => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      toast.error("Não foi possível preparar a impressão.");
      return;
    }

    const cutRowsHtml = dossier.cutList
      .map(
        (c) => `
        <tr>
          <td><strong>${c.tag}</strong></td>
          <td>${c.name}</td>
          <td>${c.profileName}</td>
          <td style="text-align:center">${c.quantity}</td>
          <td style="text-align:right"><strong>${c.unitLengthMm} mm</strong></td>
          <td style="text-align:center">${c.cutAngleLeftDeg}° / ${c.cutAngleRightDeg}°</td>
          <td style="text-align:right">${c.totalWeightKg.toFixed(2)} kg</td>
        </tr>`,
      )
      .join("");

    const bomRowsHtml = dossier.bom
      .map(
        (b) => `
        <tr>
          <td>${b.description}<br/><small style="color:#64748b">${b.specification}</small></td>
          <td style="text-align:center"><strong>${b.quantity} ${b.unit}</strong></td>
          <td style="text-align:right">${b.totalWeightKg.toFixed(2)} kg</td>
          <td style="text-align:right">${fmtBRL(b.unitPriceBRL)}</td>
          <td style="text-align:right"><strong>${fmtBRL(b.subtotalBRL)}</strong></td>
        </tr>`,
      )
      .join("");

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Dossiê Técnico & Orçamento — ${model.projectName}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 20px; font-size: 12px; }
            h1, h2, h3 { margin: 0 0 8px 0; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 16px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
            .kpi { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #f8fafc; }
            .kpi span { display: block; font-size: 10px; color: #64748b; text-transform: uppercase; }
            .kpi strong { font-size: 16px; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background: #0f172a; color: #fff; font-size: 10px; text-transform: uppercase; }
            .sheet-box { border: 1px solid #94a3b8; margin-bottom: 20px; page-break-inside: avoid; }
            @media print { .page-break { page-break-before: always; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>CALDRA — DOSSIÊ TÉCNICO, LISTA DE CORTE E ORÇAMENTO</h1>
              <div>Projeto: <strong>${model.projectName}</strong> · Cliente: <strong>${model.clientName}</strong></div>
            </div>
            <div style="text-align:right">
              <div>Código: <strong>${model.projectCode} (${model.revision})</strong></div>
              <div>Base Técnica: <strong>Catálogo Costa Ferro</strong></div>
            </div>
          </div>

          <div class="kpi-grid">
            <div class="kpi"><span>Dimensões Gerais</span><strong>${model.widthMm} × ${model.heightMm} mm</strong></div>
            <div class="kpi"><span>Peso Total Calculado</span><strong>${dossier.totalWeightKg.toFixed(2)} kg</strong></div>
            <div class="kpi"><span>Barras Comerciais 6m</span><strong>${dossier.totalBars6mCount} barras</strong></div>
            <div class="kpi"><span>Valor Final do Orçamento</span><strong>${fmtBRL(dossier.budget.finalClientPriceBRL)}</strong></div>
          </div>

          <h3>1. PRANCHA TÉCNICA MULTI-VISTAS (1º DIEDRO ABNT NBR 10067)</h3>
          <div class="sheet-box">${dossier.multiViewSvg}</div>

          <div class="page-break"></div>
          <h3>2. LISTA DE CORTE DE OFICINA (SERRALHERIA / CALDEIRARIA)</h3>
          <table>
            <thead>
              <tr>
                <th>TAG</th><th>Peça / Posição</th><th>Perfil Costa Ferro</th><th>Qtd</th><th>Compr. Unit.</th><th>Pontas</th><th>Peso</th>
              </tr>
            </thead>
            <tbody>${cutRowsHtml}</tbody>
          </table>

          <h3>3. LISTA DE MATERIAIS CONSOLIDADA (BOM COMERCIAL)</h3>
          <table>
            <thead>
              <tr>
                <th>Material / Ferragem (Catálogo Costa Ferro)</th><th>Qtd Compra</th><th>Peso</th><th>Unitário</th><th>Subtotal</th>
              </tr>
            </thead>
            <tbody>${bomRowsHtml}</tbody>
          </table>

          <h3>4. RESUMO FINANCEIRO E PROPOSTA COMERCIAL</h3>
          <table>
            <tbody>
              <tr><td>Total em Materiais, Perfis, Chapas e Ferragens</td><td style="text-align:right"><strong>${fmtBRL(dossier.budget.totalMaterialsBRL)}</strong></td></tr>
              <tr><td>Mão de Obra de Fabricação (${model.laborHoursCutWeld}h × ${fmtBRL(model.laborHourlyRateBRL)}/h)</td><td style="text-align:right">${fmtBRL(dossier.budget.laborCostBRL)}</td></tr>
              <tr><td>Pintura / Tratamento Superficial (${dossier.totalSurfaceAreaM2} m²) + Corte CNC</td><td style="text-align:right">${fmtBRL(dossier.budget.paintingCostBRL + dossier.budget.cncCuttingCostBRL)}</td></tr>
              <tr><td>Frete e Instalação em Obra</td><td style="text-align:right">${fmtBRL(dossier.budget.installationCostBRL)}</td></tr>
              <tr><td>Impostos e Custos Operacionais (${model.overheadTaxPct}%)</td><td style="text-align:right">${fmtBRL(dossier.budget.taxesAndOverheadBRL)}</td></tr>
              <tr><td>Margem Líquida da Oficina (${model.profitMarginPct}%)</td><td style="text-align:right">${fmtBRL(dossier.budget.profitAmountBRL)}</td></tr>
              <tr style="background:#f1f5f9;font-size:14px"><td><strong>PREÇO FINAL AO CLIENTE</strong></td><td style="text-align:right"><strong>${fmtBRL(dossier.budget.finalClientPriceBRL)}</strong></td></tr>
            </tbody>
          </table>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1500);
    }, 250);
  };

  const content = (
    <div
      className={cn(
        "flex flex-col gap-3.5 text-foreground max-h-[95vh] sm:max-h-[90vh] overflow-y-auto",
        embedded
          ? "w-full rounded-2xl border border-line bg-card/90 p-4 shadow-xl"
          : "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] w-[min(96vw,1140px)] rounded-2xl border border-line bg-card/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl",
      )}
    >
      {/* =================================================================== */}
      {/* 1. CABEÇALHO PRINCIPAL & SELETOR DE DUPLO MODO DE OPERAÇÃO         */}
      {/* =================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-accent/15 text-accent ring-1 ring-accent/30">
            <Boxes className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-sm sm:text-base font-bold tracking-tight text-foreground">
                Oficina Digital Integrada CALDRA · Fonte Única de Verdade
              </h2>
              <span className="font-mono text-[10px] text-accent">
                Catálogo Costa Ferro · Tempo Real
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Altere qualquer medida ou perfil: o Desenho Multi-Vistas, a Lista de Corte 6m, o BOM e o Orçamento recalculam juntos.
            </p>
          </div>
        </div>

        {/* Seletor de Duplo Modo de Operação */}
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-xl border border-line bg-background/60 p-1">
            <button
              type="button"
              onClick={() => handleSelectMode("ESTRUTURA_MONTAGEM")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase transition-all",
                model.mode === "ESTRUTURA_MONTAGEM"
                  ? "bg-accent text-background shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Boxes className="size-3.5" />
              Modo Estrutura & Serralheria
            </button>
            <button
              type="button"
              onClick={() => handleSelectMode("PECA_INDIVIDUAL")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase transition-all",
                model.mode === "PECA_INDIVIDUAL"
                  ? "bg-accent text-background shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Scissors className="size-3.5" />
              Modo Peça Individual (Caldeiraria)
            </button>
          </div>

          {!embedded && (
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. CARD DE RESUMO SUPERIOR (INDICADORES EM TEMPO REAL)              */}
      {/* =================================================================== */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div className="rounded-xl border border-line bg-background/50 px-3 py-2">
          <span className="font-mono text-[9px] uppercase text-muted-foreground">
            Medida Principal
          </span>
          <p className="font-mono text-sm font-bold text-foreground">
            {model.mode === "ESTRUTURA_MONTAGEM"
              ? `${model.widthMm} × ${model.heightMm} mm`
              : model.partTemplate === "flange-industrial"
                ? `Ø ${model.outerDiameterMm} × Ø ${model.innerDiameterMm} mm`
                : `${model.widthMm} × ${model.heightMm} mm`}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-background/50 px-3 py-2">
          <span className="font-mono text-[9px] uppercase text-muted-foreground">
            Peso Total Calculado
          </span>
          <p className="font-mono text-sm font-bold text-accent">
            {dossier.totalWeightKg.toFixed(2)} kg
          </p>
        </div>
        <div className="rounded-xl border border-line bg-background/50 px-3 py-2">
          <span className="font-mono text-[9px] uppercase text-muted-foreground">
            Barras 6m / Chapas
          </span>
          <p className="font-mono text-sm font-bold text-foreground">
            {dossier.totalBars6mCount} barra(s) · {dossier.totalSheetsCount} ch
          </p>
        </div>
        <div className="rounded-xl border border-line bg-background/50 px-3 py-2">
          <span className="font-mono text-[9px] uppercase text-muted-foreground">
            Custo de Materiais
          </span>
          <p className="font-mono text-sm font-bold text-foreground">
            {fmtBRL(dossier.budget.totalMaterialsBRL)}
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2">
          <span className="font-mono text-[9px] uppercase text-accent">
            Orçamento Final Sugerido
          </span>
          <p className="font-mono text-sm font-bold text-accent">
            {fmtBRL(dossier.budget.finalClientPriceBRL)}
          </p>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. BARRA DE SELEÇÃO DAS 5 ABAS E BOTÕES DE AÇÃO                     */}
      {/* =================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
        <div className="flex flex-wrap gap-1">
          {[
            { id: 1, label: "1. PROJETO & CATÁLOGO COSTA FERRO", icon: Sliders, active: isTab1 },
            { id: 2, label: "2. DOSSIÊ MULTI-VISTAS (ABNT)", icon: FileText, active: isTab2 },
            { id: 3, label: `3. LISTA DE CORTE (${dossier.cutList.length + dossier.sheetPieces.length})`, icon: Scissors, active: isTab3 },
            { id: 4, label: `4. LISTA DE MATERIAIS / BOM (${dossier.bom.length})`, icon: Layers, active: isTab4 },
            { id: 5, label: "5. ORÇAMENTO & PROPOSTA", icon: Receipt, active: isTab5 },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as WorkshopStudioTab)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors",
                t.active
                  ? "bg-accent/15 text-accent ring-1 ring-accent/30 font-bold"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <t.icon className="size-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {onInsertEntitiesToCad && (
            <button
              type="button"
              onClick={() => {
                onInsertEntitiesToCad(dossier.cadEntities, false);
                toast.success("Geometria paramétrica 1:1 enviada para o canvas do CHAMFER CAD!");
                if (!embedded) onClose();
              }}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-background hover:opacity-90"
            >
              <PenTool className="size-3.5" />
              Enviar Geometria p/ CHAMFER
            </button>
          )}
          <button
            type="button"
            onClick={handlePrintFullDossier}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-background/60 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase text-foreground hover:border-accent"
          >
            <Printer className="size-3.5 text-accent" />
            Imprimir Dossiê Completo
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4. ÁREA DE CONTEÚDO DAS ABAS (DEDICADO tab-content-container)       */}
      {/* =================================================================== */}
      <div
        className="tab-content-container w-full min-h-[400px] py-4 border-t border-[#E5E7EB] dark:border-line"
        data-active-tab={activeTab}
      >
        {/* ================================================================= */}
        {/* ABA 1: PROJETO & CATÁLOGO COSTA FERRO                             */}
        {/* ================================================================= */}
        {isTab1 && (
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Coluna Esquerda: Família e Dimensões Geométricas */}
            <div className="space-y-3 lg:col-span-6">
              <div className="rounded-xl border border-line bg-background/40 p-3.5 space-y-3">
                <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-accent">
                  {model.mode === "ESTRUTURA_MONTAGEM"
                    ? "Família de Estrutura / Serralheria"
                    : "Família de Peça Individual / Caldeiraria"}
                </h3>

                {model.mode === "ESTRUTURA_MONTAGEM" ? (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {STRUCTURE_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() =>
                          updateModel({
                            structureTemplate: tpl.id,
                            projectName: `${tpl.label.split("/")[0]?.trim()} ${model.widthMm}×${model.heightMm}mm`,
                          })
                        }
                        className={cn(
                          "rounded-xl border p-2.5 text-left transition-all",
                          model.structureTemplate === tpl.id
                            ? "border-accent bg-accent/10 text-foreground ring-1 ring-accent/30"
                            : "border-line bg-card/50 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <p className="font-display text-xs font-semibold text-foreground">
                          {tpl.label}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">
                          {tpl.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {PART_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() =>
                          updateModel({
                            partTemplate: tpl.id,
                            projectName: `${tpl.label.split("(")[0]?.trim()}`,
                          })
                        }
                        className={cn(
                          "rounded-xl border p-2.5 text-left transition-all",
                          model.partTemplate === tpl.id
                            ? "border-accent bg-accent/10 text-foreground ring-1 ring-accent/30"
                            : "border-line bg-card/50 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <p className="font-display text-xs font-semibold text-foreground">
                          {tpl.label}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">
                          {tpl.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {/* Presets Rápidos de Vão para teste de reatividade */}
                {model.mode === "ESTRUTURA_MONTAGEM" && (
                  <div className="pt-1">
                    <span className="font-mono text-[9.5px] uppercase text-muted-foreground">
                      Teste Rápido de Vão / Largura (Recálculo Automático):
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {[3000, 4000, 4800, 5400, 6000, 7200].map((wPreset) => (
                        <button
                          key={wPreset}
                          type="button"
                          onClick={() =>
                            updateModel({
                              widthMm: wPreset,
                              projectName: `${model.projectName.replace(/\d+×\d+mm/, `${wPreset}×${model.heightMm}mm`)}`,
                            })
                          }
                          className={cn(
                            "rounded-lg border px-2.5 py-1 font-mono text-[10px] font-semibold transition-colors",
                            model.widthMm === wPreset
                              ? "border-accent bg-accent/20 text-accent"
                              : "border-line bg-background/60 text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {wPreset} mm ({(wPreset / 1000).toFixed(1)}m)
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dimensões Geométricas Editáveis em mm */}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 pt-1">
                  {model.mode === "PECA_INDIVIDUAL" &&
                  model.partTemplate === "flange-industrial" ? (
                    <>
                      <NumInput
                        label="Ø Externo (mm)"
                        value={model.outerDiameterMm}
                        onChange={(v) => updateModel({ outerDiameterMm: v })}
                      />
                      <NumInput
                        label="Ø Interno (mm)"
                        value={model.innerDiameterMm}
                        onChange={(v) => updateModel({ innerDiameterMm: v })}
                      />
                      <NumInput
                        label="Ø Furação PCD (mm)"
                        value={model.boltCircleDiameterMm}
                        onChange={(v) => updateModel({ boltCircleDiameterMm: v })}
                      />
                      <NumInput
                        label="Nº de Furos"
                        value={model.holesCount}
                        onChange={(v) => updateModel({ holesCount: v })}
                      />
                      <NumInput
                        label="Ø dos Furos (mm)"
                        value={model.holeDiameterMm}
                        onChange={(v) => updateModel({ holeDiameterMm: v })}
                      />
                      <NumInput
                        label="Quantidade (un)"
                        value={model.quantity}
                        onChange={(v) => updateModel({ quantity: Math.max(1, v) })}
                      />
                    </>
                  ) : (
                    <>
                      <NumInput
                        label="Largura / Vão W (mm)"
                        value={model.widthMm}
                        onChange={(v) => updateModel({ widthMm: v })}
                      />
                      <NumInput
                        label="Altura Total H (mm)"
                        value={model.heightMm}
                        onChange={(v) => updateModel({ heightMm: v })}
                      />
                      <NumInput
                        label="Profundidade D (mm)"
                        value={model.depthMm}
                        onChange={(v) => updateModel({ depthMm: v })}
                      />
                      <NumInput
                        label="Passo da Grade (mm)"
                        value={model.gridSpacingMm}
                        onChange={(v) => updateModel({ gridSpacingMm: v })}
                      />
                      <NumInput
                        label="Altura Saia Chapa (mm)"
                        value={model.lowerSheetHeightMm}
                        onChange={(v) => updateModel({ lowerSheetHeightMm: v })}
                      />
                      <NumInput
                        label="Quantidade Conjuntos"
                        value={model.quantity}
                        onChange={(v) => updateModel({ quantity: Math.max(1, v) })}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Identificação do Projeto / Carimbo */}
              <div className="rounded-xl border border-line bg-background/40 p-3.5 space-y-2.5">
                <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-accent">
                  Dados do Projeto & Carimbo Normalizado
                </h3>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <label className="block">
                    <span className="font-mono text-[9.5px] uppercase text-muted-foreground">
                      Nome do Projeto
                    </span>
                    <input
                      value={model.projectName}
                      onChange={(e) => updateModel({ projectName: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                    />
                  </label>
                  <label className="block">
                    <span className="font-mono text-[9.5px] uppercase text-muted-foreground">
                      Cliente / Obra
                    </span>
                    <input
                      value={model.clientName}
                      onChange={(e) => updateModel({ clientName: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                    />
                  </label>
                  <label className="block">
                    <span className="font-mono text-[9.5px] uppercase text-muted-foreground">
                      Código / Rev.
                    </span>
                    <input
                      value={model.projectCode}
                      onChange={(e) => updateModel({ projectCode: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Coluna Direita: Seleção de Materiais do Catálogo Costa Ferro & Ferragens */}
            <div className="space-y-3 lg:col-span-6">
              <div className="rounded-xl border border-line bg-background/40 p-3.5 space-y-3">
                <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-accent">
                  Seleção de Perfis & Materiais (Catálogo Costa Ferro)
                </h3>

                {model.mode === "ESTRUTURA_MONTAGEM" ? (
                  <>
                    <div>
                      <label className="font-mono text-[10px] uppercase text-muted-foreground">
                        1. Tubos Retangulares Metalon — Perfil Principal do Quadro (Barra 6000mm)
                      </label>
                      <select
                        value={model.frameProfileId}
                        onChange={(e) => updateModel({ frameProfileId: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-mono text-xs outline-none focus:border-accent"
                      >
                        <optgroup label="Tubos Retangulares Metalon (NBR 6591)">
                          {rectTubes.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.linearWeightKgM?.toFixed(2)} kg/m ({fmtBRL(p.unitPriceBRL)}/barra)
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Tubos Quadrados Metalon (NBR 6591)">
                          {squareTubes.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.linearWeightKgM?.toFixed(2)} kg/m ({fmtBRL(p.unitPriceBRL)}/barra)
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Perfis Estruturais U / Vigas">
                          {structuralAndAngles.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.linearWeightKgM?.toFixed(2)} kg/m ({fmtBRL(p.unitPriceBRL)}/barra)
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    <div>
                      <label className="font-mono text-[10px] uppercase text-muted-foreground">
                        2. Tubos Quadrados Metalon — Grade / Montantes Internos (Barra 6000mm)
                      </label>
                      <select
                        value={model.secondaryProfileId}
                        onChange={(e) => updateModel({ secondaryProfileId: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-mono text-xs outline-none focus:border-accent"
                      >
                        <optgroup label="Tubos Quadrados Metalon (NBR 6591)">
                          {squareTubes.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.linearWeightKgM?.toFixed(2)} kg/m ({fmtBRL(p.unitPriceBRL)}/barra)
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Tubos Redondos Industriais / DIN">
                          {roundTubes.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.linearWeightKgM?.toFixed(2)} kg/m ({fmtBRL(p.unitPriceBRL)}/barra)
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Cantoneiras e Barras">
                          {structuralAndAngles.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.linearWeightKgM?.toFixed(2)} kg/m ({fmtBRL(p.unitPriceBRL)}/barra)
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    <div>
                      <label className="font-mono text-[10px] uppercase text-muted-foreground">
                        3. Perfil de Colunas / Batente / Trilho Lateral (Barra 6000mm)
                      </label>
                      <select
                        value={model.columnProfileId}
                        onChange={(e) => updateModel({ columnProfileId: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-mono text-xs outline-none focus:border-accent"
                      >
                        <optgroup label="Tubos Retangulares Metalon">
                          {rectTubes.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.linearWeightKgM?.toFixed(2)} kg/m ({fmtBRL(p.unitPriceBRL)}/barra)
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Tubos Redondos e Condução DIN/SCH">
                          {roundTubes.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.linearWeightKgM?.toFixed(2)} kg/m ({fmtBRL(p.unitPriceBRL)}/barra)
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Perfis Estruturais e Cantoneiras">
                          {structuralAndAngles.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.linearWeightKgM?.toFixed(2)} kg/m ({fmtBRL(p.unitPriceBRL)}/barra)
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    <div>
                      <label className="font-mono text-[10px] uppercase text-muted-foreground">
                        4. Chapas de Aço (FF / FQ / Galvanizada / Xadrez / Frisada)
                      </label>
                      <select
                        value={model.infillSheetId}
                        onChange={(e) => updateModel({ infillSheetId: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-mono text-xs outline-none focus:border-accent"
                      >
                        {sheetMaterials.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} — {s.areaWeightKgM2?.toFixed(2)} kg/m² ({fmtBRL(s.unitPriceBRL)}/chapa)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div>
                        <span className="font-mono text-[10px] uppercase text-muted-foreground">
                          Encaixe das Pontas
                        </span>
                        <div className="mt-1 flex gap-1.5">
                          {(
                            [
                              { id: "MEIA_ESQUADRIA_45", label: "Meia-Esquadria 45°" },
                              { id: "TOPO_90", label: "Corte Reto 90°" },
                            ] as { id: CornerJointType; label: string }[]
                          ).map((j) => (
                            <button
                              key={j.id}
                              type="button"
                              onClick={() => updateModel({ cornerJoint: j.id })}
                              className={cn(
                                "flex-1 rounded-lg border px-2 py-1.5 font-mono text-[10px] font-semibold transition-all",
                                model.cornerJoint === j.id
                                  ? "border-accent bg-accent/15 text-accent"
                                  : "border-line bg-card text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {j.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="font-mono text-[10px] uppercase text-muted-foreground">
                          Tipo de Fechamento
                        </span>
                        <select
                          value={model.infillType}
                          onChange={(e) =>
                            updateModel({ infillType: e.target.value as GateInfillType })
                          }
                          className="mt-1 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 font-mono text-[10px] outline-none"
                        >
                          <option value="MISTO_LAMBRIL_GRADE">Misto (Saia Lambril + Grade)</option>
                          <option value="GRADE_TUBULAR">100% Grade Tubular</option>
                          <option value="CHAPA_LAMBRIL">100% Fechado Chapa Lambril</option>
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="font-mono text-[10px] uppercase text-muted-foreground">
                        Chapa Comercial Costa Ferro (Espessura, Norma & Dimensão)
                      </label>
                      <select
                        value={model.partSheetId}
                        onChange={(e) => updateModel({ partSheetId: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-mono text-xs outline-none focus:border-accent"
                      >
                        {sheetMaterials.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} — {s.areaWeightKgM2?.toFixed(2)} kg/m² ({fmtBRL(s.unitPriceBRL)}/chapa)
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Checkboxes de Ferragens e Complementos de Montagem */}
                <div className="rounded-xl border border-line bg-card/60 p-3 space-y-2">
                  <span className="font-mono text-[10px] font-bold uppercase text-accent">
                    Ferragens & Complementos de Montagem (Catálogo Costa Ferro)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={model.hardwareOptions?.includeRoldanas !== false}
                        onChange={(e) =>
                          updateModel({
                            hardwareOptions: {
                              ...model.hardwareOptions,
                              includeRoldanas: e.target.checked,
                            },
                          })
                        }
                        className="rounded border-line text-accent focus:ring-accent"
                      />
                      <span>Roldanas Canal V/U + Guia Superior</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={model.hardwareOptions?.includeFechadura !== false}
                        onChange={(e) =>
                          updateModel({
                            hardwareOptions: {
                              ...model.hardwareOptions,
                              includeFechadura: e.target.checked,
                            },
                          })
                        }
                        className="rounded border-line text-accent focus:ring-accent"
                      />
                      <span>Fechadura Bico de Papagaio / Elétrica</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={model.hardwareOptions?.includeDobradicas ?? true}
                        onChange={(e) =>
                          updateModel({
                            hardwareOptions: {
                              ...model.hardwareOptions,
                              includeDobradicas: e.target.checked,
                            },
                          })
                        }
                        className="rounded border-line text-accent focus:ring-accent"
                      />
                      <span>Dobradiças / Gonzos com Aba para Solda</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={model.hardwareOptions?.includeParafusosParabolt !== false}
                        onChange={(e) =>
                          updateModel({
                            hardwareOptions: {
                              ...model.hardwareOptions,
                              includeParafusosParabolt: e.target.checked,
                            },
                          })
                        }
                        className="rounded border-line text-accent focus:ring-accent"
                      />
                      <span>Chumbadores Mecânicos Parabolt 3/8"</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={model.hardwareOptions?.includePrimerTinta !== false}
                        onChange={(e) =>
                          updateModel({
                            hardwareOptions: {
                              ...model.hardwareOptions,
                              includePrimerTinta: e.target.checked,
                            },
                          })
                        }
                        className="rounded border-line text-accent focus:ring-accent"
                      />
                      <span>Insumos de Oficina (Solda MIG, Discos de Corte & Primer Anticorrosivo)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* ABA 2: DOSSIÊ MULTI-VISTAS (ABNT)                                 */}
        {/* ================================================================= */}
        {isTab2 && (
          <div className="space-y-3">
            {/* Barra de Ferramentas da Vista Técnica */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-background/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  Quadro Técnico Multi-Vistas (1º Diedro ABNT NBR 10067)
                </span>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  · Frontal e Lateral cotadas lado a lado em mm/cm + Isométrica 2.5D + Legenda
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Seletor de Fundo: Escuro CAD vs Branco ABNT */}
                <div className="flex rounded-lg border border-line bg-card p-0.5 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => setDrawingViewMode("dark-cad")}
                    className={cn(
                      "flex items-center gap-1 rounded px-2 py-1 transition-all",
                      drawingViewMode === "dark-cad"
                        ? "bg-accent/20 text-accent font-bold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Moon className="size-3" />
                    Fundo Escuro CAD
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawingViewMode("white-sheet")}
                    className={cn(
                      "flex items-center gap-1 rounded px-2 py-1 transition-all",
                      drawingViewMode === "white-sheet"
                        ? "bg-accent/20 text-accent font-bold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Sun className="size-3" />
                    Prancha A3 Branca
                  </button>
                </div>

                {onInsertEntitiesToCad && (
                  <button
                    type="button"
                    onClick={() => {
                      onInsertEntitiesToCad(
                        [...dossier.multiViewEntities, ...dossier.cadEntities],
                        false,
                      );
                      toast.success("Prancha e geometria inseridas no Canvas CHAMFER!");
                      if (!embedded) onClose();
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-2.5 py-1 font-mono text-[10px] font-semibold text-accent hover:bg-accent/25"
                  >
                    <PenTool className="size-3.5" />
                    Inserir no CHAMFER
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1 font-mono text-[10px] font-semibold text-foreground hover:border-accent"
                >
                  <Download className="size-3.5 text-accent" />
                  Baixar SVG
                </button>
              </div>
            </div>

            {/* Quadro Técnico com Vistas Cotadas Lado a Lado e Isométrica */}
            <div
              className={cn(
                "w-full overflow-hidden rounded-xl border border-line shadow-inner p-2 transition-all",
                drawingViewMode === "dark-cad" ? "bg-[#070B14]" : "bg-white",
              )}
              dangerouslySetInnerHTML={{
                __html:
                  drawingViewMode === "dark-cad"
                    ? dossier.darkTechnicalBoardSvg
                    : dossier.multiViewSvg,
              }}
            />
          </div>
        )}

        {/* ================================================================= */}
        {/* ABA 3: LISTA DE CORTE                                             */}
        {/* ================================================================= */}
        {isTab3 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">
                  Tabela Completa de Corte de Bancada & Aproveitamento 1D
                </h3>
                <p className="text-xs text-muted-foreground">
                  Comprimentos exatos com desconto de perda de serra ({model.sawKerfMm}mm) e ângulos de ponta (45° / 90°).
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadCutListCsv}
                className="flex items-center gap-1.5 rounded-xl border border-line bg-background/60 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase hover:border-accent"
              >
                <FileSpreadsheet className="size-3.5 text-accent" />
                Exportar CSV de Corte
              </button>
            </div>

            {/* TABELA DE CORTE COM AS COLUNAS EXATAS ESPECIFICADAS */}
            <div className="overflow-x-auto rounded-xl border border-line bg-background/40">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-muted/40 font-mono text-[9.5px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Item/Posição</th>
                    <th className="px-3 py-2.5">Peça</th>
                    <th className="px-3 py-2.5">Perfil / Material</th>
                    <th className="px-3 py-2.5 text-right">Comprimento de Corte (mm)</th>
                    <th className="px-3 py-2.5 text-center">Ângulos (90° ou 45°)</th>
                    <th className="px-3 py-2.5 text-center">Qtd</th>
                    <th className="px-3 py-2.5 text-right">Peso (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {dossier.cutList.map((c) => (
                    <tr key={c.id} className="border-t border-line/60 hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono font-bold text-accent">{c.tag}</td>
                      <td className="px-3 py-2 font-medium text-foreground">{c.name}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{c.profileName}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-foreground">
                        {c.unitLengthMm} mm
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-[11px]">
                        {c.cutAngleLeftDeg}° / {c.cutAngleRightDeg}°
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-foreground">
                        {c.quantity}x
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-accent">
                        {c.totalWeightKg.toFixed(2)} kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mapa Visual de Aproveitamento de Barras Comerciais de 6000mm (1D Bar Nesting) */}
            <div className="space-y-3 pt-2">
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
                Plano de Otimização Linear em Barras de 6000mm (First-Fit Decreasing)
              </h4>

              {dossier.barNestingPlans.map((plan) => (
                <div
                  key={plan.profileId}
                  className="rounded-xl border border-line bg-background/50 p-3.5 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {plan.profileName}
                      </span>
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                        · Comprar <strong>{plan.barsRequired} barra(s)</strong> de {plan.barCommercialLengthMm} mm
                      </span>
                    </div>
                    <div className="font-mono text-xs">
                      <span className="text-accent font-bold">
                        Aproveitamento: {plan.overallUtilizationPct}%
                      </span>
                      <span className="ml-3 text-muted-foreground">
                        Sobra Total: <strong>{plan.totalOffcutMm} mm</strong>
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {plan.bars.map((bar) => (
                      <div key={bar.barNumber} className="space-y-1">
                        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                          <span>
                            Barra #{bar.barNumber} ({bar.barLengthMm} mm) — Usado: <strong>{bar.usedLengthMm} mm</strong>
                          </span>
                          <span>
                            Aproveitamento {bar.utilizationPct}% · Retalho/Sobra: <strong>{bar.offcutMm} mm</strong>
                          </span>
                        </div>
                        <div className="flex h-7 w-full overflow-hidden rounded-lg border border-line bg-background">
                          {bar.cuts.map((cut, cIdx) => {
                            const wPct = Math.max(4, (cut.lengthMm / bar.barLengthMm) * 100);
                            return (
                              <div
                                key={`${bar.barNumber}-${cIdx}`}
                                style={{ width: `${wPct}%` }}
                                className="flex items-center justify-center border-r border-background/80 bg-accent/25 px-1 font-mono text-[9.5px] font-bold text-foreground truncate"
                                title={`${cut.tag} (${cut.name}): ${cut.lengthMm}mm [${cut.leftAngleDeg}°/${cut.rightAngleDeg}°]`}
                              >
                                {cut.tag}: {cut.lengthMm}mm
                              </div>
                            );
                          })}
                          {bar.offcutMm > 0 && (
                            <div
                              style={{ width: `${(bar.offcutMm / bar.barLengthMm) * 100}%` }}
                              className="flex items-center justify-center bg-muted/40 px-1 font-mono text-[9px] text-muted-foreground truncate"
                              title={`Sobra de barra: ${bar.offcutMm}mm`}
                            >
                              {bar.offcutMm >= 300 ? `Sobra ${bar.offcutMm}mm` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Tabela de Chapas Recortadas / Blanks */}
            {dossier.sheetPieces.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
                  Peças e Blanks de Chapa Plana / Dobrada
                </h4>
                <div className="overflow-x-auto rounded-xl border border-line bg-background/40">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-line bg-muted/40 font-mono text-[9.5px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">TAG</th>
                        <th className="px-3 py-2">Peça de Chapa</th>
                        <th className="px-3 py-2">Chapa Costa Ferro</th>
                        <th className="px-3 py-2 text-center">Qtd</th>
                        <th className="px-3 py-2 text-right">Blank (L × A)</th>
                        <th className="px-3 py-2 text-right">Perímetro CNC</th>
                        <th className="px-3 py-2 text-right">Massa Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.sheetPieces.map((sp) => (
                        <tr key={sp.id} className="border-t border-line/60">
                          <td className="px-3 py-2 font-mono font-bold text-accent">{sp.tag}</td>
                          <td className="px-3 py-2 font-medium text-foreground">{sp.name}</td>
                          <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{sp.sheetName}</td>
                          <td className="px-3 py-2 text-center font-mono font-bold">{sp.quantity}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-foreground">
                            {sp.widthMm} × {sp.heightMm} mm
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{sp.cutPerimeterM} m</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-accent">
                            {sp.totalWeightKg.toFixed(2)} kg
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* ABA 4: LISTA DE MATERIAIS / BOM                                   */}
        {/* ================================================================= */}
        {isTab4 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">
                  Lista Comercial de Compras (BOM Consolidada · Catálogo Costa Ferro)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Quantidade real de barras comerciais de 6000mm, chapas industriais e kits de montagem.
                </p>
              </div>
              <div className="font-mono text-xs font-bold text-accent">
                Total em Materiais & Ferragens: {fmtBRL(dossier.budget.totalMaterialsBRL)}
              </div>
            </div>

            {/* Cartões de Resumo da Lista de Materiais */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-line bg-card/60 p-3">
                <span className="font-mono text-[9px] uppercase text-muted-foreground">
                  Barras 6000mm a Comprar
                </span>
                <p className="font-mono text-base font-bold text-foreground">
                  {dossier.totalBars6mCount} barras
                </p>
              </div>
              <div className="rounded-xl border border-line bg-card/60 p-3">
                <span className="font-mono text-[9px] uppercase text-muted-foreground">
                  Chapas Comerciais
                </span>
                <p className="font-mono text-base font-bold text-foreground">
                  {dossier.totalSheetsCount} chapa(s) · {dossier.totalSurfaceAreaM2} m²
                </p>
              </div>
              <div className="rounded-xl border border-line bg-card/60 p-3">
                <span className="font-mono text-[9px] uppercase text-muted-foreground">
                  Peso Total Consolidado
                </span>
                <p className="font-mono text-base font-bold text-accent">
                  {dossier.totalWeightKg.toFixed(2)} kg
                </p>
              </div>
              <div className="rounded-xl border border-line bg-card/60 p-3">
                <span className="font-mono text-[9px] uppercase text-muted-foreground">
                  Total Compra Materiais
                </span>
                <p className="font-mono text-base font-bold text-foreground">
                  {fmtBRL(dossier.budget.totalMaterialsBRL)}
                </p>
              </div>
            </div>

            {/* TABELA DE COMPRA COM VALORES EDITÁVEIS */}
            <div className="overflow-x-auto rounded-xl border border-line bg-background/40">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-muted/40 font-mono text-[9.5px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Item / Especificação Comercial Costa Ferro</th>
                    <th className="px-3 py-2.5">Origem</th>
                    <th className="px-3 py-2.5 text-center">Qtd a Comprar</th>
                    <th className="px-3 py-2.5 text-right">Peso Total</th>
                    <th className="px-3 py-2.5 text-right">Preço Unit. (R$)</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {dossier.bom.map((item) => {
                    const catalogId = item.id
                      .replace(/^bom-bar-/, "")
                      .replace(/^bom-sheet-/, "")
                      .replace(/^bom-hw-/, "");
                    return (
                      <tr key={item.id} className="border-t border-line/60 hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <span className="font-medium text-foreground">{item.description}</span>
                          <span className="block text-[10px] text-muted-foreground">
                            {item.specification}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                          {item.origin}
                        </td>
                        <td className="px-3 py-2 text-center font-mono font-bold text-foreground">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {item.totalWeightKg.toFixed(2)} kg
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          <input
                            type="number"
                            step="0.5"
                            defaultValue={item.unitPriceBRL}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value);
                              if (Number.isFinite(val) && val > 0) {
                                savePriceOverride(catalogId, val);
                                setPriceTick((t) => t + 1);
                                toast.success(`Preço atualizado para ${fmtBRL(val)}`);
                              }
                            }}
                            className="w-24 rounded-lg border border-line bg-card px-2 py-1 text-right font-mono text-xs outline-none focus:border-accent"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-accent">
                          {fmtBRL(item.subtotalBRL)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* ABA 5: ORÇAMENTO & PROPOSTA                                       */}
        {/* ================================================================= */}
        {isTab5 && (
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Parâmetros de Custo, Mão de Obra e BDI */}
            <div className="space-y-3 lg:col-span-6">
              <div className="rounded-xl border border-line bg-background/40 p-3.5 space-y-3">
                <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-accent">
                  Parâmetros de Custeio, Mão de Obra e Margem
                </h3>

                <div className="flex items-center justify-between rounded-xl border border-line bg-card p-2.5">
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      Critério de Custeio de Barras e Chapas
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {model.chargeFullBars
                        ? "Cobrando barras inteiras de 6000mm e chapas fechadas"
                        : `Cobrando apenas peso líquido + ${model.wasteMarginPct}% de perda`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateModel({ chargeFullBars: !model.chargeFullBars })}
                    className="rounded-lg border border-accent/40 bg-accent/15 px-2.5 py-1 font-mono text-[10px] font-bold text-accent"
                  >
                    {model.chargeFullBars ? "Barras Inteiras (6m)" : "Peso Líquido + Perda"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <NumInput
                    label="Horas de Oficina (Corte/Solda)"
                    value={model.laborHoursCutWeld}
                    onChange={(v) => updateModel({ laborHoursCutWeld: v })}
                  />
                  <NumInput
                    label="Taxa Hora Oficina (R$/h)"
                    value={model.laborHourlyRateBRL}
                    onChange={(v) => updateModel({ laborHourlyRateBRL: v })}
                  />
                  <NumInput
                    label="Pintura / Acabamento (R$/m²)"
                    value={model.paintingAreaRateBRL}
                    onChange={(v) => updateModel({ paintingAreaRateBRL: v })}
                  />
                  <NumInput
                    label="Frete e Instalação em Obra (R$)"
                    value={model.installationBRL}
                    onChange={(v) => updateModel({ installationBRL: v })}
                  />
                  <NumInput
                    label="Impostos / Custos Operacionais (%)"
                    value={model.overheadTaxPct}
                    onChange={(v) => updateModel({ overheadTaxPct: v })}
                  />
                  <NumInput
                    label="Margem de Lucro / BDI (%)"
                    value={model.profitMarginPct}
                    onChange={(v) => updateModel({ profitMarginPct: v })}
                  />
                </div>
              </div>
            </div>

            {/* Demonstrativo Financeiro Final & Proposta Comercial */}
            <div className="space-y-3 lg:col-span-6">
              <div className="rounded-xl border border-line bg-background/40 p-4 space-y-2.5">
                <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-accent">
                  Detalhamento Financeiro & Formação de Preço
                </h3>

                <div className="space-y-1.5 text-xs">
                  <Row
                    label="Subtotal de Materiais Brutos (Perfis e Tubos Costa Ferro)"
                    value={fmtBRL(dossier.budget.profilesCostBRL)}
                  />
                  <Row
                    label="Chapas de Aço Comerciais"
                    value={fmtBRL(dossier.budget.sheetsCostBRL)}
                  />
                  <Row
                    label="Ferragens e Acessórios de Montagem"
                    value={fmtBRL(dossier.budget.hardwareCostBRL)}
                  />
                  <Row
                    label="Consumíveis (Solda MIG, Discos, Primer)"
                    value={fmtBRL(dossier.budget.consumablesCostBRL)}
                  />

                  <div className="border-t border-line pt-1.5 font-semibold">
                    <Row
                      label="Subtotal de Materiais Diretos"
                      value={fmtBRL(dossier.budget.totalMaterialsBRL)}
                    />
                  </div>

                  <Row
                    label={`Mão de Obra (${model.laborHoursCutWeld}h × ${fmtBRL(model.laborHourlyRateBRL)}/h)`}
                    value={fmtBRL(dossier.budget.laborCostBRL)}
                  />
                  <Row
                    label={`Pintura e Tratamento (${dossier.totalSurfaceAreaM2} m²) + Corte CNC`}
                    value={fmtBRL(dossier.budget.paintingCostBRL + dossier.budget.cncCuttingCostBRL)}
                  />
                  <Row
                    label="Frete e Instalação em Obra"
                    value={fmtBRL(dossier.budget.installationCostBRL)}
                  />
                  <Row
                    label={`Impostos e Custos Operacionais (${model.overheadTaxPct}%)`}
                    value={fmtBRL(dossier.budget.taxesAndOverheadBRL)}
                  />
                  <Row
                    label={`Margem de Lucro / BDI (${model.profitMarginPct}%)`}
                    value={fmtBRL(dossier.budget.profitAmountBRL)}
                    highlight
                  />
                </div>

                <div className="mt-3 rounded-xl border border-accent/40 bg-accent/10 p-3 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-[10px] uppercase text-accent font-bold">
                      Preço Final de Venda Sugerido
                    </span>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {fmtBRL(dossier.budget.pricePerKgBRL)}/kg instalado · {fmtBRL(dossier.budget.pricePerM2BRL)}/m²
                    </p>
                  </div>
                  <p className="font-mono text-xl font-bold text-accent">
                    {fmtBRL(dossier.budget.finalClientPriceBRL)}
                  </p>
                </div>

                {/* BOTÕES DE PROPOSTA COMERCIAL: PDF / WHATSAPP / CSV */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handlePrintFullDossier}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2.5 font-mono text-xs font-bold uppercase text-background hover:opacity-90"
                  >
                    <Printer className="size-4" />
                    Emitir PDF
                  </button>

                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(generateProposalText())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/50 bg-emerald-500/15 text-emerald-400 px-3 py-2.5 font-mono text-xs font-bold uppercase hover:bg-emerald-500/25"
                  >
                    <MessageSquare className="size-4" />
                    WhatsApp
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyProposal}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2.5 font-mono text-xs font-semibold hover:border-accent"
                  >
                    <Copy className="size-4 text-accent" />
                    Copiar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <>
      <div
        className="fixed inset-0 z-[85] bg-background/80 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
      {content}
    </>
  );
}

function NumInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[9.5px] uppercase text-muted-foreground">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 font-mono text-xs font-semibold text-foreground outline-none focus:border-accent"
      />
    </label>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={cn("text-muted-foreground", highlight && "text-accent font-medium")}>
        {label}
      </span>
      <span className={cn("font-mono font-medium", highlight && "text-accent font-bold")}>
        {value}
      </span>
    </div>
  );
}
