import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { notesApi, type NoteDTO } from "../lib/api";
import { useToast } from "../contexts/ToastContext";

export function NotesPage() {
  const { toast } = useToast();
  const [notes, setNotes] = useState<NoteDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  function isLong(content: string | null | undefined) {
    if (!content) return false;
    return content.length > 200 || content.split("\n").length > 3;
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const loadNotes = useCallback(async () => {
    try {
      const data = await notesApi.list();
      setNotes(data);
    } catch {
      toast("Erro ao carregar notas.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() && !newContent.trim()) return;
    setIsCreating(true);
    try {
      await notesApi.create({ title: newTitle, content: newContent });
      setNewTitle("");
      setNewContent("");
      toast("Nota criada.", "success");
      await loadNotes();
    } catch {
      toast("Erro ao criar nota.", "error");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdate(id: string) {
    try {
      await notesApi.update(id, { title: editTitle, content: editContent });
      setEditingId(null);
      toast("Nota atualizada.", "success");
      await loadNotes();
    } catch {
      toast("Erro ao atualizar nota.", "error");
    }
  }

  async function handleDelete(id: string) {
    setDeletingIds((prev) => new Set(prev).add(id));
    setTimeout(async () => {
      try {
        await notesApi.remove(id);
        toast("Nota removida.", "success");
        await loadNotes();
      } catch {
        toast("Erro ao remover nota.", "error");
      }
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 200);
  }

  function startEdit(note: NoteDTO) {
    setEditingId(note.id);
    setEditTitle(note.title ?? "");
    setEditContent(note.content ?? "");
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
      <h1 className="mb-6 font-display text-2xl font-bold text-ink dark:text-neutral-100">
        Notas
      </h1>

      {/* Formulário de criação */}
      <form
        onSubmit={handleCreate}
        className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-border-dark dark:bg-card-dark"
      >
        <input
          type="text"
          placeholder="Título"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="mb-2 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100 dark:focus:border-brand-500"
        />
        <textarea
          placeholder="Conteúdo"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={3}
          className="mb-3 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-300"
        />
        <button
          type="submit"
          disabled={isCreating}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Adicionar nota
        </button>
      </form>

      {/* Lista de notas */}
      {notes.length === 0 ? (
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
          Nenhuma nota ainda. Crie a primeira acima.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map((note, i) => (
            <div
              key={note.id}
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
              className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-all dark:border-border-dark dark:bg-card-dark ${
                deletingIds.has(note.id)
                  ? "animate-slide-out"
                  : "animate-card-enter hover:-translate-y-0.5 hover:shadow-md"
              }`}
            >
              {editingId === note.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-300"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(note.id)}
                      className="flex items-center gap-1 rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 min-h-0 min-w-0"
                    >
                      <Check className="h-3.5 w-3.5" /> Salvar
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1 rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:border-border-dark dark:text-neutral-400 dark:hover:bg-neutral-800 min-h-0 min-w-0"
                    >
                      <X className="h-3.5 w-3.5" /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mb-1 font-medium text-ink dark:text-neutral-100 truncate">
                    {note.title || "Sem título"}
                  </p>
                  <p
                    className={`mb-1 whitespace-pre-wrap text-sm text-neutral-500 dark:text-neutral-400 ${
                      expandedIds.has(note.id) ? "" : "line-clamp-3"
                    }`}
                  >
                    {note.content || "Sem conteúdo"}
                  </p>
                  {isLong(note.content) && (
                    <button
                      onClick={() => toggleExpand(note.id)}
                      className="mb-3 text-xs font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
                    >
                      {expandedIds.has(note.id) ? "Mostrar menos" : "Ler mais"}
                    </button>
                  )}
                  {!isLong(note.content) && <div className="mb-3" />}
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(note)}
                      className="flex items-center gap-1 rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:border-border-dark dark:text-neutral-400 dark:hover:bg-neutral-800 min-h-0 min-w-0"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="flex items-center gap-1 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20 min-h-0 min-w-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remover
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
