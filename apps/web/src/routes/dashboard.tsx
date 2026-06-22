import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { notesApi, tasksApi } from "../lib/api";

interface DashboardSummary {
  notesCount: number;
  tasksTotal: number;
  tasksPending: number;
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [notes, tasks] = await Promise.all([
          notesApi.list(),
          tasksApi.list(),
        ]);
        setData({
          notesCount: notes.length,
          tasksTotal: tasks.length,
          tasksPending: tasks.filter((t) => !t.completed).length,
        });
      } catch (err) {
        console.error("Erro ao carregar dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Boas-vindas */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Olá, {user?.email?.split("@")[0] || "bem-vindo"} 👋
        </h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          Aqui está o resumo do seu dia.
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          to="/notes"
          className="rounded-xl border border-neutral-200 bg-white p-6 transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
        >
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            Notas
          </p>
          <p className="mt-1 text-3xl font-bold text-brand-500">
            {data?.notesCount ?? 0}
          </p>
        </Link>

        <Link
          to="/tasks"
          className="rounded-xl border border-neutral-200 bg-white p-6 transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
        >
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            Tarefas
          </p>
          <p className="mt-1 text-3xl font-bold text-brand-500">
            {data?.tasksTotal ?? 0}
          </p>
        </Link>

        <Link
          to="/tasks"
          className="rounded-xl border border-neutral-200 bg-white p-6 transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
        >
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            Pendentes
          </p>
          <p className="mt-1 text-3xl font-bold text-amber-500">
            {data?.tasksPending ?? 0}
          </p>
        </Link>
      </div>

      {/* Ações rápidas */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-neutral-800 dark:text-neutral-200">
          Ações rápidas
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/notes"
            className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            Nova nota
          </Link>
          <Link
            to="/tasks"
            className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Nova tarefa
          </Link>
        </div>
      </div>
    </div>
  );
}
