import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { AppError } from "../middleware/error.js";

const router = Router();

router.use(authMiddleware);

/**
 * GET /api/users/me/profile
 */
router.get("/me/profile", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin!.auth.admin.getUserById(req.user!.id);
    if (error || !data.user) throw new AppError("Usuário não encontrado", 404);
    res.json({
      display_name: (data.user.user_metadata?.display_name as string) ?? null,
      email: data.user.email ?? null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/users/me/profile
 */
const updateProfileSchema = z.object({
  display_name: z.string().max(100).optional(),
});

router.put("/me/profile", validate(updateProfileSchema), async (req, res, next) => {
  try {
    const { display_name } = req.body;
    const { data, error } = await supabaseAdmin!.auth.admin.updateUserById(
      req.user!.id,
      { user_metadata: { display_name } }
    );
    if (error || !data.user) throw new AppError("Erro ao atualizar perfil", 500);
    res.json({
      display_name: (data.user.user_metadata?.display_name as string) ?? null,
      email: data.user.email ?? null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/users/me
 */
router.delete("/me", async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin!.auth.admin.deleteUser(req.user!.id);
    if (error) throw new AppError("Erro ao excluir conta", 500);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
