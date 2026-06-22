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
 * POST /api/finance/accounts
 * Criar nova conta financeira.
 */
const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["checking", "savings", "cash", "credit"]),
  balance: z.number().default(0),
  color: z.string().default("#7C6FCD"),
  icon: z.string().default("Wallet"),
});

router.post("/", validate(createSchema), async (req, res, next) => {
  try {
    const { name, type, balance, color, icon } = req.body;
    const ulid = crypto.randomUUID().replace(/-/g, "").slice(0, 26);

    const { data, error } = await supabaseAdmin!
      .from("accounts")
      .insert({
        id: ulid,
        user_id: req.user!.id,
        name,
        type,
        balance,
        color,
        icon,
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
 * GET /api/finance/accounts
 * Listar contas do usuário autenticado.
 */
router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin!
      .from("accounts")
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
 * GET /api/finance/accounts/:id
 * Obter uma conta específica.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin!
      .from("accounts")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .single();

    if (error || !data) {
      throw new AppError("Conta não encontrada", 404);
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/finance/accounts/:id
 * Atualizar conta existente.
 */
const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["checking", "savings", "cash", "credit"]).optional(),
  balance: z.number().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

router.put("/:id", validate(updateSchema), async (req, res, next) => {
  try {
    const updates: Record<string, unknown> = {
      ...req.body,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin!
      .from("accounts")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select()
      .single();

    if (error || !data) {
      throw new AppError("Conta não encontrada", 404);
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/finance/accounts/:id
 * Remover conta.
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin!
      .from("accounts")
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
