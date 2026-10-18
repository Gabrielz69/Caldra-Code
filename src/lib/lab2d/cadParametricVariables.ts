/**
 * CALDRA CHAMFER — VARIÁVEIS E EQUAÇÕES PARAMÉTRICAS (CAD PARAMETRICS)
 *
 * Tabela de variáveis globais e expressões relacionais do projeto:
 *  - Ex: LARGURA = 500, ALTURA = 300, MARGEM = 25, FURO = LARGURA / 10
 *  - Avaliador de expressões matemáticas seguro e determinístico;
 *  - Grafo de dependências direcionado acíclico (DAG) para propagação em cascata;
 *  - Atualização automática de entidades geométricas vinculadas a variáveis.
 */

export interface ParametricVariable {
  name: string;
  expression: string;
  value: number;
  description?: string;
  unit: "mm" | "deg" | "qty";
}

export class ParametricVariableStore {
  private variables: Map<string, ParametricVariable> = new Map();
  private listeners: (() => void)[] = [];

  constructor() {
    // Variáveis padrão para caldeiraria e mecânica
    this.setVariable("LARGURA", "600", "Largura nominal da chapa / peça");
    this.setVariable("ALTURA", "400", "Altura nominal da chapa / peça");
    this.setVariable("ESPESSURA", "6.35", "Espessura da chapa (1/4 pol)");
    this.setVariable("MARGEM", "50", "Margem de dobra e furação");
    this.setVariable("FURO_FIXACAO", "18", "Diâmetro dos furos de parafuso M16");
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public getAll(): ParametricVariable[] {
    return Array.from(this.variables.values());
  }

  public get(name: string): ParametricVariable | undefined {
    return this.variables.get(name.toUpperCase());
  }

  public getValue(name: string, fallback = 0): number {
    const v = this.variables.get(name.toUpperCase());
    return v ? v.value : fallback;
  }

  /**
   * Avalia expressão com suporte a:
   * - Nomes de variáveis do projeto
   * - Operadores: +, -, *, /, ^, parênteses
   * - Funções: sqrt, sin, cos, tan, atan2, abs, min, max, round, ceil, floor, if
   * - Unidades: mm, in, pol, ", cm, m, deg, °
   * - Separador decimal: vírgula ou ponto (ex: "1,5 in", "500 mm")
   */
  public evaluateExpression(expr: string): number {
    let clean = (expr || "").trim();
    if (!clean) return 0;

    // Normalização de unidades técnicas comuns
    clean = clean.replace(/([0-9]+(?:[.,][0-9]+)?)\s*(?:in|pol|")\b/gi, (_, val) => {
      const v = parseFloat(val.replace(",", "."));
      return String(v * 25.4);
    });
    clean = clean.replace(/([0-9]+(?:[.,][0-9]+)?)\s*cm\b/gi, (_, val) => {
      const v = parseFloat(val.replace(",", "."));
      return String(v * 10);
    });
    clean = clean.replace(/([0-9]+(?:[.,][0-9]+)?)\s*m\b/gi, (_, val) => {
      const v = parseFloat(val.replace(",", "."));
      return String(v * 1000);
    });
    clean = clean.replace(/([0-9]+(?:[.,][0-9]+)?)\s*mm\b/gi, (_, val) => {
      return val.replace(",", ".");
    });
    clean = clean.replace(/([0-9]+(?:[.,][0-9]+)?)\s*(?:deg|°)\b/gi, (_, val) => {
      return val.replace(",", ".");
    });

    // Se houver vírgula entre números (ex: 12,5 + 2,3), converte para ponto
    clean = clean.replace(/(\d+),(\d+)/g, "$1.$2");

    // Se for número puro direto
    const num = Number(clean);
    if (!isNaN(num)) return num;

    // Substitui variáveis conhecidas pelo seu valor numérico
    let parsed = clean.toUpperCase();
    const sortedVars = Array.from(this.variables.values()).sort(
      (a, b) => b.name.length - a.name.length,
    );

    for (const v of sortedVars) {
      const regex = new RegExp(`\\b${v.name}\\b`, "g");
      parsed = parsed.replace(regex, `(${v.value})`);
    }

    // Mapeamento de funções matemáticas suportadas
    parsed = parsed.toLowerCase();
    const mathMap: Record<string, string> = {
      sqrt: "Math.sqrt",
      sin: "Math.sin",
      cos: "Math.cos",
      tan: "Math.tan",
      atan2: "Math.atan2",
      abs: "Math.abs",
      min: "Math.min",
      max: "Math.max",
      round: "Math.round",
      ceil: "Math.ceil",
      floor: "Math.floor",
      pi: "Math.PI",
    };

    for (const [fn, mathFn] of Object.entries(mathMap)) {
      const regex = new RegExp(`\\b${fn}\\b`, "g");
      parsed = parsed.replace(regex, mathFn);
    }

    // Suporte a if(cond, a, b) -> (cond ? a : b)
    parsed = parsed.replace(/\bif\s*\(([^,]+),([^,]+),([^)]+)\)/g, "($1 ? $2 : $3)");

    try {
      // Verifica se a expressão contém apenas tokens seguros (números, operadores, Math.*, parênteses e ternários)
      const sanitized = parsed.replace(/[^0-9a-zA-Z_+\-*/().^eE\s,?:<>=!]/g, "");
      // Garante que qualquer palavra usada seja ou 'Math' ou membro de Math ou operador seguro
      const tokens = sanitized.match(/[a-zA-Z_]+/g) || [];
      const allowedTokens = new Set([
        "Math", "sqrt", "sin", "cos", "tan", "atan2", "abs", "min", "max",
        "round", "ceil", "floor", "PI", "E"
      ]);
      for (const tok of tokens) {
        if (!allowedTokens.has(tok)) {
          return 0; // Rejeita qualquer símbolo não permitido
        }
      }
      const runnable = sanitized.replace(/\^/g, "**");
      const result = new Function("Math", `return (${runnable});`)(Math);
      return typeof result === "number" && !isNaN(result) && isFinite(result) ? result : 0;
    } catch {
      return 0;
    }
  }

  public setVariable(
    name: string,
    expression: string,
    description = "",
    unit: "mm" | "deg" | "qty" = "mm",
  ) {
    const upperName = name.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
    if (!upperName) return;

    const value = this.evaluateExpression(expression);
    this.variables.set(upperName, {
      name: upperName,
      expression,
      value,
      description,
      unit,
    });

    // Reavalia variáveis dependentes
    this.recomputeAll();
    this.notify();
  }

  public removeVariable(name: string) {
    this.variables.delete(name.toUpperCase());
    this.recomputeAll();
    this.notify();
  }

  public recomputeAll() {
    let changed = true;
    let cycles = 0;
    while (changed && cycles < 10) {
      changed = false;
      cycles++;
      for (const [key, v] of this.variables.entries()) {
        const newVal = this.evaluateExpression(v.expression);
        if (Math.abs(newVal - v.value) > 1e-6) {
          v.value = newVal;
          changed = true;
        }
      }
    }
  }
}

export const globalParametricStore = new ParametricVariableStore();
