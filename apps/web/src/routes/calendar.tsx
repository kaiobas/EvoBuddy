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
import { useToast } from "../contexts/ToastContext";

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

  const { toast } = useToast();

  const [_refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const from = format(startOfMonth(subMonths(date, 1)), "yyyy-MM-dd");
        const to = format(endOfMonth(addMonths(date, 1)), "yyyy-MM-dd");
        const [evts, cats, tks] = await Promise.all([
          calendarApi.events.list(from, to),
          calendarApi.categories.list(),
          tasksApi.list(),
        ]);
        if (ignore) return;
        setEvents(evts);
        setCategories(cats);
        setTasks(tks.filter((t) => t.due_date));
      } catch {
        if (!ignore) toast("Erro ao carregar eventos.", "error");
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [date, toast, _refreshKey]);

  // Request notification permission (once) and schedule notifications via SW
  useEffect(() => {
    if (!("Notification" in window) || !navigator.serviceWorker) return;
    const schedule = (reg: ServiceWorkerRegistration) => {
      reg.active?.postMessage({
        type: "SCHEDULE_NOTIFICATIONS",
        events: events.filter((e) => e.notification_minutes != null),
      });
    };
    if (Notification.permission === "granted") {
      navigator.serviceWorker.ready.then(schedule);
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") navigator.serviceWorker.ready.then(schedule);
      });
    }
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

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink dark:text-white">
          Calendário
        </h1>
        <button
          onClick={() => {
            setEditingEvent(null);
            setDefaultDate(format(new Date(), "yyyy-MM-dd"));
            setModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-3 py-2 sm:px-4 sm:py-2.5 text-sm font-medium text-white hover:bg-brand-600 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo evento</span>
        </button>
      </div>

      <div
        className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm dark:border-border-dark dark:bg-card-dark"
        style={{ height: isMobile ? "calc(100dvh - 180px)" : 620 }}
      >
        <Calendar
          localizer={localizer}
          events={rbcEvents}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          formats={{
            dateFormat: "dd",
            dayFormat: "EEE dd/MM",
            weekdayFormat: "EEE",
            monthHeaderFormat: "MMMM yyyy",
            dayHeaderFormat: "EEEE, dd/MM/yyyy",
            dayRangeHeaderFormat: ({ start, end }) =>
              `${format(start, "dd/MM")} – ${format(end, "dd/MM/yyyy")}`,
            agendaDateFormat: "dd/MM/yyyy",
            agendaTimeFormat: "HH:mm",
            agendaTimeRangeFormat: ({ start, end }) =>
              `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`,
            agendaHeaderFormat: ({ start, end }) =>
              `${format(start, "dd/MM/yyyy")} – ${format(end, "dd/MM/yyyy")}`,
          }}
          eventPropGetter={eventStyleGetter}
          views={isMobile ? [Views.MONTH, Views.DAY, Views.AGENDA] : [Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
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
            day: "Dia",
            agenda: "Agenda",
            date: "Data",
            time: "Hora",
            event: "Evento",
            allDay: "Dia inteiro",
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
          refresh();
        }}
        event={editingEvent}
        defaultDate={defaultDate}
        categories={categories}
      />
    </div>
  );
}
