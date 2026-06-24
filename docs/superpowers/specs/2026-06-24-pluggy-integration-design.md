# Pluggy Open Finance Integration — Design Spec

**Date:** 2026-06-24  
**Status:** Approved  
**Scope:** Integração com Pluggy Open Finance no módulo de finanças existente do EvoBuddy

---

## Objetivo

Permitir que qualquer usuário conecte suas contas bancárias via Open Finance (regulado pelo Banco Central) usando a API da Pluggy. Após conectar, transações e saldos são sincronizados automaticamente em background toda vez que o módulo de finanças é aberto. Os dados importados aparecem nas mesmas telas já existentes (contas, transações, dashboard).

---

## Abordagem escolhida

**Sync pelo backend.** O Pluggy Connect Widget roda no frontend apenas para o fluxo de autenticação inicial com o banco. Todas as chamadas à API Pluggy para buscar dados (transações, saldos, cartões) são feitas pelo backend Node.js usando `CLIENT_ID` + `CLIENT_SECRET` armazenados em variáveis de ambiente. O frontend nunca acessa a API Pluggy diretamente após a conexão.

---

## Banco de dados

### Alterações em tabelas existentes

**Tabela `accounts` — novas colunas:**
```sql
pluggy_item_id    TEXT          -- ID do item Pluggy (null = conta manual)
pluggy_account_id TEXT          -- ID da conta específica dentro do item Pluggy
source            TEXT NOT NULL DEFAULT 'manual'  -- 'manual' | 'pluggy'
last_synced_at    TIMESTAMPTZ   -- timestamp da última sincronização bem-sucedida
```

**Tabela `transactions` — novas colunas:**
```sql
pluggy_transaction_id TEXT UNIQUE  -- ID original da transação na Pluggy (para deduplicação)
source                TEXT NOT NULL DEFAULT 'manual'  -- 'manual' | 'pluggy'
```

### Nova tabela `pluggy_connections`

Registra cada banco conectado por usuário. Um usuário pode ter múltiplas conexões.

```sql
CREATE TABLE pluggy_connections (
  id             TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id        TEXT NOT NULL UNIQUE,
  connector_name TEXT,           -- ex: "Nubank", "Itaú PF"
  status         TEXT NOT NULL DEFAULT 'updated',  -- 'updated' | 'updating' | 'error'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ
);

CREATE INDEX idx_pluggy_connections_user_id ON pluggy_connections(user_id);
ALTER TABLE pluggy_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access" ON pluggy_connections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

---

## Backend

### Novas variáveis de ambiente

```
PLUGGY_CLIENT_ID=...
PLUGGY_CLIENT_SECRET=...
```

### Novo arquivo: `packages/api/src/routes/finance/pluggy.ts`

Montado em `/api/finance/pluggy`. Todas as rotas exigem `authMiddleware`.

#### `POST /connect-token`
Gera um Connect Token temporário (válido 30 min) para o frontend abrir o Pluggy Connect Widget.

- Chama `POST https://api.pluggy.ai/auth` com `clientId` + `clientSecret` para obter API Key
- Chama `POST https://api.pluggy.ai/connect_token` com a API Key
- Retorna `{ connectToken: string }`

#### `POST /connect`
Chamado pelo frontend após o widget fechar com sucesso.

- Body: `{ item_id: string, connector_name?: string }`
- Insere registro em `pluggy_connections`
- Dispara sync completo imediato (histórico dos últimos 90 dias)
- Retorna a conexão criada

#### `POST /sync`
Sincroniza todos os bancos conectados do usuário. Chamado silenciosamente no frontend ao abrir o módulo de finanças.

Fluxo por conexão ativa:
1. Busca contas do item via `GET https://api.pluggy.ai/accounts?itemId=...`
2. Para cada conta:
   - Upsert em `accounts` (cria se não existe, atualiza saldo se já existe)
   - Busca transações desde `last_synced_at` (ou 90 dias atrás na primeira vez)
   - Insere transações novas em `transactions` com deduplicação via `pluggy_transaction_id`
3. Atualiza `last_synced_at` na conexão e nas contas
4. Retorna `{ synced: number }` (quantidade de transações novas importadas)

#### `GET /connections`
Lista todas as conexões ativas do usuário com status e `last_synced_at`.

#### `DELETE /connections/:id`
Desconecta um banco:
- Remove o registro de `pluggy_connections`
- Marca as contas associadas como inativas (`source = 'pluggy_disconnected'`) preservando histórico
- **Não** deleta transações históricas

### Registro em `packages/api/src/routes/finance/index.ts`

```ts
import pluggyRouter from "./pluggy.js";
router.use("/pluggy", pluggyRouter);
```

---

## Frontend

### `apps/web/src/lib/api.ts`

Novos tipos e métodos:

```ts
// Tipos
export interface PluggyConnectionDTO {
  id: string;
  item_id: string;
  connector_name: string | null;
  status: 'updated' | 'updating' | 'error';
  last_synced_at: string | null;
  created_at: string;
}

// AccountDTO — campos adicionais
source: 'manual' | 'pluggy' | 'pluggy_disconnected';
pluggy_item_id: string | null;

// TransactionDTO — campos adicionais
source: 'manual' | 'pluggy';
pluggy_transaction_id: string | null;

// API client
export const pluggyApi = {
  createConnectToken: () => request<{ connectToken: string }>("/api/finance/pluggy/connect-token", { method: "POST" }),
  connect: (data: { item_id: string; connector_name?: string }) => request<PluggyConnectionDTO>("/api/finance/pluggy/connect", { method: "POST", body: JSON.stringify(data) }),
  sync: () => request<{ synced: number }>("/api/finance/pluggy/sync", { method: "POST" }),
  listConnections: () => request<PluggyConnectionDTO[]>("/api/finance/pluggy/connections"),
  disconnect: (id: string) => request<void>(`/api/finance/pluggy/connections/${id}`, { method: "DELETE" }),
};
```

### `apps/web/src/routes/finance.accounts.tsx`

**Seção "Bancos conectados"** (acima da lista de contas manuais):
- Lista conexões com nome do banco, status (`updated` / `error`) e data da última sync
- Botão "Desconectar" por conexão (com confirmação)
- Botão **"Conectar banco via Open Finance"** que:
  1. Chama `pluggyApi.createConnectToken()`
  2. Instancia `PluggyConnect` do SDK `@pluggy/connect-sdk-js`
  3. Ao callback `onSuccess({ item })`: chama `pluggyApi.connect({ item_id: item.id, connector_name: item.connector?.name })`
  4. Recarrega contas e conexões

Contas com `source === 'pluggy'`:
- Badge "Sincronizado" (ícone de banco + texto)
- Botão de deletar **oculto**

### `apps/web/src/routes/finance.tsx` (dashboard)

Ao montar o componente, dispara `pluggyApi.sync()` silenciosamente em background (sem bloquear o carregamento do dashboard, sem mostrar loading).

```ts
useEffect(() => {
  pluggyApi.sync().catch(() => {}); // falha silenciosa
}, []);
```

### `apps/web/src/routes/finance.transactions.tsx`

Transações com `source === 'pluggy'`:
- Ícone de banco pequeno ao lado do nome
- Botões de editar/deletar **ocultos**

---

## Dependência nova

```
@pluggy/connect-sdk-js  (frontend only, apps/web)
```

O backend chama a API Pluggy via `fetch` nativo — sem SDK do lado do servidor.

---

## Tratamento de erros

| Cenário | Comportamento |
|---|---|
| Pluggy API indisponível no sync | Falha silenciosa, `last_synced_at` não atualizado |
| Item expirado / reautenticação necessária | Status da conexão muda para `error`, badge vermelho na UI |
| Transação duplicada (deduplicação) | Ignorada via `ON CONFLICT DO NOTHING` no insert |
| Desconectar banco | Histórico preservado, contas marcadas como `pluggy_disconnected` |

---

## O que NÃO está no escopo

- Sync automático via cron/webhook (pode ser adicionado depois sem mudança de arquitetura)
- Edição de transações importadas (read-only por design)
- Categorização automática (Pluggy retorna categorias, mas mapeamento para categorias do EvoBuddy fica para uma próxima iteração)
- Suporte a múltiplas contas do mesmo banco (já suportado pela arquitetura, apenas não testado explicitamente)
