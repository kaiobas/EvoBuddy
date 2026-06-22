# ARCHITECTURE.md

> Documento vivo. Toda decisão arquitetural significativa deve ser registrada aqui antes de ser implementada.

---

## 1. Visão Geral

EvoBuddy é uma aplicação de produtividade pessoal **Web-first** e **Cloud-native**.
Ela roda exclusivamente no navegador e persiste todos os dados na nuvem (Supabase PostgreSQL),
vinculados à conta do usuário. Não há versão mobile nativa nem desktop — apenas uma SPA
acessível de qualquer dispositivo com navegador e internet.

### Por que essa abordagem?

| Problema anterior | Solução nova |
|---|---|
| Offline-first exigia sync P2P complexo | Cloud-first: dados centralizados no PostgreSQL |
| React Native + Electron = 2x manutenção | Web-only: uma única SPA |
| SQLite em cada dispositivo | Supabase: um banco central por usuário |
| Sync = conflitos, CRDT, changelogs | Sem sync: a API é a fonte da verdade |
| Instalação em cada aparelho | Sem instalação: qualquer browser |

### Princípios Inegociáveis

| Princípio | Implicação prática |
|---|---|
| **Web-first** | Zero instalação. Funciona em qualquer navegador moderno — celular, tablet ou desktop. |
| **Mobile-first responsivo** | Design começa pelo mobile e expande para desktop com TailwindCSS. Uma única SPA que se adapta a qualquer tela. |
| **Cloud-native** | Fonte da verdade é o Supabase PostgreSQL. Cache local é efêmero. |
| **Autenticação obrigatória** | Cada usuário vê apenas seus próprios dados. RLS policies no banco. |
| **Core independente** | Regras de negócio em `packages/shared` não importam backend, banco nem framework. |
| **API como fronteira** | Frontend nunca acessa o banco diretamente (exceto via Supabase client autenticado). |
| **IA como assistente** | O app funciona 100% sem IA. IA é camada opt-in (futuro). |
| **Simplicidade** | Nenhuma abstração sem necessidade demonstrada. |

---

## 2. Estrutura do Monorepo

```
evobuddy/
├── apps/
│   └── web/                # SPA React + Vite + TailwindCSS
│
├── packages/
│   ├── shared/             # Schemas Zod, stores Zustand, tipos compartilhados
│   ├── api/                # Backend Node.js + Express + Supabase Admin
│   └── dev-rag/            # MCP server para opencode (ferramenta interna)
│
├── docs/
│   ├── PLAN.md
│   └── architecture/
│       └── ARCHITECTURE.md # este arquivo
│
├── package.json            # workspace root (pnpm workspaces)
├── pnpm-workspace.yaml
└── turbo.json
```

### Regras de Dependência (acíclicas)

```
apps/web → packages/shared     (tipos, schemas, stores)
apps/web → packages/api        (apenas tipos das rotas, se necessário)
packages/api → packages/shared  (schemas para validação no backend)

# Proibido:
packages/shared → qualquer outro package (zero deps de plataforma)
apps/web → banco diretamente (sempre via API ou Supabase client)
packages/api → apps/*  (backend não conhece frontend)
```

---

## 3. Stack Detalhada

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Frontend** | React 19 + Vite 6 + TailwindCSS | SPA moderna, HMR rápido, estilos utilitários |
| **Roteamento** | React Router v7 (ou TanStack Router) | Navegação SPA com lazy loading |
| **Estado** | Zustand 5 | Leve, sem boilerplate, tipo-safe |
| **Validação** | Zod 3 | Schemas compartilhados entre front e back |
| **Backend** | Node.js + Express | Simples, maduro, tipos compartilhados via Zod |
| **Database** | PostgreSQL (Supabase) | Relacional, RLS, bom com Zod |
| **Auth** | Supabase Auth | Magic link, Google, GitHub, built-in RLS |
| **API Security** | Helmet + CORS + Rate Limiting + Zod | Múltiplas camadas de defesa |
| **Data Access** | Express API como proxy (nunca Supabase direto do frontend) | service_role key secreta no servidor |
| **Dev RAG** | Ollama + Prisma + SQLite | Ferramenta interna, não do produto |

---

## 4. Fluxo de Dados

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Browser    │────▶│  packages/   │────▶│  Supabase    │────▶│   PostgreSQL     │
│  (React SPA) │     │  api         │     │  Admin       │     │                  │
│  ────────────│◀────│  (Express)   │◀────│  Client      │◀────│  (RLS por user)  │
│  Auth apenas │     └──────────────┘     └──────────────┘     └──────────────────┘
│  via Supabase│
│  Client      │
└─────────────┘
       │
       ▼ (apenas para login)
┌─────────────┐
│  Supabase   │
│  Auth       │
│  (nuvem)    │
└─────────────┘
```

### 🔒 Padrão de segurança: API como proxy

Diferente de apps que usam Supabase Client direto no frontend com anon key,
**toda operação de dados passa pelo nosso backend Express**. Isso porque:

1. **A chave anon do Supabase fica exposta no frontend** — qualquer um pode vê-la
2. **Com a API como proxy**, usamos a `service_role` key (secreta) no servidor
3. **Camadas extras de segurança** no caminho: rate limiting, validação Zod, Helmet, CORS

### O que o frontend faz diretamente

Apenas **autenticação** via Supabase Auth Client:
- Login com Google, GitHub, Magic Link
- Gerenciamento de sessão (JWT)
- O JWT é armazenado no `localStorage` e enviado para a API no header `Authorization: Bearer <token>`

### O que o backend faz

Tudo que envolve dados:
- CRUD de notas, tasks, etc.
- Validação com Zod (mesmos schemas do `packages/shared`)
- Verificação do JWT via Supabase Admin Client
- Rate limiting, sanitização, logs

---

## 5. Autenticação e Segurança

### Supabase Auth

- **Provedores**: Magic link (email), Google, GitHub
- **Sessão**: JWT gerenciado pelo Supabase Client no frontend; cookie httpOnly `sb-token` para comunicação com a API
- **RLS**: Toda tabela tem `user_id` (UUID) com policy `USING (auth.uid() = user_id)` — redundante com a API, mas essencial como defesa em profundidade
- **Anônimo?**: Não. O app exige login para qualquer operação.

```sql
-- Exemplo de RLS policy
CREATE POLICY "users_see_only_own_notes" ON notes
  FOR ALL USING (auth.uid() = user_id);
```

### Zustand + Auth

```typescript
// store de auth
interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}
```

---

## 6. Segurança

### Camadas de defesa

| Camada | O que faz | Implementação |
|---|---|---|
| **Helmet** | Security headers (CSP, XSS, etc.) | Middleware Express |
| **CORS** | Restringe origens permitidas | `CORS_ORIGIN` no env |
| **Rate Limiting** | 100 req/min global, 5 req/min auth | `express-rate-limit` |
| **Validação Zod** | Sanitiza inputs em todas as rotas | Middleware `validate()` |
| **Auth JWT** | Verifica token em toda rota protegida | `authMiddleware` + Supabase Admin |
| **Error Handler** | Não vaza detalhes internos em produção | `AppError` + sanitização |
| **nginx** | Headers de segurança, CSP, HTTPS | Reverse proxy (deploy) |
| **RLS** | Defesa em profundidade no banco | Supabase Row Level Security |

### Boas práticas

- **Nunca** armazenar `service_role` key no frontend
- **Nunca** logar tokens, senhas ou dados sensíveis
- **Sempre** validar inputs com Zod (frontend + backend)
- **Sempre** usar HTTPS em produção
- **Sempre** restringir CORS para o domínio do app
- **Cookies**: `httpOnly`, `secure`, `sameSite: strict` em produção

### Variáveis sensíveis (NUNCA comitar)

| Variável | Onde | Secreta? |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend | Não (pública) |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Não (pública, RLS protege) |
| `VITE_API_URL` | Frontend | Não |
| `SUPABASE_URL` | Backend | Não |
| `SUPABASE_SERVICE_KEY` | Backend | **SIM** |
| `PORT` | Backend | Não |
| `CORS_ORIGIN` | Backend | Não |
| `COOKIE_SECURE` | Backend | Não |

---

O pacote compartilhado contém **apenas**:
- Schemas Zod (validam tanto no frontend quanto no backend)
- Tipos TypeScript inferidos dos schemas
- Stores Zustand (estado da UI — **não** são fonte da verdade)

### Estrutura

```
packages/shared/src/
├── modules/
│   ├── notes/
│   │   ├── schema.ts        # NoteSchema (agora com user_id opcional no tipo)
│   │   ├── store.ts         # useNoteStore (cache UI)
│   │   └── index.ts
│   ├── tasks/
│   │   ├── schema.ts
│   │   ├── store.ts
│   │   └── index.ts
│   └── settings/
│       ├── schema.ts
│       ├── store.ts
│       └── index.ts
├── auth/
│   └── store.ts
├── types.ts                 # tipos auxiliares (Pagination, etc.)
└── index.ts
```

### Mudanças importantes do modelo anterior

| Antes (offline-first) | Agora (cloud-first) |
|---|---|
| `version: number`, `deviceId: string` | Removido (não há sync) |
| `deletedAt` soft-delete | Removido (DELETE real via API) |
| Timestamps em `number` (Date.now()) | Timestamps em `string` ISO 8601 do PostgreSQL |
| `Map<string, Note>` no store | `Note[]` (fetch da API) |
| Store = cache + grava no SQLite | Store = cache efêmero da UI |

### Schema — exemplo canônico

```typescript
// packages/shared/src/modules/notes/schema.ts
import { z } from "zod";

export const noteSchema = z.object({
  id: z.string().ulid(),
  user_id: z.string().uuid(),       // vinculado à conta
  title: z.string().default(""),
  content: z.string().default(""),
  created_at: z.string().datetime(), // ISO do PostgreSQL
  updated_at: z.string().datetime(),
});

export type Note = z.infer<typeof noteSchema>;
export type NoteInput = z.infer<typeof noteSchema.omit({ id: true, user_id: true, created_at: true, updated_at: true })>;
```

---

## 7. apps/web

Aplicação React SPA. Único app do monorepo.

**Design mobile-first:** toda a interface é construída primeiro para telas pequenas
(celulares) e expandida progressivamente para tablets e desktops usando os breakpoints
do TailwindCSS (`sm:`, `md:`, `lg:`, `xl:`). O layout se adapta:
- **Mobile** (< 768px): sidebar vira drawer navigable por ícone, conteúdo em coluna única
- **Tablet** (768px - 1024px): sidebar compacta (ícones + labels), grid de 2 colunas
- **Desktop** (> 1024px): sidebar expandida, grid de 3+ colunas, atalhos de teclado

Isso garante que o app seja utilizável no celular (dando um load), no tablet e no
computador com a **mesma base de código**, sem precisar de React Native ou Electron.

### Estrutura

```
apps/web/
├── src/
│   ├── main.tsx              # entry point
│   ├── App.tsx               # providers + router
│   ├── routes/                # páginas
│   │   ├── index.tsx          # / — dashboard
│   │   ├── login.tsx          # /login
│   │   ├── notes.tsx          # /notes
│   │   ├── notes.$id.tsx      # /notes/:id
│   │   ├── tasks.tsx          # /tasks
│   │   └── settings.tsx       # /settings
│   ├── components/            # UI components
│   │   ├── ui/                # primitives (botão, input, card)
│   │   ├── layout/            # sidebar, header, shell
│   │   └── features/          # note-card, task-item, etc.
│   ├── hooks/                 # custom hooks (useAuth, useNotes, etc.)
│   ├── lib/                   # supabase client, api client
│   │   └── supabase.ts
│   └── styles/
│       └── globals.css        # TailwindCSS
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### Responsabilidades

- **Roteamento**: React Router com lazy loading por rota
- **Autenticação**: Fluxo completo (login, callback, logout, proteção de rotas)
- **Mobile-first responsivo**: TailwindCSS com breakpoints `sm:`, `md:`, `lg:`, `xl:` — layout adaptativo sem media queries manuais
- **Touch-friendly**: Todos os botões e alvos de interação com mínimo de 44px (padrão WCAG para toque)
- **UI**: Componentes puros com TailwindCSS, sem lib externa de componentes
- **API Client**: `lib/api.ts` — cliente tipado que chama o backend Express (nunca Supabase direto para dados)
- **Auth**: Supabase Auth Client apenas para login; token JWT enviado para API via `Authorization: Bearer`
- **Otimista**: Updates otimistas com rollback em erro

---

## 8. packages/api

Backend Node.js + Express. **Opcional para o MVP** — 90% das operações podem
ser feitas diretamente via Supabase Client + RLS. O backend existe para:

- Operações administrativas (seeds, migrações complexas)
- Integrações com IA (Ollama/OpenAI)
- Webhooks e tarefas agendadas
- Endpoints que exigem lógica server-side

### Estrutura

```
packages/api/
├── src/
│   ├── index.ts              # server entry
│   ├── router.ts             # rotas
│   ├── middleware/
│   │   ├── auth.ts           # verifica JWT do Supabase
│   │   └── error.ts          # error handler
│   ├── routes/
│   │   ├── notes.ts
│   │   ├── tasks.ts
│   │   └── ai.ts
│   └── lib/
│       ├── supabase.ts       # Supabase Admin Client
│       └── validators.ts     # reuse schemas do shared
├── package.json
└── tsconfig.json
```

---

## 9. Database (Supabase PostgreSQL)

### Schema Principal

```sql
CREATE TABLE notes (
  id         TEXT PRIMARY KEY,  -- ULID
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  title      TEXT NOT NULL DEFAULT '',
  content    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_updated_at ON notes(updated_at DESC);

-- RLS
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access" ON notes
  FOR ALL USING (auth.uid() = user_id);

-- mesma estrutura para tasks, settings, etc.
```

### Por que ULID em vez de UUID?

- ULIDs são ordenáveis por tempo (cluster index friendly)
- Podem ser gerados no frontend antes do insert (otimista)
- Compatíveis com TEXT no PostgreSQL

---

## 10. Estado Global (Zustand)

Zustand é **cache da UI**, não fonte da verdade.

```typescript
// packages/shared/src/modules/notes/store.ts
import { create } from "zustand";
import type { Note } from "./schema.js";

interface NoteState {
  notes: Note[];
  loading: boolean;
  error: string | null;
  setNotes: (notes: Note[]) => void;
  addNote: (note: Note) => void;
  updateNote: (id: string, partial: Partial<Note>) => void;
  removeNote: (id: string) => void;
}

export const useNoteStore = create<NoteState>((set) => ({
  notes: [],
  loading: false,
  error: null,

  setNotes: (notes) => set({ notes }),
  addNote: (note) => set((s) => ({ notes: [...s.notes, note] })),
  updateNote: (id, partial) =>
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...partial } : n)),
    })),
  removeNote: (id) =>
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
}));
```

### Ciclo de vida dos dados

```
[User Action]
  → Zustand update otimista (UI instantânea)
    → Supabase.mutate() (persiste no banco)
      → Se erro: rollback Zustand + notificar usuário
      → Se ok: confirma estado (ou atualiza com retorno do banco)

[Page Load / Navigation]
  → Zustand loading = true
    → Supabase.query() (fetch do banco)
      → Zustand setNotes(data), loading = false
```

---

## 11. Testes

| Camada | Tipo | Ferramenta | O que testar |
|---|---|---|---|
| `packages/shared` | Unit | Vitest | Schemas (parse/reject), tipos |
| `apps/web` | Component | Vitest + Testing Library | Componentes, hooks, fluxos |
| `apps/web` | E2E | Playwright | Fluxos críticos (login, CRUD) |
| `packages/api` | Integration | Vitest + Supertest | Rotas, auth, validação |

---

## 12. Fluxo de Desenvolvimento com IA

```
PLAN.md
  └─► docs/architecture/ARCHITECTURE.md (atualizado com decisões)
        └─► IMPLEMENTAÇÃO DIRETA (sem camadas extras de docs)

Para mudanças arquiteturais significativas:
  └─► Atualizar ARCHITECTURE.md antes de codificar

Para features complexas:
  └─► Breve SPEC inline na issue/task (não criar arquivo separado)
```

> Diferente do modelo anterior, não criamos mais `features/`, `specs/` e `TASKS.md`
> separados para cada feature. O plano está no `PLAN.md`, a arquitetura neste
> arquivo, e a implementação segue diretamente. A burocracia documental anterior
> era desnecessária para um app single-dev.

---

## 13. Decisões Registradas (ADR)

| # | Decisão | Razão | Data |
|---|---|---|---|
| 001 | pnpm + Turborepo | Performance, workspaces nativos, cache incremental | 2026-06 |
| 002 | Zod no shared | Schemas servem frontend e backend com mesmo contrato | 2026-06 |
| 003 | Supabase como backend | Auth + PostgreSQL + RLS + client JS — elimina backend próprio para MVP | 2026-06 |
| 004 | Web-only + Mobile-first responsivo | Manutenção única, acesso universal (celular, tablet, desktop), sem instalação | 2026-06 |
| 005 | Zustand como cache, não fonte da verdade | Cloud-first: banco central é a fonte; Zustand é efêmero | 2026-06 |
| 006 | ULID em vez de UUID | Ordenável por tempo, gerável no frontend | 2026-06 |
| 007 | Sem soft-delete | Cloud-first: DELETE real. Sem sync, sem conflitos de ressurreição | 2026-06 |
| 008 | DELETE real em vez de soft-delete | Sem sync, sem necessidade de changelog ou CRDT | 2026-06 |
| 009 | Supabase Client direto do frontend (com RLS) | 90% das operações não precisam de backend; simplicidade máxima | 2026-06 |
| 010 | React Router + lazy loading | SPA com carregamento sob demanda, SEO não é requisito | 2026-06 |
| 011 | API como proxy (não Supabase direto) | service_role key fica secreta no servidor; camadas extras de segurança | 2026-06 |
| 012 | Helmet + CORS + Rate Limiting + Zod validation | Múltiplas camadas de defesa contra ataques comuns | 2026-06 |
| 013 | JWT via localStorage + Authorization header | Simples, funciona com API REST; httpOnly cookies em produção | 2026-06 |
| 014 | Docker multi-stage + nginx | Deploy otimizado (imagem pequena), SPA servida com headers de segurança | 2026-06 |

---

## 14. Por que Removemos

### ❌ React Native (apps/mobile)

Manter iOS + Android dobraria o esforço de desenvolvimento e teste.
Com **mobile-first responsivo**, a SPA web cobre todos os dispositivos
(celular, tablet, desktop) com uma única base de código — sem precisar
de React Native, App Store, TestFlight ou builds nativas.

### ❌ Electron (apps/desktop)

Uma SPA no browser elimina a necessidade de empacotamento,
distribuição, atualização e IPC. Acessa-se de qualquer computador
sem instalar nada.

### ❌ SQLite + Database Layer (packages/database)

Sem dados locais persistentes, não precisamos de SQLite.
O Supabase Client é a camada de dados.

### ❌ Sync Engine (P2P + CRDT + ChangeLog)

Com dados centralizados no PostgreSQL, não há o que sincronizar.
Não há conflitos, não há versões, não há deviceId.

### ❌ Soft-delete

Era necessária para evitar conflitos de ressurreição no sync.
Sem sync, DELETE real é mais simples e performático.

### ❌ packages/core + packages/modules separados

No modelo anterior, `core` (entidades) e `modules` (use cases) eram
pacotes separados. Agora tudo está em `packages/shared` — os schemas
são as entidades e contratos simultaneamente. Use cases são
substituídos por hooks ou chamadas diretas ao Supabase.

---

## 15. Próximos Passos (visão geral — ver PLAN.md para detalhes)

- [ ] Fase 1 — Fundação: monorepo, Supabase, auth, notas CRUD
- [ ] Fase 2 — Tasks: módulo de tarefas completo
- [ ] Fase 3 — UI/UX: refinamento visual, responsivo, dark mode
- [ ] Fase 4 — Busca e organização: tags, filtros, pesquisa full-text
- [ ] Fase 5 — IA: assistente integrado (opt-in)
- [ ] Fase 6 — Polimento: performance, acessibilidade, PWA (opcional)
