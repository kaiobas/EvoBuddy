import rateLimit from "express-rate-limit";

/**
 * Rate limiter global: 100 requisições por minuto por IP.
 */
export const globalRateLimit = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

/**
 * Rate limiter estrito para auth: 5 tentativas por minuto.
 */
export const authRateLimit = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});
