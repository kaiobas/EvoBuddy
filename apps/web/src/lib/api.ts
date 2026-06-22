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
