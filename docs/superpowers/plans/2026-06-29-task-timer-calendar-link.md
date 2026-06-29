# Task Timer & Calendar Link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar timer de progresso (barra início→fim) nas tarefas e possibilidade de vincular um evento do calendário a uma tarefa automaticamente.

**Architecture:** Nova migration adiciona `starts_at`, `ends_at` e `calendar_event_id` na tabela `tasks`. A API de calendar events recebe o flag `create_task` no POST e sincroniza a tarefa vinculada no PUT. No frontend, o formulário de tarefas ganha campos opcionais de período e cada card exibe o componente `<TaskTimerBar>`.

**Tech Stack:** PostgreSQL/Supabase, Node.js + Express + Zod, React 19, TailwindCSS, TypeScript.

## Global Constraints

- Tailwind: usar apenas tokens do design system definidos em `CLAUDE.md` (`brand-500`, `peach-500`, `card-dark`, `border-dark`, etc.)
- Ícones: `lucide-react` — nunca SVG inline
- Fontes: `font-display` (Plus Jakarta Sans) para headings, `font-sans` (Inter) para corpo
- Dark mode: classes `dark:` sempre ao lado das classes light
- Nenhuma dependência nova de produção — tudo com o que já existe
- `due_date` na tabela `tasks` já existe no banco (usada pelo calendário) — não recriar
- Timezone: `starts_at`/`ends_at` armazenados como UTC; limitação conhecida documentada no spec

---

## Mapa de Arquivos

| Arquivo | Ação |
|---------|------|
| `packages/api/src/db/migrations/005_task_timer_and_calendar_link.sql` | Criar |
| `packages/api/src/routes/tasks.ts` | Modificar |
| `packages/api/src/routes/calendar/events.ts` | Modificar |
| `apps/web/src/lib/api.ts` | Modificar |
| `apps/web/src/components/features/tasks/TaskTimerBar.tsx` | Criar |
| `apps/web/src/routes/tasks.tsx` | Modificar |
| `apps/web/src/components/features/calendar/EventModal.tsx` | Modificar |

---

### Task 1: Migration do banco de dados

**Files:**
- Create: `packages/api/src/db/migrations/005_task_timer_and_calendar_link.sql`

**Interfaces:**
- Produces: colunas `starts_at TIMESTAMPTZ`, `ends_at TIMESTAMPTZ`, `calendar_event_id TEXT` na tabela `tasks`

- [ ] **Step 1: Criar o arquivo de migration**

Conteúdo exato do arquivo:

```sql
-- Migration 005: Task timer and calendar event link
-- Apply via: Supabase Dashboard > SQL Editor

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS starts_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS calendar_event_id  TEXT REFERENCES calendar_events(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_calendar_event_id
  ON tasks(calendar_event_id)
  WHERE calendar_event_id IS NOT NULL;
```

- [ ] **Step 2: Aplicar a migration no Supabase**

Abra o Supabase Dashboard → SQL Editor → cole o conteúdo acima → Execute.

Verificação: rode no SQL Editor:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tasks'
  AND column_name IN ('starts_at', 'ends_at', 'calendar_event_id');
```
Resultado esperado: 3 linhas retornadas.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/db/migrations/005_task_timer_and_calendar_link.sql
git commit -m "feat(db): add starts_at, ends_at, calendar_event_id to tasks"
```

---

### Task 2: API — Atualizar rotas de tasks

**Files:**
- Modify: `packages/api/src/routes/tasks.ts`

**Interfaces:**
- Consumes: colunas `starts_at`, `ends_at` (Task 1)
- Produces:
  - `POST /api/tasks` aceita `starts_at?: string` (ISO datetime), `ends_at?: string` (ISO datetime)
  - `PUT /api/tasks/:id` aceita os mesmos campos
  - Quando `ends_at` fornecido, `due_date` é auto-preenchido com `ends_at.slice(0, 10)`

- [ ] **Step 1: Verificar o estado atual do arquivo**

Abra `packages/api/src/routes/tasks.ts`. Localize:
- `createSchema` (linha ~17)
- `updateSchema` (linha ~92)
- Bloco de insert no `router.post` (linha ~23)
- Bloco de update no `router.put` (linha ~99)

- [ ] **Step 2: Atualizar `createSchema` para aceitar os novos campos**

Encontre:
```typescript
const createSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().default(""),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});
```

Substitua por:
```typescript
const createSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().default(""),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
});
```

- [ ] **Step 3: Atualizar o handler POST para persistir os novos campos e auto-preencher `due_date`**

Encontre o trecho dentro de `router.post("/", ...)`:
```typescript
const { title, description, due_date } = req.body;
const ulid = crypto.randomUUID().replace(/-/g, "").slice(0, 26);

const { data, error } = await supabaseAdmin!
  .from("tasks")
  .insert({
    id: ulid,
    user_id: req.user!.id,
    title,
    description,
    due_date: due_date ?? null,
  })
```

Substitua por:
```typescript
const { title, description, due_date, starts_at, ends_at } = req.body;
const ulid = crypto.randomUUID().replace(/-/g, "").slice(0, 26);

// Se ends_at fornecido e due_date não, derivar due_date da data de ends_at
const effectiveDueDate =
  due_date ?? (ends_at ? ends_at.slice(0, 10) : null);

const { data, error } = await supabaseAdmin!
  .from("tasks")
  .insert({
    id: ulid,
    user_id: req.user!.id,
    title,
    description,
    due_date: effectiveDueDate,
    starts_at: starts_at ?? null,
    ends_at: ends_at ?? null,
  })
```

- [ ] **Step 4: Atualizar `updateSchema` para aceitar os novos campos**

Encontre:
```typescript
const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  completed: z.boolean().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});
```

Substitua por:
```typescript
const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  completed: z.boolean().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
});
```

- [ ] **Step 5: Atualizar o handler PUT para auto-preencher `due_date` quando `ends_at` mudar**

Encontre dentro de `router.put("/:id", ...)`:
```typescript
const updates: Record<string, unknown> = {
  ...req.body,
  updated_at: new Date().toISOString(),
};
```

Substitua por:
```typescript
const { ends_at, due_date, ...rest } = req.body;
const effectiveDueDate =
  due_date !== undefined
    ? due_date
    : ends_at !== undefined && ends_at !== null
    ? ends_at.slice(0, 10)
    : undefined;

const updates: Record<string, unknown> = {
  ...rest,
  updated_at: new Date().toISOString(),
};
if (ends_at !== undefined) updates.ends_at = ends_at;
if (effectiveDueDate !== undefined) updates.due_date = effectiveDueDate;
```

- [ ] **Step 6: Testar via curl**

Crie uma tarefa com timer:
```bash
curl -s -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "Testar timer",
    "starts_at": "2026-06-29T14:00:00.000Z",
    "ends_at": "2026-06-29T16:00:00.000Z"
  }' | jq '{id, due_date, starts_at, ends_at}'
```

Resultado esperado:
```json
{
  "id": "...",
  "due_date": "2026-06-29",
  "starts_at": "2026-06-29T14:00:00+00:00",
  "ends_at": "2026-06-29T16:00:00+00:00"
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/routes/tasks.ts
git commit -m "feat(api): add starts_at/ends_at to tasks routes"
```

---

### Task 3: API — Calendar events: criar e sincronizar tarefa vinculada

**Files:**
- Modify: `packages/api/src/routes/calendar/events.ts`

**Interfaces:**
- Consumes: tabela `tasks` com colunas da Task 1; API de tasks da Task 2
- Produces:
  - `POST /api/calendar/events` aceita `create_task?: boolean`; se `true`, cria tarefa vinculada
  - `PUT /api/calendar/events/:id` sincroniza título e horários da tarefa vinculada (se existir)
  - `DELETE /api/calendar/events/:id` — CASCADE do banco deleta a tarefa automaticamente (sem código extra)

- [ ] **Step 1: Adicionar `create_task` ao `createSchema`**

Encontre em `packages/api/src/routes/calendar/events.ts` o `createSchema`. Adicione ao final do objeto (antes do `.refine`):
```typescript
create_task: z.boolean().optional(),
```

O schema completo ficará:
```typescript
const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  all_day: z.boolean().default(true),
  category_id: z.string().nullable().optional(),
  recurring: z
    .object({
      frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
      days_of_week: z.array(z.number().min(0).max(6)).optional(),
      end_date: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  notification_minutes: z.number().nullable().optional(),
  create_task: z.boolean().optional(),
}).refine(
  (data) => data.all_day !== false || (data.start_time != null && data.start_time !== ""),
  { message: "start_time required when all_day is false", path: ["start_time"] }
);
```

- [ ] **Step 2: Criar helper para gerar ULID de tarefa**

No topo do arquivo (após os imports existentes), adicione:
```typescript
function makeUlid(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26);
}
```

- [ ] **Step 3: Atualizar o handler POST para criar tarefa vinculada**

Localize o bloco final do `router.post("/", ...)` — logo após o insert do evento e antes de `res.status(201).json(data)`. Substitua:
```typescript
if (error) throw new AppError(error.message, 500);
res.status(201).json(data);
```

Por:
```typescript
if (error) throw new AppError(error.message, 500);

if (req.body.create_task && data) {
  const evt = data as Record<string, unknown>;
  const taskPayload: Record<string, unknown> = {
    id: makeUlid(),
    user_id: req.user!.id,
    title: evt.title,
    description: "",
    calendar_event_id: evt.id,
    due_date: evt.date,
  };

  if (!evt.all_day && evt.start_time && evt.end_time) {
    taskPayload.starts_at = `${evt.date}T${evt.start_time}:00`;
    taskPayload.ends_at   = `${evt.date}T${evt.end_time}:00`;
  }

  await supabaseAdmin!.from("tasks").insert(taskPayload);
}

res.status(201).json(data);
```

- [ ] **Step 4: Atualizar o handler PUT para sincronizar a tarefa vinculada**

Localize o bloco final do `router.put("/:id", ...)`. Substitua:
```typescript
if (error || !data) {
  throw new AppError("Evento não encontrado", 404);
}
res.json(data);
```

Por:
```typescript
if (error || !data) {
  throw new AppError("Evento não encontrado", 404);
}

// Sincronizar tarefa vinculada se existir
const { data: linkedTask } = await supabaseAdmin!
  .from("tasks")
  .select("id")
  .eq("calendar_event_id", req.params.id)
  .eq("user_id", req.user!.id)
  .maybeSingle();

if (linkedTask) {
  const evt = data as Record<string, unknown>;
  const taskUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (req.body.title !== undefined) taskUpdates.title = evt.title;

  if (
    req.body.date !== undefined ||
    req.body.start_time !== undefined ||
    req.body.end_time !== undefined ||
    req.body.all_day !== undefined
  ) {
    taskUpdates.due_date = evt.date;
    if (!evt.all_day && evt.start_time && evt.end_time) {
      taskUpdates.starts_at = `${evt.date}T${evt.start_time}:00`;
      taskUpdates.ends_at   = `${evt.date}T${evt.end_time}:00`;
    } else {
      taskUpdates.starts_at = null;
      taskUpdates.ends_at   = null;
    }
  }

  await supabaseAdmin!
    .from("tasks")
    .update(taskUpdates)
    .eq("id", (linkedTask as Record<string, unknown>).id)
    .eq("user_id", req.user!.id);
}

res.json(data);
```

- [ ] **Step 5: Testar criação com `create_task: true`**

```bash
curl -s -X POST http://localhost:3001/api/calendar/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "Reunião",
    "date": "2026-06-30",
    "all_day": false,
    "start_time": "10:00",
    "end_time": "11:00",
    "create_task": true
  }' | jq '.id'
```

Em seguida, verificar se a tarefa foi criada:
```bash
curl -s http://localhost:3001/api/tasks \
  -H "Authorization: Bearer <token>" | jq '[.[] | select(.title == "Reunião") | {id, calendar_event_id, starts_at, ends_at}]'
```

Resultado esperado: 1 tarefa com `calendar_event_id` preenchido e `starts_at`/`ends_at` iguais a `2026-06-30T10:00:00` e `2026-06-30T11:00:00`.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/calendar/events.ts
git commit -m "feat(api): create and sync linked task from calendar event"
```

---

### Task 4: Frontend — Atualizar tipos em api.ts

**Files:**
- Modify: `apps/web/src/lib/api.ts`

**Interfaces:**
- Produces:
  - `TaskDTO` com `starts_at: string | null`, `ends_at: string | null`, `calendar_event_id: string | null`
  - `CreateTaskDTO` com `starts_at?: string`, `ends_at?: string`
  - `UpdateTaskDTO` com `starts_at?: string | null`, `ends_at?: string | null`
  - `CalendarEventDTO` com `create_task?: boolean` (usado no POST)

- [ ] **Step 1: Atualizar `TaskDTO`**

Encontre:
```typescript
export interface TaskDTO {
  id: string;
  user_id: string;
  title: string;
  description: string;
  completed: boolean;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}
```

Substitua por:
```typescript
export interface TaskDTO {
  id: string;
  user_id: string;
  title: string;
  description: string;
  completed: boolean;
  due_date: string | null;
  starts_at: string | null;
  ends_at: string | null;
  calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Atualizar `CreateTaskDTO`**

Encontre:
```typescript
export interface CreateTaskDTO {
  title: string;
  description?: string;
  due_date?: string;
}
```

Substitua por:
```typescript
export interface CreateTaskDTO {
  title: string;
  description?: string;
  due_date?: string;
  starts_at?: string;
  ends_at?: string;
}
```

- [ ] **Step 3: Atualizar `UpdateTaskDTO`**

Encontre:
```typescript
export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  completed?: boolean;
  due_date?: string | null;
}
```

Substitua por:
```typescript
export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  completed?: boolean;
  due_date?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
}
```

- [ ] **Step 4: Adicionar `create_task` ao payload do calendarApi**

Localize `CalendarEventDTO` (ou onde `calendarApi.events.create` é tipado). Encontre a interface/tipo do payload de criação de evento. Se não existir `CreateCalendarEventDTO`, adicione antes de `calendarApi`:

```typescript
export interface CreateCalendarEventDTO {
  title: string;
  description?: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  all_day: boolean;
  category_id?: string | null;
  recurring?: { frequency: string; end_date?: string | null } | null;
  notification_minutes?: number | null;
  create_task?: boolean;
}
```

Se já existir `calendarApi.events.create` tipado como `(data: SomeType)`, atualize esse tipo para incluir `create_task?: boolean`. Se não houver tipo explícito (usa `any` ou `object`), apenas garanta que o campo é passado no body.

- [ ] **Step 5: Verificar que o TypeScript compila**

```bash
cd /caminho/do/projeto && pnpm typecheck
```

Resultado esperado: sem erros nos arquivos modificados.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(api-types): add timer fields and create_task to DTOs"
```

---

### Task 5: Componente TaskTimerBar

**Files:**
- Create: `apps/web/src/components/features/tasks/TaskTimerBar.tsx`

**Interfaces:**
- Consumes: nada (componente puro)
- Produces: `<TaskTimerBar startsAt={string} endsAt={string} />` — componente React exportado

- [ ] **Step 1: Criar o diretório se necessário**

```bash
mkdir -p apps/web/src/components/features/tasks
```

- [ ] **Step 2: Criar o arquivo `TaskTimerBar.tsx`**

Conteúdo completo:

```tsx
import { useEffect, useState } from "react";

interface TaskTimerBarProps {
  startsAt: string;
  endsAt: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRemaining(ms: number): string {
  const totalMins = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min restantes`;
  if (h > 0) return `${h}h restantes`;
  return `${m}min restantes`;
}

export function TaskTimerBar({ startsAt, endsAt }: TaskTimerBarProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const total = end - start;

  if (now < start) {
    return (
      <p className="mt-1.5 text-xs text-neutral-400 dark:text-neutral-500">
        Inicia às {formatTime(startsAt)}
      </p>
    );
  }

  if (now > end) {
    return (
      <div className="mt-1.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-red-100 dark:bg-red-900/20">
          <div className="h-full w-full rounded-full bg-red-500" />
        </div>
        <p className="mt-1 text-xs text-red-500">Prazo encerrado</p>
      </div>
    );
  }

  const elapsed = now - start;
  const pct = Math.min(100, Math.round((elapsed / total) * 100));
  const remaining = end - now;
  const isUrgent = remaining / total < 0.25;

  return (
    <div className="mt-1.5">
      <div className="mb-0.5 flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500">
        <span>{formatTime(startsAt)}</span>
        <span>{formatTime(endsAt)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isUrgent ? "bg-peach-500" : "bg-brand-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p
        className={`mt-1 text-xs ${
          isUrgent
            ? "text-peach-500"
            : "text-neutral-400 dark:text-neutral-500"
        }`}
      >
        {formatRemaining(remaining)}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verificar que compila sem erros**

```bash
pnpm typecheck
```

Resultado esperado: sem erros TypeScript.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/features/tasks/TaskTimerBar.tsx
git commit -m "feat(web): add TaskTimerBar component with 3-state progress display"
```

---

### Task 6: tasks.tsx — formulário com período e timer nos cards

**Files:**
- Modify: `apps/web/src/routes/tasks.tsx`

**Interfaces:**
- Consumes: `TaskTimerBar` (Task 5), `TaskDTO` atualizado (Task 4), `tasksApi.create` atualizado (Task 4)
- Produces: formulário de criação com seção "Definir período" colapsável; cards de lista e kanban exibindo `<TaskTimerBar>` quando aplicável

- [ ] **Step 1: Adicionar import do TaskTimerBar e atualizar estado do formulário**

No topo de `apps/web/src/routes/tasks.tsx`, adicione o import:
```typescript
import { TaskTimerBar } from "../components/features/tasks/TaskTimerBar";
import { Clock } from "lucide-react";
```

No corpo de `TasksPage`, substitua:
```typescript
const [newDueDate, setNewDueDate] = useState("");
```

Por:
```typescript
const [newStartsAt, setNewStartsAt] = useState("");
const [newEndsAt, setNewEndsAt] = useState("");
const [showPeriod, setShowPeriod] = useState(false);
```

- [ ] **Step 2: Atualizar `handleCreate` para usar os novos campos**

Encontre:
```typescript
await tasksApi.create({ title: newTitle, due_date: newDueDate || undefined });
setNewTitle("");
setNewDueDate("");
```

Substitua por:
```typescript
await tasksApi.create({
  title: newTitle,
  starts_at: newStartsAt || undefined,
  ends_at: newEndsAt || undefined,
});
setNewTitle("");
setNewStartsAt("");
setNewEndsAt("");
setShowPeriod(false);
```

- [ ] **Step 3: Substituir o campo de data no formulário pela seção colapsável**

Encontre no JSX do formulário:
```tsx
<input
  type="date"
  value={newDueDate}
  onChange={(e) => setNewDueDate(e.target.value)}
  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100"
  aria-label="Prazo (opcional)"
/>
```

Substitua por:
```tsx
<div>
  <button
    type="button"
    onClick={() => setShowPeriod((v) => !v)}
    className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 transition hover:text-brand-500 dark:text-neutral-500 dark:hover:text-brand-400 min-h-0 min-w-0"
  >
    <Clock className="h-3.5 w-3.5" />
    {showPeriod ? "Remover período" : "Definir período"}
  </button>

  {showPeriod && (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-400 dark:text-neutral-500">
          Início
        </label>
        <input
          type="datetime-local"
          value={newStartsAt}
          onChange={(e) => setNewStartsAt(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-400 dark:text-neutral-500">
          Fim
        </label>
        <input
          type="datetime-local"
          value={newEndsAt}
          onChange={(e) => setNewEndsAt(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100"
        />
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 4: Adicionar TaskTimerBar nos cards da visão lista**

Na visão lista, localize o bloco de conteúdo de cada item (`<li>`). Encontre:
```tsx
<span
  className={`flex-1 text-sm transition-colors relative ${
    task.completed
      ? "text-neutral-400 dark:text-neutral-500 animate-strikethrough"
      : "text-ink dark:text-neutral-200"
  }`}
>
  {task.title}
  {task.description && (
    <span className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 block truncate max-w-[200px]">
      {task.description}
    </span>
  )}
</span>
```

Substitua por:
```tsx
<span
  className={`flex-1 text-sm transition-colors relative ${
    task.completed
      ? "text-neutral-400 dark:text-neutral-500 animate-strikethrough"
      : "text-ink dark:text-neutral-200"
  }`}
>
  {task.title}
  {task.description && (
    <span className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 block truncate max-w-[200px]">
      {task.description}
    </span>
  )}
  {!task.completed && task.starts_at && task.ends_at && (
    <span className="block">
      <TaskTimerBar startsAt={task.starts_at} endsAt={task.ends_at} />
    </span>
  )}
</span>
```

- [ ] **Step 5: Adicionar TaskTimerBar no DraggableCard (visão kanban)**

Localize o componente `DraggableCard`. Encontre:
```tsx
<div className="min-w-0 flex-1">
  <p className={`text-sm font-medium ${task.completed ? "text-neutral-400 line-through dark:text-neutral-500" : "text-ink dark:text-neutral-200"}`}>
    {task.title}
  </p>
  {task.description && (
    <p className="mt-0.5 truncate text-xs text-neutral-400 dark:text-neutral-500">
      {task.description}
    </p>
  )}
</div>
```

Substitua por:
```tsx
<div className="min-w-0 flex-1">
  <p className={`text-sm font-medium ${task.completed ? "text-neutral-400 line-through dark:text-neutral-500" : "text-ink dark:text-neutral-200"}`}>
    {task.title}
  </p>
  {task.description && (
    <p className="mt-0.5 truncate text-xs text-neutral-400 dark:text-neutral-500">
      {task.description}
    </p>
  )}
  {!task.completed && task.starts_at && task.ends_at && (
    <TaskTimerBar startsAt={task.starts_at} endsAt={task.ends_at} />
  )}
</div>
```

- [ ] **Step 6: Verificar compilação**

```bash
pnpm typecheck
```

Resultado esperado: sem erros.

- [ ] **Step 7: Testar na interface**

Rode `pnpm dev`. Acesse a tela de Tarefas. Clique em "Definir período", preencha um início e fim, crie a tarefa. Verifique:
- Card exibe a barra de progresso com horários
- Cor da barra é `brand-500` (lilás) quando há tempo sobrando
- Se setar um `starts_at` futuro, exibe "Inicia às HH:MM"

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/routes/tasks.tsx
git commit -m "feat(web): add period form fields and TaskTimerBar to task cards"
```

---

### Task 7: EventModal — toggle "Adicionar como tarefa"

**Files:**
- Modify: `apps/web/src/components/features/calendar/EventModal.tsx`

**Interfaces:**
- Consumes: `CreateCalendarEventDTO` com `create_task` (Task 4), `calendarApi.events.create` (já existe)
- Produces: toggle "Adicionar como tarefa" visível somente na criação de evento novo; envia `create_task` no payload

- [ ] **Step 1: Adicionar estado `createTask` no EventModal**

Dentro da função `EventModal`, localize os `useState` existentes (após `const [submitting, setSubmitting] = useState(false)`). Adicione:
```typescript
const [createTask, setCreateTask] = useState(!event);
```

Explicação: por padrão, ao criar um evento novo (`!event`), ativa o toggle.

- [ ] **Step 2: Resetar `createTask` quando o modal reabrir**

Localize o `useEffect` que sincroniza os campos com o `event` prop:
```typescript
useEffect(() => {
  setTitle(event?.title ?? "");
  // ... outros campos
}, [event, defaultDate, open]);
```

Adicione ao final desse useEffect:
```typescript
setCreateTask(!event);
```

- [ ] **Step 3: Incluir `create_task` no payload de criação**

Dentro de `handleSubmit`, localize:
```typescript
if (event) {
  await calendarApi.events.update(event.id, payload);
  toast("Evento atualizado.", "success");
} else {
  await calendarApi.events.create(payload);
  toast("Evento criado.", "success");
}
```

Substitua o branch `else` por:
```typescript
} else {
  await calendarApi.events.create({ ...payload, create_task: createTask });
  toast("Evento criado.", "success");
}
```

- [ ] **Step 4: Adicionar o toggle na UI do modal**

No JSX do `<form>`, após o campo "Descrição" e antes de `{/* Actions */}`, adicione:

```tsx
{/* Adicionar como tarefa — só na criação */}
{!event && (
  <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-border-dark dark:bg-neutral-800">
    <span className="text-sm text-ink dark:text-white">Adicionar como tarefa</span>
    <button
      type="button"
      role="switch"
      aria-checked={createTask}
      onClick={() => setCreateTask((v) => !v)}
      style={{ minWidth: "2.75rem" }}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 min-h-0 ${
        createTask ? "bg-brand-500" : "bg-neutral-300 dark:bg-neutral-600"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          createTask ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  </div>
)}
```

- [ ] **Step 5: Verificar tipagem do `calendarApi.events.create`**

Em `apps/web/src/lib/api.ts`, localize `calendarApi.events.create`. Se o parâmetro for tipado como algo sem `create_task`, atualize para usar `CreateCalendarEventDTO` (definida na Task 4) ou adicione `& { create_task?: boolean }`. Se não houver tipo explícito, apenas verifique que `pnpm typecheck` passa.

- [ ] **Step 6: Verificar compilação**

```bash
pnpm typecheck
```

Resultado esperado: sem erros.

- [ ] **Step 7: Testar na interface**

Rode `pnpm dev`. Acesse o Calendário, clique para criar evento. Verifique:
- Toggle "Adicionar como tarefa" aparece no modal de criação
- Toggle NÃO aparece ao editar um evento existente
- Ao criar com toggle ativado e horários definidos, vá para a tela de Tarefas e confirme que a nova tarefa aparece com a barra de progresso no horário correto
- Ao deletar o evento no calendário, a tarefa deve desaparecer da aba de tarefas (CASCADE)

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/features/calendar/EventModal.tsx
git commit -m "feat(web): add create_task toggle to EventModal"
```

---

### Task 8: Deploy para produção

**Files:** nenhum arquivo novo

- [ ] **Step 1: Confirmar que todas as tarefas anteriores estão commitadas**

```bash
git log --oneline -8
```

Verificar que os commits das Tasks 1–7 estão presentes.

- [ ] **Step 2: Sincronizar código com a VPS**

Na raiz do projeto:
```bash
rsync -az --delete --exclude='node_modules' --exclude='.git' --exclude='dist' \
  apps/ root@72.60.255.200:/opt/evobuddy/apps/

rsync -az --delete --exclude='node_modules' --exclude='.git' --exclude='dist' \
  packages/shared/ root@72.60.255.200:/opt/evobuddy/packages/shared/

rsync -az --delete --exclude='node_modules' --exclude='.git' --exclude='dist' \
  packages/api/ root@72.60.255.200:/opt/evobuddy/packages/api/

rsync -az Dockerfile docker-compose.yml pnpm-lock.yaml pnpm-workspace.yaml \
  package.json turbo.json tsconfig.base.json root@72.60.255.200:/opt/evobuddy/
```

- [ ] **Step 3: Rebuild na VPS**

```bash
ssh root@72.60.255.200 "cd /opt/evobuddy && docker compose up -d --build"
```

Resultado esperado: `Container evobuddy-web Started` e `Container evobuddy-api Started` no output.

- [ ] **Step 4: Smoke test em produção**

Acesse https://bitsautomacoes.site. Verifique:
- Tela de Tarefas carrega sem erros no console
- Modal de criação de tarefa tem a opção "Definir período"
- Modal do Calendário tem o toggle "Adicionar como tarefa"
