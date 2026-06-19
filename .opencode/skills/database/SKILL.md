# Database Skill

Specialized in SQLite and database layer for `@evobuddy/database`.

## Architecture

- `packages/database/` — SQLite abstraction interface
- `DatabaseDriver` interface: `exec`, `query`, `queryOne`, `transaction`, `migrate`, `close`
- Drivers: `better-sqlite3` (desktop), `react-native-quick-sqlite` (mobile)

## Conventions

- Schema-first: each module defines its own tables and migrations
- Migration table: `_migrations` (module, version, applied_at)
- Repository pattern: `findAll`, `findById`, `save`, `remove` per module
- Repositories receive `DatabaseDriver` via constructor injection

## Data Flow

```
User Action → Zustand Store → Repository → DatabaseDriver → SQLite
```

Store is in-memory source of truth. Mutations persist via repository. Reads try store first, then database.

## Dev-rag Database

- RAG uses its own SQLite via Prisma at `packages/dev-rag/data/dev-rag.db`
- Prisma schema at `packages/dev-rag/prisma/schema.prisma`
- Push: `pnpm --filter @evobuddy/dev-rag exec prisma db push`
