import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { ToastContainer } from "../components/ui/Toast";

export type ToastType = "success" | "error" | "warning";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  exiting: boolean;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, type, exiting: false }]);
      const timer = setTimeout(() => dismiss(id), 4000);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  function pauseTimer(id: string) {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
  }

  function resumeTimer(id: string) {
    const timer = setTimeout(() => dismiss(id), 1500);
    timers.current.set(id, timer);
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismiss}
        onMouseEnter={pauseTimer}
        onMouseLeave={resumeTimer}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
