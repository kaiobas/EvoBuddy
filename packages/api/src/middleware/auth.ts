import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { AppError } from "./error.js";

/**
 * Extensão do Request do Express para incluir dados do usuário autenticado.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
      };
    }
  }
}

/**
 * Middleware de autenticação.
 * Aceita token via:
 *   1. Cookie `sb-token` (mais seguro — httpOnly)
 *   2. Header `Authorization: Bearer <token>` (fallback para API clients)
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Tentar cookie primeiro
    let token = req.cookies?.["sb-token"];

    // 2. Fallback para Authorization header
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      throw new AppError("Authentication required", 401);
    }

    if (!supabaseAdmin) {
      throw new AppError("Auth service not available", 500);
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      throw new AppError("Invalid or expired token", 401);
    }

    req.user = {
      id: data.user.id,
      email: data.user.email,
    };

    next();
  } catch (err) {
    next(err);
  }
}
