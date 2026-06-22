import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  financeApi,
  type TransactionType,
  type CategoryDTO,
  type AccountDTO,
} from "../../../lib/api";
import { useToast } from "../../../contexts/ToastContext";

interface TransactionModalProps {
  onCreated?: () => void;
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function TransactionModal({ onCreated }: TransactionModalProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Options
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);

  // Form fields
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");

  // Load options on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      financeApi.categories.list(),
      financeApi.accounts.list(),
    ]).then(([cats, accs]) => {
      if (!cancelled) {
        setCategories(cats);
        setAccounts(accs);
      }
    }).catch(() => {
      // silently ignore — user will see empty selects
    });
    return () => { cancelled = true; };
  }, []);

  // Filter categories by selected type
  const filteredCategories = categories.filter(
    (c) => c.type === null || c.type === type
  );

  function resetForm() {
    setType("expense");
    setAmount("");
    setCategoryId("");
    setAccountId("");
    setDate(todayISO());
    setDescription("");
  }

  function handleOpen() {
    resetForm();
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (!parsedAmount || parsedAmount <= 0) {
      toast("Informe um valor válido.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await financeApi.transactions.create({
        type,
        amount: parsedAmount,
        date: date || undefined,
        description: description.trim() || undefined,
        category_id: categoryId || undefined,
        account_id: accountId || undefined,
      });
      toast("Transação salva.", "success");
      onCreated?.();
      handleClose();
    } catch {
      toast("Erro ao salvar transação.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-neutral-800 dark:text-white";

  return (
    <>
      {/* Floating action button */}
      <button
        onClick={open ? handleClose : handleOpen}
        aria-label={open ? "Fechar modal de transação" : "Nova transação"}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 shadow-lg transition-all hover:bg-brand-600 active:scale-95"
      >
        {open ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <Plus className="h-6 w-6 text-white" />
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Modal panel */}
      {open && (
        <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl dark:bg-card-dark">
          <h2 className="mb-5 font-display text-lg font-bold text-ink dark:text-white">
            Nova Transação
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Type toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setType("income");
                  setCategoryId("");
                }}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition active:scale-95 ${
                  type === "income"
                    ? "border-green-500 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-900/20 dark:text-green-400"
                    : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-green-300 hover:bg-green-50 dark:border-border-dark dark:bg-neutral-800 dark:text-neutral-400"
                }`}
              >
                Entrada
              </button>
              <button
                type="button"
                onClick={() => {
                  setType("expense");
                  setCategoryId("");
                }}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition active:scale-95 ${
                  type === "expense"
                    ? "border-red-500 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-900/20 dark:text-red-400"
                    : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-red-300 hover:bg-red-50 dark:border-border-dark dark:bg-neutral-800 dark:text-neutral-400"
                }`}
              >
                Saída
              </button>
            </div>

            {/* Amount */}
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className={inputClass}
              aria-label="Valor"
            />

            {/* Category */}
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
              aria-label="Categoria"
            >
              <option value="">Sem categoria</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Account */}
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={inputClass}
              aria-label="Conta"
            >
              <option value="">Sem conta</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            {/* Date */}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={inputClass}
              aria-label="Data"
            />

            {/* Description */}
            <input
              type="text"
              placeholder="Descrição (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              aria-label="Descrição"
            />

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-60 w-full"
            >
              {submitting ? "Salvando..." : "Salvar transação"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
