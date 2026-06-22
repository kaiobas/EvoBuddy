import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { AppError } from "../../middleware/error.js";

const router = Router();

// Todas as rotas exigem autenticação
router.use(authMiddleware);

/**
 * POST /api/finance/recurring
 * Criar nova regra recorrente.
 */
const createSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  description: z.string().default(""),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  next_date: z.string().min(1),
  account_id: z.string().optional(),
  category_id: z.string().optional(),
  active: z.boolean().default(true),
});

router.post("/", validate(createSchema), async (req, res, next) => {
  try {
    const { type, amount, description, frequency, next_date, account_id, category_id, active } =
      req.body;
    const ulid = crypto.randomUUID().replace(/-/g, "").slice(0, 26);

    const { data, error } = await supabaseAdmin!
      .from("recurring_rules")
      .insert({
        id: ulid,
        user_id: req.user!.id,
        type,
        amount,
        description,
        frequency,
        next_date,
        account_id: account_id ?? null,
        category_id: category_id ?? null,
        active,
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
 * GET /api/finance/recurring
 * Listar regras recorrentes do usuário autenticado.
 */
router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin!
      .from("recurring_rules")
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
 * GET /api/finance/recurring/:id
 * Obter uma regra recorrente específica.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin!
      .from("recurring_rules")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .single();

    if (error || !data) {
      throw new AppError("Regra recorrente não encontrada", 404);
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/finance/recurring/:id
 * Atualizar regra recorrente existente.
 */
const updateSchema = z.object({
  type: z.enum(["income", "expense"]).optional(),
  amount: z.number().positive().optional(),
  description: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
  next_date: z.string().min(1).optional(),
  account_id: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

router.put("/:id", validate(updateSchema), async (req, res, next) => {
  try {
    const updates: Record<string, unknown> = {
      ...req.body,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin!
      .from("recurring_rules")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select()
      .single();

    if (error || !data) {
      throw new AppError("Regra recorrente não encontrada", 404);
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/finance/recurring/:id
 * Remover regra recorrente.
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin!
      .from("recurring_rules")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id);

    if (error) throw new AppError(error.message, 500);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/finance/recurring/:id/toggle
 * Alternar estado active.
 */
router.patch("/:id/toggle", async (req, res, next) => {
  try {
    // Busca estado atual
    const { data: current, error: fetchError } = await supabaseAdmin!
      .from("recurring_rules")
      .select("active")
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .single();

    if (fetchError || !current) {
      throw new AppError("Regra recorrente não encontrada", 404);
    }

    const { data, error } = await supabaseAdmin!
      .from("recurring_rules")
      .update({
        active: !current.active,
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

export default router;
