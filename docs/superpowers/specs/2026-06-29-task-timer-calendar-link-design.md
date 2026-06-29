# Task Timer & Calendar Link — Design Spec

**Data:** 2026-06-29
**Status:** Aprovado

---

## Visão Geral

Duas melhorias interligadas:

1. **Timer de tarefa** — cada tarefa pode ter um período definido (`starts_at` + `ends_at`), exibido como barra de progresso no card.
2. **Calendário → Tarefa** — ao criar um evento no calendário, o usuário pode optar por vincular esse evento a uma tarefa. A tarefa fica linkada: edições e deleções do evento propagam para a tarefa.

---

## 1. Banco de Dados

**Migration:** `packages/api/src/db/migrations/005_task_timer_and_calendar_link.sql`

```sql
ALTER TABLE tasks
  ADD COLUMN starts_at         TIMESTAMPTZ,
  ADD COLUMN ends_at           TIMESTAMPTZ,
  ADD COLUMN calendar_event_id TEXT REFERENCES calendar_events(id) ON DELETE CASCADE;

CREATE INDEX idx_tasks_calendar_event_id ON tasks(calendar_event_id)
  WHERE calendar_event_id IS NOT NULL;
```

- `starts_at` / `ends_at` — nullable; quando ambos preenchidos, ativam o timer
- `calendar_event_id` — FK com CASCADE: deletar o evento deleta a tarefa vinculada
- `due_date` — mantido; preenchido automaticamente com `ends_at::DATE` quando o timer é definido

---

## 2. API

### 2a. `packages/api/src/routes/tasks.ts`

**createSchema e updateSchema:** adicionar campos:
```
starts_at: z.string().datetime().nullable().optional()
ends_at:   z.string().datetime().nullable().optional()
```

**POST /api/tasks:** quando `ends_at` fornecido, preencher `due_date = ends_at.slice(0, 10)` automaticamente.

**PUT /api/tasks/:id:** idem — se `ends_at` atualizado, atualizar `due_date` também.

### 2b. `packages/api/src/routes/calendar/events.ts`

**createSchema:** adicionar `create_task: z.boolean().optional()`.

**POST /api/calendar/events:**
- Após inserir o evento, se `create_task: true`:
  - Se evento tem horário (`!all_day` e `start_time` + `end_time` presentes): criar tarefa com `starts_at = date + 'T' + start_time`, `ends_at = date + 'T' + end_time`, `due_date = date`, `calendar_event_id = event.id`, `title = event.title`
  - Se `all_day`: criar tarefa com `due_date = date`, `calendar_event_id = event.id`, `title = event.title` (sem timer)

**PUT /api/calendar/events/:id:**
- Após atualizar o evento, buscar tarefa com `calendar_event_id = event.id`
- Se existir: atualizar `title`, `starts_at`, `ends_at` e `due_date` para refletir os novos dados do evento

**DELETE /api/calendar/events/:id:**
- O CASCADE no banco deleta automaticamente a tarefa vinculada — nenhuma ação extra necessária na rota

---

## 3. Frontend

### 3a. `apps/web/src/lib/api.ts`

```ts
// TaskDTO
starts_at: string | null
ends_at:   string | null
calendar_event_id: string | null

// CreateTaskDTO
starts_at?: string
ends_at?:   string

// UpdateTaskDTO
starts_at?: string | null
ends_at?:   string | null

// CreateCalendarEventDTO (nova interface, usada pelo EventModal)
create_task?: boolean
```

### 3b. `apps/web/src/routes/tasks.tsx`

**Formulário de criação:** seção colapsável "Definir período" abaixo do título. Quando expandida, exibe dois campos `datetime-local`: início e fim. Opcional — tarefa pode ser criada sem timer.

**Cards (lista e kanban):** renderizar `<TaskTimerBar>` quando `starts_at` e `ends_at` existem e tarefa não está concluída.

### 3c. Componente `TaskTimerBar`

**Local:** `apps/web/src/components/features/tasks/TaskTimerBar.tsx`

**Props:** `{ startsAt: string; endsAt: string }`

**Lógica:** `useEffect` + `setInterval` a cada 30s para recalcular.

**Estados visuais:**

| Estado | Condição | Visual |
|--------|----------|--------|
| Futuro | `now < starts_at` | Texto cinza "Inicia às HH:MM" |
| Ativo | `starts_at ≤ now ≤ ends_at` | Barra `brand-500` (vira `peach-500` quando < 25% restante) + "Xh Ymin restantes" |
| Expirado | `now > ends_at` | Barra vermelha cheia + "Prazo encerrado" |

Barra mostra o percentual do período já decorrido (não o restante), crescendo da esquerda para a direita.

### 3d. `apps/web/src/components/features/calendar/EventModal.tsx`

**Toggle "Adicionar como tarefa":**
- Aparece somente em criação de evento novo (não em edição)
- Estilo igual ao toggle "Dia inteiro" já existente
- Por padrão: `true` quando `!allDay`, `false` quando `allDay`
- Enviado como `create_task` no payload do POST

---

## Limitações Conhecidas

- **Timezone:** o calendário armazena `date` e `start_time` como strings sem offset. Ao montar `starts_at`/`ends_at` no backend, a combinação `date + 'T' + start_time` será tratada como UTC pelo Supabase. Para usuários em UTC-3, o timer pode estar 3h adiantado. A solução correta exige passar o offset do cliente — fica como dívida técnica.
- O frontend (`datetime-local`) no formulário de tarefas envia tempo local; o backend armazena como UTC. Mesmo imprecisão de timezone.

## Fora do Escopo

- Notificações / push quando o timer expira
- Edição da tarefa vinculada a partir do modal do calendário
- Exibição do timer no kanban (cards menores — pode ser adicionado depois)
