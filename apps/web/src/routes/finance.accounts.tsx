import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, X, Building2, Unlink, Wifi } from "lucide-react";
import { financeApi, pluggyApi, type AccountDTO, type AccountType, type PluggyConnectionDTO } from "../lib/api";
import { useToast } from "../contexts/ToastContext";

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Dinheiro",
  credit: "Cartão de crédito",
};

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

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AccountsPage() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);
  const [connections, setConnections] = useState<PluggyConnectionDTO[]>([]);
  const [connectingBank, setConnectingBank] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // Form state
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<AccountType>("checking");
  const [newBalance, setNewBalance] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await financeApi.accounts.list();
      setAccounts(data);
    } catch {
      toast("Erro ao carregar contas.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadConnections = useCallback(async () => {
    try {
      const data = await pluggyApi.listConnections();
      setConnections(data);
    } catch {
      // silencioso — conexões são feature extra
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    loadConnections();
  }, [loadAccounts, loadConnections]);

  function resetForm() {
    setNewName("");
    setNewType("checking");
    setNewBalance("");
    setNewColor(PRESET_COLORS[0]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      const created = await financeApi.accounts.create({
        name: newName.trim(),
        type: newType,
        balance: parseFloat(newBalance.replace(",", ".")) || 0,
        color: newColor,
      });
      setNewlyCreatedId(created.id);
      resetForm();
      setShowForm(false);
      toast("Conta criada.", "success");
      await loadAccounts();
      // Clear pop-in after animation completes
      setTimeout(() => setNewlyCreatedId(null), 600);
    } catch {
      toast("Erro ao criar conta.", "error");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingIds((prev) => new Set(prev).add(id));
    setTimeout(async () => {
      try {
        await financeApi.accounts.remove(id);
        toast("Conta removida.", "success");
        await loadAccounts();
      } catch {
        toast("Erro ao remover conta.", "error");
      }
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 200);
  }

  async function handleConnectBank() {
    setConnectingBank(true);
    try {
      const { connectToken } = await pluggyApi.createConnectToken();

      const { PluggyConnect } = await import("pluggy-connect-sdk");

      const widget = new PluggyConnect({
        connectToken,
        onSuccess: async ({ item }: { item: { id: string; connector: { name: string } } }) => {
          setConnectingBank(false);
          try {
            await pluggyApi.connect({
              item_id: item.id,
              connector_name: item.connector?.name,
            });
            toast("Banco conectado! Importando dados...", "success");
            await Promise.all([loadAccounts(), loadConnections()]);
          } catch {
            toast("Erro ao salvar conexão.", "error");
          }
        },
        onError: () => {
          toast("Erro ao conectar banco.", "error");
        },
        onClose: () => {
          setConnectingBank(false);
        },
      });

      widget.init();
    } catch {
      toast("Erro ao iniciar conexão.", "error");
      setConnectingBank(false);
    }
  }

  async function handleDisconnect(id: string) {
    if (!confirm("Desconectar este banco? O histórico de transações será mantido.")) return;
    setDisconnectingId(id);
    try {
      await pluggyApi.disconnect(id);
      toast("Banco desconectado.", "success");
      await Promise.all([loadAccounts(), loadConnections()]);
    } catch {
      toast("Erro ao desconectar banco.", "error");
    } finally {
      setDisconnectingId(null);
    }
  }

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
          Contas
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
              Nova conta
            </>
          )}
        </button>
      </div>

      {/* Bancos conectados via Open Finance */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-ink dark:text-neutral-100 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-brand-500" />
            Open Finance
          </h2>
          <button
            onClick={handleConnectBank}
            disabled={connectingBank}
            className="flex items-center gap-2 rounded-xl border border-brand-500 px-3 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50 active:scale-95 disabled:opacity-60 dark:text-brand-400 dark:hover:bg-brand-900/20"
          >
            <Wifi className="h-4 w-4" />
            {connectingBank ? "Aguardando..." : "Conectar banco"}
          </button>
        </div>

        {connections.length === 0 ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-500">
            Nenhum banco conectado. Clique em "Conectar banco" para importar dados via Open Finance.
          </p>
        ) : (
          <div className="space-y-2">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 dark:border-border-dark dark:bg-card-dark"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-brand-500" />
                  <div>
                    <p className="text-sm font-medium text-ink dark:text-neutral-100">
                      {conn.connector_name ?? "Banco"}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {conn.status === "error" ? (
                        <span className="text-red-500">Erro na sincronização</span>
                      ) : conn.last_synced_at ? (
                        <>Sincronizado {new Date(conn.last_synced_at).toLocaleDateString("pt-BR")}</>
                      ) : (
                        "Sincronizando..."
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDisconnect(conn.id)}
                  disabled={disconnectingId === conn.id}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 disabled:opacity-50"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  Desconectar
                </button>
              </div>
            ))}
          </div>
        )}
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
              placeholder="Nome da conta"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              autoFocus
              className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100 dark:focus:border-brand-500"
            />
            {/* Type */}
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as AccountType)}
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100 dark:focus:border-brand-500"
            >
              <option value="checking">Conta corrente</option>
              <option value="savings">Poupança</option>
              <option value="cash">Dinheiro</option>
              <option value="credit">Cartão de crédito</option>
            </select>
            {/* Balance */}
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              className="w-40 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100 dark:focus:border-brand-500"
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
                    ? "ring-2 ring-offset-2 ring-neutral-400 scale-110 dark:ring-offset-card-dark"
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
            Criar conta
          </button>
        </form>
      )}

      {/* Empty state */}
      {accounts.length === 0 ? (
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
          Nenhuma conta cadastrada. Crie a primeira acima.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account, i) => (
            <div
              key={account.id}
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
              className={`group relative rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-all dark:border-border-dark dark:bg-card-dark ${
                deletingIds.has(account.id)
                  ? "animate-slide-out"
                  : newlyCreatedId === account.id
                  ? "animate-pop-in"
                  : "animate-card-enter hover:-translate-y-0.5 hover:shadow-md"
              }`}
            >
              {/* Delete button — only for manual accounts */}
              {account.source === 'manual' && (
                <button
                  onClick={() => handleDelete(account.id)}
                  className="absolute right-3 top-3 hidden rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-500 group-hover:flex dark:hover:bg-red-900/20"
                  aria-label="Remover conta"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              {/* Color dot + name */}
              <div className="mb-3 flex items-center gap-3">
                <span
                  className="h-4 w-4 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: account.color || "#7C6FCD" }}
                />
                <p className="truncate font-display text-base font-bold text-ink dark:text-neutral-100">
                  {account.name}
                </p>
              </div>

              {/* Type badge */}
              <span className="mb-3 inline-block rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                {ACCOUNT_TYPE_LABELS[account.type] ?? account.type}
              </span>

              {/* Pluggy sync badge */}
              {account.source === 'pluggy' && (
                <span className="mb-1 flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400">
                  <Building2 className="h-3 w-3" />
                  Sincronizado
                </span>
              )}

              {/* Balance */}
              <p className="text-lg font-bold text-ink dark:text-neutral-100">
                {formatBRL(account.balance)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
