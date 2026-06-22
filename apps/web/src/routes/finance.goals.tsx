import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, X, Pause, Play } from "lucide-react";
import {
  financeApi,
  type GoalDTO,
  type GoalType,
  type CategoryDTO,
} from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { GoalProgressBar } from "../components/features/finance/GoalProgressBar";

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  savings: "Poupança",
  spending_limit: "Limite mensal",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export function GoalsPage() {
  const { toast } = useToast();
  const [goals, setGoals] = useState<GoalDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);

  // Form state
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<GoalType>("savings");
  const [newTargetAmount, setNewTargetAmount] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newDeadline, setNewDeadline] = useState("");

  const loadGoals = useCallback(async () => {
    try {
      const data = await financeApi.goals.list();
      setGoals(data);
    } catch {
      toast("Erro ao carregar metas.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadCategories = useCallback(async () => {
    try {
      const data = await financeApi.categories.list();
      setCategories(data);
    } catch {
      // categories are optional context, fail silently
    }
  }, []);

  useEffect(() => {
    loadGoals();
    loadCategories();
  }, [loadGoals, loadCategories]);

  function resetForm() {
    setNewName("");
    setNewType("savings");
    setNewTargetAmount("");
    setNewCategoryId("");
    setNewDeadline("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    if (newType === "spending_limit" && !newCategoryId) {
      toast("Selecione uma categoria para o limite de gasto.", "error");
      return;
    }
    setIsCreating(true);
    try {
      const created = await financeApi.goals.create({
        name: newName.trim(),
        type: newType,
        target_amount: parseFloat(newTargetAmount.replace(",", ".")) || 0,
        ...(newCategoryId ? { category_id: newCategoryId } : {}),
        ...(newType === "savings" && newDeadline ? { deadline: newDeadline } : {}),
        active: true,
      });
      setNewlyCreatedId(created.id);
      resetForm();
      setShowForm(false);
      toast("Meta criada.", "success");
      await loadGoals();
      setTimeout(() => setNewlyCreatedId(null), 600);
    } catch {
      toast("Erro ao criar meta.", "error");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingIds((prev) => new Set(prev).add(id));
    setTimeout(async () => {
      try {
        await financeApi.goals.remove(id);
        toast("Meta removida.", "success");
        await loadGoals();
      } catch {
        toast("Erro ao remover meta.", "error");
      }
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 200);
  }

  async function handleToggleActive(goal: GoalDTO) {
    try {
      await financeApi.goals.update(goal.id, { active: !goal.active });
      toast(
        goal.active ? "Meta pausada." : "Meta reativada.",
        "success"
      );
      await loadGoals();
    } catch {
      toast("Erro ao atualizar meta.", "error");
    }
  }

  function getCategoryName(id: string | null): string | null {
    if (!id) return null;
    const cat = categories.find((c) => c.id === id);
    return cat ? cat.name : null;
  }

  const savingsGoals = goals.filter((g) => g.type === "savings");
  const spendingGoals = goals.filter((g) => g.type === "spending_limit");

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
          Metas
        </h1>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            if (!showForm) resetForm();
          }}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 active:scale-95"
        >
          {showForm ? (
            <>
              <X className="h-4 w-4" />
              Cancelar
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Nova meta
            </>
          )}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-border-dark dark:bg-card-dark"
        >
          <div className="mb-3 flex flex-col gap-3 sm:flex-row">
            {/* Name */}
            <input
              type="text"
              placeholder="Nome da meta"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              autoFocus
              className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100 dark:focus:border-brand-500"
            />
            {/* Type */}
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as GoalType)}
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100 dark:focus:border-brand-500"
            >
              <option value="savings">Poupança</option>
              <option value="spending_limit">Limite de gasto</option>
            </select>
            {/* Target amount */}
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={newTargetAmount}
              onChange={(e) => setNewTargetAmount(e.target.value)}
              required
              className="w-40 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100 dark:focus:border-brand-500"
            />
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            {/* Category */}
            <select
              value={newCategoryId}
              onChange={(e) => setNewCategoryId(e.target.value)}
              required={newType === "spending_limit"}
              className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100 dark:focus:border-brand-500"
            >
              <option value="">
                {newType === "spending_limit"
                  ? "Selecione uma categoria *"
                  : "Categoria (opcional)"}
              </option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            {/* Deadline — only for savings */}
            {newType === "savings" && (
              <input
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100 dark:focus:border-brand-500"
                placeholder="Prazo (opcional)"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={isCreating || !newName.trim()}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Criar meta
          </button>
        </form>
      )}

      {/* Empty state */}
      {goals.length === 0 ? (
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
          Nenhuma meta cadastrada. Crie a primeira acima.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Savings section */}
          {savingsGoals.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-bold text-ink dark:text-neutral-100">
                Poupança
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {savingsGoals.map((goal, i) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    index={i}
                    deletingIds={deletingIds}
                    newlyCreatedId={newlyCreatedId}
                    categoryName={getCategoryName(goal.category_id)}
                    onDelete={handleDelete}
                    onToggleActive={handleToggleActive}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Spending limit section */}
          {spendingGoals.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-bold text-ink dark:text-neutral-100">
                Limites de gasto
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {spendingGoals.map((goal, i) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    index={i}
                    deletingIds={deletingIds}
                    newlyCreatedId={newlyCreatedId}
                    categoryName={getCategoryName(goal.category_id)}
                    onDelete={handleDelete}
                    onToggleActive={handleToggleActive}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ─── GoalCard sub-component ───────────────────────────────────

interface GoalCardProps {
  goal: GoalDTO;
  index: number;
  deletingIds: Set<string>;
  newlyCreatedId: string | null;
  categoryName: string | null;
  onDelete: (id: string) => void;
  onToggleActive: (goal: GoalDTO) => void;
}

function GoalCard({
  goal,
  index,
  deletingIds,
  newlyCreatedId,
  categoryName,
  onDelete,
  onToggleActive,
}: GoalCardProps) {
  const isDeleting = deletingIds.has(goal.id);
  const isNew = newlyCreatedId === goal.id;
  const isSpendingLimit = goal.type === "spending_limit";

  return (
    <div
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
      className={`group relative rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-all dark:border-border-dark dark:bg-card-dark ${
        !goal.active ? "opacity-60" : ""
      } ${
        isDeleting
          ? "animate-slide-out"
          : isNew
          ? "animate-pop-in"
          : "animate-card-enter hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      {/* Action buttons */}
      <div className="absolute right-3 top-3 hidden items-center gap-1 group-hover:flex">
        {/* Toggle active */}
        <button
          onClick={() => onToggleActive(goal)}
          className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
          aria-label={goal.active ? "Pausar meta" : "Reativar meta"}
        >
          {goal.active ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>
        {/* Delete */}
        <button
          onClick={() => onDelete(goal.id)}
          className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
          aria-label="Remover meta"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Name */}
      <p className="mb-2 pr-16 font-display text-base font-bold text-ink dark:text-neutral-100">
        {goal.name}
      </p>

      {/* Type badge */}
      <span
        className={`mb-3 inline-block rounded-lg px-2.5 py-1 text-xs font-medium ${
          isSpendingLimit
            ? "bg-peach-50 text-peach-500"
            : "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
        }`}
      >
        {GOAL_TYPE_LABELS[goal.type]}
      </span>

      {/* Deadline (savings only) */}
      {goal.type === "savings" && goal.deadline && (
        <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
          Prazo: {formatDate(goal.deadline)}
        </p>
      )}

      {/* Category (spending_limit) */}
      {goal.type === "spending_limit" && categoryName && (
        <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
          Categoria: {categoryName}
        </p>
      )}

      {/* Progress bar */}
      <GoalProgressBar current={goal.current_amount} target={goal.target_amount} />
    </div>
  );
}
