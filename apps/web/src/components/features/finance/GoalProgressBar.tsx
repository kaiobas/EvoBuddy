interface GoalProgressBarProps {
  current: number;
  target: number;
}

export function GoalProgressBar({ current, target }: GoalProgressBarProps) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const barColor =
    pct >= 100
      ? "bg-red-500"
      : pct >= 80
      ? "bg-peach-500"
      : "bg-brand-500";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>{pct.toFixed(0)}%</span>
        <span>
          {current.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}{" "}
          /{" "}
          {target.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
        </span>
      </div>
      <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-700">
        <div
          className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
