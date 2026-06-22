import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, List, Columns } from "lucide-react";
import { tasksApi, type TaskDTO } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";

function SpringCheckbox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  const [springing, setSpringing] = useState(false);

  function handleClick() {
    if (!checked) setSpringing(true);
    onToggle();
  }

  return (
    <button
      onClick={handleClick}
      onAnimationEnd={() => setSpringing(false)}
      aria-checked={checked}
      role="checkbox"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors min-h-0 min-w-0 ${
        springing ? "animate-checkbox-spring" : ""
      } ${
        checked
          ? "border-transparent bg-brand-500"
          : "border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-800"
      }`}
    >
      {checked && (
        <svg
          viewBox="0 0 12 10"
          className="h-3 w-3"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M1 5l3.5 3.5L11 1"
            className="animate-check-draw"
            strokeDasharray="20"
          />
        </svg>
      )}
    </button>
  );
}

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

type Filter = "all" | "pending" | "done";
type View = "list" | "kanban";

export function TasksPage() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>(
    () => (localStorage.getItem("tasks_view") as View) ?? "list"
  );
  const [activeTask, setActiveTask] = useState<TaskDTO | null>(null);

  function handleViewChange(v: View) {
    setView(v);
    localStorage.setItem("tasks_view", v);
  }

  const loadTasks = useCallback(async () => {
    try {
      const data = await tasksApi.list();
      setTasks(data);
    } catch {
      toast("Erro ao carregar tarefas.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await tasksApi.create({ title: newTitle });
      setNewTitle("");
      toast("Tarefa criada.", "success");
      await loadTasks();
    } catch {
      toast("Erro ao criar tarefa.", "error");
    }
  }

  async function handleToggle(id: string) {
    try {
      await tasksApi.toggle(id);
      await loadTasks();
      toast("Tarefa atualizada.", "success");
    } catch {
      toast("Erro ao atualizar tarefa.", "error");
    }
  }

  async function handleDelete(id: string) {
    setDeletingIds((prev) => new Set(prev).add(id));
    setTimeout(async () => {
      try {
        await tasksApi.remove(id);
        toast("Tarefa removida.", "success");
        await loadTasks();
      } catch {
        toast("Erro ao remover tarefa.", "error");
      }
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 200);
  }

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
    const task = tasks.find((t) => t.id === String(active.id));
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

  const filtered = tasks.filter((t) => {
    if (filter === "pending") return !t.completed;
    if (filter === "done") return t.completed;
    return true;
  });

  const pendingCount = tasks.filter((t) => !t.completed).length;

  const filterLabels: { key: Filter; label: string }[] = [
    { key: "all",     label: "Todas"     },
    { key: "pending", label: "Pendentes" },
    { key: "done",    label: "Concluídas"},
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
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

      {/* Formulário */}
      <form
        onSubmit={handleCreate}
        className="mb-6 flex gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-border-dark dark:bg-card-dark"
      >
        <input
          type="text"
          placeholder="Nova tarefa..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100"
        />
        <button
          type="submit"
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Adicionar</span>
        </button>
      </form>

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
          onDragCancel={() => setActiveTask(null)}
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
        <>
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 py-8">
              {filter === "done"
                ? "Nenhuma tarefa concluída ainda."
                : filter === "pending"
                ? "Nenhuma tarefa pendente."
                : "Nenhuma tarefa ainda. Crie a primeira acima."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((task, i) => (
                <li
                  key={task.id}
                  style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                  className={`group flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm transition-all dark:border-border-dark dark:bg-card-dark ${
                    deletingIds.has(task.id)
                      ? "animate-slide-out"
                      : "animate-card-enter hover:-translate-y-0.5 hover:shadow-md"
                  }`}
                >
                  <SpringCheckbox
                    checked={task.completed}
                    onToggle={() => handleToggle(task.id)}
                  />
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
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="rounded-xl p-1.5 text-neutral-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100 focus:opacity-100 min-h-0 min-w-0 hover:opacity-100"
                    aria-label="Remover tarefa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
