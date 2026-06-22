import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Wallet,
  ChevronDown,
  ChevronRight,
  ArrowLeftRight,
  Landmark,
  Tag,
  Target,
  RefreshCw,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useTheme } from "../../contexts/ThemeContext";

const navItems = [
  { to: "/",       label: "Dashboard", icon: LayoutDashboard },
  { to: "/notes",  label: "Notas",     icon: FileText        },
  { to: "/tasks",  label: "Tarefas",   icon: CheckSquare     },
];

const financeSubItems = [
  { to: "/finance",             label: "Visão Geral",  icon: LayoutDashboard  },
  { to: "/finance/transactions",label: "Transações",   icon: ArrowLeftRight   },
  { to: "/finance/accounts",    label: "Contas",       icon: Landmark         },
  { to: "/finance/categories",  label: "Categorias",   icon: Tag              },
  { to: "/finance/goals",       label: "Metas",        icon: Target           },
  { to: "/finance/recurring",   label: "Recorrências", icon: RefreshCw        },
];

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, signOut } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  const isInFinance = location.pathname.startsWith("/finance");
  const [financeOpen, setFinanceOpen] = useState(isInFinance);

  function cycleTheme() {
    const cycle: Record<string, "dark" | "system" | "light"> = {
      light:  "dark",
      dark:   "system",
      system: "light",
    };
    setTheme(cycle[theme]);
  }

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <div className="flex min-h-dvh bg-neutral-50 dark:bg-surface-dark">
      {drawerOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      {/* Sidebar / Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-neutral-200 bg-white transition-transform dark:border-border-dark dark:bg-card-dark ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        } lg:static lg:translate-x-0 lg:rounded-none rounded-r-2xl`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-neutral-200 px-6 dark:border-border-dark">
          <img src="/logo.png" alt="EvoBuddy" className="h-7 w-auto" />
          <button
            className="text-neutral-500 hover:text-neutral-700 lg:hidden min-h-0 min-w-0 p-1"
            onClick={() => setDrawerOpen(false)}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800/60"
                }`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}

          {/* Finance collapsible section */}
          <button
            onClick={() => setFinanceOpen((prev) => !prev)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isInFinance
                ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800/60"
            }`}
          >
            <Wallet className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-left">Finanças</span>
            {financeOpen
              ? <ChevronDown className="h-4 w-4 shrink-0" />
              : <ChevronRight className="h-4 w-4 shrink-0" />
            }
          </button>

          {financeOpen && (
            <div className="space-y-1">
              {financeSubItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/finance"}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl pl-9 pr-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800/60"
                    }`
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        {/* User + theme toggle */}
        <div className="border-t border-neutral-200 px-4 py-4 dark:border-border-dark">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
              {user?.email?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {user?.email ?? "Usuário"}
              </p>
            </div>
            <button
              onClick={cycleTheme}
              className="rounded-xl p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 min-h-0 min-w-0"
              title={`Tema: ${theme}`}
              aria-label={`Alternar tema (atual: ${theme})`}
            >
              <ThemeIcon className="h-4 w-4" />
            </button>
            <button
              onClick={signOut}
              className="rounded-xl p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 min-h-0 min-w-0"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Header mobile */}
        <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 dark:border-border-dark dark:bg-card-dark lg:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-xl p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 min-h-0 min-w-0"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-lg font-bold text-brand-500">
            EvoBuddy
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={cycleTheme}
              className="rounded-xl p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 min-h-0 min-w-0"
              aria-label={`Alternar tema (atual: ${theme})`}
            >
              <ThemeIcon className="h-4 w-4" />
            </button>
            <button
              onClick={signOut}
              className="rounded-xl p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 min-h-0 min-w-0"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div key={location.key} className="animate-pop-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
