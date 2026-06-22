import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Pause,
  Play,
} from "lucide-react";
import {
  financeApi,
  type RecurringRuleDTO,
  type RecurringFrequency,
  type TransactionType,
  type AccountDTO,
  type CategoryDTO,
} from "../lib/api";
import { useToast } from "../contexts/ToastContext";

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
};

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string): string {
  // dateStr is ISO date string, e.g. "2025-07-01" or "2025-07-01T00:00:00Z"
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function RecurringPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<RecurringRuleDTO[]>([]);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);

  // Form state
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<TransactionType>("expense");
  const [newAmount, setNewAmount] = useState("");
  const [newFrequency, setNewFrequency] = useState<RecurringFrequency>("monthly");
  const [newNextDate, setNewNextDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [newAccountId, setNewAccountId] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const [rulesData, accountsData, categoriesData] = await Promise.all([
        financeApi.recurring.list(),
        financeApi.accounts.list(),
        financeApi.categories.list(),
      ]);
      setRules(rulesData);
      setAccounts(accountsData);
      setCategories(categoriesData);
    } catch {
      toast("Erro ao carregar recorrências.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function resetForm() {
    setNewDescription("");
    setNewType("expense");
    setNewAmount("");
    setNewFrequency("monthly");
    const today = new Date();
    setNewNextDate(today.toISOString().slice(0, 10));
    setNewAccountId("");
    setNewCategoryId("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(newAmount.replace(",", "."));
    if (!parsedAmount || parsedAmount <= 0 || !newNextDate) return;
    setIsCreating(true);
    try {
      const created = await financeApi.recurring.create({
        description: newDescription.trim() || undefined,
        type: newType,
        amount: parsedAmount,
        frequency: newFrequency,
        next_date: newNextDate,
        account_id: newAccountId || undefined,
        category_id: newCategoryId || undefined,
      });
      setNewlyCreatedId(created.id);
      resetForm();
      setShowForm(false);
      toast("Recorrência criada.", "success");
      await loadAll();
      setTimeout(() => setNewlyCreatedId(null), 600);
    } catch {
      toast("Erro ao criar recorrência.", "error");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingIds((prev) => new Set(prev).add(id));
    setTimeout(async () => {
      try {
        await financeApi.recurring.remove(id);
        toast("Recorrência removida.", "success");
        await loadAll();
      } catch {
        toast("Erro ao remover recorrência.", "error");
      }
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 200);
  }

  async function handleToggle(id: string) {
    setTogglingIds((prev) => new Set(prev).add(id));
    try {
      await financeApi.recurring.toggle(id);
      const rule = rules.find((r) => r.id === id);
      toast(
        rule?.active ? "Recorrência pausada." : "Recorrência ativada.",
        "success"
      );
      await loadAll();
    } catch {
      toast("Erro ao atualizar recorrência.", "error");
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const inputClass =
    "rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100 dark:focus:border-brand-500";

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
          Recorrências
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
              Nova recorrência
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
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Description */}
            <input
              type="text"
              placeholder="Descrição (opcional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              autoFocus
              className={inputClass + " sm:col-span-2"}
            />

            {/* Type */}
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as TransactionType)}
              className={inputClass}
            >
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>

            {/* Amount */}
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              required
              className={inputClass}
            />

            {/* Frequency */}
            <select
              value={newFrequency}
              onChange={(e) => setNewFrequency(e.target.value as RecurringFrequency)}
              className={inputClass}
            >
              <option value="daily">Diário</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
              <option value="yearly">Anual</option>
            </select>

            {/* Next date */}
            <input
              type="date"
              value={newNextDate}
              onChange={(e) => setNewNextDate(e.target.value)}
              required
              className={inputClass}
            />

            {/* Account */}
            <select
              value={newAccountId}
              onChange={(e) => setNewAccountId(e.target.value)}
              className={inputClass}
            >
              <option value="">Conta (opcional)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            {/* Category */}
            <select
              value={newCategoryId}
              onChange={(e) => setNewCategoryId(e.target.value)}
              className={inputClass}
            >
              <option value="">Categoria (opcional)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isCreating || !newAmount || !newNextDate}
            className="mt-4 flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Criar recorrência
          </button>
        </form>
      )}

      {/* Empty state */}
      {rules.length === 0 ? (
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
          Nenhuma recorrência cadastrada. Crie a primeira acima.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map((rule, i) => {
            const isDeleting = deletingIds.has(rule.id);
            const isNew = newlyCreatedId === rule.id;
            const isToggling = togglingIds.has(rule.id);
            const isIncome = rule.type === "income";

            return (
              <div
                key={rule.id}
                style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                className={`group relative rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all dark:border-border-dark dark:bg-card-dark ${
                  isDeleting
                    ? "animate-slide-out"
                    : isNew
                    ? "animate-pop-in"
                    : "animate-card-enter hover:-translate-y-0.5 hover:shadow-md"
                } ${!rule.active ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-4">
                  {/* Type icon */}
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                      isIncome
                        ? "bg-green-100 dark:bg-green-900/30"
                        : "bg-red-100 dark:bg-red-900/30"
                    }`}
                  >
                    {isIncome ? (
                      <ArrowDownLeft
                        className="h-5 w-5 text-green-600 dark:text-green-400"
                      />
                    ) : (
                      <ArrowUpRight
                        className="h-5 w-5 text-red-500 dark:text-red-400"
                      />
                    )}
                  </div>

                  {/* Main info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-display text-sm font-bold text-ink dark:text-neutral-100">
                        {rule.description || "(sem descrição)"}
                      </p>
                      {/* Frequency badge */}
                      <span className="rounded-lg bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                        {FREQUENCY_LABELS[rule.frequency] ?? rule.frequency}
                      </span>
                    </div>
                    {/* Next date */}
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      Próximo: {formatDate(rule.next_date)}
                    </p>
                  </div>

                  {/* Amount */}
                  <p
                    className={`flex-shrink-0 text-base font-bold ${
                      isIncome
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-500 dark:text-red-400"
                    }`}
                  >
                    {isIncome ? "+" : "-"}
                    {formatBRL(rule.amount)}
                  </p>

                  {/* Toggle active button */}
                  <button
                    onClick={() => handleToggle(rule.id)}
                    disabled={isToggling}
                    title={rule.active ? "Pausar" : "Ativar"}
                    className="flex-shrink-0 rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 disabled:opacity-40"
                    aria-label={rule.active ? "Pausar recorrência" : "Ativar recorrência"}
                  >
                    {rule.active ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>

                  {/* Delete button (on hover) */}
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="hidden flex-shrink-0 rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-500 group-hover:flex dark:hover:bg-red-900/20"
                    aria-label="Remover recorrência"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
