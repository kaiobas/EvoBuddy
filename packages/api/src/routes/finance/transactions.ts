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
 * Advances a date by the given frequency.
 * Returns the new date as 'YYYY-MM-DD'.
 */
function advanceDate(dateStr: string, frequency: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  switch (frequency) {
    case "daily":
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "yearly":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * processRecurring — gera transações para regras recorrentes vencidas.
 * Chamado automaticamente no GET / antes de listar transações.
 */
async function processRecurring(userId: string): Promise<void> {
  // 1. Buscar regras ativas com next_date <= hoje
  const { data: rules, error: fetchError } = await supabaseAdmin!
    .from("recurring_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .lte("next_date", new Date().toISOString().slice(0, 10));

  if (fetchError || !rules || rules.length === 0) return;

  for (const rule of rules) {
    // 2. Inserir transação para a regra
    const ulid = crypto.randomUUID().replace(/-/g, "").slice(0, 26);
    const { error: insertError } = await supabaseAdmin!
      .from("transactions")
      .insert({
        id: ulid,
        user_id: userId,
        account_id: rule.account_id ?? null,
        category_id: rule.category_id ?? null,
        goal_id: null,
        recurring_id: rule.id,
        type: rule.type,
        amount: rule.amount,
        description: rule.description ?? "",
        date: rule.next_date,
      });

    if (insertError) {
      // Não interrompe o fluxo por falha em uma regra individual
      console.error(`processRecurring: falha ao inserir transação para regra ${rule.id}:`, insertError.message);
      continue;
    }

    // 3. Avançar next_date
    const newDate = advanceDate(rule.next_date as string, rule.frequency as string);

    await supabaseAdmin!
      .from("recurring_rules")
      .update({ next_date: newDate, updated_at: new Date().toISOString() })
      .eq("id", rule.id);
  }
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  description: z.string().default(""),
  date: z
    .string()
    .optional()
    .default(() => new Date().toISOString().slice(0, 10)),
  account_id: z.string().optional(),
  category_id: z.string().optional(),
  goal_id: z.string().optional(),
  recurring_id: z.string().optional(),
});

const updateSchema = z.object({
  type: z.enum(["income", "expense"]).optional(),
  amount: z.number().positive().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  account_id: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
  goal_id: z.string().nullable().optional(),
  recurring_id: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/finance/transactions
 * Dispara processRecurring e lista transações com filtros opcionais.
 * Query params: type, category_id, account_id, from, to
 */
router.get("/", async (req, res, next) => {
  try {
    await processRecurring(req.user!.id);

    let query = supabaseAdmin!
      .from("transactions")
      .select("*")
      .eq("user_id", req.user!.id);

    if (req.query.type) {
      query = query.eq("type", req.query.type as string);
    }
    if (req.query.category_id) {
      query = query.eq("category_id", req.query.category_id as string);
    }
    if (req.query.account_id) {
      query = query.eq("account_id", req.query.account_id as string);
    }
    if (req.query.from) {
      query = query.gte("date", req.query.from as string);
    }
    if (req.query.to) {
      query = query.lte("date", req.query.to as string);
    }

    query = query.order("date", { ascending: false }).order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) throw new AppError(error.message, 500);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/finance/transactions
 * Criar nova transação.
 */
router.post("/", validate(createSchema), async (req, res, next) => {
  try {
    const { type, amount, description, date, account_id, category_id, goal_id, recurring_id } =
      req.body;
    const ulid = crypto.randomUUID().replace(/-/g, "").slice(0, 26);

    const { data, error } = await supabaseAdmin!
      .from("transactions")
      .insert({
        id: ulid,
        user_id: req.user!.id,
        type,
        amount,
        description,
        date,
        account_id: account_id ?? null,
        category_id: category_id ?? null,
        goal_id: goal_id ?? null,
        recurring_id: recurring_id ?? null,
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
 * GET /api/finance/transactions/:id
 * Obter uma transação específica.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin!
      .from("transactions")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .single();

    if (error || !data) {
      throw new AppError("Transação não encontrada", 404);
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/finance/transactions/:id
 * Atualizar transação existente.
 */
router.put("/:id", validate(updateSchema), async (req, res, next) => {
  try {
    const updates: Record<string, unknown> = {
      ...req.body,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin!
      .from("transactions")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select()
      .single();

    if (error || !data) {
      throw new AppError("Transação não encontrada", 404);
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/finance/transactions/:id
 * Remover transação.
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin!
      .from("transactions")
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
