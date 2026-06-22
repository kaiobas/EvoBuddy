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
// Default categories seed
// ---------------------------------------------------------------------------

type DefaultCategory = {
  name: string;
  color: string;
  icon: string;
  type: "income" | "expense";
};

const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Income
  { name: "Salário", color: "#22c55e", icon: "Briefcase", type: "income" },
  { name: "Freelance", color: "#3b82f6", icon: "Laptop", type: "income" },
  { name: "Investimentos", color: "#8b5cf6", icon: "TrendingUp", type: "income" },
  { name: "Outros (entrada)", color: "#6b7280", icon: "Plus", type: "income" },
  // Expense
  { name: "Alimentação", color: "#f97316", icon: "UtensilsCrossed", type: "expense" },
  { name: "Transporte", color: "#06b6d4", icon: "Car", type: "expense" },
  { name: "Moradia", color: "#84cc16", icon: "Home", type: "expense" },
  { name: "Saúde", color: "#ec4899", icon: "Heart", type: "expense" },
  { name: "Lazer", color: "#f59e0b", icon: "Smile", type: "expense" },
  { name: "Educação", color: "#7C6FCD", icon: "BookOpen", type: "expense" },
  { name: "Assinaturas", color: "#14b8a6", icon: "CreditCard", type: "expense" },
  { name: "Outros (saída)", color: "#6b7280", icon: "Minus", type: "expense" },
];

async function seedDefaultCategories(userId: string): Promise<void> {
  const rows = DEFAULT_CATEGORIES.map((cat) => ({
    id: crypto.randomUUID().replace(/-/g, "").slice(0, 26),
    user_id: userId,
    name: cat.name,
    color: cat.color,
    icon: cat.icon,
    type: cat.type,
    is_default: true,
  }));

  const { error } = await supabaseAdmin!.from("categories").insert(rows);
  if (error) throw new AppError(error.message, 500);
}

// ---------------------------------------------------------------------------
// POST /api/finance/categories — criar categoria
// ---------------------------------------------------------------------------

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().default("#7C6FCD"),
  icon: z.string().default("Tag"),
  type: z.enum(["income", "expense"]).optional(),
});

router.post("/", validate(createSchema), async (req, res, next) => {
  try {
    const { name, color, icon, type } = req.body;
    const ulid = crypto.randomUUID().replace(/-/g, "").slice(0, 26);

    const { data, error } = await supabaseAdmin!
      .from("categories")
      .insert({
        id: ulid,
        user_id: req.user!.id,
        name,
        color,
        icon,
        type: type ?? null,
        is_default: false,
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/finance/categories — listar (com seed automático se vazio)
// ---------------------------------------------------------------------------

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin!
      .from("categories")
      .select("*")
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: true });

    if (error) throw new AppError(error.message, 500);

    if (data.length === 0) {
      await seedDefaultCategories(req.user!.id);

      const { data: seeded, error: seedError } = await supabaseAdmin!
        .from("categories")
        .select("*")
        .eq("user_id", req.user!.id)
        .order("created_at", { ascending: true });

      if (seedError) throw new AppError(seedError.message, 500);
      return res.json(seeded);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/finance/categories/:id — obter categoria específica
// ---------------------------------------------------------------------------

router.get("/:id", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin!
      .from("categories")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .single();

    if (error || !data) {
      throw new AppError("Categoria não encontrada", 404);
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/finance/categories/:id — atualizar categoria
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  type: z.enum(["income", "expense"]).optional(),
});

router.put("/:id", validate(updateSchema), async (req, res, next) => {
  try {
    const updates: Record<string, unknown> = {
      ...req.body,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin!
      .from("categories")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select()
      .single();

    if (error || !data) {
      throw new AppError("Categoria não encontrada", 404);
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/finance/categories/:id — remover categoria
// ---------------------------------------------------------------------------

router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin!
      .from("categories")
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
