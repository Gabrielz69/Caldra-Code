export type AngleMode = "RAD" | "DEG" | "GRAD";

type Token =
  | { type: "number"; value: number }
  | { type: "name"; value: string }
  | { type: "op"; value: string }
  | { type: "lparen" }
  | { type: "rparen" };

export class CalculatorError extends Error {}

const FUNCTIONS = new Set([
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "log",
  "ln",
  "sqrt",
  "cbrt",
  "exp",
]);

function tokenize(source: string): Token[] {
  const normalized = source
    .replace(/√\s*([0-9.]+)/g, "sqrt($1)")
    .replace(/√/g, "sqrt")
    .replace(/,/g, ".")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/π/g, "pi");
  const out: Token[] = [];
  let i = 0;
  while (i < normalized.length) {
    const c = normalized[i] ?? "";
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let raw = "";
      while (i < normalized.length && /[0-9.eE]/.test(normalized[i] ?? ""))
        raw += normalized[i++] ?? "";
      if ((normalized[i] === "+" || normalized[i] === "-") && /[eE]$/.test(raw))
        raw += normalized[i++] ?? "";
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new CalculatorError("Número inválido");
      out.push({ type: "number", value });
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let value = "";
      while (i < normalized.length && /[a-zA-Z0-9]/.test(normalized[i] ?? ""))
        value += normalized[i++] ?? "";
      out.push({ type: "name", value: value.toLowerCase() });
      continue;
    }
    if (c === "(") out.push({ type: "lparen" });
    else if (c === ")") out.push({ type: "rparen" });
    else if ("+-*/^%!".includes(c)) out.push({ type: "op", value: c });
    else throw new CalculatorError("Símbolo não reconhecido");
    i += 1;
  }
  return out;
}

/** Fatorial exato para inteiros (0! = 1). Acima de 170 estoura o double. */
function factorial(n: number): number {
  if (!Number.isFinite(n) || n < 0 || Math.abs(n - Math.round(n)) > 1e-9)
    throw new CalculatorError("Fatorial exige inteiro não negativo");
  const k = Math.round(n);
  if (k > 170) throw new CalculatorError("Fatorial grande demais");
  let out = 1;
  for (let i = 2; i <= k; i += 1) out *= i;
  return out;
}

function toRadians(value: number, mode: AngleMode) {
  if (mode === "DEG") return (value * Math.PI) / 180;
  if (mode === "GRAD") return (value * Math.PI) / 200;
  return value;
}

function fromRadians(value: number, mode: AngleMode) {
  if (mode === "DEG") return (value * 180) / Math.PI;
  if (mode === "GRAD") return (value * 200) / Math.PI;
  return value;
}

export function evaluateExpression(source: string, angleMode: AngleMode): number {
  const tokens = tokenize(source);
  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];

  const primary = (): number => {
    const token = take();
    if (!token) throw new CalculatorError("Expressão incompleta");
    if (token.type === "number") return token.value;
    if (token.type === "lparen") {
      const value = expression();
      if (take()?.type !== "rparen") throw new CalculatorError("Feche os parênteses");
      return value;
    }
    if (token.type === "name") {
      if (token.value === "pi") return Math.PI;
      if (token.value === "e") return Math.E;
      if (!FUNCTIONS.has(token.value)) throw new CalculatorError("Função desconhecida");
      let argument: number;
      if (peek()?.type === "lparen") {
        take();
        argument = expression();
        if (take()?.type !== "rparen") throw new CalculatorError("Feche os parênteses");
      } else argument = unary();
      switch (token.value) {
        case "sin":
          return Math.sin(toRadians(argument, angleMode));
        case "cos":
          return Math.cos(toRadians(argument, angleMode));
        case "tan":
          return Math.tan(toRadians(argument, angleMode));
        case "asin":
          return fromRadians(Math.asin(argument), angleMode);
        case "acos":
          return fromRadians(Math.acos(argument), angleMode);
        case "atan":
          return fromRadians(Math.atan(argument), angleMode);
        case "log":
          return Math.log10(argument);
        case "ln":
          return Math.log(argument);
        case "sqrt":
          return Math.sqrt(argument);
        case "cbrt":
          return Math.cbrt(argument);
        case "exp":
          return Math.exp(argument);
        default:
          throw new CalculatorError("Função inválida");
      }
    }
    throw new CalculatorError("Valor esperado");
  };

  /* Pós-fixos: `!` (fatorial) e `%` (porcentagem = valor / 100).
     `10%×250` → 25. Precedência acima de potência. */
  const postfix = (base: () => number) => (): { value: number; percent: boolean } => {
    let value = base();
    let percent = false;
    while (true) {
      const token = peek();
      if (token?.type !== "op" || (token.value !== "!" && token.value !== "%")) break;
      take();
      if (token.value === "!") value = factorial(value);
      else {
        value /= 100;
        percent = true;
      }
    }
    return { value, percent };
  };

  const primaryPostfix = postfix(primary);

  /* `-3^2` = −9: o sinal é aplicado DEPOIS da potência, como na matemática. */
  const power = (): number => {
    const left = primaryPostfix().value;
    const token = peek();
    if (token?.type === "op" && token.value === "^") {
      take();
      return left ** unary();
    }
    return left;
  };

  const unary = (): number => {
    const token = peek();
    if (token?.type === "op" && (token.value === "+" || token.value === "-")) {
      take();
      const value = unary();
      return token.value === "-" ? -value : value;
    }
    return power();
  };

  const product = (): number => {
    let value = unary();
    while (true) {
      const token = peek();
      if (token?.type !== "op" || !["*", "/"].includes(token.value)) break;
      take();
      const right = unary();
      if (token.value === "*") value *= right;
      else value /= right;
    }
    return value;
  };

  const expression = (): number => {
    let value = product();
    while (true) {
      const token = peek();
      if (token?.type !== "op" || !["+", "-"].includes(token.value)) break;
      take();
      const rightStart = index;
      const right = product();
      const rightIsPercent = tokens
        .slice(rightStart, index)
        .some((t) => t.type === "op" && t.value === "%");
      const operand = rightIsPercent ? value * right : right;
      value = token.value === "+" ? value + operand : value - operand;
    }
    return value;
  };

  if (!tokens.length) return 0;
  const result = expression();
  if (index !== tokens.length) throw new CalculatorError("Revise a expressão");
  if (!Number.isFinite(result)) throw new CalculatorError("Resultado indefinido");
  if (Number.isNaN(result)) throw new CalculatorError("Operação fora do domínio real");
  return Math.abs(result) < 1e-14 ? 0 : result;
}

export function formatResult(value: number, places: number) {
  const abs = Math.abs(value);
  if (abs >= 1e12 || (abs > 0 && abs < 1e-8)) return value.toExponential(places).replace(".", ",");
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
    useGrouping: false,
  });
}

export function toFraction(value: number, maxDenominator = 10000) {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "−" : "";
  const target = Math.abs(value);
  let bestN = Math.round(target),
    bestD = 1,
    bestError = Math.abs(target - bestN);
  for (let d = 1; d <= maxDenominator; d += 1) {
    const n = Math.round(target * d);
    const error = Math.abs(target - n / d);
    if (error < bestError) {
      bestN = n;
      bestD = d;
      bestError = error;
    }
    if (error < 1e-10) break;
  }
  return `${sign}${bestN}/${bestD}`;
}
