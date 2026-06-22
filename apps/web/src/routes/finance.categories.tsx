import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  financeApi,
  type CategoryDTO,
  type TransactionType,
} from "../lib/api";
import { useToast } from "../contexts/ToastContext";

const PRESET_COLORS = [
  "#7C6FCD",
  "#F4845F",
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#6b7280",
];

export function CategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);

  // Form state
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<TransactionType>("expense");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newIcon, setNewIcon] = useState("");

  const loadCategories = useCallback(async () => {
    try {
      const data = await financeApi.categories.list();
      setCategories(data);
    } catch {
      toast("Erro ao carregar categorias.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  function resetForm() {
    setNewName("");
    setNewType("expense");
    setNewColor(PRESET_COLORS[0]);
    setNewIcon("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      const created = await financeApi.categories.create({
        name: newName.trim(),
        type: newType,
        color: newColor,
        icon: newIcon.trim() || undefined,
      });
      setNewlyCreatedId(created.id);
      resetForm();
      setShowForm(false);
      toast("Categoria criada.", "success");
      await loadCategories();
      setTimeout(() => setNewlyCreatedId(null), 600);
    } catch {
      toast("Erro ao criar categoria.", "error");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingIds((prev) => new Set(prev).add(id));
    setTimeout(async () => {
      try {
        await financeApi.categories.remove(id);
        toast("Categoria removida.", "success");
        await loadCategories();
      } catch {
        toast("Erro ao remover categoria.", "error");
      }
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 200);
  }

  const income = categories.filter((c) => c.type === "income");
  const expense = categories.filter((c) => c.type === "expense");
  const untyped = categories.filter((c) => c.type === null);

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
          Categorias
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
              Nova categoria
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
              placeholder="Nome da categoria"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              autoFocus
              className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100 dark:focus:border-brand-500"
            />
            {/* Type */}
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as TransactionType)}
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100 dark:focus:border-brand-500"
            >
              <option value="income">Entrada</option>
              <option value="expense">Saída</option>
            </select>
            {/* Icon */}
            <input
              type="text"
              placeholder="Tag"
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              className="w-32 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100 dark:focus:border-brand-500"
            />
          </div>

          {/* Color swatches */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Cor:
            </span>
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setNewColor(color)}
                style={{ backgroundColor: color }}
                className={`h-7 w-7 rounded-full transition-transform hover:scale-110 focus:outline-none ${
                  newColor === color
                    ? "scale-110 ring-2 ring-neutral-400 ring-offset-2 dark:ring-offset-card-dark"
                    : ""
                }`}
                aria-label={`Cor ${color}`}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={isCreating || !newName.trim()}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Criar categoria
          </button>
        </form>
      )}

      {/* Empty state */}
      {categories.length === 0 ? (
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
          Nenhuma categoria cadastrada. Crie a primeira acima.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Income section */}
          {income.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Entradas
              </h2>
              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-border-dark dark:bg-card-dark">
                {income.map((cat, i) => (
                  <CategoryRow
                    key={cat.id}
                    category={cat}
                    index={i}
                    isDeleting={deletingIds.has(cat.id)}
                    isNew={newlyCreatedId === cat.id}
                    onDelete={handleDelete}
                    isLast={i === income.length - 1}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Expense section */}
          {expense.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Saídas
              </h2>
              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-border-dark dark:bg-card-dark">
                {expense.map((cat, i) => (
                  <CategoryRow
                    key={cat.id}
                    category={cat}
                    index={i}
                    isDeleting={deletingIds.has(cat.id)}
                    isNew={newlyCreatedId === cat.id}
                    onDelete={handleDelete}
                    isLast={i === expense.length - 1}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Untyped section */}
          {untyped.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Outras
              </h2>
              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-border-dark dark:bg-card-dark">
                {untyped.map((cat, i) => (
                  <CategoryRow
                    key={cat.id}
                    category={cat}
                    index={i}
                    isDeleting={deletingIds.has(cat.id)}
                    isNew={newlyCreatedId === cat.id}
                    onDelete={handleDelete}
                    isLast={i === untyped.length - 1}
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

interface CategoryRowProps {
  category: CategoryDTO;
  index: number;
  isDeleting: boolean;
  isNew: boolean;
  onDelete: (id: string) => void;
  isLast: boolean;
}

function CategoryRow({
  category,
  index,
  isDeleting,
  isNew,
  onDelete,
  isLast,
}: CategoryRowProps) {
  return (
    <div
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
      className={`group relative flex items-center gap-3 px-4 py-3 ${
        !isLast
          ? "border-b border-neutral-100 dark:border-border-dark"
          : ""
      } ${
        isDeleting
          ? "animate-slide-out"
          : isNew
          ? "animate-pop-in"
          : "animate-card-enter"
      }`}
    >
      {/* Color dot */}
      <span
        className="h-3 w-3 flex-shrink-0 rounded-full"
        style={{ backgroundColor: category.color || "#7C6FCD" }}
      />

      {/* Name */}
      <span className="flex-1 truncate text-sm font-medium text-ink dark:text-neutral-100">
        {category.name}
      </span>

      {/* Badges */}
      <div className="flex items-center gap-1.5">
        {category.type === "income" && (
          <span className="rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
            Entrada
          </span>
        )}
        {category.type === "expense" && (
          <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
            Saída
          </span>
        )}
        {category.is_default && (
          <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            padrão
          </span>
        )}
      </div>

      {/* Delete button */}
      <button
        onClick={() => onDelete(category.id)}
        className="hidden rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-500 group-hover:flex dark:hover:bg-red-900/20"
        aria-label="Remover categoria"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
