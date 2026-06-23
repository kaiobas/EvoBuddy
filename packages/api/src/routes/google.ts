import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { encrypt } from "../lib/crypto.js";
import {
  createOAuth2Client,
  getAuthUrl,
  verifyState,
} from "../lib/googleAuth.js";

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/**
 * GET /api/google/auth-url
 * Retorna a URL de autorização do Google OAuth2.
 * Requer autenticação.
 */
router.get("/auth-url", authMiddleware, (req, res, next) => {
  try {
    const url = getAuthUrl(req.user!.id);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/google/callback
 * Recebe o código de autorização do Google e salva os tokens.
 * NÃO requer authMiddleware — o state HMAC autentica o usuário.
 */
router.get("/callback", async (req, res, next) => {
  try {
    const { code, state, error: oauthError } = req.query as Record<
      string,
      string
    >;

    if (oauthError) {
      return res.redirect(
        `${FRONTEND_URL}/settings?google=error&message=${encodeURIComponent(oauthError)}`
      );
    }

    if (!code || !state) {
      throw new AppError("Parâmetros inválidos no callback", 400);
    }

    const userId = verifyState(state);
    if (!userId) {
      throw new AppError("State inválido ou adulterado", 403);
    }

    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (
      !tokens.access_token ||
      !tokens.refresh_token ||
      !tokens.expiry_date
    ) {
      throw new AppError("Tokens incompletos retornados pelo Google", 500);
    }

    await supabaseAdmin!
      .from("google_calendar_tokens")
      .upsert(
        {
          user_id: userId,
          access_token: encrypt(tokens.access_token),
          refresh_token: encrypt(tokens.refresh_token),
          expires_at: new Date(tokens.expiry_date).toISOString(),
          calendar_id: "primary",
          sync_error: null,
        },
        { onConflict: "user_id" }
      );

    return res.redirect(`${FRONTEND_URL}/settings?google=connected`);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/google/status
 * Retorna o status da conexão Google do usuário autenticado.
 */
router.get("/status", authMiddleware, async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin!
      .from("google_calendar_tokens")
      .select("last_synced_at, sync_error")
      .eq("user_id", req.user!.id)
      .single();

    if (!data) {
      return res.json({
        connected: false,
        last_synced_at: null,
        sync_error: null,
      });
    }

    res.json({
      connected: true,
      last_synced_at: data.last_synced_at ?? null,
      sync_error: data.sync_error ?? null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/google/disconnect
 * Remove tokens e desconecta o Google Calendar.
 */
router.delete("/disconnect", authMiddleware, async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin!
      .from("google_calendar_tokens")
      .select("access_token, refresh_token")
      .eq("user_id", req.user!.id)
      .single();

    if (data) {
      // Tenta revogar o token no Google (best-effort, não falha se der erro)
      try {
        const oauth2Client = createOAuth2Client();
        const { decrypt } = await import("../lib/crypto.js");
        await oauth2Client.revokeToken(decrypt(data.access_token as string));
      } catch {
        // Revogação é best-effort
      }

      await supabaseAdmin!
        .from("google_calendar_tokens")
        .delete()
        .eq("user_id", req.user!.id);

      // Desancora eventos (mantém conteúdo, remove google_event_id)
      await supabaseAdmin!
        .from("calendar_events")
        .update({ google_event_id: null, google_updated_at: null })
        .eq("user_id", req.user!.id);
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/google/sync
 * Stub para o Plano 2 — retorna 501 até a engine ser implementada.
 */
router.post("/sync", authMiddleware, (_req, _res, next) => {
  next(new AppError("Sync engine não implementada ainda (Plano 2)", 501));
});

export default router;
