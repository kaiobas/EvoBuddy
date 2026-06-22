import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react";
import type { ToastItem, ToastType } from "../../contexts/ToastContext";

const config: Record<
  ToastType,
  { icon: React.ElementType; classes: string }
> = {
  success: {
    icon: CheckCircle,
    classes: "bg-brand-500 text-white",
  },
  error: {
    icon: XCircle,
    classes: "bg-red-500 text-white",
  },
  warning: {
    icon: AlertCircle,
    classes: "bg-peach-500 text-white",
  },
};

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
}

export function ToastContainer({
  toasts,
  onDismiss,
  onMouseEnter,
  onMouseLeave,
}: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 sm:bottom-6 sm:right-6 max-sm:left-4 max-sm:right-4">
      {toasts.map((t) => {
        const { icon: Icon, classes } = config[t.type];
        return (
          <div
            key={t.id}
            role="alert"
            tabIndex={0}
            onMouseEnter={() => onMouseEnter(t.id)}
            onMouseLeave={() => onMouseLeave(t.id)}
            onFocus={() => onMouseEnter(t.id)}
            onBlur={() => onMouseLeave(t.id)}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg min-w-[260px] max-w-sm ${classes} ${
              t.exiting ? "animate-toast-exit" : "animate-toast-enter"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            <button
              onClick={() => onDismiss(t.id)}
              className="rounded-lg p-1 opacity-80 hover:opacity-100 min-h-0 min-w-0"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
