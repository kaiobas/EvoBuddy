# Tasks Kanban View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar visão Kanban alternável à página de Tarefas, com drag-and-drop entre colunas Pendentes/Concluídas.

**Architecture:** Tudo em `tasks.tsx`. Toggle de view persiste em localStorage. KanbanView usa `@dnd-kit/core` para drag-and-drop; soltar na coluna oposta chama `tasksApi.toggle(id)` com update otimista.

**Tech Stack:** React 19, @dnd-kit/core, @dnd-kit/utilities, TailwindCSS, Lucide React

## Global Constraints

- Nenhuma mudança no banco de dados — usa `completed: boolean` existente
- Apenas um arquivo de rota modificado: `apps/web/src/routes/tasks.tsx`
- Ícones somente de `lucide-react` (`List`, `Columns`)
- Design tokens do CLAUDE.md: `rounded-2xl`, `border-border-dark`, `card-dark`, `brand-500`
- Dark mode: variantes `dark:` em todas as classes
- `localStorage` key: `tasks_view` (valor: `"list"` | `"kanban"`)
- Typecheck: `pnpm --filter @evobuddy/web typecheck` deve passar sem erros

---

### Task 1: Instalar @dnd-kit

**Files:**
- Modify: `apps/web/package.json` (via pnpm)

- [ ] **Step 1: Instalar dependências**

```bash
cd /path/to/repo && pnpm --filter @evobuddy/web add @dnd-kit/core @dnd-kit/utilities
```

Expected: `@dnd-kit/core` e `@dnd-kit/utilities` aparecem em `apps/web/package.json` dependencies.

- [ ] **Step 2: Verificar typecheck**

```bash
pnpm --filter @evobuddy/web typecheck
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): adicionar @dnd-kit/core e @dnd-kit/utilities"
```

---

### Task 2: View toggle + KanbanView

**Files:**
- Modify: `apps/web/src/routes/tasks.tsx`

**Interfaces:**
- Consumes: `TaskDTO`, `tasksApi.toggle`, `tasksApi.remove` — já existem
- Produces: componente `KanbanView` interno e estado `view: "list" | "kanban"`

- [ ] **Step 1: Adicionar imports no topo de tasks.tsx**

Adicionar após os imports existentes:

```tsx
import { List, Columns } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
```

- [ ] **Step 2: Adicionar estado de view e activeId em TasksPage**

Dentro de `TasksPage`, após os estados existentes, adicionar:

```tsx
type View = "list" | "kanban";
const [view, setView] = useState<View>(
  () => (localStorage.getItem("tasks_view") as View) ?? "list"
);
const [activeTask, setActiveTask] = useState<TaskDTO | null>(null);

function handleViewChange(v: View) {
  setView(v);
  localStorage.setItem("tasks_view", v);
}
```

- [ ] **Step 3: Adicionar handlers de drag**

Dentro de `TasksPage`, após `handleDelete`:

```tsx
const sensors = useSensors(useSensor(PointerSensor, {
  activationConstraint: { distance: 8 },
}));

function handleDragStart(event: DragStartEvent) {
  const task = tasks.find((t) => t.id === event.active.id);
  setActiveTask(task ?? null);
}

async function handleDragEnd(event: DragEndEvent) {
  setActiveTask(null);
  const { active, over } = event;
  if (!over) return;
  const task = tasks.find((t) => t.id === active.id);
  if (!task) return;
  const droppedOnPending = over.id === "pending";
  const droppedOnDone = over.id === "done";
  if (droppedOnPending && task.completed) {
    // mover para pendentes = desmarcar
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, completed: false } : t));
    try { await tasksApi.toggle(task.id); await loadTasks(); }
    catch { toast("Erro ao mover tarefa.", "error"); await loadTasks(); }
  } else if (droppedOnDone && !task.completed) {
    // mover para concluídas = marcar
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, completed: true } : t));
    try { await tasksApi.toggle(task.id); await loadTasks(); }
    catch { toast("Erro ao mover tarefa.", "error"); await loadTasks(); }
  }
}
```

- [ ] **Step 4: Criar componentes DraggableCard e DroppableColumn**

Adicionar antes da função `TasksPage` (ou como funções internas — prefira antes para clareza):

```tsx
function DraggableCard({
  task,
  onDelete,
}: {
  task: TaskDTO;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group flex items-start justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all dark:border-border-dark dark:bg-card-dark cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-40" : "hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
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
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
        className="shrink-0 rounded-xl p-1.5 text-neutral-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100 focus:opacity-100 min-h-0 min-w-0"
        aria-label="Remover tarefa"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function DroppableColumn({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-sm font-bold text-ink dark:text-neutral-200">{title}</h2>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          {count}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-32 flex flex-col gap-2 rounded-2xl border-2 border-dashed p-2 transition-colors ${
          isOver
            ? "border-brand-400 bg-brand-50 dark:bg-brand-900/10"
            : "border-neutral-200 dark:border-border-dark"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Adicionar toggle de view no header**

Substituir o header atual em `TasksPage` pelo novo que inclui os botões de toggle:

```tsx
{/* Header */}
<div className="mb-6 flex items-center justify-between">
  <h1 className="font-display text-2xl font-bold text-ink dark:text-neutral-100">
    Tarefas
  </h1>
  <div className="flex items-center gap-2">
    {pendingCount > 0 && (
      <span className="rounded-full bg-peach-50 px-3 py-1 text-xs font-medium text-peach-600 dark:bg-peach-700/20 dark:text-peach-300">
        {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
      </span>
    )}
    <div className="flex rounded-xl border border-neutral-200 dark:border-border-dark overflow-hidden">
      <button
        onClick={() => handleViewChange("list")}
        className={`p-2 transition min-h-0 min-w-0 ${
          view === "list"
            ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
            : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        }`}
        aria-label="Visão lista"
      >
        <List className="h-4 w-4" />
      </button>
      <button
        onClick={() => handleViewChange("kanban")}
        className={`p-2 transition min-h-0 min-w-0 ${
          view === "kanban"
            ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
            : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        }`}
        aria-label="Visão kanban"
      >
        <Columns className="h-4 w-4" />
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 6: Adicionar KanbanView no JSX**

Após os filtros (que ficam condicionais ao view), adicionar o bloco kanban:

```tsx
{/* Filtros — somente na visão lista */}
{view === "list" && (
  <div className="mb-4 flex gap-2">
    {filterLabels.map(({ key, label }) => (
      <button
        key={key}
        onClick={() => setFilter(key)}
        className={`rounded-xl px-4 py-1.5 text-sm font-medium transition min-h-0 min-w-0 ${
          filter === key
            ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
            : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800/60"
        }`}
      >
        {label}
      </button>
    ))}
  </div>
)}

{/* Kanban */}
{view === "kanban" && (
  <DndContext
    sensors={sensors}
    onDragStart={handleDragStart}
    onDragEnd={handleDragEnd}
  >
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <DroppableColumn
        id="pending"
        title="Pendentes"
        count={tasks.filter((t) => !t.completed).length}
      >
        {tasks.filter((t) => !t.completed).map((task) => (
          <DraggableCard key={task.id} task={task} onDelete={handleDelete} />
        ))}
      </DroppableColumn>
      <DroppableColumn
        id="done"
        title="Concluídas"
        count={tasks.filter((t) => t.completed).length}
      >
        {tasks.filter((t) => t.completed).map((task) => (
          <DraggableCard key={task.id} task={task} onDelete={handleDelete} />
        ))}
      </DroppableColumn>
    </div>
    <DragOverlay>
      {activeTask && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-border-dark dark:bg-card-dark opacity-95 rotate-1">
          <p className="text-sm font-medium text-ink dark:text-neutral-200">{activeTask.title}</p>
        </div>
      )}
    </DragOverlay>
  </DndContext>
)}

{/* Lista */}
{view === "list" && (
  /* ...bloco de lista existente... */
)}
```

- [ ] **Step 7: Typecheck**

```bash
pnpm --filter @evobuddy/web typecheck
```

Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/routes/tasks.tsx
git commit -m "feat(web): kanban view com drag-and-drop em tarefas"
```
