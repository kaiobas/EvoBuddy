import { create } from "zustand";
import type { Note } from "./schema.js";

interface NoteState {
  notes: Note[];
  loading: boolean;
  error: string | null;
  setNotes: (notes: Note[]) => void;
  addNote: (note: Note) => void;
  updateNote: (id: string, partial: Partial<Note>) => void;
  removeNote: (id: string) => void;
  getNote: (id: string) => Note | undefined;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  loading: false,
  error: null,

  setNotes: (notes) => set({ notes }),

  addNote: (note) =>
    set((state) => ({ notes: [...state.notes, note] })),

  updateNote: (id, partial) =>
    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === id ? { ...n, ...partial } : n
      ),
    })),

  removeNote: (id) =>
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
    })),

  getNote: (id) => get().notes.find((n) => n.id === id),
}));
