# Storage Layer Architecture

## Goals

- Abstrair SQLite em interface comum para Mobile e Desktop
- Cada módulo registra suas próprias tabelas e migrações
- Zero dependência de plataforma no pacote shared
- Offline-first: dados sempre disponíveis localmente

## Layers

```
┌─────────────────────────────────────────────────┐
│  Module (notas, tasks, etc)                      │
│  ┌──────────────┐   ┌──────────────────────┐    │
│  │ Zod Schema   │   │ Repository            │    │
│  │ Store(Zustand)│   │ (data access per     │    │
│  │              │   │  module)              │    │
│  └──────────────┘   └──────────┬───────────┘    │
├─────────────────────────────────┼────────────────┤
│  @evobuddy/database            │                │
│  ┌──────────────────────────────▼────────────┐   │
│  │ DatabaseDriver (interface)                │   │
│  │  - exec()                                 │   │
│  │  - query()                                │   │
│  │  - queryOne()                             │   │
│  │  - transaction()                          │   │
│  │  - migrate()                              │   │
│  └──────────────────────┬───────────────────┘   │
├──────────────────────────┼────────────────────────┤
│  Platform                │                        │
│  ┌──────────────────────▼───────────────────┐   │
│  │ Mobile: react-native-quick-sqlite        │   │
│  │ Desktop: better-sqlite3                  │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## DatabaseDriver Interface

`packages/database/src/driver.ts`:

```typescript
export interface QueryResult {
  rows: Record<string, unknown>[];
  affectedRows: number;
  insertId?: number;
}

export interface DatabaseDriver {
  exec(sql: string, params?: unknown[]): Promise<QueryResult>;
  query<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
  queryOne<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T | null>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
```

## Migration System

Cada módulo define suas migrações:

```typescript
interface Migration {
  version: number;
  up: string;            // SQL para aplicar
  down?: string;         // SQL para reverter
}

interface ModuleDefinition {
  name: string;
  version: number;       // versão atual do schema
  migrations: Migration[];
}
```

O `DatabaseDriver.migrate()` recebe um array de `ModuleDefinition`, consulta
`_migrations` table para ver o que já foi aplicado, e executa apenas as
pendentes.

```sql
-- Tabela de controle criada automaticamente
CREATE TABLE IF NOT EXISTS _migrations (
  module  TEXT NOT NULL,
  version INTEGER NOT NULL,
  applied_at INTEGER NOT NULL,
  PRIMARY KEY (module, version)
);
```

## Repository Pattern

Cada módulo expõe repositórios com operações específicas:

```typescript
class NoteRepository {
  constructor(private db: DatabaseDriver) {}

  async findAll(): Promise<Note[]> { ... }
  async findById(id: string): Promise<Note | null> { ... }
  async save(note: Note): Promise<void> { ... }
  async remove(id: string): Promise<void> { ... }
}
```

Os repositórios são instanciados com o driver da plataforma no bootstrap do app.

## Platform Implementations

### Desktop (better-sqlite3)

`apps/desktop/src/database/driver.ts`:
- Importa `better-sqlite3`
- Implementa `DatabaseDriver` usando API síncrona wrapped em promises
- Path do banco: `app.getPath("userData")/evobuddy.db`

### Mobile (react-native-quick-sqlite)

`apps/mobile/src/database/driver.ts`:
- Importa `react-native-quick-sqlite`
- Implementa `DatabaseDriver`
- Path do banco: definido pelo RNN SQLite (diretório documents)

## Data Flow

```
User Action
  → Zustand Store (otimista, estado imediato)
    → Repository (persiste no SQLite)
      → DatabaseDriver (abstração)
        → SQLite nativo
```

A store Zustand é a fonte de verdade em memória.
Toda mutação persiste no banco via repositório.
Toda leitura primeiro tenta da store (cache), depois do banco.
