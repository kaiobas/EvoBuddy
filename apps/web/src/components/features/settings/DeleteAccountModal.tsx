import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading: boolean;
}

export function DeleteAccountModal({ open, onClose, onConfirm, loading }: Props) {
  const [input, setInput] = useState("");

  if (!open) return null;

  async function handleConfirm() {
    if (input !== "excluir") return;
    await onConfirm();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-border-dark dark:bg-card-dark">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <h2 className="font-display text-lg font-bold text-ink dark:text-neutral-100">
              Excluir conta
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 min-h-0 min-w-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          Esta ação é <strong>irreversível</strong>. Todos os seus dados (notas, tarefas, finanças, calendário) serão excluídos permanentemente.
        </p>

        <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Digite <span className="font-mono font-bold text-red-500">excluir</span> para confirmar:
        </p>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="excluir"
          className="mb-4 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100"
        />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 dark:border-border-dark dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={input !== "excluir" || loading}
            className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Excluindo..." : "Excluir conta"}
          </button>
        </div>
      </div>
    </div>
  );
}
