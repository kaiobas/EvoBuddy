# Task Timer & Calendar Link — SDD Progress

Plan: docs/superpowers/plans/2026-06-29-task-timer-calendar-link.md
Started: 2026-06-30
BASE commit: 93d9c43

## Status de Execução

- [x] Task 1: Migration do banco de dados — COMPLETA (commit 6aecffe)
- [ ] Task 2: API — Atualizar rotas de tasks
- [ ] Task 3: API — Calendar events: criar e sincronizar tarefa vinculada
- [ ] Task 4: Frontend — Atualizar tipos em api.ts
- [ ] Task 5: Componente TaskTimerBar
- [ ] Task 6: tasks.tsx — formulário com período e timer nos cards
- [ ] Task 7: EventModal — toggle "Adicionar como tarefa"
- [ ] Task 8: Deploy para produção

## PRÓXIMO PASSO OBRIGATÓRIO (antes de continuar)

Aplicar a migration no Supabase Dashboard:
https://supabase.com/dashboard/project/qshydmetfsgfkxwnbuni/sql/new

SQL a executar (arquivo já commitado em packages/api/src/db/migrations/005_task_timer_and_calendar_link.sql):

```sql
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS starts_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS calendar_event_id  TEXT REFERENCES calendar_events(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_calendar_event_id
  ON tasks(calendar_event_id)
  WHERE calendar_event_id IS NOT NULL;
```

## Histórico de Commits

Task 1: complete (commits 93d9c43..6aecffe, review clean)

## Retomada

Após reiniciar, dizer ao Claude:
"Continua o plano task-timer-calendar-link a partir da Task 2.
O progresso está em .superpowers/sdd/progress.md"
