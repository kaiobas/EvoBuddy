# Calendar Module — Design Spec

**Date:** 2026-06-22  
**Status:** Approved

---

## 1. Objetivo

Módulo de calendário pessoal com agendamentos pontuais, rotinas recorrentes, visualizações mensal/semanal/agenda, notificações locais e integração com tarefas do EvoBuddy.

---

## 2. Arquitetura

- Rota única `/calendar` com toggle interno entre 3 views
- Biblioteca: `react-big-calendar` (Monthly/Weekly/Agenda prontos)
- Notificações: Notification API local + Service Worker
- Integração tarefas: campo `due_date` adicionado à tabela `tasks`

---

## 3. Banco de Dados (Supabase/PostgreSQL)

### `calendar_categories`
```sql
id          TEXT PRIMARY KEY
user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
name        TEXT NOT NULL
color       TEXT NOT NULL DEFAULT '#7C6FCD'
icon        TEXT NOT NULL DEFAULT 'Tag'
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**Defaults criados no primeiro acesso:**
Trabalho (`#3b82f6`), Saúde (`#22c55e`), Pessoal (`#7C6FCD`), Financeiro (`#F4845F`), Outros (`#6b7280`)

### `calendar_events`
```sql
id                   TEXT PRIMARY KEY
user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
title                TEXT NOT NULL
description          TEXT NOT NULL DEFAULT ''
date                 DATE NOT NULL
start_time           TEXT        -- "HH:MM", nullable (all-day se null)
end_time             TEXT        -- "HH:MM", nullable
all_day              BOOLEAN NOT NULL DEFAULT TRUE
category_id          TEXT REFERENCES calendar_categories(id) ON DELETE SET NULL
recurring            JSONB       -- { frequency, days_of_week?, end_date? }
notification_minutes INTEGER     -- minutos antes do evento (null = sem lembrete)
created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**recurring JSONB shape:**
```json
{
  "frequency": "daily" | "weekly" | "monthly" | "yearly",
  "days_of_week": [0, 1, 2, 3, 4, 5, 6],
  "end_date": "YYYY-MM-DD" | null
}
```

### Alteração em `tasks`
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;
```

---

## 4. Rotas API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/calendar/categories` | Listar (seed defaults se vazio) |
| POST | `/api/calendar/categories` | Criar categoria |
| PUT | `/api/calendar/categories/:id` | Atualizar |
| DELETE | `/api/calendar/categories/:id` | Deletar |
| GET | `/api/calendar/events?from=&to=` | Listar eventos no período |
| POST | `/api/calendar/events` | Criar evento |
| PUT | `/api/calendar/events/:id` | Atualizar |
| DELETE | `/api/calendar/events/:id` | Deletar |

**GET /api/calendar/events** expande recorrências no backend para o período solicitado. Ex: um evento semanal retorna múltiplas instâncias dentro do range from/to.

---

## 5. Frontend

### Rota
- `/calendar` — `CalendarPage`

### Sidebar
- Item "Calendário" com ícone `CalendarDays`, sem submenu, abaixo de Tarefas

### Biblioteca
- `react-big-calendar` + `date-fns` (localizer)
- Locale pt-BR para nomes de dias/meses

### Views

**Mensal:**
- Grade mensal com pills coloridos por categoria
- Máximo 3 eventos por dia visíveis, "+N mais" ao ultrapassar
- Tarefas com due_date: pill cinza com ícone `CheckSquare` (read-only)
- Clique no dia abre modal de criação

**Semanal:**
- Grid 7 colunas × horas do dia
- Eventos com horário posicionados na linha de hora correta
- Eventos all-day aparecem na linha superior da coluna
- Tarefas: bloco read-only, não editável pelo calendário

**Agenda:**
- Lista cronológica dos próximos 30 dias
- Agrupada por data com separadores
- Cada item: cor da categoria, título, horário (ou "Dia inteiro"), ícone de lembrete se configurado

### Header da página
```
← [Mês/Semana/Agenda] → | [Mês] [Semana] [Agenda]
```
- Setas de navegação prev/next
- Label do período atual (ex: "Junho 2026")
- Botão "Hoje" para voltar ao período atual
- Toggle de views

### Modal de criação/edição
Campos:
- Título (text, obrigatório)
- Data (date input)
- All-day toggle → se OFF: hora início + hora fim (time inputs)
- Categoria (select com dot colorido)
- Recorrência: Não repete / Diário / Semanal / Mensal / Anual
  - Se Semanal: multi-select dos dias da semana
  - Data de término (opcional)
- Lembrete: Sem lembrete / 15 min / 30 min / 1 hora / 1 dia antes
- Descrição (textarea, opcional)

### DTOs (api.ts)

```ts
interface CalendarCategoryDTO {
  id, user_id, name, color, icon, created_at
}

interface CalendarEventDTO {
  id, user_id, title, description, date, start_time, end_time,
  all_day, category_id, recurring, notification_minutes, created_at
}

interface CreateCalendarEventDTO {
  title, date, description?, start_time?, end_time?, all_day?,
  category_id?, recurring?, notification_minutes?
}
```

---

## 6. Notificações Locais

### Service Worker (`apps/web/public/sw.js`)
- Registrado em `main.tsx`
- Recebe eventos agendados via `postMessage({ type: 'SCHEDULE_NOTIFICATIONS', events: [...] })`
- Armazena agendamentos e dispara `self.registration.showNotification(title, { body, icon })` no momento correto
- Funciona em background no iOS 16.4+ com app instalado

### Fluxo no app
1. Ao montar `CalendarPage`: solicita permissão `Notification.requestPermission()`
2. Busca eventos dos próximos 7 dias
3. Filtra os que têm `notification_minutes` definido
4. Envia para o service worker via `navigator.serviceWorker.controller.postMessage(...)`

### Notificação exibe
- Título: nome do evento
- Body: horário do evento ou "Dia inteiro"
- Icon: `/icon-192.png`

---

## 7. Integração com Tarefas

- Campo `due_date` (DATE, nullable) adicionado à tabela `tasks`
- `TaskDTO` atualizado com `due_date: string | null`
- Na página de Tarefas: campo de data opcional no formulário de criação
- No Calendário: GET de tarefas com `due_date != null` → renderizadas como eventos read-only em cinza

---

## 8. Fora do Escopo (YAGNI)

- Compartilhamento de calendário entre usuários
- Sincronização com Google Calendar / iCal
- Convites e RSVP
- Drag-and-drop para mover eventos entre dias
- Notificações push server-side (VAPID)
- Timezones múltiplos
- Eventos com duração multi-dia

---

## 9. Estrutura de Arquivos

```
apps/web/src/
  routes/
    calendar.tsx                  — CalendarPage
  components/features/calendar/
    EventModal.tsx                — Modal criação/edição
    CalendarHeader.tsx            — Nav + view toggle
  lib/api.ts                      — calendarApi.* (adicionar)

packages/api/src/routes/calendar/
  categories.ts
  events.ts
  index.ts

apps/web/public/
  sw.js                           — Service Worker (atualizar)
```
