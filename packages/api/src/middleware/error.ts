import type { Request, Response, NextFunction } from "express";

/**
 * Erro customizado com status HTTP.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public status: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Error handler global.
 * Em produção, NÃO vaza detalhes internos do erro.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err instanceof AppError ? err.status : 500;
  const isProduction = process.env.NODE_ENV === "production";

  // Log interno sempre
  if (status >= 500) {
    console.error("[error]", err);
  }

  // Resposta sanitizada
  res.status(status).json({
    error: isProduction && status >= 500 ? "Internal server error" : err.message,
  });
}
