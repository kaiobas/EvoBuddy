# EvoBuddy

Aplicação de produtividade pessoal **Web-first** com dados na nuvem.

## Estrutura

- `packages/shared/` — Schemas Zod, stores Zustand, tipos compartilhados
- `packages/api/` — Backend Node.js + Express + Supabase (PostgreSQL)
- `packages/dev-rag/` — Dev RAG engine interno (MCP server para opencode/Claude)
- `apps/web/` — SPA React + Vite + TailwindCSS

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + Vite + TailwindCSS |
| Backend | Node.js + Express + Supabase Client |
| Database | PostgreSQL (via Supabase) |
| Auth | Supabase Auth (magic link, Google, GitHub) |
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

## Desenvolvimento

```bash
pnpm install
pnpm dev            # dev mode (turbo) — web + api
pnpm build          # build all
pnpm typecheck      # typecheck all
```

## RAG (MCP)

`@evobuddy/dev-rag` roda como MCP server para opencode e Claude.
Tools: `rag_query`, `rag_augment`, `rag_ingest`, `rag_sessions`.
Database: SQLite via Prisma em `packages/dev-rag/data/dev-rag.db`.
Embeddings: Ollama (llama3.2) em `http://localhost:11434`.

O dev-rag é uma ferramenta interna de desenvolvimento, **não** faz parte do produto.

## Task Completion

**Sempre chame `rag_finish_task` ao final de toda task/issue.** Indexa um resumo do que foi feito no RAG para que sessões futuras possam recuperar contexto. A ferramenta detecta automaticamente commits, arquivos alterados e diff stats — basta fornecer um `title` claro e `summary` opcional.
