import { useEffect, useState, useCallback } from "react";
import { Building2, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import {
  financeApi,
  type TransactionDTO,
  type TransactionType,
  type CategoryDTO,
} from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { TransactionModal } from "../components/features/finance/TransactionModal";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateSeparator(dateISO: string): string {
  // dateISO: "YYYY-MM-DD"
  const [year, month, day] = dateISO.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getMonthBounds(year: number, month: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

function monthLabel(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

// Group transactions by date string (YYYY-MM-DD)
function groupByDate(transactions: TransactionDTO[]): [string, TransactionDTO[]][] {
  const map = new Map<string, TransactionDTO[]>();
  for (const tx of transactions) {
    const day = tx.date.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(tx);
  }
  // Sort dates descending
  return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
}

// ─── Component ───────────────────────────────────────────────────────────────

type TypeFilter = "all" | TransactionType;

export function TransactionsPage() {
  const { toast } = useToast();

  // Filter state
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  // Data
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Category lookup map
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getMonthBounds(filterYear, filterMonth);
      const params: Parameters<typeof financeApi.transactions.list>[0] = { from, to };
      if (typeFilter !== "all") params.type = typeFilter;
      const data = await financeApi.transactions.list(params);
      // Sort by date descending, then created_at descending
      data.sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return b.created_at.localeCompare(a.created_at);
      });
      setTransactions(data);
    } catch {
      toast("Erro ao carregar transações.", "error");
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterMonth, typeFilter, toast]);

  // Load categories once on mount
  useEffect(() => {
    financeApi.categories
      .list()
      .then(setCategories)
      .catch(() => {/* silently ignore */});
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Month navigation
  function prevMonth() {
    if (filterMonth === 1) {
      setFilterMonth(12);
      setFilterYear((y) => y - 1);
    } else {
      setFilterMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (filterMonth === 12) {
      setFilterMonth(1);
      setFilterYear((y) => y + 1);
    } else {
      setFilterMonth((m) => m + 1);
    }
  }

  async function handleDelete(id: string) {
    setDeletingIds((prev) => new Set(prev).add(id));
    setTimeout(async () => {
      try {
        await financeApi.transactions.remove(id);
        toast("Transação removida.", "success");
        await loadTransactions();
      } catch {
        toast("Erro ao remover transação.", "error");
      }
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 200);
  }

  const grouped = groupByDate(transactions);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink dark:text-neutral-100">
          Transações
        </h1>
      </div>

      {/* Filter bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Type filter */}
        <div className="flex rounded-xl border border-neutral-200 bg-white p-1 dark:border-border-dark dark:bg-card-dark">
          {(
            [
              { value: "all", label: "Todos" },
              { value: "income", label: "Entradas" },
              { value: "expense", label: "Saídas" },
            ] as { value: TypeFilter; label: string }[]
          ).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTypeFilter(value)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                typeFilter === value
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            aria-label="Mês anterior"
            className="rounded-lg border border-neutral-200 bg-white p-1.5 text-neutral-500 transition hover:bg-neutral-50 dark:border-border-dark dark:bg-card-dark dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[10rem] text-center text-sm font-medium capitalize text-ink dark:text-neutral-100">
            {monthLabel(filterYear, filterMonth)}
          </span>
          <button
            onClick={nextMonth}
            aria-label="Próximo mês"
            className="rounded-lg border border-neutral-200 bg-white p-1.5 text-neutral-500 transition hover:bg-neutral-50 dark:border-border-dark dark:bg-card-dark dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Nenhuma transação encontrada.
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            Use o botão + para registrar uma nova transação.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {grouped.map(([day, dayTransactions], groupIdx) => (
            <div key={day}>
              {/* Date separator */}
              <p
                className="text-xs font-semibold uppercase tracking-wider text-neutral-400 py-2"
                style={{ animationDelay: `${Math.min(groupIdx, 8) * 30}ms` }}
              >
                {formatDateSeparator(day)}
              </p>

              {/* Transactions for this day */}
              <div className="flex flex-col gap-1">
                {dayTransactions.map((tx, i) => {
                  const category = tx.category_id ? categoryMap.get(tx.category_id) : null;
                  const dotColor = category?.color ?? "#6b7280";
                  const isDeleting = deletingIds.has(tx.id);

                  return (
                    <div
                      key={tx.id}
                      style={{
                        animationDelay: `${Math.min(groupIdx * 3 + i, 12) * 40}ms`,
                      }}
                      className={`group flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm transition-all dark:border-border-dark dark:bg-card-dark ${
                        isDeleting
                          ? "animate-slide-out"
                          : "animate-card-enter hover:-translate-y-0.5 hover:shadow-md"
                      }`}
                    >
                      {/* Colored dot */}
                      <span
                        className="h-3 w-3 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: dotColor }}
                      />

                      {/* Description */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {tx.source === 'pluggy' && (
                          <Building2 className="h-3 w-3 flex-shrink-0 text-brand-400" />
                        )}
                        <p className="truncate text-sm font-medium text-ink dark:text-neutral-100">
                          {tx.description?.trim() || "(sem descrição)"}
                        </p>
                      </div>

                      {/* Category name */}
                      <p className="hidden w-36 shrink-0 truncate text-center text-xs text-neutral-400 dark:text-neutral-500 sm:block">
                        {category?.name ?? "(sem categoria)"}
                      </p>

                      {/* Amount */}
                      <p
                        className={`w-28 shrink-0 text-right text-sm font-semibold ${
                          tx.type === "income"
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-500 dark:text-red-400"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {formatBRL(tx.amount)}
                      </p>

                      {/* Delete button */}
                      {tx.source !== 'pluggy' && (
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="hidden rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-500 group-hover:flex dark:hover:bg-red-900/20"
                          aria-label="Remover transação"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating action button — TransactionModal */}
      <TransactionModal onCreated={loadTransactions} />
    </div>
  );
}
