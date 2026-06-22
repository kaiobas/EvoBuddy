# EvoBuddy

Aplicação de produtividade pessoal **Web-first** com dados na nuvem.

## Estrutura

- `packages/shared/` — Schemas Zod, stores Zustand, tipos compartilhados
- `packages/api/` — Backend Node.js + Express + Supabase (PostgreSQL)
- `packages/dev-rag/` — Dev RAG engine interno (MCP server para Claude)
- `apps/web/` — SPA React + Vite + TailwindCSS

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + Vite + TailwindCSS + Lucide React |
| Fontes | Inter (body) + Plus Jakarta Sans (display) via `@fontsource` |
| Ícones | `lucide-react` — nunca SVG inline |
| Backend | Node.js + Express + Supabase Client |
| Database | PostgreSQL (via Supabase) |
| Auth | Supabase Auth — Magic Link, Google OAuth, GitHub OAuth (todos ativos) |
| Cache | Zustand (estado da UI, não fonte da verdade) |
| IA (futuro) | Ollama (local) + OpenAI/Anthropic (remoto) |

## Princípios

- **Web-first**: acessível de qualquer navegador, sem instalação
- **Mobile-first responsivo**: design para celular primeiro, expande para desktop com TailwindCSS breakpoints
- **Cloud-native**: dados salvos na conta do usuário (Supabase PostgreSQL)
- **Offline?**: não é prioridade. O app requer internet para funcionar
- **Sem sync**: dados centralizados, não distribuídos
- **Autenticação obrigatória**: cada usuário vê apenas seus próprios dados
- **Core independente**: regras de negócio em `packages/shared`, desacopladas do backend

## Design System

### Paleta de Cores (Tailwind)

| Token | Hex | Uso |
|-------|-----|-----|
| `brand-500` | `#7C6FCD` | Primary — botões, nav ativo, brand |
| `brand-100` | `#EEE9FF` | Hover, active nav bg |
| `peach-500` | `#F4845F` | Pendente, atenção, badge |
| `peach-50` | `#FEF0EB` | Background tint quente |
| `ink` | `#1E1B2E` | Texto principal (light mode) |
| `surface-dark` | `#16131F` | Background geral (dark mode) |
| `card-dark` | `#201C2E` | Cards e sidebar (dark mode) |
| `border-dark` | `#2E2840` | Bordas (dark mode) |

### Tipografia

- `font-display` → Plus Jakarta Sans 700/800 — headings, logo, títulos de card
- `font-sans` (padrão) → Inter 400/500 — corpo, labels, inputs

### Dark Mode

- Controlado por classe `dark` no `document.documentElement` (Tailwind `darkMode: 'class'`)
- `ThemeProvider` em `apps/web/src/contexts/ThemeContext.tsx` — gerencia light/dark/system
- Hook: `useTheme()` → `{ theme, resolvedTheme, setTheme }`
- Persiste em `localStorage` sob a chave `theme`
- Script anti-FOUC no `index.html` aplica a classe antes do React hidratar

### Animações (globals.css)

Classes utilitárias prontas para usar:

| Classe | Uso |
|--------|-----|
| `animate-card-enter` | Entrada de cards em lista (opacity + translateY, stagger com `animationDelay`) |
| `animate-pop-in` | Criação de item (scale + fade) |
| `animate-slide-out` | Deleção de item (translateX + fade) |
| `animate-checkbox-spring` | Spring-bounce no checkbox ao marcar tarefa |
| `animate-check-draw` | SVG checkmark se desenhando (stroke-dashoffset) |
| `animate-strikethrough` | Pseudo-element risca o texto ao completar tarefa |
| `animate-toast-enter` | Toast entrando |
| `animate-toast-exit` | Toast saindo |

**Padrão de stagger em listas:**
```tsx
items.map((item, i) => (
  <div key={item.id} style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }} className="animate-card-enter">
```

**Padrão de deleção animada:**
```tsx
const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
// ao deletar: adiciona id ao Set, setTimeout 200ms, chama API, recarrega
className={deletingIds.has(id) ? "animate-slide-out" : "animate-card-enter"}
```

### Toast

- `ToastProvider` em `apps/web/src/contexts/ToastContext.tsx`
- Hook: `useToast()` → `{ toast: (message, type?) => void }`
- Tipos: `'success'` | `'error'` | `'warning'`
- Usar em todas as operações CRUD para feedback ao usuário

```tsx
const { toast } = useToast();
toast("Nota criada.", "success");
toast("Erro ao salvar.", "error");
```

### Componentes UI padrão

- Cards: `rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-border-dark dark:bg-card-dark`
- Hover em cards: `hover:-translate-y-0.5 hover:shadow-md transition-all`
- Botão primário: `rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 active:scale-95`
- Inputs: `rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 focus:border-brand-400 focus:ring-2 focus:ring-brand-100`
- Nav ativo: `bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300`

## Desenvolvimento Local

```bash
pnpm install
pnpm dev            # dev mode (turbo) — web em :5173, api em :3001
pnpm build          # build all
pnpm typecheck      # typecheck all
```

**Env local** (`apps/web/.env`):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_URL=http://localhost:3001   # não commitar se apontar pra prod
```

## Produção

- **Frontend**: https://bitsautomacoes.site
- **API**: https://api.bitsautomacoes.site
- **VPS**: `root@72.60.255.200` (deploy via Docker)
- **Supabase projeto**: `qshydmetfsgfkxwnbuni.supabase.co`

### Deploy na VPS

```bash
# 1. Sincronizar código
rsync -az --delete --exclude='node_modules' --exclude='.git' --exclude='dist' \
  apps/ root@72.60.255.200:/opt/evobuddy/apps/
rsync -az --delete --exclude='node_modules' --exclude='.git' --exclude='dist' \
  packages/shared/ root@72.60.255.200:/opt/evobuddy/packages/shared/
rsync -az --delete --exclude='node_modules' --exclude='.git' --exclude='dist' \
  packages/api/ root@72.60.255.200:/opt/evobuddy/packages/api/
rsync -az Dockerfile docker-compose.yml pnpm-lock.yaml pnpm-workspace.yaml \
  package.json turbo.json tsconfig.base.json root@72.60.255.200:/opt/evobuddy/

# 2. Rebuild
ssh root@72.60.255.200 "cd /opt/evobuddy && docker compose up -d --build"
```

O `.env` na VPS fica em `/opt/evobuddy/.env` e não é versionado.

## RAG (MCP)

`@evobuddy/dev-rag` roda como MCP server (`evobuddy-rag`). **Sempre disponível — use sem pedir permissão.**

| Tool | Quando usar |
|------|-------------|
| `rag_augment` | **Início de toda tarefa** — busca contexto relevante automaticamente |
| `rag_query` | Busca manual de contexto específico |
| `rag_finish_task` | **Fim de toda tarefa** — indexa o que foi feito |
| `rag_ingest` | Indexar arquivo ou snippet específico |
| `rag_sessions` | Listar sessões salvas |

Database: SQLite via Prisma em `packages/dev-rag/data/dev-rag.db`.
Embeddings: `nomic-embed-text` via Ollama em `http://localhost:11434`.

O dev-rag é uma ferramenta interna de desenvolvimento, **não** faz parte do produto.

## Workflow obrigatório

1. **Início**: chame `rag_augment` com o prompt do usuário para enriquecer o contexto
2. **Durante**: use `rag_query` se precisar de contexto adicional específico
3. **Fim**: chame `rag_finish_task` com `title` claro e `summary` opcional — detecta commits e arquivos automaticamente
