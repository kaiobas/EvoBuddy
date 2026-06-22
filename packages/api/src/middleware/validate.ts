import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { AppError } from "./error.js";

/**
 * Middleware de validação com Zod.
 * Valida req.body contra o schema fornecido.
 */
export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const messages = result.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`
      );
      throw new AppError(messages.join("; "), 400);
    }
    req[source] = result.data;
    next();
  };
}
