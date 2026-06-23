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
};

const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Trabalho",   color: "#3b82f6", icon: "Briefcase" },
  { name: "Saúde",      color: "#22c55e", icon: "Heart"     },
  { name: "Pessoal",    color: "#7C6FCD", icon: "User"      },
  { name: "Financeiro", color: "#F4845F", icon: "Wallet"    },
  { name: "Outros",     color: "#6b7280", icon: "Tag"       },
];

async function seedDefaultCategories(userId: string): Promise<void> {
  const rows = DEFAULT_CATEGORIES.map((cat) => ({
    id: crypto.randomUUID().replace(/-/g, "").slice(0, 26),
    user_id: userId,
    name: cat.name,
    color: cat.color,
    icon: cat.icon,
  }));

  const { error } = await supabaseAdmin!.from("calendar_categories").insert(rows);
  if (error) throw new AppError(error.message, 500);
}

// ---------------------------------------------------------------------------
// GET /api/calendar/categories — listar (com seed automático se vazio)
// ---------------------------------------------------------------------------

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin!
      .from("calendar_categories")
      .select("*")
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: true });

    if (error) throw new AppError(error.message, 500);

    if (data.length === 0) {
      await seedDefaultCategories(req.user!.id);

      const { data: seeded, error: seedError } = await supabaseAdmin!
        .from("calendar_categories")
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
// POST /api/calendar/categories — criar categoria
// ---------------------------------------------------------------------------

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  icon: z.string().optional(),
});

router.post("/", validate(createSchema), async (req, res, next) => {
  try {
    const { name, color, icon } = req.body;
    const ulid = crypto.randomUUID().replace(/-/g, "").slice(0, 26);

    const { data, error } = await supabaseAdmin!
      .from("calendar_categories")
      .insert({
        id: ulid,
        user_id: req.user!.id,
        name,
        color: color ?? "#7C6FCD",
        icon: icon ?? "Tag",
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
// PUT /api/calendar/categories/:id — atualizar categoria
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  name: z.string().min(1).optional(),
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
      .from("calendar_categories")
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
// DELETE /api/calendar/categories/:id — remover categoria (204)
// ---------------------------------------------------------------------------

router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin!
      .from("calendar_categories")
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
