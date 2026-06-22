import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, CheckSquare, Clock } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { notesApi, tasksApi } from "../lib/api";

interface DashboardSummary {
  notesCount: number;
  tasksTotal: number;
  tasksPending: number;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

const DAILY_MESSAGES = [
  "Pequenos passos consistentes constroem grandes resultados.",
  "O que você faz hoje define quem você será amanhã.",
  "Foco no que depende de você. O resto é ruído.",
  "Uma tarefa por vez. Progresso real é simples assim.",
  "Organize sua mente antes de organizar o dia.",
  "Clareza primeiro, velocidade depois.",
  "Cada anotação é um pensamento que não vai se perder.",
  "Disciplina é liberdade disfarçada.",
  "Menos perfeição, mais constância.",
  "O dia começa bem quando você sabe o que importa.",
  "Feito é melhor que perfeito.",
  "Priorize. Não dá pra fazer tudo — e tudo bem.",
  "Uma boa ideia anotada vale mais que dez esquecidas.",
  "Seu futuro eu vai agradecer pelo que você faz agora.",
  "Progresso, não perfeição.",
  "Comece. O resto vem com o movimento.",
  "O segredo da produtividade é saber o que não fazer.",
  "Cada tarefa concluída é uma promessa cumprida.",
  "Mente organizada, vida organizada.",
  "Hoje é uma boa oportunidade para avançar um passo.",
];

function getDailyMessage() {
  const day = Math.floor(Date.now() / 86_400_000);
  return DAILY_MESSAGES[day % DAILY_MESSAGES.length];
}

const cards = (data: DashboardSummary) => [
  {
    to: "/notes",
    label: "Notas",
    value: data.notesCount,
    icon: FileText,
    valueClass: "text-brand-500",
  },
  {
    to: "/tasks",
    label: "Tarefas",
    value: data.tasksTotal,
    icon: CheckSquare,
    valueClass: "text-brand-500",
  },
  {
    to: "/tasks",
    label: "Pendentes",
    value: data.tasksPending,
    icon: Clock,
    valueClass: "text-peach-500",
  },
];

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

  const summary = data ?? { notesCount: 0, tasksTotal: 0, tasksPending: 0 };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-brand-500">
          {getGreeting()}, {user?.email?.split("@")[0] ?? "bem-vindo"} 👋
        </p>
        <h1 className="font-display text-2xl font-bold text-ink dark:text-neutral-100">
          {getDailyMessage()}
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Aqui está o resumo do seu dia.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards(summary).map((card, i) => (
          <Link
            key={card.label}
            to={card.to}
            style={{ animationDelay: `${i * 50}ms` }}
            className="animate-card-enter group flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-border-dark dark:bg-card-dark"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {card.label}
              </p>
              <card.icon className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
            </div>
            <p className={`text-3xl font-bold ${card.valueClass}`}>
              {card.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-neutral-800 dark:text-neutral-200">
          Ações rápidas
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/notes"
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 active:scale-95"
          >
            Nova nota
          </Link>
          <Link
            to="/tasks"
            className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Nova tarefa
          </Link>
        </div>
      </div>
    </div>
  );
}
