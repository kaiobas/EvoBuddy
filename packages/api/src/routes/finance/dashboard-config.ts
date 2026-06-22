import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { AppError } from "../../middleware/error.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

const DEFAULT_WIDGETS = [
  { key: "balance-summary",     enabled: true,  order: 0 },
  { key: "month-cashflow",      enabled: true,  order: 1 },
  { key: "top-categories",      enabled: true,  order: 2 },
  { key: "recent-transactions", enabled: true,  order: 3 },
  { key: "goals-progress",      enabled: true,  order: 4 },
  { key: "balance-chart",       enabled: true,  order: 5 },
  { key: "category-pie",        enabled: true,  order: 6 },
];

/**
 * GET /api/finance/dashboard-config
 * Return existing config or create default for current user.
 */
router.get("/", async (req, res, next) => {
  try {
    const userId = req.user!.id;

    const { data: existing, error: fetchError } = await supabaseAdmin!
      .from("dashboard_config")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      throw new AppError(fetchError.message, 500);
    }

    if (existing) {
      return res.json(existing);
    }

    // No row yet — insert default config
    const ulid = crypto.randomUUID().replace(/-/g, "").slice(0, 26);

    const { data: created, error: insertError } = await supabaseAdmin!
      .from("dashboard_config")
      .insert({
        id: ulid,
        user_id: userId,
        widgets: DEFAULT_WIDGETS,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw new AppError(insertError.message, 500);

    return res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/finance/dashboard-config
 * Upsert config for current user.
 */
const widgetSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean(),
  order: z.number().int().min(0),
});

const upsertSchema = z.object({
  widgets: z.array(widgetSchema).min(1),
});

router.put("/", validate(upsertSchema), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { widgets } = req.body as z.infer<typeof upsertSchema>;

    // Check if a row already exists to decide insert vs update
    const { data: existing } = await supabaseAdmin!
      .from("dashboard_config")
      .select("id")
      .eq("user_id", userId)
      .single();

    let result;

    if (existing) {
      const { data, error } = await supabaseAdmin!
        .from("dashboard_config")
        .update({
          widgets,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw new AppError(error.message, 500);
      result = data;
    } else {
      const ulid = crypto.randomUUID().replace(/-/g, "").slice(0, 26);

      const { data, error } = await supabaseAdmin!
        .from("dashboard_config")
        .insert({
          id: ulid,
          user_id: userId,
          widgets,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw new AppError(error.message, 500);
      result = data;
    }

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
