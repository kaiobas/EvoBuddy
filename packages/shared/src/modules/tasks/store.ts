import { create } from "zustand";
import type { Task } from "./schema.js";

interface TaskState {
  tasks: Map<string, Task>;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, partial: Partial<Task>) => void;
  removeTask: (id: string) => void;
  toggleTask: (id: string) => void;
  getTask: (id: string) => Task | undefined;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: new Map(),

  setTasks: (tasks) =>
    set({ tasks: new Map(tasks.map((t) => [t.id, t])) }),

  addTask: (task) =>
    set((state) => {
      const next = new Map(state.tasks);
      next.set(task.id, task);
      return { tasks: next };
    }),

  updateTask: (id, partial) =>
    set((state) => {
      const existing = state.tasks.get(id);
      if (!existing) return state;
      const next = new Map(state.tasks);
      next.set(id, { ...existing, ...partial, updatedAt: Date.now() });
      return { tasks: next };
    }),

  removeTask: (id) =>
    set((state) => {
      const next = new Map(state.tasks);
      next.delete(id);
      return { tasks: next };
    }),

  toggleTask: (id) =>
    set((state) => {
      const existing = state.tasks.get(id);
      if (!existing) return state;
      const next = new Map(state.tasks);
      next.set(id, { ...existing, completed: !existing.completed, updatedAt: Date.now() });
      return { tasks: next };
    }),

  getTask: (id) => get().tasks.get(id),
}));
