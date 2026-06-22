# Finance Module — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task.

**Goal:** Módulo completo de finanças pessoais com transações, contas, categorias, metas, recorrências e dashboard personalizável.

**Architecture:** Sub-rotas por entidade (`/finance`, `/finance/transactions`, etc.). API Express com rotas em `packages/api/src/routes/finance/`. Frontend React em `apps/web/src/routes/finance*.tsx`.

**Tech Stack:** React 19 + TailwindCSS + Lucide React (frontend) · Express + Supabase (backend) · recharts (gráficos — nova dep)

## Global Constraints

- `authMiddleware` em todas as rotas de finance
- IDs gerados com `crypto.randomUUID().replace(/-/g,"").slice(0,26)` (padrão do projeto)
- Valores monetários: `numeric` no DB, `number` no TS
- Ícones: somente `lucide-react`
- Toasts em todos os CRUDs via `useToast()`
- Animações: `animate-card-enter` / `animate-slide-out` / `animate-pop-in`
- Dark mode: variantes `dark:` em todas as classes

---

## Mapa de Arquivos

### Criar
```
packages/api/src/routes/finance/
  index.ts             — registra sub-rotas
  accounts.ts          — CRUD contas
  categories.ts        — CRUD categorias + seed defaults
  transactions.ts      — CRUD transações + trigger recorrências
  goals.ts             — CRUD metas + progresso calculado
  recurring.ts         — CRUD regras de recorrência
  dashboard-config.ts  — GET/PUT config de widgets

apps/web/src/routes/
  finance.tsx                  — Finance Dashboard (hub)
  finance.accounts.tsx         — Página de contas
  finance.categories.tsx       — Página de categorias
  finance.transactions.tsx     — Página de transações
  finance.goals.tsx            — Página de metas
  finance.recurring.tsx        — Página de recorrências

apps/web/src/components/features/finance/
  TransactionModal.tsx    — Modal de criação rápida (botão flutuante)
  GoalProgressBar.tsx     — Barra de progresso com cores dinâmicas
  WidgetBalanceSummary.tsx
  WidgetMonthCashflow.tsx
  WidgetTopCategories.tsx
  WidgetRecentTransactions.tsx
  WidgetGoalsProgress.tsx
  WidgetBalanceChart.tsx
  WidgetCategoryPie.tsx
```

### Modificar
```
packages/api/src/router.ts                      — registrar financeRouter
apps/web/src/lib/api.ts                         — DTOs + financeApi.*
apps/web/src/App.tsx                            — adicionar 6 rotas /finance*
apps/web/src/components/layout/Layout.tsx       — submenu Finance no sidebar
apps/web/package.json                           — adicionar recharts
```

---

## Interfaces TypeScript (api.ts)

```ts
// Enums
type AccountType = "checking" | "savings" | "cash" | "credit"
type TransactionType = "income" | "expense"
type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly"
type GoalType = "savings" | "spending_limit"

// DTOs
interface AccountDTO { id, user_id, name, type: AccountType, balance: number, color, icon, created_at }
interface CategoryDTO { id, user_id, name, color, icon, is_default: boolean, created_at }
interface TransactionDTO { id, user_id, account_id?, category_id?, goal_id?, recurring_id?, type: TransactionType, amount: number, description, date, created_at }
interface RecurringRuleDTO { id, user_id, account_id?, category_id?, type: TransactionType, amount: number, description, frequency: RecurringFrequency, next_date, active: boolean, created_at }
interface GoalDTO { id, user_id, name, type: GoalType, target_amount: number, category_id?, deadline?, current_amount: number, active: boolean, created_at }
interface DashboardWidget { key: string, enabled: boolean, order: number }
interface DashboardConfigDTO { id, user_id, widgets: DashboardWidget[] }

// API objects: financeApi.accounts.*, financeApi.categories.*, financeApi.transactions.*,
//              financeApi.goals.*, financeApi.recurring.*, financeApi.dashboardConfig.*
```

---

## SQL Migration

Rodar no painel SQL do Supabase:

```sql
-- Contas
CREATE TABLE IF NOT EXISTS accounts (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('checking','savings','cash','credit')),
  balance     NUMERIC NOT NULL DEFAULT 0,
  color       TEXT NOT NULL DEFAULT '#7C6FCD',
  icon        TEXT NOT NULL DEFAULT 'Wallet',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categorias
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#7C6FCD',
  icon        TEXT NOT NULL DEFAULT 'Tag',
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Metas
CREATE TABLE IF NOT EXISTS goals (
  id             TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('savings','spending_limit')),
  target_amount  NUMERIC NOT NULL,
  category_id    TEXT REFERENCES categories(id) ON DELETE SET NULL,
  deadline       DATE,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Regras de recorrência
CREATE TABLE IF NOT EXISTS recurring_rules (
  id           TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id   TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  category_id  TEXT REFERENCES categories(id) ON DELETE SET NULL,
  type         TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount       NUMERIC NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  frequency    TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  next_date    DATE NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transações
CREATE TABLE IF NOT EXISTS transactions (
  id             TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id     TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  category_id    TEXT REFERENCES categories(id) ON DELETE SET NULL,
  goal_id        TEXT REFERENCES goals(id) ON DELETE SET NULL,
  recurring_id   TEXT REFERENCES recurring_rules(id) ON DELETE SET NULL,
  type           TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount         NUMERIC NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Config do dashboard
CREATE TABLE IF NOT EXISTS dashboard_config (
  id        TEXT PRIMARY KEY,
  user_id   UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  widgets   JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Categorias Default (seed na API)

Inseridas ao primeiro GET /api/finance/categories se o usuário não tiver nenhuma:

```
Entradas: Salário, Freelance, Investimentos, Outros
Saídas:   Alimentação, Transporte, Moradia, Saúde, Lazer, Educação, Assinaturas, Outros
```

---

## Widgets Default (dashboard_config)

Quando não existe config, retornar:
```json
[
  { "key": "balance-summary",       "enabled": true,  "order": 0 },
  { "key": "month-cashflow",        "enabled": true,  "order": 1 },
  { "key": "top-categories",        "enabled": true,  "order": 2 },
  { "key": "recent-transactions",   "enabled": true,  "order": 3 },
  { "key": "goals-progress",        "enabled": true,  "order": 4 },
  { "key": "balance-chart",         "enabled": true,  "order": 5 },
  { "key": "category-pie",          "enabled": true,  "order": 6 }
]
```

---

## Lógica de Recorrências

Helper `processRecurring(userId)` em `transactions.ts`:
- SELECT recurring_rules WHERE user_id = $1 AND active = TRUE AND next_date <= CURRENT_DATE
- Para cada regra: INSERT transaction com recurring_id, advance next_date por frequency
- Chamado no início do GET /api/finance/transactions e GET /api/finance/dashboard-config

---

## Progresso de Metas

Calculado na API ao retornar goals:
- **savings**: `SELECT SUM(amount) FROM transactions WHERE goal_id = $1 AND user_id = $2`
- **spending_limit**: `SELECT SUM(amount) FROM transactions WHERE category_id = $1 AND type = 'expense' AND user_id = $2 AND date >= DATE_TRUNC('month', CURRENT_DATE)`

---

## Tasks

### Task 1 — SQL Migration
- [ ] Rodar o SQL acima no Supabase Dashboard > SQL Editor
- [ ] Verificar que as 5 tabelas aparecem em Table Editor
- [ ] Commit: `"chore: add finance tables migration SQL"`

### Task 2 — API: Finance Router Base
- [ ] Criar `packages/api/src/routes/finance/index.ts` registrando sub-rotas
- [ ] Registrar em `packages/api/src/router.ts`: `router.use("/api/finance", financeRouter)`
- [ ] `pnpm typecheck` no pacote api
- [ ] Commit

### Task 3 — API: Accounts
- [ ] Criar `packages/api/src/routes/finance/accounts.ts` — CRUD completo
- [ ] `pnpm typecheck`
- [ ] Commit

### Task 4 — API: Categories + Seed
- [ ] Criar `packages/api/src/routes/finance/categories.ts` — CRUD + seed no GET se vazio
- [ ] `pnpm typecheck`
- [ ] Commit

### Task 5 — API: Recurring Rules
- [ ] Criar `packages/api/src/routes/finance/recurring.ts` — CRUD
- [ ] `pnpm typecheck`
- [ ] Commit

### Task 6 — API: Transactions + Recurring Trigger
- [ ] Criar `packages/api/src/routes/finance/transactions.ts`
- [ ] Implementar `processRecurring(userId)` no topo do arquivo
- [ ] Chamar `processRecurring` no GET antes de listar
- [ ] `pnpm typecheck`
- [ ] Commit

### Task 7 — API: Goals
- [ ] Criar `packages/api/src/routes/finance/goals.ts`
- [ ] Calcular `current_amount` no GET via queries definidas acima
- [ ] `pnpm typecheck`
- [ ] Commit

### Task 8 — API: Dashboard Config
- [ ] Criar `packages/api/src/routes/finance/dashboard-config.ts`
- [ ] GET: retornar config existente ou criar default (upsert)
- [ ] PUT: upsert config
- [ ] Chamar `processRecurring` no GET
- [ ] `pnpm typecheck`
- [ ] Commit

### Task 9 — Frontend: DTOs + API Client
- [ ] Adicionar todas as interfaces e `financeApi.*` em `apps/web/src/lib/api.ts`
- [ ] `pnpm typecheck` no pacote web
- [ ] Commit

### Task 10 — Frontend: Layout + App Routes
- [ ] Modificar `Layout.tsx`: Finance com submenu expansível no sidebar
- [ ] Modificar `App.tsx`: adicionar 6 rotas `/finance*`
- [ ] Criar shells vazios para cada rota (retornam `<div>`) para typecheck passar
- [ ] `pnpm typecheck`
- [ ] Commit

### Task 11 — Frontend: Accounts Page
- [ ] Implementar `apps/web/src/routes/finance.accounts.tsx`
- [ ] Cards de conta com saldo, tipo, cor, ícone
- [ ] CRUD completo com toasts + animações
- [ ] `pnpm typecheck`
- [ ] Commit

### Task 12 — Frontend: Categories Page
- [ ] Implementar `apps/web/src/routes/finance.categories.tsx`
- [ ] Lista com cor e ícone, deletar/criar
- [ ] Paleta de 8 cores na criação
- [ ] `pnpm typecheck`
- [ ] Commit

### Task 13 — Frontend: TransactionModal
- [ ] Implementar `apps/web/src/components/features/finance/TransactionModal.tsx`
- [ ] Botão flutuante `+` presente em todas as sub-rotas finance
- [ ] Campos: tipo, valor, categoria, conta (opt), data, descrição (opt)
- [ ] `pnpm typecheck`
- [ ] Commit

### Task 14 — Frontend: Transactions Page
- [ ] Implementar `apps/web/src/routes/finance.transactions.tsx`
- [ ] Lista com filtros: período, tipo, categoria, conta
- [ ] Inclui `TransactionModal` flutuante
- [ ] `pnpm typecheck`
- [ ] Commit

### Task 15 — Frontend: Goals Page
- [ ] Implementar `apps/web/src/routes/finance.goals.tsx`
- [ ] Criar `GoalProgressBar.tsx`: verde → peach-500 em 80% → vermelho ao ultrapassar
- [ ] CRUD completo com progresso calculado
- [ ] `pnpm typecheck`
- [ ] Commit

### Task 16 — Frontend: Recurring Page
- [ ] Implementar `apps/web/src/routes/finance.recurring.tsx`
- [ ] Lista com próxima data, frequência, toggle ativo/pausado
- [ ] CRUD completo
- [ ] `pnpm typecheck`
- [ ] Commit

### Task 17 — Frontend: Finance Dashboard
- [ ] Instalar `recharts`: `pnpm --filter @evobuddy/web add recharts`
- [ ] Implementar os 7 widgets em `components/features/finance/`
- [ ] Implementar `finance.tsx`: carrega config, renderiza widgets enabled ordenados
- [ ] Toggle de visibilidade de saldo (`Eye`/`EyeOff`) persistido em `localStorage` com chave `finance_balance_visible`
- [ ] Painel de configuração de widgets (toggle enabled de cada um)
- [ ] `pnpm typecheck`
- [ ] Commit
