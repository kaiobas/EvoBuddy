# Calendar Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo completo de calendário pessoal com eventos, rotinas recorrentes, 3 views (mensal/semanal/agenda), notificações locais via service worker e integração com tarefas.

**Architecture:** API Express com rotas em `packages/api/src/routes/calendar/`. Frontend com `react-big-calendar` em `apps/web/src/routes/calendar.tsx`. Service worker atualizado para notificações locais.

**Tech Stack:** React 19 + react-big-calendar + date-fns · Express + Supabase · Notification API + Service Worker

## Global Constraints

- Tabelas: `calendar_categories`, `calendar_events`, coluna `due_date` em `tasks`
- IDs: `crypto.randomUUID().replace(/-/g,"").slice(0,26)`
- authMiddleware em todas as rotas calendar
- ES modules (.js extensions nos imports da API)
- Zod validation em POST/PUT
- All queries filtradas por `user_id = req.user.id`
- Ícones somente lucide-react
- Design tokens CLAUDE.md: rounded-2xl, brand-500, card-dark, border-dark
- Dark mode: variantes `dark:` em todas as classes
- Typecheck: `pnpm --filter @evobuddy/web typecheck` e `pnpm --filter @evobuddy/api typecheck`

---

### Task 1: SQL Migration

**Files:** Supabase SQL Editor (usuário roda manualmente)

- [ ] **Step 1: Rodar no Supabase Dashboard → SQL Editor**

```sql
-- Categorias de calendário
CREATE TABLE IF NOT EXISTS calendar_categories (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#7C6FCD',
  icon        TEXT NOT NULL DEFAULT 'Tag',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Eventos de calendário
CREATE TABLE IF NOT EXISTS calendar_events (
  id                   TEXT PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  description          TEXT NOT NULL DEFAULT '',
  date                 DATE NOT NULL,
  start_time           TEXT,
  end_time             TEXT,
  all_day              BOOLEAN NOT NULL DEFAULT TRUE,
  category_id          TEXT REFERENCES calendar_categories(id) ON DELETE SET NULL,
  recurring            JSONB,
  notification_minutes INTEGER,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Adicionar due_date nas tarefas
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;
```

- [ ] **Step 2: Verificar** que `calendar_categories`, `calendar_events` aparecem no Table Editor e `tasks` tem coluna `due_date`

- [ ] **Step 3: Commit** `"chore: add calendar tables and tasks.due_date migration"`

---

### Task 2: API Calendar Router Base

**Files:**
- Create: `packages/api/src/routes/calendar/index.ts`
- Modify: `packages/api/src/router.ts`

- [ ] **Step 1: Criar `packages/api/src/routes/calendar/index.ts`**

```ts
import { Router } from "express";
const router = Router();
// sub-routes mounted by Tasks 3 and 4
export default router;
```

- [ ] **Step 2: Registrar em `packages/api/src/router.ts`**

Adicionar após as rotas existentes:
```ts
import calendarRouter from "./routes/calendar/index.js";
router.use("/api/calendar", calendarRouter);
```

- [ ] **Step 3: Typecheck** `pnpm --filter @evobuddy/api typecheck`

- [ ] **Step 4: Commit** `"feat(api): register calendar router base"`

---

### Task 3: API Calendar Categories

**Files:**
- Create: `packages/api/src/routes/calendar/categories.ts`
- Modify: `packages/api/src/routes/calendar/index.ts`

Pattern: seguir exatamente `packages/api/src/routes/finance/categories.ts`.

- [ ] **Step 1: Criar `categories.ts`** com CRUD completo:
  - `authMiddleware` no topo
  - `GET /` — lista categorias do usuário; se vazio, seed 5 defaults:
    - `{ name: "Trabalho", color: "#3b82f6", icon: "Briefcase" }`
    - `{ name: "Saúde", color: "#22c55e", icon: "Heart" }`
    - `{ name: "Pessoal", color: "#7C6FCD", icon: "User" }`
    - `{ name: "Financeiro", color: "#F4845F", icon: "Wallet" }`
    - `{ name: "Outros", color: "#6b7280", icon: "Tag" }`
  - `POST /` — Zod: `{ name: string min 1, color?: string, icon?: string }`
  - `PUT /:id` — atualiza name/color/icon
  - `DELETE /:id` — 204
  - Tabela: `calendar_categories`

- [ ] **Step 2: Registrar em `index.ts`**

```ts
import categoriesRouter from "./categories.js";
router.use("/categories", categoriesRouter);
```

- [ ] **Step 3: Typecheck**

- [ ] **Step 4: Commit** `"feat(api): calendar categories CRUD"`

---

### Task 4: API Calendar Events

**Files:**
- Create: `packages/api/src/routes/calendar/events.ts`
- Modify: `packages/api/src/routes/calendar/index.ts`

- [ ] **Step 1: Criar `events.ts`**

Zod schema para criação:
```ts
const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  all_day: z.boolean().default(true),
  category_id: z.string().nullable().optional(),
  recurring: z.object({
    frequency: z.enum(["daily","weekly","monthly","yearly"]),
    days_of_week: z.array(z.number().min(0).max(6)).optional(),
    end_date: z.string().nullable().optional(),
  }).nullable().optional(),
  notification_minutes: z.number().nullable().optional(),
});
```

Rotas:
- `GET /?from=YYYY-MM-DD&to=YYYY-MM-DD` — lista eventos no período + expande recorrências (ver lógica abaixo)
- `POST /` — cria evento
- `PUT /:id` — atualiza
- `DELETE /:id` — 204

**Lógica de expansão de recorrências no GET:**
```ts
// Buscar eventos base no período ou que começaram antes e têm recorrência ativa
// Para cada evento com recurring != null:
//   gerar todas as instâncias dentro do range from..to
//   retornar como objetos separados com mesmo id + date virtual

function expandRecurring(event, from, to) {
  // Avança date pelo frequency até ultrapassar to
  // Respeita end_date se definido
  // Retorna array de { ...event, date: instanceDate }
}
```

- [ ] **Step 2: Registrar em `index.ts`**

```ts
import eventsRouter from "./events.js";
router.use("/events", eventsRouter);
```

- [ ] **Step 3: Typecheck**

- [ ] **Step 4: Commit** `"feat(api): calendar events CRUD with recurrence expansion"`

---

### Task 5: Frontend — Instalar Deps + API Client

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/package.json` (via pnpm)

- [ ] **Step 1: Instalar dependências**

```bash
pnpm --filter @evobuddy/web add react-big-calendar date-fns
pnpm --filter @evobuddy/web add -D @types/react-big-calendar
```

- [ ] **Step 2: Adicionar ao final de `api.ts`**

```ts
// ─── Calendar ────────────────────────────────────────────────

export interface CalendarCategoryDTO {
  id: string; user_id: string; name: string; color: string; icon: string; created_at: string;
}
export interface CreateCalendarCategoryDTO { name: string; color?: string; icon?: string }

export interface CalendarRecurring {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  days_of_week?: number[];
  end_date?: string | null;
}

export interface CalendarEventDTO {
  id: string; user_id: string; title: string; description: string;
  date: string; start_time: string | null; end_time: string | null;
  all_day: boolean; category_id: string | null;
  recurring: CalendarRecurring | null;
  notification_minutes: number | null; created_at: string;
}
export interface CreateCalendarEventDTO {
  title: string; date: string; description?: string;
  start_time?: string | null; end_time?: string | null; all_day?: boolean;
  category_id?: string | null; recurring?: CalendarRecurring | null;
  notification_minutes?: number | null;
}

export const calendarApi = {
  categories: {
    list: () => request<CalendarCategoryDTO[]>("/api/calendar/categories"),
    create: (data: CreateCalendarCategoryDTO) => request<CalendarCategoryDTO>("/api/calendar/categories", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CreateCalendarCategoryDTO>) => request<CalendarCategoryDTO>(`/api/calendar/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/api/calendar/categories/${id}`, { method: "DELETE" }),
  },
  events: {
    list: (from: string, to: string) => request<CalendarEventDTO[]>(`/api/calendar/events?from=${from}&to=${to}`),
    create: (data: CreateCalendarEventDTO) => request<CalendarEventDTO>("/api/calendar/events", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CreateCalendarEventDTO>) => request<CalendarEventDTO>(`/api/calendar/events/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/api/calendar/events/${id}`, { method: "DELETE" }),
  },
};
```

- [ ] **Step 3: Também atualizar `TaskDTO`** adicionando `due_date: string | null` e `UpdateTaskDTO` com `due_date?: string | null`

- [ ] **Step 4: Typecheck** `pnpm --filter @evobuddy/web typecheck`

- [ ] **Step 5: Commit** `"feat(web): calendar DTOs and API client"`

---

### Task 6: Service Worker — Notificações

**Files:**
- Modify: `apps/web/public/sw.js` (criar se não existir)
- Modify: `apps/web/src/main.tsx` — registrar SW

- [ ] **Step 1: Criar/atualizar `apps/web/public/sw.js`**

```js
// Armazena timers de notificação agendados
const scheduledTimers = [];

self.addEventListener("message", (event) => {
  if (event.data?.type !== "SCHEDULE_NOTIFICATIONS") return;

  // Limpar timers anteriores
  scheduledTimers.forEach(clearTimeout);
  scheduledTimers.length = 0;

  const { events } = event.data;
  const now = Date.now();

  events.forEach((ev) => {
    if (!ev.notification_minutes || ev.notification_minutes == null) return;

    // Construir datetime do evento
    const [year, month, day] = ev.date.split("-").map(Number);
    let eventMs;
    if (ev.start_time) {
      const [h, m] = ev.start_time.split(":").map(Number);
      eventMs = new Date(year, month - 1, day, h, m).getTime();
    } else {
      eventMs = new Date(year, month - 1, day, 9, 0).getTime(); // all-day: 9h
    }

    const notifyAt = eventMs - ev.notification_minutes * 60 * 1000;
    const delay = notifyAt - now;
    if (delay <= 0) return;

    const timer = setTimeout(() => {
      self.registration.showNotification(ev.title, {
        body: ev.start_time ? `Hoje às ${ev.start_time}` : "Hoje — dia inteiro",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
      });
    }, delay);

    scheduledTimers.push(timer);
  });
});
```

- [ ] **Step 2: Registrar SW em `apps/web/src/main.tsx`**

Adicionar antes do `ReactDOM.createRoot(...)`:
```ts
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
```

- [ ] **Step 3: Typecheck**

- [ ] **Step 4: Commit** `"feat(web): service worker com notificações locais de calendário"`

---

### Task 7: Layout + App Routes + Task due_date

**Files:**
- Modify: `apps/web/src/components/layout/Layout.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/routes/tasks.tsx`

- [ ] **Step 1: Adicionar item Calendário no sidebar (`Layout.tsx`)**

No array `navItems`, inserir após Tarefas:
```ts
{ to: "/calendar", label: "Calendário", icon: CalendarDays },
```
Importar `CalendarDays` do lucide-react.

- [ ] **Step 2: Adicionar rota em `App.tsx`**

```tsx
import { CalendarPage } from "./routes/calendar";
// dentro do Layout route:
<Route path="calendar" element={<CalendarPage />} />
```

- [ ] **Step 3: Atualizar `tasks.tsx`** — adicionar campo `due_date` no formulário de criação:

No estado do form, adicionar `const [newDueDate, setNewDueDate] = useState("")`.

No `handleCreate`, incluir `due_date: newDueDate || undefined` no create call.

No JSX do formulário, adicionar após o campo de título:
```tsx
<input
  type="date"
  value={newDueDate}
  onChange={(e) => setNewDueDate(e.target.value)}
  className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100"
  aria-label="Prazo (opcional)"
/>
```

Também adicionar `due_date: newDueDate || null` no `UpdateTaskDTO` do toggle — não alterar, só no create.

- [ ] **Step 4: Typecheck**

- [ ] **Step 5: Commit** `"feat(web): calendar route, sidebar item, tasks due_date field"`

---

### Task 8: EventModal Component

**Files:**
- Create: `apps/web/src/components/features/calendar/EventModal.tsx`

- [ ] **Step 1: Criar `EventModal.tsx`**

Props:
```ts
interface EventModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  event?: CalendarEventDTO | null;      // se preenchido = edição
  defaultDate?: string;                 // data clicada no calendário
  categories: CalendarCategoryDTO[];
}
```

Estado interno:
```ts
const [title, setTitle] = useState(event?.title ?? "");
const [date, setDate] = useState(event?.date ?? defaultDate ?? todayISO());
const [allDay, setAllDay] = useState(event?.all_day ?? true);
const [startTime, setStartTime] = useState(event?.start_time ?? "09:00");
const [endTime, setEndTime] = useState(event?.end_time ?? "10:00");
const [categoryId, setCategoryId] = useState(event?.category_id ?? "");
const [frequency, setFrequency] = useState<string>(event?.recurring?.frequency ?? "none");
const [notifMinutes, setNotifMinutes] = useState<number | null>(event?.notification_minutes ?? null);
const [description, setDescription] = useState(event?.description ?? "");
const [submitting, setSubmitting] = useState(false);
```

Ao submeter:
- Se `event` existe: `calendarApi.events.update(event.id, payload)`
- Senão: `calendarApi.events.create(payload)`
- `payload.recurring = frequency !== "none" ? { frequency } : null`
- `payload.all_day = allDay`; se allDay, `start_time = null`, `end_time = null`

UI: modal centrado (mesmo padrão do TransactionModal), renderizado via `createPortal(content, document.body)`.

Campos em ordem: Título, Data, Toggle All-day, (se !allDay: Hora início + Hora fim), Categoria select, Recorrência select (Não repete/Diário/Semanal/Mensal/Anual), Lembrete select (Sem lembrete/15 min/30 min/1 hora/1 dia), Descrição.

Botão deletar (vermelho) se `event` existe (modo edição).

- [ ] **Step 2: Typecheck**

- [ ] **Step 3: Commit** `"feat(web): EventModal component"`

---

### Task 9: CalendarPage

**Files:**
- Create: `apps/web/src/routes/calendar.tsx`

- [ ] **Step 1: Criar `apps/web/src/routes/calendar.tsx`**

Imports necessários:
```ts
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
```

Localizer:
```ts
const localizer = dateFnsLocalizer({
  format, parse, startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay, locales: { "pt-BR": ptBR },
});
```

Estado:
```ts
const [view, setView] = useState<(typeof Views)[keyof typeof Views]>(Views.MONTH);
const [date, setDate] = useState(new Date());
const [events, setEvents] = useState<CalendarEventDTO[]>([]);
const [tasks, setTasks] = useState<TaskDTO[]>([]);
const [categories, setCategories] = useState<CalendarCategoryDTO[]>([]);
const [modalOpen, setModalOpen] = useState(false);
const [editingEvent, setEditingEvent] = useState<CalendarEventDTO | null>(null);
const [defaultDate, setDefaultDate] = useState("");
const [balanceVisible] = useState(true); // não usado aqui mas padrão
```

Carregar dados:
```ts
async function load() {
  const from = format(startOfMonth(subMonths(date, 1)), "yyyy-MM-dd");
  const to = format(endOfMonth(addMonths(date, 1)), "yyyy-MM-dd");
  const [evts, cats, tks] = await Promise.all([
    calendarApi.events.list(from, to),
    calendarApi.categories.list(),
    tasksApi.list(),
  ]);
  setEvents(evts);
  setCategories(cats);
  setTasks(tks.filter(t => t.due_date));
}
```

Converter para formato react-big-calendar:
```ts
const rbcEvents = [
  ...events.map(ev => ({
    id: ev.id,
    title: ev.title,
    start: ev.all_day ? parseISO(`${ev.date}`) : parseISO(`${ev.date}T${ev.start_time}`),
    end: ev.all_day ? parseISO(`${ev.date}`) : parseISO(`${ev.date}T${ev.end_time ?? ev.start_time}`),
    allDay: ev.all_day,
    resource: { type: "event", data: ev, color: categories.find(c => c.id === ev.category_id)?.color ?? "#7C6FCD" },
  })),
  ...tasks.map(t => ({
    id: `task-${t.id}`,
    title: `✓ ${t.title}`,
    start: parseISO(t.due_date!),
    end: parseISO(t.due_date!),
    allDay: true,
    resource: { type: "task", data: t, color: "#6b7280" },
  })),
];
```

Estilização dos eventos por cor:
```ts
const eventStyleGetter = (event) => ({
  style: {
    backgroundColor: event.resource.color,
    borderRadius: "6px",
    border: "none",
    opacity: event.resource.type === "task" ? 0.7 : 1,
  },
});
```

Notificações:
```ts
useEffect(() => {
  if (!("Notification" in window)) return;
  Notification.requestPermission().then(perm => {
    if (perm !== "granted") return;
    navigator.serviceWorker?.ready.then(reg => {
      reg.active?.postMessage({
        type: "SCHEDULE_NOTIFICATIONS",
        events: events.filter(e => e.notification_minutes != null),
      });
    });
  });
}, [events]);
```

JSX principal:
```tsx
<div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
  <div className="mb-6 flex items-center justify-between">
    <h1 className="font-display text-2xl font-bold text-ink dark:text-white">Calendário</h1>
    <button onClick={() => { setEditingEvent(null); setDefaultDate(format(new Date(),"yyyy-MM-dd")); setModalOpen(true); }}
      className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 active:scale-95 flex items-center gap-2">
      <Plus className="h-4 w-4" /> Novo evento
    </button>
  </div>
  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-border-dark dark:bg-card-dark" style={{ height: 600 }}>
    <Calendar
      localizer={localizer}
      events={rbcEvents}
      view={view}
      onView={setView}
      date={date}
      onNavigate={setDate}
      eventPropGetter={eventStyleGetter}
      onSelectEvent={(ev) => {
        if (ev.resource.type === "event") {
          setEditingEvent(ev.resource.data);
          setModalOpen(true);
        }
      }}
      onSelectSlot={(slot) => {
        setEditingEvent(null);
        setDefaultDate(format(slot.start, "yyyy-MM-dd"));
        setModalOpen(true);
      }}
      selectable
      messages={{
        next: "›", previous: "‹", today: "Hoje",
        month: "Mês", week: "Semana", agenda: "Agenda",
        date: "Data", time: "Hora", event: "Evento",
        noEventsInRange: "Nenhum evento neste período.",
        showMore: (total) => `+${total} mais`,
      }}
    />
  </div>
  <EventModal
    open={modalOpen}
    onClose={() => setModalOpen(false)}
    onSaved={() => { setModalOpen(false); load(); }}
    event={editingEvent}
    defaultDate={defaultDate}
    categories={categories}
  />
</div>
```

- [ ] **Step 2: Adicionar estilos escuros para react-big-calendar em `apps/web/src/styles/globals.css`**

```css
/* react-big-calendar dark mode */
.dark .rbc-calendar { color: #e5e7eb; }
.dark .rbc-toolbar button { color: #e5e7eb; background: transparent; border-color: #2E2840; }
.dark .rbc-toolbar button:hover { background: #2E2840; }
.dark .rbc-toolbar button.rbc-active { background: rgba(124,111,205,0.3); color: #a78bfa; }
.dark .rbc-month-view, .dark .rbc-time-view, .dark .rbc-agenda-view { border-color: #2E2840; }
.dark .rbc-header { border-color: #2E2840; background: #201C2E; }
.dark .rbc-day-bg { background: #201C2E; }
.dark .rbc-day-bg.rbc-today { background: rgba(124,111,205,0.15); }
.dark .rbc-off-range-bg { background: #16131F; }
.dark .rbc-date-cell { color: #9ca3af; }
.dark .rbc-date-cell.rbc-now { color: #a78bfa; font-weight: bold; }
.dark .rbc-time-slot { border-color: #2E2840; }
.dark .rbc-timeslot-group { border-color: #2E2840; }
.dark .rbc-agenda-date-cell, .dark .rbc-agenda-time-cell { color: #9ca3af; border-color: #2E2840; }
.dark .rbc-agenda-event-cell { border-color: #2E2840; }
```

- [ ] **Step 3: Typecheck**

- [ ] **Step 4: Commit** `"feat(web): CalendarPage com 3 views, notificações e integração de tarefas"`

---

### Task 10: Atualizar API tasks (due_date)

**Files:**
- Modify: `packages/api/src/routes/tasks.ts`

- [ ] **Step 1: Atualizar schema Zod de criação em `tasks.ts`**

```ts
const createSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().default(""),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});
```

- [ ] **Step 2: Incluir `due_date` no INSERT**

```ts
const { title, description, due_date } = req.body;
// ...
.insert({ id: ulid, user_id: req.user!.id, title, description, due_date: due_date ?? null })
```

- [ ] **Step 3: Atualizar schema de update** para aceitar `due_date` também

- [ ] **Step 4: Typecheck** `pnpm --filter @evobuddy/api typecheck`

- [ ] **Step 5: Commit** `"feat(api): tasks suportam due_date"`
