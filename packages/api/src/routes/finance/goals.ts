import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { AppError } from "../../middleware/error.js";

const router = Router();

// Todas as rotas exigem autenticação
router.use(authMiddleware);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["savings", "spending_limit"]),
  target_amount: z.number().positive(),
  category_id: z.string().optional(),
  deadline: z.string().optional(),
  active: z.boolean().default(true),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["savings", "spending_limit"]).optional(),
  target_amount: z.number().positive().optional(),
  category_id: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computes current_amount for a single goal.
 *
 * savings       → SUM of transactions linked via goal_id
 * spending_limit → SUM of expense transactions for category_id in current month
 */
async function computeCurrentAmount(
  goal: Record<string, unknown>,
  userId: string
): Promise<number> {
  if (goal.type === "savings") {
    const { data, error } = await supabaseAdmin!
      .from("transactions")
      .select("amount")
      .eq("goal_id", goal.id as string)
      .eq("user_id", userId);

    if (error) return 0;
    return (data ?? []).reduce((sum, t) => sum + (t.amount as number), 0);
  }

  if (goal.type === "spending_limit" && goal.category_id) {
    // Start of current month in UTC
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10);

    const { data, error } = await supabaseAdmin!
      .from("transactions")
      .select("amount")
      .eq("category_id", goal.category_id as string)
      .eq("type", "expense")
      .eq("user_id", userId)
      .gte("date", monthStart);

    if (error) return 0;
    return (data ?? []).reduce((sum, t) => sum + (t.amount as number), 0);
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/finance/goals
 * Criar nova meta financeira.
 */
router.post("/", validate(createSchema), async (req, res, next) => {
  try {
    const { name, type, target_amount, category_id, deadline, active } = req.body;
    const ulid = crypto.randomUUID().replace(/-/g, "").slice(0, 26);

    const { data, error } = await supabaseAdmin!
      .from("goals")
      .insert({
        id: ulid,
        user_id: req.user!.id,
        name,
        type,
        target_amount,
        category_id: category_id ?? null,
        deadline: deadline ?? null,
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
 * GET /api/finance/goals
 * Listar metas do usuário com current_amount computado.
 */
router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin!
      .from("goals")
      .select("*")
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: false });

    if (error) throw new AppError(error.message, 500);

    const goals = await Promise.all(
      (data ?? []).map(async (goal) => {
        const current_amount = await computeCurrentAmount(
          goal as Record<string, unknown>,
          req.user!.id
        );
        return { ...goal, current_amount };
      })
    );

    res.json(goals);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/finance/goals/:id
 * Obter uma meta específica com current_amount computado.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin!
      .from("goals")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .single();

    if (error || !data) {
      throw new AppError("Meta não encontrada", 404);
    }

    const current_amount = await computeCurrentAmount(
      data as Record<string, unknown>,
      req.user!.id
    );

    res.json({ ...data, current_amount });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/finance/goals/:id
 * Atualizar meta existente (todos os campos opcionais, incluindo active).
 */
router.put("/:id", validate(updateSchema), async (req, res, next) => {
  try {
    const updates: Record<string, unknown> = {
      ...req.body,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin!
      .from("goals")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select()
      .single();

    if (error || !data) {
      throw new AppError("Meta não encontrada", 404);
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/finance/goals/:id
 * Remover meta.
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin!
      .from("goals")
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
