# Tasks Kanban View — Design Spec

**Date:** 2026-06-22  
**Status:** Approved

---

## Objetivo

Adicionar uma visão Kanban à página de Tarefas, alternável com a visão lista existente. Sem mudanças no banco de dados.

---

## Decisões de Design

- **2 colunas:** Pendentes / Concluídas (usa `completed: boolean` existente)
- **Drag and drop:** `@dnd-kit/core` + `@dnd-kit/sortable`
- **Toggle de visualização:** persiste em `localStorage` com chave `tasks_view`
- **Sem novo arquivo:** tudo em `apps/web/src/routes/tasks.tsx`

---

## UI

### Toggle de visualização
- Ícones `List` e `Columns` (Lucide) no header, ao lado do badge de pendentes
- Estilo ativo: `bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300`
- Estilo inativo: `text-neutral-400 hover:text-neutral-600`

### Kanban — Layout
- Desktop: duas colunas side-by-side (`grid grid-cols-2 gap-4`)
- Mobile: colunas empilhadas (`grid grid-cols-1`)
- Cada coluna: header com nome + contador, área de drop com cards

### Kanban — Card
- Visual similar ao item da lista (rounded-2xl, border, shadow-sm)
- Mostra: título, descrição (se houver), botão deletar (hover)
- **Sem checkbox** — mover o card entre colunas é o toggle
- Cursor `grab` ao hover, `grabbing` ao arrastar
- Opacidade reduzida (`opacity-50`) no card sendo arrastado

### Comportamento de drag
- Ao soltar na coluna oposta: chama `tasksApi.toggle(id)` + atualiza estado local imediatamente (optimistic update)
- Ao soltar na mesma coluna: cancela (sem ação)
- `DragOverlay` com preview do card sendo arrastado

### Filtros
- Botões "Todas / Pendentes / Concluídas" visíveis **somente na visão lista**
- No Kanban, as colunas já são o filtro — barra de filtros oculta

### Form de criação
- Presente em ambas as visões (lista e kanban), sempre no topo

---

## Fora do Escopo

- Reordenação dentro da mesma coluna
- Mais de 2 colunas
- Campo `status` no banco
- Drag em mobile touch (funciona via @dnd-kit mas não é garantido testar)
