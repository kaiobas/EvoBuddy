# Onboarding Tour + Tela de Configurações — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar tour de onboarding automático (driver.js) para novos usuários e uma tela de configurações completa em `/settings`.

**Architecture:** O tour é controlado pela chave `evobuddy_tour_done` no localStorage e iniciado pelo hook `useTour` dentro do `Layout` via `useEffect`. A tela de configurações é uma nova rota `/settings` com seções de perfil (via API backend + Supabase user_metadata), aparência, notificações (stub), tour e conta (deleção via endpoint backend).

**Tech Stack:** driver.js v1.x, React 19, Supabase Auth Admin, Express/Node.js, TailwindCSS, lucide-react

## Global Constraints

- Usar apenas ícones de `lucide-react` — nunca SVG inline
- Classes Tailwind: `rounded-2xl`, `brand-500`, `card-dark`, `border-dark`, etc. — seguir design system do CLAUDE.md
- Fontes: `font-display` (Plus Jakarta Sans) para headings, `font-sans` (Inter) para corpo
- Toast via `useToast()` em todas as operações CRUD
- Backend: `authMiddleware` + `supabaseAdmin` em todas as rotas protegidas; seguir padrão de `notes.ts`
- Projeto não possui test suite — verificação via `pnpm typecheck` + teste manual no browser
- Perfil armazenado em `auth.users.user_metadata.display_name` (sem nova tabela)

---

## Mapa de Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `packages/api/src/routes/users.ts` |
| Modificar | `packages/api/src/router.ts` |
| Modificar | `apps/web/src/lib/api.ts` |
| Criar | `apps/web/src/lib/tour.ts` |
| Criar | `apps/web/src/hooks/useTour.ts` |
| Modificar | `apps/web/src/styles/globals.css` |
| Modificar | `apps/web/src/components/layout/Layout.tsx` |
| Criar | `apps/web/src/components/features/settings/DeleteAccountModal.tsx` |
| Criar | `apps/web/src/routes/settings.tsx` |
| Modificar | `apps/web/src/App.tsx` |

---

### Task 1: Backend — Users router (perfil + delete conta)

**Files:**
- Create: `packages/api/src/routes/users.ts`
- Modify: `packages/api/src/router.ts`

**Interfaces:**
- Produces: `GET /api/users/me/profile` → `{ display_name: string | null, email: string | null }`, `PUT /api/users/me/profile` → mesma shape, `DELETE /api/users/me` → 204

- [ ] **Step 1: Criar `packages/api/src/routes/users.ts`**

```typescript
import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { AppError } from "../middleware/error.js";

const router = Router();

router.use(authMiddleware);

/**
 * GET /api/users/me/profile
 */
router.get("/me/profile", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin!.auth.admin.getUserById(req.user!.id);
    if (error || !data.user) throw new AppError("Usuário não encontrado", 404);
    res.json({
      display_name: (data.user.user_metadata?.display_name as string) ?? null,
      email: data.user.email ?? null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/users/me/profile
 */
const updateProfileSchema = z.object({
  display_name: z.string().max(100).optional(),
});

router.put("/me/profile", validate(updateProfileSchema), async (req, res, next) => {
  try {
    const { display_name } = req.body;
    const { data, error } = await supabaseAdmin!.auth.admin.updateUserById(
      req.user!.id,
      { user_metadata: { display_name } }
    );
    if (error || !data.user) throw new AppError("Erro ao atualizar perfil", 500);
    res.json({
      display_name: (data.user.user_metadata?.display_name as string) ?? null,
      email: data.user.email ?? null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/users/me
 */
router.delete("/me", async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin!.auth.admin.deleteUser(req.user!.id);
    if (error) throw new AppError("Erro ao excluir conta", 500);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: Registrar router em `packages/api/src/router.ts`**

Adicionar import após o import de `calendarRouter`:
```typescript
import usersRouter from "./routes/users.js";
```

Adicionar após `router.use("/api/calendar", calendarRouter);`:
```typescript
router.use("/api/users", usersRouter);
```

- [ ] **Step 3: Verificar tipagem**

```bash
pnpm typecheck
```

Esperado: sem erros em `packages/api`

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routes/users.ts packages/api/src/router.ts
git commit -m "feat(api): adicionar router de usuários (perfil e delete conta)"
```

---

### Task 2: Frontend — usersApi

**Files:**
- Modify: `apps/web/src/lib/api.ts`

**Interfaces:**
- Consumes: endpoints da Task 1
- Produces: `usersApi.getProfile()` → `Promise<ProfileDTO>`, `usersApi.updateProfile(data: UpdateProfileDTO)` → `Promise<ProfileDTO>`, `usersApi.deleteAccount()` → `Promise<void>`

- [ ] **Step 1: Adicionar ao final de `apps/web/src/lib/api.ts`**

```typescript
// ─── Users ───────────────────────────────────────────────────

export interface ProfileDTO {
  display_name: string | null;
  email: string | null;
}

export interface UpdateProfileDTO {
  display_name?: string;
}

export const usersApi = {
  getProfile: () => request<ProfileDTO>("/api/users/me/profile"),
  updateProfile: (data: UpdateProfileDTO) =>
    request<ProfileDTO>("/api/users/me/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteAccount: () =>
    request<void>("/api/users/me", { method: "DELETE" }),
};
```

- [ ] **Step 2: Verificar tipagem**

```bash
pnpm typecheck
```

Esperado: sem erros

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): adicionar usersApi (perfil e delete conta)"
```

---

### Task 3: Tour — instalação, config e hook

**Files:**
- Create: `apps/web/src/lib/tour.ts`
- Create: `apps/web/src/hooks/useTour.ts`
- Modify: `apps/web/src/styles/globals.css`

**Interfaces:**
- Produces: `useTour()` → `{ startTour: () => void, resetTour: () => void, hasDoneTour: boolean }`

- [ ] **Step 1: Instalar driver.js**

```bash
cd apps/web && pnpm add driver.js
```

Esperado: `driver.js` aparece em `apps/web/package.json` dependencies

- [ ] **Step 2: Criar `apps/web/src/lib/tour.ts`**

```typescript
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export const TOUR_DONE_KEY = "evobuddy_tour_done";

export function createTour() {
  return driver({
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Próximo →",
    prevBtnText: "← Anterior",
    doneBtnText: "Concluir",
    onDestroyed: () => {
      localStorage.setItem(TOUR_DONE_KEY, "true");
    },
    steps: [
      {
        element: "[data-tour='logo']",
        popover: {
          title: "Bem-vindo ao EvoBuddy 👋",
          description: "Seu assistente de produtividade pessoal. Vamos te mostrar o que está disponível.",
          side: "right",
        },
      },
      {
        element: "[data-tour='nav-dashboard']",
        popover: {
          title: "Dashboard",
          description: "Veja um resumo de tudo: tarefas pendentes, eventos do dia e saldo financeiro.",
          side: "right",
        },
      },
      {
        element: "[data-tour='nav-notes']",
        popover: {
          title: "Notas",
          description: "Crie e organize anotações rápidas com suporte a Markdown.",
          side: "right",
        },
      },
      {
        element: "[data-tour='nav-tasks']",
        popover: {
          title: "Tarefas",
          description: "Gerencie suas tarefas com prioridade e data de vencimento.",
          side: "right",
        },
      },
      {
        element: "[data-tour='nav-calendar']",
        popover: {
          title: "Calendário",
          description: "Visualize e crie eventos nas visões mês, semana ou dia.",
          side: "right",
        },
      },
      {
        element: "[data-tour='nav-finance']",
        popover: {
          title: "Finanças",
          description: "Controle receitas, despesas, contas bancárias e metas financeiras.",
          side: "right",
        },
      },
      {
        element: "[data-tour='theme-toggle']",
        popover: {
          title: "Tema",
          description: "Alterne entre tema claro, escuro ou automático (segue o sistema).",
          side: "top",
        },
      },
      {
        element: "[data-tour='nav-settings']",
        popover: {
          title: "Configurações",
          description: "Acesse perfil, preferências e este tour a qualquer momento.",
          side: "right",
        },
      },
    ],
  });
}
```

- [ ] **Step 3: Criar `apps/web/src/hooks/useTour.ts`**

```typescript
import { useCallback } from "react";
import { createTour, TOUR_DONE_KEY } from "../lib/tour";

export function useTour() {
  const hasDoneTour = localStorage.getItem(TOUR_DONE_KEY) === "true";

  const startTour = useCallback(() => {
    const tourInstance = createTour();
    tourInstance.drive();
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_DONE_KEY);
    const tourInstance = createTour();
    tourInstance.drive();
  }, []);

  return { startTour, resetTour, hasDoneTour };
}
```

- [ ] **Step 4: Adicionar CSS overrides ao final de `apps/web/src/styles/globals.css`**

```css
/* driver.js overrides — alinha ao design system do EvoBuddy */
.driver-popover {
  border-radius: 16px !important;
  font-family: Inter, sans-serif !important;
}

.driver-popover-title {
  font-family: 'Plus Jakarta Sans', sans-serif !important;
  font-size: 1rem !important;
  font-weight: 700 !important;
  color: #1E1B2E !important;
}

.driver-popover-description {
  font-size: 0.875rem !important;
  color: #525252 !important;
}

.driver-popover-next-btn,
.driver-popover-done-btn {
  background-color: #7C6FCD !important;
  border: none !important;
  border-radius: 10px !important;
  color: #fff !important;
}

.driver-popover-next-btn:hover,
.driver-popover-done-btn:hover {
  background-color: #6b5ec0 !important;
}

.driver-popover-prev-btn {
  border-radius: 10px !important;
  color: #525252 !important;
}

.driver-popover-progress-text {
  font-size: 0.75rem !important;
  color: #a3a3a3 !important;
}
```

- [ ] **Step 5: Verificar tipagem**

```bash
pnpm typecheck
```

Esperado: sem erros

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/tour.ts apps/web/src/hooks/useTour.ts apps/web/src/styles/globals.css apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): adicionar tour de onboarding com driver.js"
```

---

### Task 4: Layout — data-tour attrs + link Settings + auto-start do tour

**Files:**
- Modify: `apps/web/src/components/layout/Layout.tsx`

**Interfaces:**
- Consumes: `useTour()` → `{ startTour, hasDoneTour }` (Task 3)

- [ ] **Step 1: Adicionar `Settings` ao import do lucide-react e importar `useTour`**

Substituir os imports no topo do arquivo:

```typescript
import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  CalendarDays,
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
  Settings,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useTheme } from "../../contexts/ThemeContext";
import { useTour } from "../../hooks/useTour";
```

- [ ] **Step 2: Adicionar `tourId` ao array `navItems`**

```typescript
const navItems = [
  { to: "/",         label: "Dashboard",  icon: LayoutDashboard, tourId: "nav-dashboard" },
  { to: "/notes",    label: "Notas",      icon: FileText,        tourId: "nav-notes"     },
  { to: "/tasks",    label: "Tarefas",    icon: CheckSquare,     tourId: "nav-tasks"     },
  { to: "/calendar", label: "Calendário", icon: CalendarDays,    tourId: "nav-calendar"  },
];
```

- [ ] **Step 3: Inicializar `useTour` e adicionar `useEffect` de auto-start**

Dentro da função `Layout()`, após as declarações de `financeOpen` e `isInFinance`:

```typescript
const { startTour, hasDoneTour } = useTour();

useEffect(() => {
  if (!hasDoneTour) {
    const timer = setTimeout(() => startTour(), 500);
    return () => clearTimeout(timer);
  }
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Adicionar `data-tour="logo"` na primeira imagem da sidebar**

Localizar (dentro do `<aside>`):
```tsx
<img src="/logo-black.png" alt="EvoBuddy" className="h-28 w-auto dark:hidden" />
```

Substituir por:
```tsx
<img src="/logo-black.png" alt="EvoBuddy" className="h-28 w-auto dark:hidden" data-tour="logo" />
```

- [ ] **Step 5: Adicionar `data-tour={item.tourId}` no `NavLink` de `navItems.map`**

Localizar o `NavLink` dentro do `navItems.map(...)` e adicionar o atributo:
```tsx
<NavLink
  key={item.to}
  to={item.to}
  end={item.to === "/"}
  data-tour={item.tourId}
  onClick={() => setDrawerOpen(false)}
  className={({ isActive }) => ...}
>
```

- [ ] **Step 6: Adicionar `data-tour="nav-finance"` no botão de Finance collapsible**

Localizar:
```tsx
<button
  onClick={() => setFinanceOpen((prev) => !prev)}
```

Substituir por:
```tsx
<button
  data-tour="nav-finance"
  onClick={() => setFinanceOpen((prev) => !prev)}
```

- [ ] **Step 7: Adicionar link de Settings e `data-tour="theme-toggle"` dentro da sidebar**

Dentro do `<nav className="flex-1 space-y-1 px-3 py-4">`, ao final (após o bloco `financeOpen`), adicionar o link de Configurações:

```tsx
<NavLink
  to="/settings"
  data-tour="nav-settings"
  onClick={() => setDrawerOpen(false)}
  className={({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800/60"
    }`
  }
>
  <Settings className="h-5 w-5 shrink-0" />
  Configurações
</NavLink>
```

No botão de tema dentro do bloco "User + theme toggle" (desktop sidebar), adicionar `data-tour="theme-toggle"`:
```tsx
<button
  data-tour="theme-toggle"
  onClick={cycleTheme}
  className="rounded-xl p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 min-h-0 min-w-0"
  title={`Tema: ${theme}`}
  aria-label={`Alternar tema (atual: ${theme})`}
>
```

- [ ] **Step 8: Verificar tipagem**

```bash
pnpm typecheck
```

Esperado: sem erros

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/layout/Layout.tsx
git commit -m "feat(web): data-tour attrs, link Configurações e auto-start do tour no Layout"
```

---

### Task 5: DeleteAccountModal

**Files:**
- Create: `apps/web/src/components/features/settings/DeleteAccountModal.tsx`

**Interfaces:**
- Produces: `<DeleteAccountModal open={boolean} onClose={() => void} onConfirm={() => Promise<void>} loading={boolean} />`

- [ ] **Step 1: Criar `apps/web/src/components/features/settings/DeleteAccountModal.tsx`**

```tsx
import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading: boolean;
}

export function DeleteAccountModal({ open, onClose, onConfirm, loading }: Props) {
  const [input, setInput] = useState("");

  if (!open) return null;

  async function handleConfirm() {
    if (input !== "excluir") return;
    await onConfirm();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-border-dark dark:bg-card-dark">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <h2 className="font-display text-lg font-bold text-ink dark:text-neutral-100">
              Excluir conta
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 min-h-0 min-w-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          Esta ação é <strong>irreversível</strong>. Todos os seus dados (notas, tarefas, finanças, calendário) serão excluídos permanentemente.
        </p>

        <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Digite <span className="font-mono font-bold text-red-500">excluir</span> para confirmar:
        </p>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="excluir"
          className="mb-4 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100"
        />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 dark:border-border-dark dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={input !== "excluir" || loading}
            className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Excluindo..." : "Excluir conta"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipagem**

```bash
pnpm typecheck
```

Esperado: sem erros

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/features/settings/DeleteAccountModal.tsx
git commit -m "feat(web): adicionar DeleteAccountModal"
```

---

### Task 6: Settings page + rota

**Files:**
- Create: `apps/web/src/routes/settings.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `usersApi.getProfile()`, `usersApi.updateProfile(data: UpdateProfileDTO)`, `usersApi.deleteAccount()` (Task 2); `useTour()` → `{ resetTour }` (Task 3); `DeleteAccountModal` (Task 5); `useTheme()`, `useToast()`, `useAuthStore()`

- [ ] **Step 1: Criar `apps/web/src/routes/settings.tsx`**

```tsx
import { useEffect, useState } from "react";
import { User, Palette, Bell, HelpCircle, Shield, Sun, Moon, Monitor } from "lucide-react";
import { usersApi, type ProfileDTO } from "../lib/api";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { useAuthStore } from "../stores/authStore";
import { useTour } from "../hooks/useTour";
import { supabase } from "../lib/supabase";
import { DeleteAccountModal } from "../components/features/settings/DeleteAccountModal";

export function SettingsPage() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuthStore();
  const { resetTour } = useTour();

  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    usersApi.getProfile().then((data) => {
      setProfile(data);
      setDisplayName(data.display_name ?? "");
    }).catch(() => {
      toast("Erro ao carregar perfil.", "error");
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await usersApi.updateProfile({ display_name: displayName });
      setProfile(updated);
      toast("Perfil atualizado.", "success");
    } catch {
      toast("Erro ao atualizar perfil.", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordReset() {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email);
      if (error) throw error;
      toast("Email de redefinição de senha enviado.", "success");
    } catch {
      toast("Erro ao enviar email de redefinição.", "error");
    } finally {
      setSendingReset(false);
    }
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    try {
      await usersApi.deleteAccount();
      await signOut();
    } catch {
      toast("Erro ao excluir conta.", "error");
      setDeletingAccount(false);
      setShowDeleteModal(false);
    }
  }

  const initial = (profile?.display_name || user?.email)?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-display text-2xl font-bold text-ink dark:text-neutral-100">
        Configurações
      </h1>

      <div className="space-y-6">
        {/* Perfil */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-border-dark dark:bg-card-dark">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-brand-500" />
            <h2 className="font-display text-base font-bold text-ink dark:text-neutral-100">Perfil</h2>
          </div>

          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
              {initial}
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {profile?.display_name || "Sem nome definido"}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Nome de exibição
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Seu nome"
                maxLength={100}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Email
              </label>
              <input
                type="email"
                value={user?.email ?? ""}
                readOnly
                className="w-full cursor-not-allowed rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-2.5 text-sm text-neutral-500 outline-none dark:border-border-dark dark:bg-surface-dark/60 dark:text-neutral-500"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-60"
            >
              {savingProfile ? "Salvando..." : "Salvar alterações"}
            </button>
          </form>
        </section>

        {/* Aparência */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-border-dark dark:bg-card-dark">
          <div className="mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5 text-brand-500" />
            <h2 className="font-display text-base font-bold text-ink dark:text-neutral-100">Aparência</h2>
          </div>

          <div className="flex gap-3">
            {(["light", "dark", "system"] as const).map((t) => {
              const Icon = t === "light" ? Sun : t === "dark" ? Moon : Monitor;
              const labels: Record<string, string> = { light: "Claro", dark: "Escuro", system: "Sistema" };
              return (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex flex-1 flex-col items-center gap-2 rounded-xl border px-4 py-3 text-xs font-medium transition ${
                    theme === t
                      ? "border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-900/20 dark:text-brand-300"
                      : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-border-dark dark:text-neutral-400 dark:hover:bg-neutral-800/60"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {labels[t]}
                </button>
              );
            })}
          </div>
        </section>

        {/* Notificações */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-border-dark dark:bg-card-dark">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-brand-500" />
            <h2 className="font-display text-base font-bold text-ink dark:text-neutral-100">Notificações</h2>
          </div>
          <div className="space-y-3">
            {["Lembretes de tarefas", "Alertas de metas financeiras"].map((label) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500">
                    Em breve
                  </span>
                  <div className="h-5 w-10 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tour & Ajuda */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-border-dark dark:bg-card-dark">
          <div className="mb-4 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-brand-500" />
            <h2 className="font-display text-base font-bold text-ink dark:text-neutral-100">Tour & Ajuda</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Tour de introdução</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Revisita o tutorial guiado do EvoBuddy</p>
            </div>
            <button
              onClick={resetTour}
              className="rounded-xl border border-brand-300 px-4 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-900/20"
            >
              Refazer tour
            </button>
          </div>
        </section>

        {/* Conta */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-border-dark dark:bg-card-dark">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand-500" />
            <h2 className="font-display text-base font-bold text-ink dark:text-neutral-100">Conta</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Alterar senha</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Envia um email de redefinição</p>
              </div>
              <button
                onClick={handlePasswordReset}
                disabled={sendingReset}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-60 dark:border-border-dark dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                {sendingReset ? "Enviando..." : "Enviar email"}
              </button>
            </div>

            <div className="border-t border-neutral-100 pt-3 dark:border-border-dark">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Excluir conta</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Ação irreversível — todos os dados serão apagados</p>
                </div>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <DeleteAccountModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        loading={deletingAccount}
      />
    </div>
  );
}
```

- [ ] **Step 2: Adicionar rota `/settings` em `apps/web/src/App.tsx`**

Adicionar import após o import de `CalendarPage`:
```typescript
import { SettingsPage } from "./routes/settings";
```

Adicionar dentro do bloco `AuthGuard > Layout`, após `<Route path="calendar" element={<CalendarPage />} />`:
```tsx
<Route path="settings" element={<SettingsPage />} />
```

- [ ] **Step 3: Verificar tipagem em todos os pacotes**

```bash
pnpm typecheck
```

Esperado: sem erros em `apps/web`, `packages/api`, `packages/shared`

- [ ] **Step 4: Testar no browser**

```bash
pnpm dev
```

Verificar:
1. Primeiro acesso → tour inicia automaticamente após ~500ms
2. Navegar pelos 8 steps do tour
3. Acessar `/settings` pelo link "Configurações" na sidebar
4. Seção Perfil: editar nome e salvar → toast "Perfil atualizado."
5. Seção Aparência: clicar em cada tema → UI muda imediatamente
6. Seção Tour & Ajuda: "Refazer tour" → tour reinicia
7. Seção Conta: "Enviar email" → toast de sucesso; botão "Excluir" → modal abre, campo bloqueado até digitar "excluir"

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/settings.tsx apps/web/src/App.tsx
git commit -m "feat(web): adicionar tela de configurações completa (/settings)"
```
