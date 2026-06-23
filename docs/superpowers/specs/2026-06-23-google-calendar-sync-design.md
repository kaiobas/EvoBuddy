# Design: Google Calendar Sync (Bidirecional)

**Data:** 2026-06-23
**Status:** Aprovado

---

## Visão Geral

Sincronização bidirecional entre o calendário do EvoBuddy e o Google Calendar primário do usuário, via polling server-side a cada 15 minutos. Usuários conectam sua conta Google em `/settings`. Google vence em conflitos. Eventos criados no EvoBuddy são empurrados para o Google; eventos do Google são puxados para o EvoBuddy.

---

## Escopo — 2 Planos de Implementação

| Plano | Conteúdo |
|-------|----------|
| **Plano 1: OAuth + Settings UI** | DB migration, OAuth endpoints, seção "Integrações" em `/settings` |
| **Plano 2: Sync Engine + UI Feedback** | Algoritmo de sync, polling job, endpoint de sync manual, indicador na CalendarPage |

Cada plano é independente e entrega valor por si só: Plano 1 entrega a conexão; Plano 2 entrega a sincronização.

---

## Variáveis de Ambiente

```env
# .env na VPS (/opt/evobuddy/.env)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://api.bitsautomacoes.site/api/google/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=...   # 32 bytes hex, gerado via: openssl rand -hex 32
```

```env
# apps/web/.env (local) e variáveis de build na VPS
VITE_API_URL=https://api.bitsautomacoes.site
```

---

## Plano 1: OAuth + Settings UI

### 1.1 Data Model — Migração SQL

**Nova tabela `google_calendar_tokens`:**
```sql
CREATE TABLE google_calendar_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token    text NOT NULL,         -- criptografado com AES-256-GCM
  refresh_token   text NOT NULL,         -- criptografado com AES-256-GCM
  expires_at      timestamptz NOT NULL,
  calendar_id     text NOT NULL DEFAULT 'primary',
  last_synced_at  timestamptz,
  sync_error      text,                  -- null = sem erro
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS: usuário só acessa os próprios tokens (backend usa service role, então RLS não bloqueia)
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;
```

**Novas colunas em `calendar_events`:**
```sql
ALTER TABLE calendar_events
  ADD COLUMN google_event_id   text,          -- null = evento só local
  ADD COLUMN google_updated_at timestamptz;   -- updated_at do evento no Google

CREATE INDEX idx_calendar_events_google_event_id
  ON calendar_events(google_event_id)
  WHERE google_event_id IS NOT NULL;
```

**Arquivo:** `packages/api/src/db/migrations/002_google_calendar_sync.sql`

### 1.2 Criptografia de Tokens

**Arquivo:** `packages/api/src/lib/crypto.ts`

Funções `encrypt(plaintext: string): string` e `decrypt(ciphertext: string): string` usando Node.js `crypto` módulo com AES-256-GCM. Chave lida de `process.env.GOOGLE_TOKEN_ENCRYPTION_KEY`.

Formato do ciphertext: `${iv_hex}:${authTag_hex}:${encrypted_hex}` (string base64-safe, armazenável em TEXT).

### 1.3 Backend — Google OAuth Endpoints

**Arquivo:** `packages/api/src/routes/google.ts`  
**Registrado em:** `packages/api/src/router.ts` como `router.use("/api/google", googleRouter)`

**Dependência:** `googleapis` npm package (`google-auth-library` + `@googleapis/calendar`)

```
GET  /api/google/auth-url      → { url: string }   (requer auth)
GET  /api/google/callback      → redirect para frontend com ?connected=1 ou ?error=...
GET  /api/google/status        → { connected: bool, last_synced_at, sync_error }  (requer auth)
DELETE /api/google/disconnect  → 204  (requer auth)
POST /api/google/sync          → { synced_at: string }  (requer auth, dispara sync manual)
```

**Fluxo OAuth:**

1. `GET /api/google/auth-url`: gera URL com escopos `https://www.googleapis.com/auth/calendar.events` e `offline` (para refresh_token). Inclui `state` = JWT assinado com `user_id` para CSRF protection.

2. `GET /api/google/callback`: valida `state`, troca `code` por tokens via `oauth2Client.getToken(code)`, criptografa e salva em `google_calendar_tokens`, redireciona para `${FRONTEND_URL}/settings?google=connected`.

3. `DELETE /api/google/disconnect`: revoga token no Google via `oauth2Client.revokeToken(access_token)`, deleta registro da tabela. Eventos com `google_event_id` mantêm conteúdo mas ficam com `google_event_id = null`.

**Refresh automático:** helper `getValidAccessToken(userId)` em `packages/api/src/lib/googleAuth.ts` — verifica `expires_at`, usa `refresh_token` se necessário, atualiza tabela.

### 1.4 Frontend — Seção "Integrações" em `/settings`

**Arquivo:** `apps/web/src/routes/settings.tsx` (modificação)  
**Novo arquivo:** `apps/web/src/lib/api.ts` (adição de `googleApi`)

**Nova seção entre Notificações e Tour & Ajuda:**

```
┌─────────────────────────────────────────────────────┐
│ 🔗 Integrações                                      │
│                                                     │
│ Google Calendar                    [Conectar]       │ ← estado desconectado
│ Sincronize eventos com sua conta Google             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 🔗 Integrações                                      │
│                                                     │
│ ● Google Calendar                                   │ ← estado conectado
│ Último sync: há 3 min                               │
│                          [Sincronizar] [Desconectar]│
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 🔗 Integrações                                      │
│                                                     │
│ ⚠ Google Calendar — Erro ao sincronizar             │ ← estado de erro
│ Token expirado. Reconecte sua conta.                │
│                          [Reconectar] [Desconectar] │
└─────────────────────────────────────────────────────┘
```

**Ícone Google:** SVG inline com as cores oficiais (exceção à regra lucide-only, pois o Google não tem ícone no lucide). Alternativa: usar `ExternalLink` do lucide com label "Google Calendar".

**Fluxo de conexão:** `window.location.href = authUrl` (redirect full-page, não popup) para evitar problemas com bloqueadores de popup. O Google redireciona de volta para `/settings?google=connected`, que exibe toast de sucesso.

**`googleApi` em `api.ts`:**
```typescript
export const googleApi = {
  getAuthUrl: () => request<{ url: string }>("/api/google/auth-url"),
  getStatus: () => request<GoogleStatusDTO>("/api/google/status"),
  disconnect: () => request<void>("/api/google/disconnect", { method: "DELETE" }),
  syncNow: () => request<{ synced_at: string }>("/api/google/sync", { method: "POST" }),
};

export interface GoogleStatusDTO {
  connected: boolean;
  last_synced_at: string | null;
  sync_error: string | null;
}
```

---

## Plano 2: Sync Engine + UI Feedback

### 2.1 Sync Engine

**Arquivo:** `packages/api/src/lib/googleSync.ts`

**Função principal:** `syncUserCalendar(userId: string): Promise<void>`

**Algoritmo detalhado:**

```
1. Busca token do usuário → getValidAccessToken(userId)
2. Determina janela: from = last_synced_at ?? (agora - 30 dias), to = agora + 1 ano

3. PULL (Google → EvoBuddy):
   a. Chama google.events.list({ calendarId: 'primary', updatedMin: last_synced_at })
   b. Para cada evento retornado:
      - status = 'cancelled' → deleta evento local com esse google_event_id (se existir)
      - google_event_id existe em calendar_events → atualiza campos (Google vence)
      - não existe → insere novo evento com google_event_id preenchido

4. PUSH (EvoBuddy → Google):
   a. Busca eventos sem google_event_id criados após a conexão (created_at >= token.created_at)
      → Cria no Google, salva google_event_id retornado
   b. Busca eventos com google_event_id != null E updated_at > last_synced_at
      E (google_updated_at IS NULL OR updated_at > google_updated_at)
      → Atualiza no Google

5. Atualiza last_synced_at = now(), sync_error = null
6. Em caso de erro: salva sync_error = error.message, NÃO atualiza last_synced_at
```

**Mapeamento de campos:**

| EvoBuddy | Google Calendar |
|----------|----------------|
| `title` | `summary` |
| `description` | `description` |
| `date` + `start_time` (não all_day) | `start.dateTime` (ISO 8601) |
| `date` + `end_time` (não all_day) | `end.dateTime` |
| `all_day = true` | `start.date` + `end.date` (sem hora) |
| `google_event_id` | `id` |
| — | `updated` → salvo em `google_updated_at` |

**Eventos recorrentes do Google:** tratados como eventos independentes (cada instância vira um evento simples no EvoBuddy, sem regra de recorrência).

**Eventos recorrentes do EvoBuddy:** não sincronizados para o Google por enquanto (complexidade de mapeamento de RRULE). Apenas eventos não-recorrentes são empurrados.

### 2.2 Polling Job

**Arquivo:** `packages/api/src/jobs/googleSyncJob.ts`

```typescript
export function startGoogleSyncJob(): void {
  const INTERVAL_MS = 15 * 60 * 1000; // 15 minutos

  async function runAll() {
    const { data } = await supabaseAdmin
      .from('google_calendar_tokens')
      .select('user_id');
    for (const row of data ?? []) {
      await syncUserCalendar(row.user_id).catch(console.error);
    }
  }

  runAll(); // executa imediatamente no boot
  setInterval(runAll, INTERVAL_MS);
}
```

**Iniciado em:** `packages/api/src/index.ts` — `startGoogleSyncJob()` chamado após o servidor iniciar.

### 2.3 Endpoint de Sync Manual

`POST /api/google/sync` (já definido no Plano 1):
- Chama `syncUserCalendar(req.user.id)` diretamente
- Retorna `{ synced_at: string }` em caso de sucesso
- Lança `AppError` em caso de falha (mensagem propagada para o frontend)

### 2.4 UI Feedback — CalendarPage

**Arquivo:** `apps/web/src/routes/calendar.tsx` (modificação leve)

- Badge no header do calendário: `● Sincronizado com Google` (verde, visível apenas se conectado)
- Ao clicar em "Sincronizar agora" (botão `RefreshCw`): chama `googleApi.syncNow()`, spinner no ícone durante o request, toast "Calendário sincronizado." no sucesso
- Após sync: chama `refresh()` para recarregar os eventos

**Arquivo:** `apps/web/src/routes/settings.tsx` — a seção Integrações (Plano 1) já exibe status e erros.

---

## Fora de Escopo

- Sincronização de calendários não-primários do Google
- Mapeamento de regras de recorrência (RRULE) do Google para o EvoBuddy
- Empurrar eventos recorrentes do EvoBuddy para o Google
- Notificações push via Google Calendar webhooks (Channel + Watch)
- Sync de categorias/cores entre os dois sistemas
- Suporte a múltiplas contas Google por usuário
