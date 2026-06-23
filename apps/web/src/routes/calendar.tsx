import { useEffect, useState, useCallback } from "react";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Plus } from "lucide-react";
import {
  calendarApi,
  tasksApi,
  type CalendarEventDTO,
  type CalendarCategoryDTO,
  type TaskDTO,
} from "../lib/api";
import { EventModal } from "../components/features/calendar/EventModal";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { "pt-BR": ptBR },
});

export function CalendarPage() {
  const [view, setView] = useState<(typeof Views)[keyof typeof Views]>(
    Views.MONTH
  );
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEventDTO[]>([]);
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [categories, setCategories] = useState<CalendarCategoryDTO[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventDTO | null>(
    null
  );
  const [defaultDate, setDefaultDate] = useState("");

  const load = useCallback(async () => {
    const from = format(startOfMonth(subMonths(date, 1)), "yyyy-MM-dd");
    const to = format(endOfMonth(addMonths(date, 1)), "yyyy-MM-dd");
    const [evts, cats, tks] = await Promise.all([
      calendarApi.events.list(from, to),
      calendarApi.categories.list(),
      tasksApi.list(),
    ]);
    setEvents(evts);
    setCategories(cats);
    setTasks(tks.filter((t) => t.due_date));
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  // Request notification permission and schedule notifications via SW
  useEffect(() => {
    if (!("Notification" in window)) return;
    Notification.requestPermission().then((perm) => {
      if (perm !== "granted") return;
      navigator.serviceWorker?.ready.then((reg) => {
        reg.active?.postMessage({
          type: "SCHEDULE_NOTIFICATIONS",
          events: events.filter((e) => e.notification_minutes != null),
        });
      });
    });
  }, [events]);

  const rbcEvents = [
    ...events.map((ev) => ({
      id: ev.id,
      title: ev.title,
      start: ev.all_day
        ? parseISO(ev.date)
        : parseISO(`${ev.date}T${ev.start_time}`),
      end: ev.all_day
        ? parseISO(ev.date)
        : parseISO(`${ev.date}T${ev.end_time ?? ev.start_time}`),
      allDay: ev.all_day,
      resource: {
        type: "event",
        data: ev,
        color:
          categories.find((c) => c.id === ev.category_id)?.color ?? "#7C6FCD",
      },
    })),
    ...tasks.map((t) => ({
      id: `task-${t.id}`,
      title: `✓ ${t.title}`,
      start: parseISO(t.due_date!),
      end: parseISO(t.due_date!),
      allDay: true,
      resource: { type: "task", data: t, color: "#6b7280" },
    })),
  ];

  const eventStyleGetter = (event: (typeof rbcEvents)[number]) => ({
    style: {
      backgroundColor: event.resource.color,
      borderRadius: "6px",
      border: "none",
      opacity: event.resource.type === "task" ? 0.7 : 1,
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink dark:text-white">
          Calendário
        </h1>
        <button
          onClick={() => {
            setEditingEvent(null);
            setDefaultDate(format(new Date(), "yyyy-MM-dd"));
            setModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 active:scale-95"
        >
          <Plus className="h-4 w-4" /> Novo evento
        </button>
      </div>

      <div
        className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-border-dark dark:bg-card-dark"
        style={{ height: 600 }}
      >
        <Calendar
          localizer={localizer}
          events={rbcEvents}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={(ev) => {
            if (ev.resource.type === "event") {
              setEditingEvent(ev.resource.data as CalendarEventDTO);
              setModalOpen(true);
            }
          }}
          onSelectSlot={(slot) => {
            setEditingEvent(null);
            setDefaultDate(format(slot.start, "yyyy-MM-dd"));
            setModalOpen(true);
          }}
          selectable
          messages={{
            next: "›",
            previous: "‹",
            today: "Hoje",
            month: "Mês",
            week: "Semana",
            agenda: "Agenda",
            date: "Data",
            time: "Hora",
            event: "Evento",
            noEventsInRange: "Nenhum evento neste período.",
            showMore: (total) => `+${total} mais`,
          }}
        />
      </div>

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          load();
        }}
        event={editingEvent}
        defaultDate={defaultDate}
        categories={categories}
      />
    </div>
  );
}
