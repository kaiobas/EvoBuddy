import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { AppError } from "../../middleware/error.js";
import {
  getPluggyApiKey,
  getConnectToken,
  getPluggyAccounts,
  getPluggyTransactions,
} from "../../lib/pluggyClient.js";

const router = Router();
router.use(authMiddleware);

// ─── Helpers ──────────────────────────────────────────────────

function mapAccountType(pluggyType: string, subtype: string): string {
  if (pluggyType === "CREDIT") return "credit";
  if (subtype === "SAVINGS_ACCOUNT") return "savings";
  return "checking";
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function syncItem(
  userId: string,
  connection: { id: string; item_id: string; last_synced_at: string | null },
  apiKey: string
): Promise<number> {
  const accounts = await getPluggyAccounts(apiKey, connection.item_id);
  let totalSynced = 0;

  const now = new Date();
  const defaultFrom = toISODate(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()));
  const from = connection.last_synced_at
    ? toISODate(new Date(connection.last_synced_at))
    : defaultFrom;
  const to = toISODate(now);

  for (const pAccount of accounts) {
    // Upsert account
    const localAccountId = crypto.randomUUID().replace(/-/g, "").slice(0, 26);

    const { data: existingAccount } = await supabaseAdmin!
      .from("accounts")
      .select("id")
      .eq("pluggy_account_id", pAccount.id)
      .eq("user_id", userId)
      .maybeSingle();

    let accountId: string;

    if (existingAccount) {
      accountId = existingAccount.id;
      await supabaseAdmin!
        .from("accounts")
        .update({
          balance: pAccount.balance,
          last_synced_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", accountId);
    } else {
      accountId = localAccountId;
      await supabaseAdmin!.from("accounts").insert({
        id: accountId,
        user_id: userId,
        name: pAccount.name,
        type: mapAccountType(pAccount.type, pAccount.subtype),
        balance: pAccount.balance,
        color: "#7C6FCD",
        icon: "Building2",
        source: "pluggy",
        pluggy_item_id: connection.item_id,
        pluggy_account_id: pAccount.id,
        last_synced_at: now.toISOString(),
      });
    }

    // Fetch and insert transactions
    const txns = await getPluggyTransactions(apiKey, pAccount.id, from, to);

    for (const pt of txns) {
      // Check for existing transaction to avoid duplicates
      const { data: existing } = await supabaseAdmin!
        .from("transactions")
        .select("id")
        .eq("pluggy_transaction_id", pt.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) continue;

      const { error } = await supabaseAdmin!.from("transactions").insert({
        id: crypto.randomUUID().replace(/-/g, "").slice(0, 26),
        user_id: userId,
        account_id: accountId,
        type: pt.type === "CREDIT" ? "income" : "expense",
        amount: Math.abs(pt.amount),
        description: pt.description || "",
        date: pt.date.slice(0, 10),
        source: "pluggy",
        pluggy_transaction_id: pt.id,
      });

      if (!error) totalSynced++;
    }
  }

  // Update connection last_synced_at and status
  await supabaseAdmin!
    .from("pluggy_connections")
    .update({ last_synced_at: now.toISOString(), status: "updated" })
    .eq("id", connection.id);

  return totalSynced;
}

// ─── Routes ───────────────────────────────────────────────────

/**
 * POST /api/finance/pluggy/connect-token
 * Gera Connect Token para o frontend abrir o Pluggy Connect Widget.
 */
router.post("/connect-token", async (req, res, next) => {
  try {
    const apiKey = await getPluggyApiKey();
    const connectToken = await getConnectToken(apiKey);
    res.json({ connectToken });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/finance/pluggy/connect
 * Salva conexão após widget fechar com sucesso e dispara sync inicial.
 */
const connectSchema = z.object({
  item_id: z.string().min(1),
  connector_name: z.string().optional(),
});

router.post("/connect", validate(connectSchema), async (req, res, next) => {
  try {
    const { item_id, connector_name } = req.body;
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 26);

    const { data, error } = await supabaseAdmin!
      .from("pluggy_connections")
      .upsert(
        {
          id,
          user_id: req.user!.id,
          item_id,
          connector_name: connector_name ?? null,
          status: "updating",
        },
        { onConflict: "user_id,item_id", ignoreDuplicates: false }
      )
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    // Sync inicial em background (não bloqueia resposta)
    getPluggyApiKey()
      .then((apiKey) =>
        syncItem(req.user!.id, { id: data.id, item_id, last_synced_at: null }, apiKey)
      )
      .catch((err) => {
        console.error("[pluggy] sync inicial falhou:", err.message);
        supabaseAdmin!
          .from("pluggy_connections")
          .update({ status: "error" })
          .eq("id", data.id);
      });

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/finance/pluggy/sync
 * Sincroniza todas as conexões ativas do usuário.
 */
router.post("/sync", async (req, res, next) => {
  try {
    const { data: connections, error } = await supabaseAdmin!
      .from("pluggy_connections")
      .select("id, item_id, last_synced_at")
      .eq("user_id", req.user!.id)
      .neq("status", "error");

    if (error) throw new AppError(error.message, 500);
    if (!connections || connections.length === 0) {
      return res.json({ synced: 0 });
    }

    const apiKey = await getPluggyApiKey();
    let totalSynced = 0;

    for (const conn of connections) {
      try {
        const count = await syncItem(req.user!.id, conn, apiKey);
        totalSynced += count;
      } catch (err) {
        console.error(`[pluggy] sync falhou para item ${conn.item_id}:`, (err as Error).message);
        await supabaseAdmin!
          .from("pluggy_connections")
          .update({ status: "error" })
          .eq("id", conn.id);
      }
    }

    res.json({ synced: totalSynced });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/finance/pluggy/connections
 * Lista conexões do usuário.
 */
router.get("/connections", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin!
      .from("pluggy_connections")
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
 * DELETE /api/finance/pluggy/connections/:id
 * Desconecta banco: preserva histórico, marca contas como pluggy_disconnected.
 */
router.delete("/connections/:id", async (req, res, next) => {
  try {
    // Buscar a conexão para obter item_id
    const { data: conn, error: fetchError } = await supabaseAdmin!
      .from("pluggy_connections")
      .select("item_id")
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .single();

    if (fetchError || !conn) throw new AppError("Conexão não encontrada", 404);

    // Marcar contas como pluggy_disconnected (preserva histórico)
    await supabaseAdmin!
      .from("accounts")
      .update({ source: "pluggy_disconnected" })
      .eq("pluggy_item_id", conn.item_id)
      .eq("user_id", req.user!.id);

    // Remover conexão
    const { error } = await supabaseAdmin!
      .from("pluggy_connections")
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
