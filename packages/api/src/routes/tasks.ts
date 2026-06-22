import { Router } from "express";

const router = Router();

/**
 * GET /api/tasks
 * Listar tarefas do usuário autenticado.
 */
router.get("/", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet" });
});

/**
 * POST /api/tasks
 * Criar nova tarefa.
 */
router.post("/", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet" });
});

/**
 * PUT /api/tasks/:id
 * Atualizar tarefa existente.
 */
router.put("/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet" });
});

/**
 * DELETE /api/tasks/:id
 * Remover tarefa.
 */
router.delete("/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet" });
});

/**
 * PATCH /api/tasks/:id/toggle
 * Alternar estado completed.
 */
router.patch("/:id/toggle", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet" });
});

export default router;
