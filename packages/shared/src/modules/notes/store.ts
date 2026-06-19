import { create } from "zustand";
import type { Note } from "./schema.js";

interface NoteState {
  notes: Map<string, Note>;
  setNotes: (notes: Note[]) => void;
  addNote: (note: Note) => void;
  updateNote: (id: string, partial: Partial<Note>) => void;
  removeNote: (id: string) => void;
  getNote: (id: string) => Note | undefined;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: new Map(),

  setNotes: (notes) =>
    set({ notes: new Map(notes.map((n) => [n.id, n])) }),

  addNote: (note) =>
    set((state) => {
      const next = new Map(state.notes);
      next.set(note.id, note);
      return { notes: next };
    }),

  updateNote: (id, partial) =>
    set((state) => {
      const existing = state.notes.get(id);
      if (!existing) return state;
      const next = new Map(state.notes);
      next.set(id, { ...existing, ...partial, updatedAt: Date.now() });
      return { notes: next };
    }),

  removeNote: (id) =>
    set((state) => {
      const next = new Map(state.notes);
      next.delete(id);
      return { notes: next };
    }),

  getNote: (id) => get().notes.get(id),
}));
