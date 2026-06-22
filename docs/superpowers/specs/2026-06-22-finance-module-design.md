# Finance Module — Design Spec

**Date:** 2026-06-22  
**Status:** Approved  
**Scope:** Módulo de finanças pessoais do dia a dia para EvoBuddy

---

## 1. Objetivo

Adicionar um módulo de finanças pessoais simples e rápido de usar. O usuário deve conseguir registrar uma transação em menos de 5 segundos, acompanhar o fluxo de dinheiro por categoria e conta, definir metas e visualizar o resumo financeiro num dashboard personalizável.

---

## 2. Arquitetura Geral

Abordagem de sub-rotas por entidade, seguindo o padrão existente do projeto (uma rota = uma responsabilidade). O `/finance` é o hub/dashboard. Sub-rotas cobrem cada entidade.

### 2.1 Rotas Frontend

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/finance` | `FinanceDashboard` | Hub principal com widgets personalizáveis |
| `/finance/transactions` | `TransactionsPage` | Lista, filtro e criação de transações |
| `/finance/accounts` | `AccountsPage` | Gerenciar contas bancárias/carteiras |
| `/finance/categories` | `CategoriesPage` | Gerenciar categorias (defaults + personalizadas) |
| `/finance/goals` | `GoalsPage` | Metas de poupança e limites de gasto |
| `/finance/recurring` | `RecurringPage` | Regras de recorrência |

### 2.2 Rotas Backend (API)

Todos os endpoints seguem o padrão `/finance/<resource>` com CRUD completo:

- `GET|POST /finance/accounts`
- `PUT|DELETE /finance/accounts/:id`
- `GET|POST /finance/transactions`
- `PUT|DELETE /finance/transactions/:id`
- `GET|POST /finance/categories`
- `PUT|DELETE /finance/categories/:id`
- `GET|POST /finance/goals`
- `PUT|DELETE /finance/goals/:id`
- `GET|POST /finance/recurring`
- `PUT|DELETE /finance/recurring/:id`
- `GET|PUT /finance/dashboard-config`

---

## 3. Modelo de Dados (Supabase/PostgreSQL)

### `accounts`
```sql
id          uuid PK
user_id     uuid FK auth.users
name        text
type        enum(checking, savings, cash, credit)
balance     numeric  -- saldo inicial; atualizado via transações
color       text     -- hex color
icon        text     -- nome do ícone Lucide
created_at  timestamptz
```

### `categories`
```sql
id          uuid PK
user_id     uuid FK auth.users
name        text
color       text
icon        text
is_default  boolean  -- true = veio pré-criado pelo sistema
created_at  timestamptz
```

**Categorias default** criadas automaticamente no primeiro acesso do usuário ao módulo:
- Entradas: Salário, Freelance, Investimentos, Outros (entrada)
- Saídas: Alimentação, Transporte, Moradia, Saúde, Lazer, Educação, Assinaturas, Outros (saída)

### `transactions`
```sql
id             uuid PK
user_id        uuid FK auth.users
account_id     uuid FK accounts (nullable)
category_id    uuid FK categories (nullable)
goal_id        uuid FK goals (nullable)  -- para metas de poupança
recurring_id   uuid FK recurring_rules (nullable)
type           enum(income, expense)
amount         numeric
description    text
date           date
created_at     timestamptz
```

### `recurring_rules`
```sql
id           uuid PK
user_id      uuid FK auth.users
account_id   uuid FK accounts (nullable)
category_id  uuid FK categories (nullable)
type         enum(income, expense)
amount       numeric
description  text
frequency    enum(daily, weekly, monthly, yearly)
next_date    date
active       boolean
created_at   timestamptz
```

### `goals`
```sql
id             uuid PK
user_id        uuid FK auth.users
name           text
type           enum(savings, spending_limit)
target_amount  numeric
category_id    uuid FK categories (nullable)  -- obrigatório para spending_limit
deadline       date (nullable)                -- para savings
active         boolean
created_at     timestamptz
```

> `current_amount` em goals é calculado em tempo real:
> - **savings**: soma de `transactions.amount` onde `goal_id = goals.id`
> - **spending_limit**: soma de `transactions.amount` onde `category_id = goal.category_id`, `type = expense`, no mês corrente

### `dashboard_config`
```sql
id         uuid PK
user_id    uuid FK auth.users (unique)
widgets    jsonb  -- Array<{ key: string, enabled: boolean, order: number }>
```

---

## 4. Dashboard

### 4.1 Widgets Disponíveis

| Key | Tipo | Descrição |
|-----|------|-----------|
| `balance-summary` | Card | Saldo total consolidado de todas as contas + toggle de visibilidade (olho) |
| `month-cashflow` | Cards | Entradas vs. saídas do mês atual |
| `top-categories` | Lista | Top 5 categorias de gasto do mês (barra horizontal) |
| `recent-transactions` | Lista | Últimas 5 transações |
| `goals-progress` | Cards | Progresso das metas ativas |
| `balance-chart` | Gráfico linha | Evolução do saldo nos últimos 6 meses |
| `category-pie` | Gráfico pizza | Distribuição de gastos do mês por categoria |

### 4.2 Toggle de Visibilidade de Saldo

- Botão `Eye`/`EyeOff` (Lucide) no widget `balance-summary`
- Quando oculto, todos os valores monetários no dashboard exibem `••••`
- Estado persiste em `localStorage` sob a chave `finance_balance_visible`
- Não requer chamada de API — é preferência visual local

### 4.3 Personalização de Widgets

- Usuário pode ativar/desativar cada widget individualmente
- Configuração salva via `PUT /finance/dashboard-config`
- Ordem dos widgets é fixa (sem drag-and-drop para evitar complexidade de layout)

---

## 5. Entidades em Detalhe

### 5.1 Transações

- Modal de criação rápida acessível de qualquer sub-rota via botão flutuante `+`
- Campos: tipo (toggle entrada/saída), valor, categoria, conta (opcional), data (default hoje), descrição (opcional)
- Listagem com filtros: período (mês/semana/custom), tipo, categoria, conta
- Deleção com `animate-slide-out` e confirmação via toast

### 5.2 Contas

- Cards com nome, tipo, saldo atual calculado e cor
- Saldo = saldo_inicial + Σ(entradas) - Σ(saídas) via transações vinculadas
- Tipos: Conta corrente, Poupança, Dinheiro em espécie, Cartão de crédito
- Ícone e cor escolhidos pelo usuário na criação

### 5.3 Categorias

- Defaults pré-criados no primeiro acesso (deletáveis pelo usuário)
- Criação: nome + cor (paleta de 8 cores pré-definidas) + ícone (subset Lucide)
- Sem hierarquia (sem subcategorias) para manter simplicidade

### 5.4 Metas

**Savings goal:**
- Nome, valor alvo, prazo (opcional)
- Progresso: `current / target * 100%`
- Transações podem ser vinculadas a uma meta na criação

**Spending limit:**
- Nome, categoria vinculada, limite mensal
- Progresso calculado em tempo real no mês corrente
- Cor do progress bar: verde → laranja (`peach-500`) ao atingir 80% → vermelho ao ultrapassar

### 5.5 Recorrências

- Cadastro: mesmo formulário de transação + frequência + data de início
- Backend verifica `recurring_rules` onde `next_date <= hoje` e `active = true` ao chamar `/finance/dashboard-config` ou qualquer endpoint de transactions
- Cria a transação automaticamente e avança `next_date`
- Toggle ativo/pausado sem deleção

---

## 6. Padrões de UI (Design System)

Seguir exatamente os padrões do CLAUDE.md:

- Cards: `rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-border-dark dark:bg-card-dark`
- Botão primário: `rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 active:scale-95`
- Entradas de gasto: `text-red-500` / Entradas de receita: `text-green-500`
- Alertas de meta: `text-peach-500` quando ≥ 80% do limite
- Animações: `animate-card-enter` (stagger em listas), `animate-slide-out` (deleção), `animate-pop-in` (criação)
- Toasts em todos os CRUDs via `useToast()`
- Dark mode: todas as classes com variantes `dark:`

---

## 7. Fora do Escopo (YAGNI)

- Importação de extratos bancários (CSV/OFX)
- Integração com Open Finance / APIs bancárias
- Relatórios exportáveis (PDF/Excel)
- Split de despesas entre pessoas
- Moedas múltiplas
- Histórico de edições de transações
- Subcategorias
- Notificações push para metas

---

## 8. Estrutura de Arquivos

```
apps/web/src/
  routes/
    finance.tsx              # Dashboard
    finance.transactions.tsx
    finance.accounts.tsx
    finance.categories.tsx
    finance.goals.tsx
    finance.recurring.tsx
  components/features/finance/
    TransactionModal.tsx     # Modal de criação rápida
    WidgetBalanceSummary.tsx
    WidgetMonthCashflow.tsx
    WidgetTopCategories.tsx
    WidgetRecentTransactions.tsx
    WidgetGoalsProgress.tsx
    WidgetBalanceChart.tsx
    WidgetCategoryPie.tsx
    GoalProgressBar.tsx
    AccountCard.tsx
    CategoryBadge.tsx
  lib/
    api.ts                   # adicionar financeApi.*

packages/shared/src/modules/
  finance/
    index.ts                 # schemas Zod + tipos DTO

packages/api/src/routes/
  finance/
    accounts.ts
    transactions.ts
    categories.ts
    goals.ts
    recurring.ts
    dashboard-config.ts
    index.ts                 # registra todas as rotas
```
