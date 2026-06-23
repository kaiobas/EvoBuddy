import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  calendarApi,
  type CalendarEventDTO,
  type CalendarCategoryDTO,
  type CalendarRecurring,
} from "../../../lib/api";
import { useToast } from "../../../contexts/ToastContext";

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  event?: CalendarEventDTO | null;
  defaultDate?: string;
  categories: CalendarCategoryDTO[];
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function EventModal({
  open,
  onClose,
  onSaved,
  event,
  defaultDate,
  categories,
}: EventModalProps) {
  const { toast } = useToast();

  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? defaultDate ?? todayISO());
  const [allDay, setAllDay] = useState(event?.all_day ?? true);
  const [startTime, setStartTime] = useState(event?.start_time ?? "09:00");
  const [endTime, setEndTime] = useState(event?.end_time ?? "10:00");
  const [categoryId, setCategoryId] = useState(event?.category_id ?? "");
  const [frequency, setFrequency] = useState<string>(
    event?.recurring?.frequency ?? "none"
  );
  const [notifMinutes, setNotifMinutes] = useState<number | null>(
    event?.notification_minutes ?? null
  );
  const [description, setDescription] = useState(event?.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Re-sync form fields when the event prop changes (e.g. switching between events)
  useEffect(() => {
    setTitle(event?.title ?? "");
    setDate(event?.date ?? defaultDate ?? todayISO());
    setAllDay(event?.all_day ?? true);
    setStartTime(event?.start_time ?? "09:00");
    setEndTime(event?.end_time ?? "10:00");
    setCategoryId(event?.category_id ?? "");
    setFrequency(event?.recurring?.frequency ?? "none");
    setNotifMinutes(event?.notification_minutes ?? null);
    setDescription(event?.description ?? "");
  }, [event, defaultDate, open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast("Informe um título para o evento.", "error");
      return;
    }

    const payload = {
      title: title.trim(),
      date,
      description: description.trim() || undefined,
      all_day: allDay,
      start_time: allDay ? null : startTime || null,
      end_time: allDay ? null : endTime || null,
      category_id: categoryId || null,
      recurring: frequency !== "none"
        ? { frequency: frequency as CalendarRecurring["frequency"] }
        : null,
      notification_minutes: notifMinutes,
    };

    setSubmitting(true);
    try {
      if (event) {
        await calendarApi.events.update(event.id, payload);
        toast("Evento atualizado.", "success");
      } else {
        await calendarApi.events.create(payload);
        toast("Evento criado.", "success");
      }
      onSaved();
      onClose();
    } catch {
      toast("Erro ao salvar evento.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!event) return;
    if (!window.confirm("Excluir este evento?")) return;
    setDeleting(true);
    try {
      await calendarApi.events.remove(event.id);
      toast("Evento excluído.", "success");
      onSaved();
      onClose();
    } catch {
      toast("Erro ao excluir evento.", "error");
    } finally {
      setDeleting(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-neutral-800 dark:text-white";

  const labelClass = "block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1";

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={event ? "Editar evento" : "Novo evento"}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl dark:bg-card-dark"
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink dark:text-white">
            {event ? "Editar evento" : "Novo evento"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title */}
          <div>
            <label className={labelClass}>Título *</label>
            <input
              type="text"
              placeholder="Nome do evento"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              className={inputClass}
              aria-label="Título"
            />
          </div>

          {/* Date */}
          <div>
            <label className={labelClass}>Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={inputClass}
              aria-label="Data"
            />
          </div>

          {/* All-day toggle */}
          <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-border-dark dark:bg-neutral-800">
            <span className="text-sm text-ink dark:text-white">Dia inteiro</span>
            <button
              type="button"
              role="switch"
              aria-checked={allDay}
              onClick={() => setAllDay((v) => !v)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 ${
                allDay ? "bg-brand-500" : "bg-neutral-300 dark:bg-neutral-600"
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  allDay ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Start + End time (only when not all-day) */}
          {!allDay && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelClass}>Início</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={inputClass}
                  aria-label="Hora de início"
                />
              </div>
              <div className="flex-1">
                <label className={labelClass}>Fim</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={inputClass}
                  aria-label="Hora de fim"
                />
              </div>
            </div>
          )}

          {/* Category */}
          <div>
            <label className={labelClass}>Categoria</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
              aria-label="Categoria"
            >
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recurrence */}
          <div>
            <label className={labelClass}>Recorrência</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className={inputClass}
              aria-label="Recorrência"
            >
              <option value="none">Não repete</option>
              <option value="daily">Diário</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
              <option value="yearly">Anual</option>
            </select>
          </div>

          {/* Reminder */}
          <div>
            <label className={labelClass}>Lembrete</label>
            <select
              value={notifMinutes ?? ""}
              onChange={(e) =>
                setNotifMinutes(e.target.value === "" ? null : Number(e.target.value))
              }
              className={inputClass}
              aria-label="Lembrete"
            >
              <option value="">Sem lembrete</option>
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="60">1 hora</option>
              <option value="1440">1 dia</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Descrição</label>
            <textarea
              placeholder="Adicione uma descrição (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
              aria-label="Descrição"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting || deleting}
              className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-60"
            >
              {submitting ? "Salvando..." : "Salvar evento"}
            </button>

            {event && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting || deleting}
                className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-100 active:scale-95 disabled:opacity-60 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
              >
                {deleting ? "Excluindo..." : "Excluir evento"}
              </button>
            )}
          </div>
        </form>
      </div>
    </>,
    document.body
  );
}
