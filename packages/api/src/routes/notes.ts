import { Router } from "express";

const router = Router();

/**
 * GET /api/notes
 * Listar notas do usuário autenticado.
 */
router.get("/", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet" });
});

/**
 * POST /api/notes
 * Criar nova nota.
 */
router.post("/", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet" });
});

/**
 * PUT /api/notes/:id
 * Atualizar nota existente.
 */
router.put("/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet" });
});

/**
 * DELETE /api/notes/:id
 * Remover nota.
 */
router.delete("/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet" });
});

export default router;
