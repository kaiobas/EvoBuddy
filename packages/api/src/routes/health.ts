import { Router } from "express";

const router = Router();

/**
 * GET /api/health
 * Health check endpoint.
 */
router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

export default router;
