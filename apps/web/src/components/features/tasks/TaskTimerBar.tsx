import { useEffect, useState } from "react";

interface TaskTimerBarProps {
  startsAt: string;
  endsAt: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRemaining(ms: number): string {
  const totalMins = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min restantes`;
  if (h > 0) return `${h}h restantes`;
  return `${m}min restantes`;
}

export function TaskTimerBar({ startsAt, endsAt }: TaskTimerBarProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const total = end - start;

  if (now < start) {
    return (
      <p className="mt-1.5 text-xs text-neutral-400 dark:text-neutral-500">
        Inicia às {formatTime(startsAt)}
      </p>
    );
  }

  if (now > end) {
    return (
      <div className="mt-1.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-red-100 dark:bg-red-900/20">
          <div className="h-full w-full rounded-full bg-red-500" />
        </div>
        <p className="mt-1 text-xs text-red-500">Prazo encerrado</p>
      </div>
    );
  }

  const elapsed = now - start;
  const pct = Math.min(100, Math.round((elapsed / total) * 100));
  const remaining = end - now;
  const isUrgent = remaining / total < 0.25;

  return (
    <div className="mt-1.5">
      <div className="mb-0.5 flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500">
        <span>{formatTime(startsAt)}</span>
        <span>{formatTime(endsAt)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isUrgent ? "bg-peach-500" : "bg-brand-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p
        className={`mt-1 text-xs ${
          isUrgent
            ? "text-peach-500"
            : "text-neutral-400 dark:text-neutral-500"
        }`}
      >
        {formatRemaining(remaining)}
      </p>
    </div>
  );
}
