# PLAN.md — EvoBuddy

> Roadmap de milestones para a versão Web-first + Mobile-first + Cloud-native.
> Detalhamento técnico em [ARCHITECTURE.md](architecture/ARCHITECTURE.md).

---

## Fase 0 — Limpeza e Fundação

> Remover o que não serve mais, configurar o novo ambiente.

- [ ] **0.1** Remover `apps/mobile/` (React Native — não vamos mais usar)
- [ ] **0.2** Remover `apps/desktop/` (Electron — substituído por SPA)
- [ ] **0.3** Remover `packages/database/` (SQLite — substituído por Supabase)
- [ ] **0.4** Remover skills antigas do `.opencode/skills/` (mobile-dev, desktop-dev, database, shared-pkg)
- [ ] **0.5** Atualizar `pnpm-workspace.yaml` (remover apps/mobile, apps/desktop)
- [ ] **0.6** Criar `apps/web/` (novo scaffold Vite + React + Tailwind com configuração mobile-first)
- [ ] **0.7** Criar `packages/api/` (novo scaffold Express + Supabase Admin)
- [ ] **0.8** Configurar conta Supabase (projeto, database, auth providers)
- [ ] **0.9** Configurar variáveis de ambiente (`.env` local, Supabase URL/keys)
- [ ] **0.10** Verificar que `pnpm dev` roda sem erros

### Schemas compartilhados

- [ ] **0.11** Atualizar `packages/shared/src/modules/notes/schema.ts` (remover campos de sync)
- [ ] **0.12** Atualizar `packages/shared/src/modules/tasks/schema.ts` (remover campos de sync)
- [ ] **0.13** Adicionar `user_id: z.string().uuid()` nos schemas
- [ ] **0.14** Trocar timestamps `number` por `string().datetime()` (ISO 8601)
- [ ] **0.15** Remover `deletedAt`, `version`, `deviceId` dos schemas
- [ ] **0.16** Atualizar stores para usar `Note[]` em vez de `Map<string, Note>`
- [ ] **0.17** Remover `packages/shared/src/storage/`, `packages/shared/src/sync/`, `packages/shared/src/modules/ai/` (placeholders vazios)
- [ ] **0.18** Remover `export *` desnecessários do `index.ts` do shared

---

## Fase 1 — Autenticação + Notas (MVP)

> Core do produto: login e CRUD de notas.

### Supabase Setup

- [ ] **1.1** Criar tabela `notes` no Supabase (via migration SQL)
- [ ] **1.2** Configurar RLS policy para `notes` (`auth.uid() = user_id`)
- [ ] **1.3** Criar índice `idx_notes_user_id` e `idx_notes_updated_at`
- [ ] **1.4** Habilitar Auth providers (Magic Link + Google)
- [ ] **1.5** Configurar URL de redirect do Supabase Auth para dev

### Frontend — Auth

- [ ] **1.6** Criar `apps/web/src/lib/supabase.ts` (cliente Supabase)
- [ ] **1.7** Implementar `packages/shared/src/auth/store.ts` (auth state)
- [ ] **1.8** Criar página `/login` com botão "Entrar com Google" e "Magic Link"
- [ ] **1.9** Implementar callback handler de auth (`/auth/callback`)
- [ ] **1.10** Criar `AuthGuard` (proteção de rotas — redireciona para /login)
- [ ] **1.11** Implementar `useAuth` hook (user, loading, signIn, signOut)
- [ ] **1.12** Botão de logout no header/layout

### Frontend — Layout

- [ ] **1.13** Criar layout base: sidebar + header + main content
- [ ] **1.14** Sidebar com navegação: Notes, Tasks (futuro), Settings (futuro)
- [ ] **1.15** Responsivo: sidebar vira drawer em mobile
- [ ] **1.16** Componentes UI primitives: Button, Input, Card, Modal, TextArea

### Frontend — Notes CRUD

- [ ] **1.17** Página `/notes` — listagem de notas (título + preview)
- [ ] **1.18** Buscar notas do Supabase (`supabase.from('notes').select('*')`)
- [ ] **1.19** Store Zustand com `useNoteStore` (cache das notas)
- [ ] **1.20** Página `/notes/new` — criar nota (formulário)
- [ ] **1.21** Página `/notes/:id` — editar nota
- [ ] **1.22** Excluir nota (com confirmação)
- [ ] **1.23** Updates otimistas com rollback em erro
- [ ] **1.24** Loading skeletons durante fetch
- [ ] **1.25** Tratamento de erro (toast ou inline)

---

## Fase 2 — Tasks

> Segundo módulo principal do produto.

### Supabase Setup

- [ ] **2.1** Criar tabela `tasks` no Supabase
- [ ] **2.2** RLS policy para `tasks`
- [ ] **2.3** Índices

### Frontend — Tasks

- [ ] **2.4** Página `/tasks` — listagem
- [ ] **2.5** Alternar entre "todas", "pendentes", "concluídas"
- [ ] **2.6** Criar task (modal inline ou página)
- [ ] **2.7** Toggle completa/incompleta (com checkbox)
- [ ] **2.8** Editar task
- [ ] **2.9** Excluir task
- [ ] **2.10** Reordenar (drag-and-drop — opcional, post MVP)

---

## Fase 3 — UI/UX Responsivo

> Refinamento visual com mobile-first como prioridade.

### Mobile-first (faz parte de cada componente, não é uma fase separada)

Todo componente é construído com a abordagem:
1. **Mobile primeiro**: funciona em tela de 320px com uma coluna
2. **Tablet** (`md:`): grid de 2 colunas, sidebar compacta
3. **Desktop** (`lg:`/`xl:`): grid de 3+ colunas, sidebar expandida, atalhos de teclado

### Tarefas

- [ ] **3.1** Dark mode (toggle + `prefers-color-scheme`)
- [ ] **3.2** Animações sutis (transições de página, hover states)
- [ ] **3.3** Ícones (Lucide ou Heroicons)
- [ ] **3.4** Fontes (Inter ou similar)
- [ ] **3.5** Página de dashboard (visão geral: últimas notas, tasks pendentes)
- [ ] **3.6** Toast de notificações (sucesso/erro)
- [ ] **3.7** Touch targets mínimos de 44px em mobile
- [ ] **3.8** Sheet/drawer para sidebar em mobile (em vez de sidebar fixa)

---

## Fase 4 — Busca e Organização

> Encontrar e organizar conteúdo.

- [ ] **4.1** Tags nas notas e tasks (campo `tags TEXT[]`)
- [ ] **4.2** Filtrar por tag
- [ ] **4.3** Busca full-text (PostgreSQL `to_tsvector` / `plainto_tsquery`)
- [ ] **4.4** Campo de busca global no header
- [ ] **4.5** Ordenação (mais recente, título A-Z)

---

## Fase 5 — IA (Opt-in)

> Assistente integrado. O app funciona 100% sem isso.

- [ ] **5.1** Criar adapter de IA em `packages/shared` (interface apenas)
- [ ] **5.2** Implementar provedor OpenAI
- [ ] **5.3** Implementar provedor Anthropic (Claude)
- [ ] **5.4** (Opcional) Implementar provedor Ollama (local)
- [ ] **5.5** Chat inline: "Pergunte sobre suas notas"
- [ ] **5.6** "Resumir nota" com IA
- [ ] **5.7** "Sugerir tasks" a partir de uma nota

---

## Fase 6 — Polimento

> Performance, acessibilidade, extras.

- [ ] **6.1** Testes E2E com Playwright (login + CRUD notas)
- [ ] **6.2** Lighthouse: performance > 90, acessibilidade > 95
- [ ] **6.3** PWA (service worker + manifest) — opcional
- [ ] **6.4** Atalhos de teclado
- [ ] **6.5** Exportar notas (Markdown)
- [ ] **6.6** Histórico de versões das notas (usando Supabase audit)

---

## Marcos (Milestones)

| Marco | O que inclui | Previsão |
|---|---|---|
| **M0** | Limpeza + schemas atualizados | Imediato |
| **M1** | Auth + Notes CRUD funcionando | Curto prazo |
| **M2** | Tasks completo | Após M1 |
| **M3** | UI refinada | Contínuo |
| **M4** | Busca + organização | Após M3 |
| **M5** | IA integrada | Post-MVP |
| **M6** | Polimento final | Contínuo |

---

## Notas técnicas

### Variáveis de ambiente (apps/web)

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Variáveis de ambiente (packages/api)

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  # role: service_role (admin)
PORT=3001
```

### Scripts de dev

```bash
pnpm dev          # turbo: web + api em paralelo
pnpm build        # build de todos os pacotes
pnpm typecheck    # typecheck de todos os pacotes
```

### Convenções de código

- **Commits**: prefixo `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- **Branches**: `feat/nome-da-feature`
- **PRs**: apenas squash merge para `main`
- **Typescript**: strict mode, ESM (`"type": "module"`)
