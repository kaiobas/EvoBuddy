import { useEffect, useState, useCallback } from "react";
import { Eye, EyeOff, Settings2, X } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  financeApi,
  pluggyApi,
  type AccountDTO,
  type TransactionDTO,
  type GoalDTO,
  type CategoryDTO,
  type DashboardConfigDTO,
  type DashboardWidget,
} from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { GoalProgressBar } from "../components/features/finance/GoalProgressBar";

// ─── Helpers ─────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getMonthRange(date: Date): { from: string; to: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`,
    to: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
  };
}

function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { key: "balance-summary",     enabled: true, order: 0 },
  { key: "month-cashflow",      enabled: true, order: 1 },
  { key: "top-categories",      enabled: true, order: 2 },
  { key: "recent-transactions", enabled: true, order: 3 },
  { key: "goals-progress",      enabled: true, order: 4 },
  { key: "balance-chart",       enabled: true, order: 5 },
  { key: "category-pie",        enabled: true, order: 6 },
];

const WIDGET_LABELS: Record<string, string> = {
  "balance-summary": "Saldo das contas",
  "month-cashflow": "Fluxo do mês",
  "top-categories": "Top categorias",
  "recent-transactions": "Transações recentes",
  "goals-progress": "Metas",
  "balance-chart": "Evolução do saldo",
  "category-pie": "Categorias (pizza)",
};

// Full-width widget keys
const FULL_WIDTH_WIDGETS = new Set(["balance-summary", "balance-chart", "recent-transactions"]);

// ─── Widget card wrapper ──────────────────────────────────────

function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-border-dark dark:bg-card-dark p-5">
      <h2 className="mb-4 font-display text-base font-bold text-ink dark:text-white">{title}</h2>
      {children}
    </div>
  );
}

// ─── Widget 1: Balance Summary ────────────────────────────────

function BalanceSummaryWidget({
  accounts,
  balanceVisible,
}: {
  accounts: AccountDTO[];
  balanceVisible: boolean;
}) {
  const total = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <WidgetCard title="Saldo das contas">
      <p className="mb-4 font-display text-3xl font-bold text-ink dark:text-white">
        {balanceVisible ? formatBRL(total) : "••••"}
      </p>
      {accounts.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhuma conta cadastrada.</p>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-border-dark">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: account.color || "#7C6FCD" }}
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">{account.name}</span>
              </div>
              <span className="text-sm font-medium text-ink dark:text-white">
                {balanceVisible ? formatBRL(account.balance) : "••••"}
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

// ─── Widget 2: Month Cashflow ─────────────────────────────────

function MonthCashflowWidget({
  transactions,
  balanceVisible,
}: {
  transactions: TransactionDTO[];
  balanceVisible: boolean;
}) {
  const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  return (
    <WidgetCard title="Fluxo do mês">
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3">
          <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Entradas</p>
          <p className="font-display text-lg font-bold text-green-700 dark:text-green-300">
            {balanceVisible ? formatBRL(income) : "••••"}
          </p>
        </div>
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3">
          <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Saídas</p>
          <p className="font-display text-lg font-bold text-red-700 dark:text-red-300">
            {balanceVisible ? formatBRL(expense) : "••••"}
          </p>
        </div>
      </div>
      <div className="rounded-xl bg-brand-100 dark:bg-brand-900/20 p-3">
        <p className="text-xs font-medium text-brand-700 dark:text-brand-300 mb-1">Saldo do mês</p>
        <p className="font-display text-lg font-bold text-brand-700 dark:text-brand-300">
          {balanceVisible ? formatBRL(balance) : "••••"}
        </p>
      </div>
    </WidgetCard>
  );
}

// ─── Widget 3: Top Categories ─────────────────────────────────

function TopCategoriesWidget({
  transactions,
  categories,
  balanceVisible,
}: {
  transactions: TransactionDTO[];
  categories: CategoryDTO[];
  balanceVisible: boolean;
}) {
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const byCategory: Record<string, { name: string; color: string; amount: number }> = {};
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const key = t.category_id ?? "__none__";
    if (!byCategory[key]) {
      const cat = t.category_id ? catMap.get(t.category_id) : undefined;
      byCategory[key] = {
        name: cat?.name ?? "Sem categoria",
        color: cat?.color ?? "#6b7280",
        amount: 0,
      };
    }
    byCategory[key].amount += t.amount;
  }

  const sorted = Object.values(byCategory)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const total = sorted.reduce((s, c) => s + c.amount, 0);

  return (
    <WidgetCard title="Top categorias">
      {sorted.length === 0 ? (
        <p className="text-sm text-neutral-400">Sem despesas este mês.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((cat) => {
            const pct = total > 0 ? (cat.amount / total) * 100 : 0;
            return (
              <div key={cat.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-neutral-700 dark:text-neutral-300">{cat.name}</span>
                  </div>
                  <span className="font-medium text-ink dark:text-white">
                    {balanceVisible ? formatBRL(cat.amount) : "••••"}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-700">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: cat.color }}
                  />
                </div>
                <p className="mt-0.5 text-right text-xs text-neutral-400">{pct.toFixed(0)}%</p>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}

// ─── Widget 4: Recent Transactions ───────────────────────────

function RecentTransactionsWidget({
  chartTransactions,
  categories,
  balanceVisible,
}: {
  chartTransactions: TransactionDTO[];
  categories: CategoryDTO[];
  balanceVisible: boolean;
}) {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const recent = [...chartTransactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <WidgetCard title="Transações recentes">
      {recent.length === 0 ? (
        <p className="text-sm text-neutral-400">Sem transações este mês.</p>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-border-dark">
          {recent.map((t) => {
            const cat = t.category_id ? catMap.get(t.category_id) : undefined;
            const dotColor = t.type === "income" ? "#22c55e" : "#ef4444";
            const [year, month, day] = t.date.split("-");
            const dateLabel = `${day}/${month}/${year}`;
            return (
              <div key={t.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: cat?.color ?? dotColor }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink dark:text-white">
                      {t.description || cat?.name || (t.type === "income" ? "Entrada" : "Saída")}
                    </p>
                    <p className="text-xs text-neutral-400">{dateLabel}</p>
                  </div>
                </div>
                <span
                  className={`ml-3 flex-shrink-0 text-sm font-bold ${
                    t.type === "income"
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {t.type === "income" ? "+" : "-"}
                  {balanceVisible ? formatBRL(t.amount) : "••••"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}

// ─── Widget 5: Goals Progress ─────────────────────────────────

function GoalsProgressWidget({
  goals,
  balanceVisible,
}: {
  goals: GoalDTO[];
  balanceVisible: boolean;
}) {
  const activeGoals = goals.filter((g) => g.active);

  return (
    <WidgetCard title="Metas">
      {activeGoals.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhuma meta ativa.</p>
      ) : (
        <div className="space-y-4">
          {activeGoals.map((goal) => (
            <div key={goal.id}>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-medium text-ink dark:text-white">{goal.name}</p>
                {goal.deadline && (
                  <p className="text-xs text-neutral-400">
                    {(() => {
                      const [y, m, d] = goal.deadline.split("-");
                      return `${d}/${m}/${y}`;
                    })()}
                  </p>
                )}
              </div>
              {balanceVisible ? (
                <GoalProgressBar current={goal.current_amount} target={goal.target_amount} />
              ) : (
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                    <span>••••</span>
                    <span>••••</span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

// ─── Widget 6: Balance Chart ──────────────────────────────────

function BalanceChartWidget({
  chartTransactions,
  balanceVisible,
}: {
  chartTransactions: TransactionDTO[];
  balanceVisible: boolean;
}) {
  const today = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth(), label: MONTH_NAMES_SHORT[d.getMonth()] };
  });

  const monthlyTotals: Record<string, { income: number; expense: number }> = {};
  for (const t of chartTransactions) {
    const td = new Date(t.date);
    const key = `${td.getFullYear()}-${td.getMonth()}`;
    if (!monthlyTotals[key]) monthlyTotals[key] = { income: 0, expense: 0 };
    if (t.type === "income") monthlyTotals[key].income += t.amount;
    else monthlyTotals[key].expense += t.amount;
  }

  let running = 0;
  const chartData = months.map(({ year, month, label }) => {
    const key = `${year}-${month}`;
    const income = monthlyTotals[key]?.income ?? 0;
    const expense = monthlyTotals[key]?.expense ?? 0;
    running += income - expense;
    return { month: label, saldo: running };
  });

  return (
    <WidgetCard title="Evolução do saldo (6 meses)">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: balanceVisible ? 0 : -40 }}>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          {balanceVisible && (
            <YAxis
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                v === 0 ? "0" : `R$${(v / 1000).toFixed(0)}k`
              }
              width={52}
            />
          )}
          <Tooltip
            formatter={(value) =>
              balanceVisible
                ? formatBRL(typeof value === "number" ? value : 0)
                : "••••"
            }
            labelStyle={{ color: "#6b7280", fontSize: 12 }}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              fontSize: 13,
            }}
          />
          <Line
            type="monotone"
            dataKey="saldo"
            stroke="#7C6FCD"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#7C6FCD", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}

// ─── Widget 7: Category Pie ───────────────────────────────────

function CategoryPieWidget({
  transactions,
  categories,
  balanceVisible,
}: {
  transactions: TransactionDTO[];
  categories: CategoryDTO[];
  balanceVisible: boolean;
}) {
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const byCategory: Record<string, { name: string; color: string; value: number }> = {};
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const key = t.category_id ?? "__none__";
    if (!byCategory[key]) {
      const cat = t.category_id ? catMap.get(t.category_id) : undefined;
      byCategory[key] = {
        name: cat?.name ?? "Sem categoria",
        color: cat?.color ?? "#6b7280",
        value: 0,
      };
    }
    byCategory[key].value += t.amount;
  }

  const pieData = Object.values(byCategory).sort((a, b) => b.value - a.value);

  return (
    <WidgetCard title="Despesas por categoria">
      {pieData.length === 0 ? (
        <p className="text-sm text-neutral-400">Sem despesas este mês.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="45%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) =>
                balanceVisible ? formatBRL(typeof value === "number" ? value : 0) : "••••"
              }
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                fontSize: 13,
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </WidgetCard>
  );
}

// ─── Config Panel ─────────────────────────────────────────────

function ConfigPanel({
  widgets,
  onSave,
  onClose,
}: {
  widgets: DashboardWidget[];
  onSave: (updated: DashboardWidget[]) => Promise<void>;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<DashboardWidget[]>(widgets);
  const [saving, setSaving] = useState(false);

  function toggle(key: string) {
    setLocal((prev) =>
      prev.map((w) => (w.key === key ? { ...w, enabled: !w.enabled } : w))
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(local);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-border-dark dark:bg-card-dark">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-ink dark:text-white">
          Configurar widgets
        </h2>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
          aria-label="Fechar painel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2">
        {[...local].sort((a, b) => a.order - b.order).map((w) => (
          <label
            key={w.key}
            className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <span className="text-sm text-ink dark:text-neutral-200">
              {WIDGET_LABELS[w.key] ?? w.key}
            </span>
            <input
              type="checkbox"
              checked={w.enabled}
              onChange={() => toggle(w.key)}
              className="h-4 w-4 rounded accent-brand-500"
            />
          </label>
        ))}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-4 rounded-xl bg-brand-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-60"
      >
        {saving ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────

export function FinanceDashboard() {
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [chartTransactions, setChartTransactions] = useState<TransactionDTO[]>([]);
  const [goals, setGoals] = useState<GoalDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [config, setConfig] = useState<DashboardConfigDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(
    () => localStorage.getItem("finance_balance_visible") !== "false"
  );

  function toggleBalanceVisible() {
    setBalanceVisible((v) => {
      const next = !v;
      localStorage.setItem("finance_balance_visible", String(next));
      return next;
    });
  }

  const load = useCallback(async () => {
    try {
      const today = new Date();
      const { from, to } = getMonthRange(today);

      const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      const sixFrom = toISODate(sixMonthsAgo);
      const sixTo = toISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0));

      const [acc, txns, chartTxns, gl, cats, cfg] = await Promise.all([
        financeApi.accounts.list(),
        financeApi.transactions.list({ from, to }),
        financeApi.transactions.list({ from: sixFrom, to: sixTo }),
        financeApi.goals.list(),
        financeApi.categories.list(),
        financeApi.dashboardConfig.get(),
      ]);

      setAccounts(acc);
      setTransactions(txns);
      setChartTransactions(chartTxns);
      setGoals(gl);
      setCategories(cats);
      setConfig(cfg);
    } catch {
      toast("Erro ao carregar dashboard.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    pluggyApi.sync().catch(() => {});
  }, []);

  const widgets: DashboardWidget[] = config?.widgets?.length
    ? config.widgets
    : DEFAULT_WIDGETS;

  const enabledWidgets = [...widgets]
    .filter((w) => w.enabled)
    .sort((a, b) => a.order - b.order);

  async function handleSaveConfig(updated: DashboardWidget[]) {
    try {
      const saved = await financeApi.dashboardConfig.update(updated);
      setConfig(saved);
      toast("Configuração salva.", "success");
    } catch {
      toast("Erro ao salvar configuração.", "error");
    }
  }

  function renderWidget(key: string) {
    switch (key) {
      case "balance-summary":
        return (
          <BalanceSummaryWidget
            accounts={accounts}
            balanceVisible={balanceVisible}
          />
        );
      case "month-cashflow":
        return (
          <MonthCashflowWidget
            transactions={transactions}
            balanceVisible={balanceVisible}
          />
        );
      case "top-categories":
        return (
          <TopCategoriesWidget
            transactions={transactions}
            categories={categories}
            balanceVisible={balanceVisible}
          />
        );
      case "recent-transactions":
        return (
          <RecentTransactionsWidget
            chartTransactions={chartTransactions}
            categories={categories}
            balanceVisible={balanceVisible}
          />
        );
      case "goals-progress":
        return (
          <GoalsProgressWidget
            goals={goals}
            balanceVisible={balanceVisible}
          />
        );
      case "balance-chart":
        return (
          <BalanceChartWidget
            chartTransactions={chartTransactions}
            balanceVisible={balanceVisible}
          />
        );
      case "category-pie":
        return (
          <CategoryPieWidget
            transactions={transactions}
            categories={categories}
            balanceVisible={balanceVisible}
          />
        );
      default:
        return null;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  // Split widgets into full-width and grid groups, preserving order
  const renderGroups: Array<{ full: boolean; key: string }> = enabledWidgets.map((w) => ({
    full: FULL_WIDTH_WIDGETS.has(w.key),
    key: w.key,
  }));

  // Build rows: consecutive non-full widgets go into 2-col grid, full-width ones are standalone
  const rows: Array<{ type: "full"; key: string } | { type: "grid"; keys: string[] }> = [];
  let gridBuffer: string[] = [];

  function flushGrid() {
    if (gridBuffer.length > 0) {
      rows.push({ type: "grid", keys: [...gridBuffer] });
      gridBuffer = [];
    }
  }

  for (const item of renderGroups) {
    if (item.full) {
      flushGrid();
      rows.push({ type: "full", key: item.key });
    } else {
      gridBuffer.push(item.key);
    }
  }
  flushGrid();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink dark:text-white">Finanças</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleBalanceVisible}
            className="rounded-xl p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-label={balanceVisible ? "Ocultar saldo" : "Mostrar saldo"}
            title={balanceVisible ? "Ocultar saldo" : "Mostrar saldo"}
          >
            {balanceVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </button>
          <button
            onClick={() => setShowConfig((v) => !v)}
            className={`rounded-xl p-2 transition ${
              showConfig
                ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            }`}
            aria-label="Configurar widgets"
            title="Configurar widgets"
          >
            <Settings2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Config panel */}
      {showConfig && (
        <ConfigPanel
          widgets={widgets}
          onSave={handleSaveConfig}
          onClose={() => setShowConfig(false)}
        />
      )}

      {/* Widgets */}
      {enabledWidgets.length === 0 ? (
        <p className="text-center text-sm text-neutral-400">
          Nenhum widget habilitado. Abra as configurações para ativar widgets.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((row, rowIdx) => {
            if (row.type === "full") {
              return (
                <div key={`row-${rowIdx}`}>
                  {renderWidget(row.key)}
                </div>
              );
            }
            return (
              <div key={`row-${rowIdx}`} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {row.keys.map((key) => (
                  <div key={key}>{renderWidget(key)}</div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
