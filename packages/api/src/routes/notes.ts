import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { AppError } from "../middleware/error.js";

const router = Router();

// Todas as rotas exigem autenticação
router.use(authMiddleware);

/**
 * POST /api/notes
 * Criar nova nota.
 */
const createSchema = z.object({
  title: z.string().max(500).default(""),
  content: z.string().default(""),
});

router.post("/", validate(createSchema), async (req, res, next) => {
  try {
    const { title, content } = req.body;
    const ulid = crypto.randomUUID().replace(/-/g, "").slice(0, 26);

    const { data, error } = await supabaseAdmin!
      .from("notes")
      .insert({
        id: ulid,
        user_id: req.user!.id,
        title,
        content,
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/notes
 * Listar notas do usuário autenticado.
 */
router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin!
      .from("notes")
      .select("*")
      .eq("user_id", req.user!.id)
      .order("updated_at", { ascending: false });

    if (error) throw new AppError(error.message, 500);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/notes/:id
 * Obter uma nota específica.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin!
      .from("notes")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .single();

    if (error || !data) {
      throw new AppError("Nota não encontrada", 404);
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/notes/:id
 * Atualizar nota existente.
 */
const updateSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().optional(),
});

router.put("/:id", validate(updateSchema), async (req, res, next) => {
  try {
    const updates: Record<string, unknown> = { ...req.body, updated_at: new Date().toISOString() };

    const { data, error } = await supabaseAdmin!
      .from("notes")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select()
      .single();

    if (error || !data) {
      throw new AppError("Nota não encontrada", 404);
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/notes/:id
 * Remover nota.
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin!
      .from("notes")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id);

    if (error) throw new AppError(error.message, 500);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
