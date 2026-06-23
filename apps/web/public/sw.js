// Armazena timers de notificação agendados
const scheduledTimers = [];

self.addEventListener("message", (event) => {
  if (event.data?.type !== "SCHEDULE_NOTIFICATIONS") return;

  // Limpar timers anteriores
  scheduledTimers.forEach(clearTimeout);
  scheduledTimers.length = 0;

  const { events } = event.data;
  const now = Date.now();

  events.forEach((ev) => {
    if (ev.notification_minutes == null) return;

    // Construir datetime do evento
    const [year, month, day] = ev.date.split("-").map(Number);
    let eventMs;
    if (ev.start_time) {
      const [h, m] = ev.start_time.split(":").map(Number);
      eventMs = new Date(year, month - 1, day, h, m).getTime();
    } else {
      eventMs = new Date(year, month - 1, day, 9, 0).getTime(); // all-day: 9h
    }

    const notifyAdvanceMs = ev.notification_minutes * 60 * 1000;
    const notifyAt = eventMs - notifyAdvanceMs;
    const delay = notifyAt - now;
    if (delay <= 0) return;

    let body;
    if (notifyAdvanceMs >= 60 * 60 * 1000) {
      // Advance notification: show actual date
      const eventDate = new Date(eventMs);
      const dateStr = eventDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      body = ev.start_time ? `${dateStr} às ${ev.start_time}` : `Dia ${dateStr}`;
    } else {
      // Near notification (< 1 hour): "Hoje às HH:MM"
      body = ev.start_time ? `Hoje às ${ev.start_time}` : "Hoje — dia inteiro";
    }

    const timer = setTimeout(() => {
      self.registration.showNotification(ev.title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
      });
    }, delay);

    scheduledTimers.push(timer);
  });
});
