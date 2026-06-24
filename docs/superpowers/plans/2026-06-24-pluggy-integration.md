# Pluggy Open Finance Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar a Pluggy Open Finance no módulo de finanças do EvoBuddy para que usuários conectem seus bancos via widget e tenham transações/saldos sincronizados automaticamente a cada abertura do módulo.

**Architecture:** O Pluggy Connect Widget roda no frontend apenas para o fluxo inicial de autenticação com o banco, retornando um `item_id`. Todo acesso subsequente à API Pluggy é feito pelo backend Node.js com `PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET`, mantendo credenciais fora do cliente. Sync é disparado pelo frontend no mount do dashboard de finanças e executado inteiramente no servidor.

**Tech Stack:** Node.js + Express + Supabase (backend), React + Vite (frontend), `@pluggy/connect-sdk-js` (frontend widget), Pluggy REST API v1 via `fetch` nativo (backend)

## Global Constraints

- Pluggy API base URL: `https://api.pluggy.ai`
- Auth endpoint exige `Content-Type: application/json` e body `{ clientId, clientSecret }`
- Todas as rotas backend usam `authMiddleware` da `../../middleware/auth.js`
- IDs de entidades locais gerados com `crypto.randomUUID().replace(/-/g, "").slice(0, 26)` (padrão do projeto)
- Migrações SQL são aplicadas manualmente via **Supabase Dashboard > SQL Editor** — não há runner automático para novas migrações
- Erros backend usam `AppError` de `../../middleware/error.js`
- Todas as rotas Pluggy montadas em `/api/finance/pluggy` via `packages/api/src/routes/finance/index.ts`
- Transações com `source === 'pluggy'` são **read-only**: sem edição, sem deleção
- Sync falha silenciosamente no frontend (não bloqueia carregamento do dashboard)

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `packages/api/src/db/migrations/004_pluggy_integration.sql` | Criar | DDL: novas colunas + tabela `pluggy_connections` |
| `packages/api/src/db/run-migrations.ts` | Modificar | Registrar migration 004 na lista |
| `packages/api/src/lib/pluggyClient.ts` | Criar | Cliente HTTP para a API Pluggy (getApiKey, getConnectToken, getAccounts, getTransactions) |
| `packages/api/src/routes/finance/pluggy.ts` | Criar | Rotas POST /connect-token, POST /connect, POST /sync, GET /connections, DELETE /connections/:id |
| `packages/api/src/routes/finance/index.ts` | Modificar | Montar `pluggyRouter` em `/pluggy` |
| `apps/web/src/lib/api.ts` | Modificar | Adicionar `PluggyConnectionDTO`, `pluggyApi`, campos `source`/`pluggy_*` em `AccountDTO`/`TransactionDTO` |
| `apps/web/src/routes/finance.accounts.tsx` | Modificar | Seção "Bancos conectados" + botão conectar via widget |
| `apps/web/src/routes/finance.tsx` | Modificar | Silent sync on mount |
| `apps/web/src/routes/finance.transactions.tsx` | Modificar | Ícone banco + ocultar botões em transações pluggy |

---

## Task 1: Migration SQL

**Files:**
- Create: `packages/api/src/db/migrations/004_pluggy_integration.sql`
- Modify: `packages/api/src/db/run-migrations.ts`

**Interfaces:**
- Produz: colunas `pluggy_item_id`, `pluggy_account_id`, `source`, `last_synced_at` em `accounts`; colunas `pluggy_transaction_id`, `source` em `transactions`; tabela `pluggy_connections`

- [ ] **Step 1: Criar arquivo de migration**

Criar `packages/api/src/db/migrations/004_pluggy_integration.sql`:

```sql
-- Migration 004: Pluggy Open Finance integration
-- Apply via: Supabase Dashboard > SQL Editor

-- Novas colunas na tabela accounts
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS pluggy_item_id     TEXT,
  ADD COLUMN IF NOT EXISTS pluggy_account_id  TEXT,
  ADD COLUMN IF NOT EXISTS source             TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS last_synced_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_accounts_pluggy_item_id
  ON accounts(pluggy_item_id)
  WHERE pluggy_item_id IS NOT NULL;

-- Novas colunas na tabela transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS pluggy_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS source                TEXT NOT NULL DEFAULT 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_pluggy_transaction_id
  ON transactions(pluggy_transaction_id)
  WHERE pluggy_transaction_id IS NOT NULL;

-- Nova tabela pluggy_connections
CREATE TABLE IF NOT EXISTS pluggy_connections (
  id             TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id        TEXT NOT NULL UNIQUE,
  connector_name TEXT,
  status         TEXT NOT NULL DEFAULT 'updated',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pluggy_connections_user_id
  ON pluggy_connections(user_id);

ALTER TABLE pluggy_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_access" ON pluggy_connections
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Registrar migration em run-migrations.ts**

Em `packages/api/src/db/run-migrations.ts`, adicionar à array `migrations`:

```ts
// Antes (último item existente):
{ version: 3, name: "Google Calendar sync", file: "003_google_calendar_sync.sql" },

// Depois (adicionar):
{ version: 3, name: "Google Calendar sync", file: "003_google_calendar_sync.sql" },
{ version: 4, name: "Pluggy Open Finance integration", file: "004_pluggy_integration.sql" },
```

- [ ] **Step 3: Aplicar migration no Supabase**

Abrir **Supabase Dashboard > SQL Editor**, colar o conteúdo de `004_pluggy_integration.sql` e executar.

Verificar que o resultado mostra `Success. No rows returned` (sem erros).

- [ ] **Step 4: Verificar schema no Supabase**

No Supabase Dashboard > Table Editor, confirmar:
- Tabela `accounts` tem colunas `source`, `pluggy_item_id`, `pluggy_account_id`, `last_synced_at`
- Tabela `transactions` tem colunas `source`, `pluggy_transaction_id`
- Tabela `pluggy_connections` existe com todas as colunas

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/db/migrations/004_pluggy_integration.sql packages/api/src/db/run-migrations.ts
git commit -m "feat(db): migration 004 — pluggy_connections + source columns"
```

---

## Task 2: Pluggy API client (backend helper)

**Files:**
- Create: `packages/api/src/lib/pluggyClient.ts`

**Interfaces:**
- Produz:
  - `getPluggyApiKey(): Promise<string>` — autentica com CLIENT_ID/SECRET, retorna apiKey
  - `getConnectToken(apiKey: string): Promise<string>` — retorna connectToken para o widget
  - `getPluggyAccounts(apiKey: string, itemId: string): Promise<PluggyAccount[]>`
  - `getPluggyTransactions(apiKey: string, accountId: string, from: string, to: string): Promise<PluggyTransaction[]>`
  - Tipos exportados: `PluggyAccount`, `PluggyTransaction`

- [ ] **Step 1: Criar `packages/api/src/lib/pluggyClient.ts`**

```ts
const PLUGGY_API = "https://api.pluggy.ai";

export interface PluggyAccount {
  id: string;
  itemId: string;
  name: string;
  type: "BANK" | "CREDIT" | "INVESTMENT";
  subtype: string;
  balance: number;
  currencyCode: string;
}

export interface PluggyTransaction {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  date: string; // ISO 8601
  category?: string;
}

interface PluggyPagedResult<T> {
  results: T[];
  totalPages: number;
  page: number;
}

async function pluggyFetch<T>(
  path: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${PLUGGY_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Pluggy API error ${res.status}: ${body.message ?? res.statusText}`);
  }

  return res.json();
}

export async function getPluggyApiKey(): Promise<string> {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PLUGGY_CLIENT_ID or PLUGGY_CLIENT_SECRET not configured");
  }

  const res = await fetch(`${PLUGGY_API}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!res.ok) {
    throw new Error(`Pluggy auth failed: ${res.status}`);
  }

  const data = await res.json();
  return data.apiKey as string;
}

export async function getConnectToken(apiKey: string): Promise<string> {
  const data = await pluggyFetch<{ accessToken: string }>(
    "/connect_token",
    apiKey,
    { method: "POST", body: JSON.stringify({}) }
  );
  return data.accessToken;
}

export async function getPluggyAccounts(
  apiKey: string,
  itemId: string
): Promise<PluggyAccount[]> {
  const data = await pluggyFetch<PluggyPagedResult<PluggyAccount>>(
    `/accounts?itemId=${encodeURIComponent(itemId)}`,
    apiKey
  );
  return data.results;
}

export async function getPluggyTransactions(
  apiKey: string,
  accountId: string,
  from: string,
  to: string
): Promise<PluggyTransaction[]> {
  const all: PluggyTransaction[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const params = new URLSearchParams({
      accountId,
      from,
      to,
      page: String(page),
      pageSize: "500",
    });
    const data = await pluggyFetch<PluggyPagedResult<PluggyTransaction>>(
      `/transactions?${params}`,
      apiKey
    );
    all.push(...data.results);
    totalPages = data.totalPages;
    page++;
  }

  return all;
}
```

- [ ] **Step 2: Testar manualmente que o módulo compila**

```bash
cd /caminho/para/EvoBuddy && pnpm typecheck
```

Esperado: zero erros no `packages/api`.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/lib/pluggyClient.ts
git commit -m "feat(api): add Pluggy API client helper"
```

---

## Task 3: Backend — rotas Pluggy

**Files:**
- Create: `packages/api/src/routes/finance/pluggy.ts`
- Modify: `packages/api/src/routes/finance/index.ts`

**Interfaces:**
- Consome: `getPluggyApiKey`, `getConnectToken`, `getPluggyAccounts`, `getPluggyTransactions` de `../../lib/pluggyClient.js`; `authMiddleware`; `supabaseAdmin`; `AppError`
- Produz:
  - `POST /api/finance/pluggy/connect-token` → `{ connectToken: string }`
  - `POST /api/finance/pluggy/connect` body `{ item_id, connector_name? }` → `PluggyConnectionRow`
  - `POST /api/finance/pluggy/sync` → `{ synced: number }`
  - `GET /api/finance/pluggy/connections` → `PluggyConnectionRow[]`
  - `DELETE /api/finance/pluggy/connections/:id` → 204

- [ ] **Step 1: Criar `packages/api/src/routes/finance/pluggy.ts`**

```ts
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
  type PluggyAccount,
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
      .insert({
        id,
        user_id: req.user!.id,
        item_id,
        connector_name: connector_name ?? null,
        status: "updating",
      })
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
```

- [ ] **Step 2: Registrar router em `packages/api/src/routes/finance/index.ts`**

```ts
// Adicionar import no topo:
import pluggyRouter from "./pluggy.js";

// Adicionar antes do export:
router.use("/pluggy", pluggyRouter);
```

O arquivo completo ficará:

```ts
import { Router } from "express";
import accountsRouter from "./accounts.js";
import categoriesRouter from "./categories.js";
import dashboardConfigRouter from "./dashboard-config.js";
import goalsRouter from "./goals.js";
import recurringRouter from "./recurring.js";
import transactionsRouter from "./transactions.js";
import pluggyRouter from "./pluggy.js";

const router = Router();

router.use("/accounts", accountsRouter);
router.use("/categories", categoriesRouter);
router.use("/dashboard-config", dashboardConfigRouter);
router.use("/goals", goalsRouter);
router.use("/recurring", recurringRouter);
router.use("/transactions", transactionsRouter);
router.use("/pluggy", pluggyRouter);

export default router;
```

- [ ] **Step 3: Adicionar variáveis de ambiente**

Adicionar ao `.env` da API (local e na VPS em `/opt/evobuddy/.env`):

```
PLUGGY_CLIENT_ID=sua_client_id_aqui
PLUGGY_CLIENT_SECRET=seu_client_secret_aqui
```

Para obter as credenciais: cadastrar em https://dashboard.pluggy.ai → criar um aplicativo → copiar `clientId` e `clientSecret`.

- [ ] **Step 4: Verificar typecheck**

```bash
pnpm typecheck
```

Esperado: zero erros TypeScript.

- [ ] **Step 5: Testar rota connect-token via curl**

Com a API rodando em `localhost:3001`:

```bash
# Substituir <TOKEN> pelo JWT do usuário logado
curl -X POST http://localhost:3001/api/finance/pluggy/connect-token \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json"
```

Esperado: `{ "connectToken": "ey..." }` (string longa)

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/finance/pluggy.ts packages/api/src/routes/finance/index.ts
git commit -m "feat(api): add Pluggy Open Finance routes (connect-token, connect, sync, connections)"
```

---

## Task 4: Frontend — tipos e API client

**Files:**
- Modify: `apps/web/src/lib/api.ts`

**Interfaces:**
- Consome: nada novo
- Produz:
  - `PluggyConnectionDTO` interface
  - `AccountDTO` com `source: 'manual' | 'pluggy' | 'pluggy_disconnected'` e `pluggy_item_id: string | null`
  - `TransactionDTO` com `source: 'manual' | 'pluggy'` e `pluggy_transaction_id: string | null`
  - `pluggyApi` com métodos `createConnectToken`, `connect`, `sync`, `listConnections`, `disconnect`

- [ ] **Step 1: Atualizar `AccountDTO` em `apps/web/src/lib/api.ts`**

Localizar a linha (linha 139):
```ts
export interface AccountDTO { id: string; user_id: string; name: string; type: AccountType; balance: number; color: string; icon: string; created_at: string }
```

Substituir por:
```ts
export interface AccountDTO { id: string; user_id: string; name: string; type: AccountType; balance: number; color: string; icon: string; source: 'manual' | 'pluggy' | 'pluggy_disconnected'; pluggy_item_id: string | null; created_at: string }
```

- [ ] **Step 2: Atualizar `TransactionDTO` em `apps/web/src/lib/api.ts`**

Localizar a linha (linha 147):
```ts
export interface TransactionDTO { id: string; user_id: string; account_id: string | null; category_id: string | null; goal_id: string | null; recurring_id: string | null; type: TransactionType; amount: number; description: string; date: string; created_at: string }
```

Substituir por:
```ts
export interface TransactionDTO { id: string; user_id: string; account_id: string | null; category_id: string | null; goal_id: string | null; recurring_id: string | null; type: TransactionType; amount: number; description: string; date: string; source: 'manual' | 'pluggy'; pluggy_transaction_id: string | null; created_at: string }
```

- [ ] **Step 3: Adicionar `PluggyConnectionDTO` e `pluggyApi`**

Adicionar após o bloco `financeApi` (antes do bloco `// ─── Calendar ───`):

```ts
// ─── Pluggy Open Finance ─────────────────────────────────────

export interface PluggyConnectionDTO {
  id: string;
  user_id: string;
  item_id: string;
  connector_name: string | null;
  status: 'updated' | 'updating' | 'error';
  last_synced_at: string | null;
  created_at: string;
}

export const pluggyApi = {
  createConnectToken: () =>
    request<{ connectToken: string }>("/api/finance/pluggy/connect-token", { method: "POST" }),
  connect: (data: { item_id: string; connector_name?: string }) =>
    request<PluggyConnectionDTO>("/api/finance/pluggy/connect", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  sync: () =>
    request<{ synced: number }>("/api/finance/pluggy/sync", { method: "POST" }),
  listConnections: () =>
    request<PluggyConnectionDTO[]>("/api/finance/pluggy/connections"),
  disconnect: (id: string) =>
    request<void>(`/api/finance/pluggy/connections/${id}`, { method: "DELETE" }),
};
```

- [ ] **Step 4: Verificar typecheck no frontend**

```bash
pnpm typecheck
```

Esperado: zero erros TypeScript.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): add PluggyConnectionDTO, pluggyApi, source fields in AccountDTO/TransactionDTO"
```

---

## Task 5: Instalar SDK Pluggy no frontend

**Files:**
- Modify: `apps/web/package.json` (via pnpm)

**Interfaces:**
- Produz: `@pluggy/connect-sdk-js` disponível em `apps/web`

- [ ] **Step 1: Instalar pacote**

```bash
cd apps/web && pnpm add @pluggy/connect-sdk-js
```

- [ ] **Step 2: Verificar instalação**

```bash
node -e "require('@pluggy/connect-sdk-js'); console.log('ok')" 2>/dev/null || echo "ESM only — ok se não der erro no build"
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): install @pluggy/connect-sdk-js"
```

---

## Task 6: `finance.accounts.tsx` — seção bancos conectados

**Files:**
- Modify: `apps/web/src/routes/finance.accounts.tsx`

**Interfaces:**
- Consome: `pluggyApi`, `PluggyConnectionDTO` de `../lib/api`; `useToast`
- Produz: UI com seção "Bancos conectados", botão "Conectar banco via Open Finance", badge "Sincronizado" em contas pluggy, botão deletar oculto para contas pluggy

- [ ] **Step 1: Adicionar imports necessários**

No topo de `finance.accounts.tsx`, adicionar aos imports existentes:

```ts
import { Building2, RefreshCw, Unlink, Wifi } from "lucide-react";
import { pluggyApi, type PluggyConnectionDTO } from "../lib/api";
```

(Remover `Plus, Trash2, X` do import do lucide-react se já existirem — manter os que já estavam, adicionar os novos.)

Atualizar o import do lucide-react para incluir os ícones novos sem remover os existentes:
```ts
import { Plus, Trash2, X, Building2, Unlink, Wifi } from "lucide-react";
```

- [ ] **Step 2: Adicionar estado para conexões**

Dentro do componente `AccountsPage`, após os estados existentes, adicionar:

```ts
const [connections, setConnections] = useState<PluggyConnectionDTO[]>([]);
const [connectingBank, setConnectingBank] = useState(false);
const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
```

- [ ] **Step 3: Criar função `loadConnections`**

Adicionar após `loadAccounts`:

```ts
const loadConnections = useCallback(async () => {
  try {
    const data = await pluggyApi.listConnections();
    setConnections(data);
  } catch {
    // silencioso — conexões são feature extra
  }
}, []);
```

- [ ] **Step 4: Chamar `loadConnections` no `useEffect`**

Localizar o `useEffect` existente:
```ts
useEffect(() => {
  loadAccounts();
}, [loadAccounts]);
```

Substituir por:
```ts
useEffect(() => {
  loadAccounts();
  loadConnections();
}, [loadAccounts, loadConnections]);
```

- [ ] **Step 5: Criar função `handleConnectBank`**

Adicionar após `handleDelete`:

```ts
async function handleConnectBank() {
  setConnectingBank(true);
  try {
    const { connectToken } = await pluggyApi.createConnectToken();

    // Importar SDK dinamicamente para não quebrar SSR/build se não estiver instalado
    const { PluggyConnect } = await import("@pluggy/connect-sdk-js");

    const widget = new PluggyConnect({
      connectToken,
      onSuccess: async ({ item }: { item: { id: string; connector: { name: string } } }) => {
        try {
          await pluggyApi.connect({
            item_id: item.id,
            connector_name: item.connector?.name,
          });
          toast("Banco conectado! Importando dados...", "success");
          await Promise.all([loadAccounts(), loadConnections()]);
        } catch {
          toast("Erro ao salvar conexão.", "error");
        }
      },
      onError: () => {
        toast("Erro ao conectar banco.", "error");
      },
      onClose: () => {
        setConnectingBank(false);
      },
    });

    widget.init();
  } catch {
    toast("Erro ao iniciar conexão.", "error");
    setConnectingBank(false);
  }
}
```

- [ ] **Step 6: Criar função `handleDisconnect`**

Adicionar após `handleConnectBank`:

```ts
async function handleDisconnect(id: string) {
  if (!confirm("Desconectar este banco? O histórico de transações será mantido.")) return;
  setDisconnectingId(id);
  try {
    await pluggyApi.disconnect(id);
    toast("Banco desconectado.", "success");
    await Promise.all([loadAccounts(), loadConnections()]);
  } catch {
    toast("Erro ao desconectar banco.", "error");
  } finally {
    setDisconnectingId(null);
  }
}
```

- [ ] **Step 7: Adicionar seção "Bancos conectados" no JSX**

Localizar no return do componente o comentário `{/* Header */}` (ou o início do JSX de cabeçalho). Adicionar a seção após o header existente e **antes** do `{/* Create form */}`:

```tsx
{/* Bancos conectados via Open Finance */}
<div className="mb-8">
  <div className="mb-3 flex items-center justify-between">
    <h2 className="font-display text-base font-bold text-ink dark:text-neutral-100 flex items-center gap-2">
      <Building2 className="h-4 w-4 text-brand-500" />
      Open Finance
    </h2>
    <button
      onClick={handleConnectBank}
      disabled={connectingBank}
      className="flex items-center gap-2 rounded-xl border border-brand-500 px-3 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50 active:scale-95 disabled:opacity-60 dark:text-brand-400 dark:hover:bg-brand-900/20"
    >
      <Wifi className="h-4 w-4" />
      {connectingBank ? "Aguardando..." : "Conectar banco"}
    </button>
  </div>

  {connections.length === 0 ? (
    <p className="text-sm text-neutral-400 dark:text-neutral-500">
      Nenhum banco conectado. Clique em "Conectar banco" para importar dados via Open Finance.
    </p>
  ) : (
    <div className="space-y-2">
      {connections.map((conn) => (
        <div
          key={conn.id}
          className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 dark:border-border-dark dark:bg-card-dark"
        >
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-brand-500" />
            <div>
              <p className="text-sm font-medium text-ink dark:text-neutral-100">
                {conn.connector_name ?? "Banco"}
              </p>
              <p className="text-xs text-neutral-400">
                {conn.status === "error" ? (
                  <span className="text-red-500">Erro na sincronização</span>
                ) : conn.last_synced_at ? (
                  <>Sincronizado {new Date(conn.last_synced_at).toLocaleDateString("pt-BR")}</>
                ) : (
                  "Sincronizando..."
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleDisconnect(conn.id)}
            disabled={disconnectingId === conn.id}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            <Unlink className="h-3.5 w-3.5" />
            Desconectar
          </button>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 8: Adicionar badge "Sincronizado" e ocultar botão deletar em contas pluggy**

No card de cada account (dentro do `.map((account, i) => ...)`), localizar o botão de delete:

```tsx
<button
  onClick={() => handleDelete(account.id)}
  className="absolute right-3 top-3 hidden rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-500 group-hover:flex dark:hover:bg-red-900/20"
  aria-label="Remover conta"
>
  <Trash2 className="h-4 w-4" />
</button>
```

Substituir por:

```tsx
{account.source === 'manual' && (
  <button
    onClick={() => handleDelete(account.id)}
    className="absolute right-3 top-3 hidden rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-500 group-hover:flex dark:hover:bg-red-900/20"
    aria-label="Remover conta"
  >
    <Trash2 className="h-4 w-4" />
  </button>
)}
```

E após o type badge existente (o `<span>` com `ACCOUNT_TYPE_LABELS`), adicionar:

```tsx
{account.source === 'pluggy' && (
  <span className="mb-1 flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400">
    <Building2 className="h-3 w-3" />
    Sincronizado
  </span>
)}
```

- [ ] **Step 9: Verificar typecheck**

```bash
pnpm typecheck
```

Esperado: zero erros.

- [ ] **Step 10: Testar manualmente no browser**

1. Iniciar dev server: `pnpm dev`
2. Navegar para `/finance/accounts`
3. Verificar que a seção "Open Finance" aparece com botão "Conectar banco"
4. Verificar que contas manuais existentes ainda aparecem normalmente com botão deletar

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/routes/finance.accounts.tsx
git commit -m "feat(web): add Open Finance section in accounts — connect bank + connected banks list"
```

---

## Task 7: `finance.tsx` — silent sync on mount

**Files:**
- Modify: `apps/web/src/routes/finance.tsx`

**Interfaces:**
- Consome: `pluggyApi` de `../lib/api`
- Produz: `pluggyApi.sync()` disparado em background no mount do dashboard, sem bloquear carregamento

- [ ] **Step 1: Adicionar import de `pluggyApi`**

No topo de `finance.tsx`, localizar o import de `../lib/api`:

```ts
import {
  financeApi,
  type AccountDTO,
  ...
} from "../lib/api";
```

Adicionar `pluggyApi` ao import:

```ts
import {
  financeApi,
  pluggyApi,
  type AccountDTO,
  ...
} from "../lib/api";
```

- [ ] **Step 2: Disparar sync silencioso no mount**

No componente `FinanceDashboard`, localizar o `useEffect` que chama `load()`:

```ts
useEffect(() => {
  load();
}, [load]);
```

Adicionar um `useEffect` separado logo abaixo:

```ts
useEffect(() => {
  pluggyApi.sync().catch(() => {});
}, []);
```

O sync roda em background: se tiver dados novos, o usuário pode clicar em atualizar manualmente; não recarrega automaticamente para evitar flash de conteúdo.

- [ ] **Step 3: Verificar typecheck**

```bash
pnpm typecheck
```

Esperado: zero erros.

- [ ] **Step 4: Testar no browser**

1. Com a API rodando, abrir Network tab no DevTools
2. Navegar para `/finance`
3. Verificar que uma requisição `POST /api/finance/pluggy/sync` é disparada e retorna 200 (ou falha silenciosamente se não houver conexões — status 200 com `{ synced: 0 }`)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/finance.tsx
git commit -m "feat(web): silent pluggy sync on finance dashboard mount"
```

---

## Task 8: `finance.transactions.tsx` — badge banco + read-only

**Files:**
- Modify: `apps/web/src/routes/finance.transactions.tsx`

**Interfaces:**
- Consome: `TransactionDTO` com `source` field
- Produz: ícone de banco em transações pluggy; botões editar/deletar ocultos para transações pluggy

- [ ] **Step 1: Adicionar import do ícone Building2**

No topo de `finance.transactions.tsx`, localizar o import do lucide-react:

```ts
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
```

Adicionar `Building2`:

```ts
import { ChevronLeft, ChevronRight, Trash2, Building2 } from "lucide-react";
```

- [ ] **Step 2: Localizar onde a descrição da transação é renderizada**

Dentro do `.map()` de transações, localizar o elemento que mostra `t.description`. Ele deve se parecer com algo como:

```tsx
<p className="truncate text-sm font-medium ...">
  {t.description || cat?.name || ...}
</p>
```

- [ ] **Step 3: Adicionar ícone de banco para transações pluggy**

Envolver a descrição num container flex e adicionar o ícone condicionalmente:

```tsx
<div className="flex items-center gap-1.5 min-w-0">
  {t.source === 'pluggy' && (
    <Building2 className="h-3 w-3 flex-shrink-0 text-brand-400" title="Importado via Open Finance" />
  )}
  <p className="truncate text-sm font-medium text-ink dark:text-white">
    {t.description || cat?.name || (t.type === "income" ? "Entrada" : "Saída")}
  </p>
</div>
```

- [ ] **Step 4: Ocultar botão deletar para transações pluggy**

Localizar o botão de deleção no card de transação. Ele se parece com:

```tsx
<button onClick={() => handleDelete(t.id)} ...>
  <Trash2 ... />
</button>
```

Envolver com condicional:

```tsx
{t.source !== 'pluggy' && (
  <button onClick={() => handleDelete(t.id)} ...>
    <Trash2 ... />
  </button>
)}
```

- [ ] **Step 5: Verificar typecheck**

```bash
pnpm typecheck
```

Esperado: zero erros.

- [ ] **Step 6: Testar no browser**

1. Navegar para `/finance/transactions`
2. Se houver transações importadas (após conectar um banco no passo anterior), verificar que:
   - Ícone de banco aparece ao lado da descrição
   - Botão de deletar não aparece no hover

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/routes/finance.transactions.tsx
git commit -m "feat(web): bank icon + read-only UI for pluggy transactions"
```

---

## Self-review checklist

Após implementar todas as tasks, verificar:

- [ ] `pnpm typecheck` passa sem erros em todo o monorepo
- [ ] `pnpm build` conclui com sucesso
- [ ] Migration 004 aplicada no Supabase (verificar via Table Editor)
- [ ] Variáveis `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` configuradas no `.env` local e na VPS
- [ ] Fluxo completo testado: conectar banco → ver conta importada → abrir transactions → ver ícone banco → desconectar → histórico preservado
- [ ] Dashboard Finance carrega sem erros mesmo sem conexões Pluggy configuradas
