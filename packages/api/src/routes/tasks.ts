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
 * POST /api/tasks
 * Criar nova tarefa.
 */
const createSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().default(""),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
});

router.post("/", validate(createSchema), async (req, res, next) => {
  try {
    const { title, description, due_date, starts_at, ends_at } = req.body;
    const ulid = crypto.randomUUID().replace(/-/g, "").slice(0, 26);

    const effectiveDueDate =
      due_date ?? (ends_at ? ends_at.slice(0, 10) : null);

    const { data, error } = await supabaseAdmin!
      .from("tasks")
      .insert({
        id: ulid,
        user_id: req.user!.id,
        title,
        description,
        due_date: effectiveDueDate,
        starts_at: starts_at ?? null,
        ends_at: ends_at ?? null,
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
 * GET /api/tasks
 * Listar tarefas do usuário autenticado.
 */
router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin!
      .from("tasks")
      .select("*")
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: false });

    if (error) throw new AppError(error.message, 500);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/tasks/:id
 * Obter uma tarefa específica.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin!
      .from("tasks")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .single();

    if (error || !data) {
      throw new AppError("Tarefa não encontrada", 404);
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/tasks/:id
 * Atualizar tarefa existente.
 */
const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  completed: z.boolean().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
});

router.put("/:id", validate(updateSchema), async (req, res, next) => {
  try {
    const { ends_at, due_date, ...rest } = req.body;
    const effectiveDueDate =
      due_date !== undefined
        ? due_date
        : ends_at !== undefined && ends_at !== null
        ? ends_at.slice(0, 10)
        : undefined;

    const updates: Record<string, unknown> = {
      ...rest,
      updated_at: new Date().toISOString(),
    };
    if (ends_at !== undefined) updates.ends_at = ends_at;
    if (effectiveDueDate !== undefined) updates.due_date = effectiveDueDate;

    const { data, error } = await supabaseAdmin!
      .from("tasks")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select()
      .single();

    if (error || !data) {
      throw new AppError("Tarefa não encontrada", 404);
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/tasks/:id/toggle
 * Alternar estado completed.
 */
router.patch("/:id/toggle", async (req, res, next) => {
  try {
    // Busca estado atual
    const { data: current, error: fetchError } = await supabaseAdmin!
      .from("tasks")
      .select("completed")
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .single();

    if (fetchError || !current) {
      throw new AppError("Tarefa não encontrada", 404);
    }

    const { data, error } = await supabaseAdmin!
      .from("tasks")
      .update({
        completed: !current.completed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/tasks/:id
 * Remover tarefa.
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin!
      .from("tasks")
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
