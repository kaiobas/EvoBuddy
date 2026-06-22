/**
 * API Client — comunicação segura com o backend Express.
 * Todas as chamadas passam por aqui, nunca pelo Supabase Client direto.
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("sb-token");

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || "Request failed", res.status);
  }

  return res.json();
}

// ─── Health ──────────────────────────────────────────────────

export async function healthCheck() {
  return request<{ status: string; timestamp: string }>("/api/health");
}

// ─── Notes ───────────────────────────────────────────────────

export interface NoteDTO {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CreateNoteDTO {
  title?: string;
  content?: string;
}

export interface UpdateNoteDTO {
  title?: string;
  content?: string;
}

export const notesApi = {
  list: () => request<NoteDTO[]>("/api/notes"),
  get: (id: string) => request<NoteDTO>(`/api/notes/${id}`),
  create: (data: CreateNoteDTO) =>
    request<NoteDTO>("/api/notes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: UpdateNoteDTO) =>
    request<NoteDTO>(`/api/notes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request<void>(`/api/notes/${id}`, { method: "DELETE" }),
};

// ─── Tasks ───────────────────────────────────────────────────

export interface TaskDTO {
  id: string;
  user_id: string;
  title: string;
  description: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskDTO {
  title: string;
  description?: string;
}

export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  completed?: boolean;
}

export const tasksApi = {
  list: () => request<TaskDTO[]>("/api/tasks"),
  get: (id: string) => request<TaskDTO>(`/api/tasks/${id}`),
  create: (data: CreateTaskDTO) =>
    request<TaskDTO>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: UpdateTaskDTO) =>
    request<TaskDTO>(`/api/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request<void>(`/api/tasks/${id}`, { method: "DELETE" }),
  toggle: (id: string) =>
    request<TaskDTO>(`/api/tasks/${id}/toggle`, { method: "PATCH" }),
};

// ─── Finance — Shared types ──────────────────────────────────
export type AccountType = "checking" | "savings" | "cash" | "credit"
export type TransactionType = "income" | "expense"
export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly"
export type GoalType = "savings" | "spending_limit"

export interface AccountDTO { id: string; user_id: string; name: string; type: AccountType; balance: number; color: string; icon: string; created_at: string }
export interface CreateAccountDTO { name: string; type: AccountType; balance?: number; color?: string; icon?: string }
export interface UpdateAccountDTO { name?: string; type?: AccountType; balance?: number; color?: string; icon?: string }

export interface CategoryDTO { id: string; user_id: string; name: string; color: string; icon: string; is_default: boolean; type: TransactionType | null; created_at: string }
export interface CreateCategoryDTO { name: string; color?: string; icon?: string; type?: TransactionType }
export interface UpdateCategoryDTO { name?: string; color?: string; icon?: string; type?: TransactionType }

export interface TransactionDTO { id: string; user_id: string; account_id: string | null; category_id: string | null; goal_id: string | null; recurring_id: string | null; type: TransactionType; amount: number; description: string; date: string; created_at: string }
export interface CreateTransactionDTO { type: TransactionType; amount: number; description?: string; date?: string; account_id?: string; category_id?: string; goal_id?: string; recurring_id?: string }
export interface UpdateTransactionDTO { type?: TransactionType; amount?: number; description?: string; date?: string; account_id?: string | null; category_id?: string | null; goal_id?: string | null }

export interface RecurringRuleDTO { id: string; user_id: string; account_id: string | null; category_id: string | null; type: TransactionType; amount: number; description: string; frequency: RecurringFrequency; next_date: string; active: boolean; created_at: string }
export interface CreateRecurringRuleDTO { type: TransactionType; amount: number; frequency: RecurringFrequency; next_date: string; description?: string; account_id?: string; category_id?: string; active?: boolean }
export interface UpdateRecurringRuleDTO { type?: TransactionType; amount?: number; frequency?: RecurringFrequency; next_date?: string; description?: string; account_id?: string | null; category_id?: string | null; active?: boolean }

export interface GoalDTO { id: string; user_id: string; name: string; type: GoalType; target_amount: number; category_id: string | null; deadline: string | null; current_amount: number; active: boolean; created_at: string }
export interface CreateGoalDTO { name: string; type: GoalType; target_amount: number; category_id?: string; deadline?: string; active?: boolean }
export interface UpdateGoalDTO { name?: string; type?: GoalType; target_amount?: number; category_id?: string | null; deadline?: string | null; active?: boolean }

export interface DashboardWidget { key: string; enabled: boolean; order: number }
export interface DashboardConfigDTO { id: string; user_id: string; widgets: DashboardWidget[]; updated_at: string }

// ─── Finance API ─────────────────────────────────────────────

export const financeApi = {
  accounts: {
    list: () => request<AccountDTO[]>("/api/finance/accounts"),
    get: (id: string) => request<AccountDTO>(`/api/finance/accounts/${id}`),
    create: (data: CreateAccountDTO) => request<AccountDTO>("/api/finance/accounts", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: UpdateAccountDTO) => request<AccountDTO>(`/api/finance/accounts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/api/finance/accounts/${id}`, { method: "DELETE" }),
  },
  categories: {
    list: () => request<CategoryDTO[]>("/api/finance/categories"),
    get: (id: string) => request<CategoryDTO>(`/api/finance/categories/${id}`),
    create: (data: CreateCategoryDTO) => request<CategoryDTO>("/api/finance/categories", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: UpdateCategoryDTO) => request<CategoryDTO>(`/api/finance/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/api/finance/categories/${id}`, { method: "DELETE" }),
  },
  transactions: {
    list: (params?: { type?: TransactionType; category_id?: string; account_id?: string; from?: string; to?: string }) => {
      const qs = params ? "?" + new URLSearchParams(Object.entries(params).filter(([,v]) => v != null) as [string,string][]).toString() : "";
      return request<TransactionDTO[]>(`/api/finance/transactions${qs}`);
    },
    get: (id: string) => request<TransactionDTO>(`/api/finance/transactions/${id}`),
    create: (data: CreateTransactionDTO) => request<TransactionDTO>("/api/finance/transactions", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: UpdateTransactionDTO) => request<TransactionDTO>(`/api/finance/transactions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/api/finance/transactions/${id}`, { method: "DELETE" }),
  },
  recurring: {
    list: () => request<RecurringRuleDTO[]>("/api/finance/recurring"),
    get: (id: string) => request<RecurringRuleDTO>(`/api/finance/recurring/${id}`),
    create: (data: CreateRecurringRuleDTO) => request<RecurringRuleDTO>("/api/finance/recurring", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: UpdateRecurringRuleDTO) => request<RecurringRuleDTO>(`/api/finance/recurring/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/api/finance/recurring/${id}`, { method: "DELETE" }),
    toggle: (id: string) => request<RecurringRuleDTO>(`/api/finance/recurring/${id}/toggle`, { method: "PATCH" }),
  },
  goals: {
    list: () => request<GoalDTO[]>("/api/finance/goals"),
    get: (id: string) => request<GoalDTO>(`/api/finance/goals/${id}`),
    create: (data: CreateGoalDTO) => request<GoalDTO>("/api/finance/goals", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: UpdateGoalDTO) => request<GoalDTO>(`/api/finance/goals/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/api/finance/goals/${id}`, { method: "DELETE" }),
  },
  dashboardConfig: {
    get: () => request<DashboardConfigDTO>("/api/finance/dashboard-config"),
    update: (widgets: DashboardWidget[]) => request<DashboardConfigDTO>("/api/finance/dashboard-config", { method: "PUT", body: JSON.stringify({ widgets }) }),
  },
};
