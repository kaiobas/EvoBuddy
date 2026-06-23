# Google Calendar Sync — Plano 1: OAuth + Settings UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que usuários conectem e desconectem sua conta Google em `/settings`, armazenando tokens OAuth de forma segura para uso futuro pela engine de sync.

**Architecture:** OAuth2 server-side com redirect full-page. O backend gera a URL de autorização com um `state` HMAC para CSRF protection, troca o código por tokens, criptografa com AES-256-GCM e salva no Supabase. O frontend detecta `?google=connected` na URL de retorno e exibe feedback.

**Tech Stack:** Node.js crypto (nativo), `googleapis` npm, React 19, TailwindCSS, Supabase PostgreSQL

## Global Constraints

- Imports ESM com extensão `.js` em todos os arquivos `packages/api/`
- Ícones apenas de `lucide-react` — exceto o SVG do logo Google (inline, uma única exceção documentada)
- Classes Tailwind seguindo design system: `rounded-2xl`, `brand-500`, `card-dark`, `border-dark`
- `authMiddleware` em todas as rotas protegidas
- `AppError` + `next(err)` em todos os handlers de rota
- Verificação: `pnpm typecheck` do root — deve passar com 0 erros
- Sem test suite — verificação via typecheck + teste manual no browser
- Migration SQL deve ser rodada manualmente no Supabase SQL Editor (não via script automatizado)

---

## Mapa de Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `packages/api/src/db/migrations/003_google_calendar_sync.sql` |
| Modificar | `packages/api/src/db/run-migrations.ts` |
| Criar | `packages/api/src/lib/crypto.ts` |
| Criar | `packages/api/src/lib/googleAuth.ts` |
| Criar | `packages/api/src/routes/google.ts` |
| Modificar | `packages/api/src/router.ts` |
| Modificar | `apps/web/src/lib/api.ts` |
| Modificar | `apps/web/src/routes/settings.tsx` |

---

### Task 1: Migration SQL + run-migrations

**Files:**
- Create: `packages/api/src/db/migrations/003_google_calendar_sync.sql`
- Modify: `packages/api/src/db/run-migrations.ts`

**Interfaces:**
- Produces: tabela `google_calendar_tokens`, colunas `google_event_id` e `google_updated_at` em `calendar_events`

- [ ] **Step 1: Criar `packages/api/src/db/migrations/003_google_calendar_sync.sql`**

```sql
-- Migration 003: Google Calendar sync
-- Apply via: Supabase Dashboard > SQL Editor

-- Tabela para armazenar tokens OAuth do Google por usuário
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  calendar_id     TEXT NOT NULL DEFAULT 'primary',
  last_synced_at  TIMESTAMPTZ,
  sync_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_user_id
  ON google_calendar_tokens(user_id);

ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Novas colunas em calendar_events para rastrear sync
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS google_event_id   TEXT,
  ADD COLUMN IF NOT EXISTS google_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_calendar_events_google_event_id
  ON calendar_events(google_event_id)
  WHERE google_event_id IS NOT NULL;
```

- [ ] **Step 2: Rodar a migration no Supabase**

Acesse o Supabase Dashboard → projeto `qshydmetfsgfkxwnbuni` → SQL Editor → cole e execute o SQL acima.

Verificar que as tabelas foram criadas sem erros.

- [ ] **Step 3: Adicionar migration ao registro em `run-migrations.ts`**

Localizar o array `migrations` e adicionar:
```typescript
const migrations: Migration[] = [
  { version: 1, name: "Create notes table", file: "001_create_notes.sql" },
  { version: 2, name: "Create tasks table", file: "002_create_tasks.sql" },
  { version: 3, name: "Google Calendar sync", file: "003_google_calendar_sync.sql" },
];
```

- [ ] **Step 4: Verificar tipagem**

```bash
pnpm typecheck
```

Esperado: sem erros

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/db/migrations/003_google_calendar_sync.sql packages/api/src/db/run-migrations.ts
git commit -m "feat(api): adicionar migration para sync Google Calendar"
```

---

### Task 2: Crypto utilities

**Files:**
- Create: `packages/api/src/lib/crypto.ts`

**Interfaces:**
- Produces: `encrypt(plaintext: string): string`, `decrypt(ciphertext: string): string`
- Formato do ciphertext: `${ivHex}:${authTagHex}:${encryptedHex}` (strings hex separadas por `:`)

- [ ] **Step 1: Criar `packages/api/src/lib/crypto.ts`**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getKey(): Buffer {
  const keyHex = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!keyHex) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY not set");
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV recomendado para AES-GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}
```

- [ ] **Step 2: Verificar tipagem**

```bash
pnpm typecheck
```

Esperado: sem erros

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/lib/crypto.ts
git commit -m "feat(api): adicionar utilitários de criptografia AES-256-GCM"
```

---

### Task 3: Google OAuth lib + endpoints

**Files:**
- Create: `packages/api/src/lib/googleAuth.ts`
- Create: `packages/api/src/routes/google.ts`
- Modify: `packages/api/src/router.ts`

**Interfaces:**
- Consumes: `encrypt`, `decrypt` (Task 2)
- Produces:
  - `createOAuth2Client()` → `OAuth2Client`
  - `getAuthUrl(userId: string): string`
  - `getValidAccessToken(userId: string): Promise<string>`
  - `GET /api/google/auth-url` → `{ url: string }`
  - `GET /api/google/callback?code&state` → redirect
  - `GET /api/google/status` → `{ connected: boolean, last_synced_at: string | null, sync_error: string | null }`
  - `DELETE /api/google/disconnect` → 204
  - `POST /api/google/sync` → `{ synced_at: string }` (stub para o Plano 2)

- [ ] **Step 1: Instalar `googleapis`**

```bash
cd /Users/kaioba/Documents/GitHub/EvoBuddy/packages/api && pnpm add googleapis
```

Esperado: `googleapis` adicionado em `packages/api/package.json`

- [ ] **Step 2: Criar `packages/api/src/lib/googleAuth.ts`**

```typescript
import { google } from "googleapis";
import { createHmac } from "crypto";
import { encrypt, decrypt } from "./crypto.js";
import { supabaseAdmin } from "./supabase.js";
import { AppError } from "../middleware/error.js";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function createState(userId: string): string {
  const hmac = createHmac("sha256", process.env.GOOGLE_TOKEN_ENCRYPTION_KEY!);
  hmac.update(userId);
  const sig = hmac.digest("hex");
  return Buffer.from(`${userId}:${sig}`).toString("base64url");
}

export function verifyState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx === -1) return null;
    const userId = decoded.slice(0, colonIdx);
    const sig = decoded.slice(colonIdx + 1);
    const hmac = createHmac("sha256", process.env.GOOGLE_TOKEN_ENCRYPTION_KEY!);
    hmac.update(userId);
    const expected = hmac.digest("hex");
    if (sig !== expected) return null;
    return userId;
  } catch {
    return null;
  }
}

export function getAuthUrl(userId: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state: createState(userId),
  });
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin!
    .from("google_calendar_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !data) throw new AppError("Google Calendar não conectado", 400);

  const expiresAt = new Date(data.expires_at as string);
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt < fiveMinutesFromNow) {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: decrypt(data.refresh_token as string) });

    const { credentials } = await oauth2Client.refreshAccessToken();
    if (!credentials.access_token || !credentials.expiry_date) {
      throw new AppError("Falha ao renovar token Google", 500);
    }

    await supabaseAdmin!
      .from("google_calendar_tokens")
      .update({
        access_token: encrypt(credentials.access_token),
        expires_at: new Date(credentials.expiry_date).toISOString(),
      })
      .eq("user_id", userId);

    return credentials.access_token;
  }

  return decrypt(data.access_token as string);
}
```

- [ ] **Step 3: Criar `packages/api/src/routes/google.ts`**

```typescript
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { encrypt } from "../lib/crypto.js";
import {
  createOAuth2Client,
  getAuthUrl,
  verifyState,
} from "../lib/googleAuth.js";

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/**
 * GET /api/google/auth-url
 * Retorna a URL de autorização do Google OAuth2.
 * Requer autenticação.
 */
router.get("/auth-url", authMiddleware, (req, res, next) => {
  try {
    const url = getAuthUrl(req.user!.id);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/google/callback
 * Recebe o código de autorização do Google e salva os tokens.
 * NÃO requer authMiddleware — o state HMAC autentica o usuário.
 */
router.get("/callback", async (req, res, next) => {
  try {
    const { code, state, error: oauthError } = req.query as Record<string, string>;

    if (oauthError) {
      return res.redirect(`${FRONTEND_URL}/settings?google=error&message=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !state) {
      throw new AppError("Parâmetros inválidos no callback", 400);
    }

    const userId = verifyState(state);
    if (!userId) {
      throw new AppError("State inválido ou adulterado", 403);
    }

    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
      throw new AppError("Tokens incompletos retornados pelo Google", 500);
    }

    await supabaseAdmin!
      .from("google_calendar_tokens")
      .upsert(
        {
          user_id: userId,
          access_token: encrypt(tokens.access_token),
          refresh_token: encrypt(tokens.refresh_token),
          expires_at: new Date(tokens.expiry_date).toISOString(),
          calendar_id: "primary",
          sync_error: null,
        },
        { onConflict: "user_id" }
      );

    return res.redirect(`${FRONTEND_URL}/settings?google=connected`);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/google/status
 * Retorna o status da conexão Google do usuário autenticado.
 */
router.get("/status", authMiddleware, async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin!
      .from("google_calendar_tokens")
      .select("last_synced_at, sync_error")
      .eq("user_id", req.user!.id)
      .single();

    if (!data) {
      return res.json({ connected: false, last_synced_at: null, sync_error: null });
    }

    res.json({
      connected: true,
      last_synced_at: data.last_synced_at ?? null,
      sync_error: data.sync_error ?? null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/google/disconnect
 * Remove tokens e desconecta o Google Calendar.
 */
router.delete("/disconnect", authMiddleware, async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin!
      .from("google_calendar_tokens")
      .select("access_token, refresh_token")
      .eq("user_id", req.user!.id)
      .single();

    if (data) {
      // Tenta revogar o token no Google (best-effort, não falha se der erro)
      try {
        const oauth2Client = createOAuth2Client();
        const { decrypt } = await import("../lib/crypto.js");
        await oauth2Client.revokeToken(decrypt(data.access_token as string));
      } catch {
        // Revogação é best-effort
      }

      await supabaseAdmin!
        .from("google_calendar_tokens")
        .delete()
        .eq("user_id", req.user!.id);

      // Desancora eventos (mantém conteúdo, remove google_event_id)
      await supabaseAdmin!
        .from("calendar_events")
        .update({ google_event_id: null, google_updated_at: null })
        .eq("user_id", req.user!.id);
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/google/sync
 * Stub para o Plano 2 — retorna 501 até a engine ser implementada.
 */
router.post("/sync", authMiddleware, (_req, _res, next) => {
  next(new AppError("Sync engine não implementada ainda (Plano 2)", 501));
});

export default router;
```

- [ ] **Step 4: Registrar router em `packages/api/src/router.ts`**

Adicionar import após imports existentes:
```typescript
import googleRouter from "./routes/google.js";
```

Adicionar rota após `router.use("/api/users", usersRouter);`:
```typescript
router.use("/api/google", googleRouter);
```

- [ ] **Step 5: Verificar tipagem**

```bash
pnpm typecheck
```

Esperado: sem erros em `packages/api`

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/lib/googleAuth.ts packages/api/src/routes/google.ts packages/api/src/router.ts packages/api/package.json pnpm-lock.yaml
git commit -m "feat(api): adicionar OAuth Google Calendar (auth-url, callback, status, disconnect)"
```

---

### Task 4: Frontend — googleApi + seção Integrações em Settings

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/routes/settings.tsx`

**Interfaces:**
- Consumes: `GET /api/google/auth-url`, `GET /api/google/status`, `DELETE /api/google/disconnect` (Task 3)
- Produces:
  - `GoogleStatusDTO { connected: boolean; last_synced_at: string | null; sync_error: string | null }`
  - `googleApi.getAuthUrl()`, `googleApi.getStatus()`, `googleApi.disconnect()`, `googleApi.syncNow()`

- [ ] **Step 1: Adicionar `googleApi` ao final de `apps/web/src/lib/api.ts`**

```typescript
// ─── Google Calendar ──────────────────────────────────────────

export interface GoogleStatusDTO {
  connected: boolean;
  last_synced_at: string | null;
  sync_error: string | null;
}

export const googleApi = {
  getAuthUrl: () => request<{ url: string }>("/api/google/auth-url"),
  getStatus: () => request<GoogleStatusDTO>("/api/google/status"),
  disconnect: () => request<void>("/api/google/disconnect", { method: "DELETE" }),
  syncNow: () => request<{ synced_at: string }>("/api/google/sync", { method: "POST" }),
};
```

- [ ] **Step 2: Adicionar imports de `googleApi` e `Link2`/`Unlink` em `settings.tsx`**

Na linha de import de `api.ts`, adicionar `googleApi` e `GoogleStatusDTO`:
```typescript
import { usersApi, googleApi, type ProfileDTO, type GoogleStatusDTO } from "../lib/api";
```

Na linha de import do lucide-react, adicionar `Link2`, `Unlink`, `RefreshCw`, `CheckCircle`, `AlertCircle`:
```typescript
import {
  User, Palette, Bell, HelpCircle, Shield, Sun, Moon, Monitor,
  Link2, Unlink, RefreshCw, CheckCircle, AlertCircle,
} from "lucide-react";
```

- [ ] **Step 3: Adicionar state de Google em `SettingsPage`**

Após as declarações de state existentes, adicionar:
```typescript
const [googleStatus, setGoogleStatus] = useState<GoogleStatusDTO | null>(null);
const [loadingGoogle, setLoadingGoogle] = useState(true);
const [disconnecting, setDisconnecting] = useState(false);
```

- [ ] **Step 4: Carregar status Google e detectar `?google=connected` no `useEffect`**

Adicionar novo `useEffect` após o existente de perfil:
```typescript
useEffect(() => {
  // Detecta retorno do OAuth
  const params = new URLSearchParams(window.location.search);
  if (params.get("google") === "connected") {
    toast("Google Calendar conectado com sucesso.", "success");
    window.history.replaceState({}, "", "/settings");
  } else if (params.get("google") === "error") {
    const msg = params.get("message") || "Erro ao conectar Google Calendar.";
    toast(msg, "error");
    window.history.replaceState({}, "", "/settings");
  }

  // Carrega status
  googleApi.getStatus()
    .then(setGoogleStatus)
    .catch(() => setGoogleStatus({ connected: false, last_synced_at: null, sync_error: null }))
    .finally(() => setLoadingGoogle(false));
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 5: Implementar `handleGoogleConnect` e `handleGoogleDisconnect`**

```typescript
async function handleGoogleConnect() {
  try {
    const { url } = await googleApi.getAuthUrl();
    window.location.href = url;
  } catch {
    toast("Erro ao iniciar conexão com Google.", "error");
  }
}

async function handleGoogleDisconnect() {
  setDisconnecting(true);
  try {
    await googleApi.disconnect();
    setGoogleStatus({ connected: false, last_synced_at: null, sync_error: null });
    toast("Google Calendar desconectado.", "success");
  } catch {
    toast("Erro ao desconectar Google Calendar.", "error");
  } finally {
    setDisconnecting(false);
  }
}
```

- [ ] **Step 6: Adicionar seção "Integrações" no JSX**

Inserir após a seção Notificações e antes da seção Tour & Ajuda:

```tsx
{/* Integrações */}
<section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-border-dark dark:bg-card-dark">
  <div className="mb-4 flex items-center gap-2">
    <Link2 className="h-5 w-5 text-brand-500" />
    <h2 className="font-display text-base font-bold text-ink dark:text-neutral-100">Integrações</h2>
  </div>

  {loadingGoogle ? (
    <div className="flex items-center gap-2 text-sm text-neutral-500">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      Verificando conexão...
    </div>
  ) : !googleStatus?.connected ? (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Google Calendar</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Sincronize eventos com sua conta Google</p>
      </div>
      <button
        onClick={handleGoogleConnect}
        className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 active:scale-95"
      >
        <Link2 className="h-4 w-4" />
        Conectar
      </button>
    </div>
  ) : googleStatus.sync_error ? (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
        <div>
          <p className="text-sm font-medium text-red-600 dark:text-red-400">Google Calendar — Erro</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{googleStatus.sync_error}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleGoogleConnect}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 active:scale-95"
        >
          <RefreshCw className="h-4 w-4" />
          Reconectar
        </button>
        <button
          onClick={handleGoogleDisconnect}
          disabled={disconnecting}
          className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-60 dark:border-border-dark dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          <Unlink className="h-4 w-4" />
          Desconectar
        </button>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-between">
      <div className="flex items-start gap-3">
        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
        <div>
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Google Calendar</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {googleStatus.last_synced_at
              ? `Último sync: ${new Date(googleStatus.last_synced_at).toLocaleString("pt-BR")}`
              : "Conectado — aguardando primeiro sync"}
          </p>
        </div>
      </div>
      <button
        onClick={handleGoogleDisconnect}
        disabled={disconnecting}
        className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-60 dark:border-border-dark dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        <Unlink className="h-4 w-4" />
        {disconnecting ? "Desconectando..." : "Desconectar"}
      </button>
    </div>
  )}
</section>
```

- [ ] **Step 7: Verificar tipagem**

```bash
pnpm typecheck
```

Esperado: 0 erros em todos os pacotes

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/routes/settings.tsx
git commit -m "feat(web): adicionar seção Integrações com Google Calendar em /settings"
```

---

## Self-Review

**Spec coverage:**
- ✅ Tabela `google_calendar_tokens` com todos os campos do spec (Task 1)
- ✅ Colunas `google_event_id` + `google_updated_at` em `calendar_events` (Task 1)
- ✅ Criptografia AES-256-GCM com `GOOGLE_TOKEN_ENCRYPTION_KEY` (Task 2)
- ✅ `GET /api/google/auth-url` retorna URL com CSRF state (Task 3)
- ✅ `GET /api/google/callback` valida state, salva tokens criptografados, redirect (Task 3)
- ✅ `GET /api/google/status` → `{ connected, last_synced_at, sync_error }` (Task 3)
- ✅ `DELETE /api/google/disconnect` revoga token + limpa google_event_id (Task 3)
- ✅ `POST /api/google/sync` stub 501 para Plano 2 (Task 3)
- ✅ `googleApi` com todos os métodos do spec (Task 4)
- ✅ Seção Integrações com 3 estados: desconectado / conectado / erro (Task 4)
- ✅ Detecção de `?google=connected` e `?google=error` (Task 4)
- ✅ Redirect full-page (não popup) via `window.location.href` (Task 4)

**Placeholder scan:** sem TBDs. Todo step tem código completo. ✓

**Type consistency:**
- `GoogleStatusDTO` exportado de `api.ts` → importado em `settings.tsx` ✓
- `googleApi.getAuthUrl()` retorna `Promise<{ url: string }>` — consumido em `handleGoogleConnect` ✓
- `googleApi.disconnect()` retorna `Promise<void>` ✓
- `getValidAccessToken(userId)` exportado de `googleAuth.ts` — disponível para Plano 2 ✓

## Variáveis de Ambiente Necessárias

Adicionar ao `.env` na VPS `/opt/evobuddy/.env` **antes de fazer deploy**:
```
GOOGLE_CLIENT_ID=<do Google Cloud Console>
GOOGLE_CLIENT_SECRET=<do Google Cloud Console>
GOOGLE_REDIRECT_URI=https://api.bitsautomacoes.site/api/google/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=<output de: openssl rand -hex 32>
FRONTEND_URL=https://bitsautomacoes.site
```

No Google Cloud Console: habilitar Google Calendar API + criar OAuth2 credentials com redirect URI `https://api.bitsautomacoes.site/api/google/callback`.
