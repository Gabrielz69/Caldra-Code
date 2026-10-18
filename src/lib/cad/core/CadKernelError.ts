/**
 * CALDRA CAD CORE — ERROR LAYER
 *
 * Tratamento robusto de erros do kernel geométrico.
 * Impede que falhas de cálculo B-Rep derrubem a interface do usuário (CHAMFER)
 * e fornece códigos padronizados para diagnóstico e recuperação segura.
 */

export type CadKernelErrorCode =
  | "NOT_INITIALIZED"
  | "INITIALIZATION_FAILED"
  | "INVALID_DIMENSIONS"
  | "INVALID_HANDLE"
  | "BOOLEAN_FAILED"
  | "TOPOLOGY_DEGENERATE"
  | "FILLET_FAILED"
  | "CHAMFER_FAILED"
  | "EXTRUSION_FAILED"
  | "REVOLUTION_FAILED"
  | "LOFT_FAILED"
  | "TRANSFORM_FAILED"
  | "TESSELLATION_FAILED"
  | "STEP_EXPORT_FAILED"
  | "STEP_IMPORT_FAILED"
  | "NOT_SUPPORTED"
  | "OUT_OF_MEMORY"
  | "TIMEOUT"
  | "UNKNOWN_ERROR";

export class CadKernelError extends Error {
  readonly operation: string;
  readonly code: CadKernelErrorCode;
  readonly recoverable: boolean;
  readonly originalError?: unknown;

  constructor(options: {
    operation: string;
    message: string;
    code?: CadKernelErrorCode;
    recoverable?: boolean;
    originalError?: unknown;
  }) {
    super(`[CALDRA CAD Core][${options.operation}] ${options.message}`);
    this.name = "CadKernelError";
    this.operation = options.operation;
    this.code = options.code ?? "UNKNOWN_ERROR";
    this.recoverable = options.recoverable ?? true;
    this.originalError = options.originalError;

    // Preserva o stack trace nativo do V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CadKernelError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      operation: this.operation,
      message: this.message,
      code: this.code,
      recoverable: this.recoverable,
      originalError:
        this.originalError instanceof Error
          ? this.originalError.message
          : String(this.originalError ?? ""),
    };
  }
}

export function wrapKernelError(
  operation: string,
  error: unknown,
  code: CadKernelErrorCode = "UNKNOWN_ERROR",
  recoverable = true,
): CadKernelError {
  if (error instanceof CadKernelError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return new CadKernelError({
    operation,
    message,
    code,
    recoverable,
    originalError: error,
  });
}
