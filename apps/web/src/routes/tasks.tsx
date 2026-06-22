import { useEffect, useState, useCallback } from "react";
import { tasksApi, type TaskDTO } from "../lib/api";

export function TasksPage() {
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

  const loadTasks = useCallback(async () => {
    try {
      const data = await tasksApi.list();
      setTasks(data);
    } catch (err) {
      console.error("Erro ao carregar tarefas:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await tasksApi.create({ title: newTitle });
      setNewTitle("");
      await loadTasks();
    } catch (err) {
      console.error("Erro ao criar tarefa:", err);
    }
  }

  async function handleToggle(id: string) {
    try {
      await tasksApi.toggle(id);
      await loadTasks();
    } catch (err) {
      console.error("Erro ao alternar tarefa:", err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await tasksApi.remove(id);
      await loadTasks();
    } catch (err) {
      console.error("Erro ao deletar tarefa:", err);
    }
  }

  const filteredTasks = tasks.filter((t) => {
    if (filter === "pending") return !t.completed;
    if (filter === "done") return t.completed;
    return true;
  });

  const pendingCount = tasks.filter((t) => !t.completed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Tarefas
        </h1>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Formulário de criação */}
      <form onSubmit={handleCreate} className="mt-6 flex gap-2">
        <input
          type="text"
          placeholder="Nova tarefa..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="flex-1 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-neutral-700 dark:bg-neutral-800"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          Adicionar
        </button>
      </form>

      {/* Filtros */}
      <div className="mt-4 flex gap-2">
        {(["all", "pending", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === f
                ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            {f === "all" ? "Todas" : f === "pending" ? "Pendentes" : "Concluídas"}
          </button>
        ))}
      </div>

      {/* Lista de tarefas */}
      {filteredTasks.length === 0 ? (
        <div className="mt-8 text-center text-neutral-500 dark:text-neutral-400">
          {tasks.length === 0
            ? "Nenhuma tarefa ainda. Adicione a primeira acima!"
            : "Nenhuma tarefa nesse filtro."}
        </div>
      ) : (
        <div className="mt-4 space-y-1">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 transition hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
            >
              {/* Checkbox */}
              <button
                onClick={() => handleToggle(task.id)}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                  task.completed
                    ? "border-green-500 bg-green-500 text-white"
                    : "border-neutral-400 hover:border-brand-500 dark:border-neutral-600"
                }`}
                aria-label={task.completed ? "Desmarcar" : "Concluir"}
              >
                {task.completed && (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>

              {/* Conteúdo */}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm ${
                    task.completed
                      ? "text-neutral-400 line-through dark:text-neutral-500"
                      : "text-neutral-900 dark:text-neutral-100"
                  }`}
                >
                  {task.title}
                </p>
                {task.description && (
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-500">
                    {task.description}
                  </p>
                )}
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(task.id)}
                className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                aria-label="Deletar"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
