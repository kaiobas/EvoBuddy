# EvoBuddy

Monorepo offline-first productivity app.

## Structure

- `packages/shared/` — Core business logic (Zod schemas, Zustand stores)
- `packages/database/` — SQLite abstraction interface
- `packages/dev-rag/` — Dev RAG engine with Prisma + Ollama (MCP server)
- `apps/desktop/` — Electron + Vite + React
- `apps/mobile/` — React Native CLI + NativeWind

## RAG (MCP)

`@evobuddy/dev-rag` runs as an MCP server for opencode and Claude.
Tools: `rag_query`, `rag_augment`, `rag_ingest`, `rag_sessions`.
Database: SQLite via Prisma at `packages/dev-rag/data/dev-rag.db`.
Embeddings: Ollama (llama3.2) at `http://localhost:11434`.

## Development

```bash
pnpm build        # build all packages
pnpm typecheck    # typecheck all
pnpm dev          # dev mode (turbo)
pnpm --filter @evobuddy/dev-rag exec prisma db push
```

## Conventions

- TypeScript strict, ESM (`"type": "module"`)
- Zod for validation, Zustand for state
- Offline-first: never depend on external services for core features
- Module pattern: schema → store → repository per module

## Task Completion

**Always call `rag_finish_task` at the end of every task/issue.** This indexes a summary of what was done into the RAG so future sessions can retrieve context. The tool auto-detects commits, changed files, and diff stats — just provide a clear `title` and optional `summary`.
