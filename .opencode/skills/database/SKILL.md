# Database Skill — Supabase + PostgreSQL

Specialized in designing, creating, and managing the database layer of EvoBuddy
using Supabase (PostgreSQL). Covers schema design, migrations, Row Level Security,
indexes, and Supabase-specific features (Auth, Realtime, Storage).

> **Princípio:** O banco é a fonte da verdade. Toda decisão de schema deve considerar
> que o frontend acessa o banco **diretamente via Supabase Client** com RLS.
> O backend (`packages/api`) é usado apenas para operações que não devem rodar no cliente.

---

## Stack

| Tecnologia | Versão | Propósito |
|---|---|---|
| PostgreSQL | 15+ (via Supabase) | Banco relacional principal |
| Supabase Auth | Built-in | Autenticação (magic link, Google, GitHub) |
| Row Level Security | PostgreSQL | Permissões em nível de linha |
| Supabase JS Client | v2 | Acesso do frontend ao banco |
| Supabase Admin Client | v2 | Acesso server-side (packages/api) |

---

## Convenções de Schema

### Naming

| Regra | Exemplo |
|---|---|
| Tabelas: `snake_case` plural | `notes`, `tasks`, `user_settings` |
| Colunas: `snake_case` | `user_id`, `created_at`, `updated_at` |
| PK: `id TEXT PRIMARY KEY` (ULID) | `id TEXT PRIMARY KEY` |
| FK: `{tabela}_id` | `user_id UUID NOT NULL` |
| Timestamps: `TIMESTAMPTZ` | `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` |
| Índices: `idx_{tabela}_{coluna}` | `idx_notes_user_id` |

### ULIDs como Primary Key

```sql
-- ULIDs são gerados no frontend (TS) antes do insert.
-- Vantagens: ordenáveis por tempo, sem wait do banco, sem auto_increment.
CREATE TABLE notes (
  id         TEXT PRIMARY KEY,  -- ULID gerado no client
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  ...
);
```

### Timestamps

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

- Usar `now()` do PostgreSQL (não gerar timestamp no frontend)
- Atualizar `updated_at` via trigger ou na query

### Soft-delete

**Não usar.** Como não há sync, fazemos DELETE real.

---

## Templates de Tabelas

### notes

```sql
CREATE TABLE notes (
  id         TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '',
  content    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_updated_at ON notes(updated_at DESC);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
```

### tasks

```sql
CREATE TABLE tasks (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  completed   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_completed ON tasks(user_id, completed);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
```

### tags

```sql
CREATE TABLE tags (
  id      TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  color   TEXT NOT NULL DEFAULT '#6366f1'
);

CREATE UNIQUE INDEX idx_tags_user_name ON tags(user_id, name);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
```

---

## Row Level Security (RLS)

### Template padrão para toda tabela

```sql
ALTER TABLE {tabela} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_access" ON {tabela}
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- `auth.uid()` retorna o UUID do usuário autenticado
- `FOR ALL` cobre SELECT, INSERT, UPDATE, DELETE (mais simples)
- `USING` determina quais linhas são visíveis
- `WITH CHECK` determina quais inserts/updates são permitidos

### RLS para tabelas públicas (settings, por exemplo)

```sql
CREATE POLICY "individual_settings" ON user_settings
  FOR ALL
  USING (auth.uid() = id);
```

---

## Supabase Auth

### Providers configurados

| Provider | Tipo | Quando usar |
|---|---|---|
| Magic Link | Email | Acesso rápido sem senha (padrão) |
| Google | OAuth | Quem já tem conta Google |
| GitHub | OAuth | Desenvolvedores |

### Como funciona no frontend

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Sign in com magic link
await supabase.auth.signInWithOtp({ email })

// Sign in com Google
await supabase.auth.signInWithOAuth({ provider: 'google' })

// Sign out
await supabase.auth.signOut()

// Escutar mudanças de auth
supabase.auth.onAuthStateChange((event, session) => {
  // atualizar store
})
```

### Session

- JWT é armazenado e gerenciado pelo Supabase client
- O token contém `sub` (user_id) e `role` (authenticated)
- O frontend envia o JWT automaticamente em toda query
- O banco valida via `auth.uid()` nas RLS policies

---

## Supabase Client no Frontend

### Configuração básica

```typescript
// apps/web/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Padrões de Query

**SELECT (listar)**

```typescript
const { data, error } = await supabase
  .from('notes')
  .select('*')
  .order('updated_at', { ascending: false })
```

**SELECT (por ID)**

```typescript
const { data, error } = await supabase
  .from('notes')
  .select('*')
  .eq('id', id)
  .single()
```

**INSERT**

```typescript
const { data, error } = await supabase
  .from('notes')
  .insert({ id: ulid(), user_id: user.id, title, content })
  .select()
  .single()
```

**UPDATE**

```typescript
const { data, error } = await supabase
  .from('notes')
  .update({ title, content, updated_at: new Date().toISOString() })
  .eq('id', id)
  .select()
  .single()
```

**DELETE**

```typescript
const { error } = await supabase
  .from('notes')
  .delete()
  .eq('id', id)
```

**Error handling**

```typescript
if (error) {
  console.error('Supabase error:', error)
  throw new Error(error.message)
}
```

---

## Supabase Admin Client (Server-side)

Para operações que exigem `service_role` (admin), usar em `packages/api/`:

```typescript
// packages/api/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,  // service_role key
  { auth: { autoRefreshToken: false, persistSession: false } }
)
```

Casos de uso:
- Seeds e migrações
- Webhooks
- Operações entre usuários (admin)

---

## Migrations

### Como aplicar migrations no Supabase

1. **Desenvolvimento local:** Acessar o SQL Editor no dashboard do Supabase
2. **Versionamento:** Manter os SQLs em `packages/api/src/db/migrations/`

```
packages/api/src/db/
├── migrations/
│   ├── 001_create_notes.sql
│   ├── 002_create_tasks.sql
│   ├── 003_create_tags.sql
│   └── 004_add_fulltext_search.sql
└── seed.sql
```

### Exemplo de migration

```sql
-- 001_create_notes.sql
CREATE TABLE notes (
  id         TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '',
  content    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_updated_at ON notes(updated_at DESC);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_access" ON notes
  FOR ALL USING (auth.uid() = user_id);
```

---

## Realtime (opcional — pós MVP)

Para features que precisam de atualização em tempo real (ex: tasks sendo
atualizadas em outra aba):

```typescript
// Habilitar realtime para a tabela no dashboard do Supabase
// Depois, no frontend:

const subscription = supabase
  .channel('notes_changes')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}` },
    (payload) => {
      // atualizar store
    }
  )
  .subscribe()
```

---

## Full-Text Search (Fase 4)

```sql
-- Adicionar coluna tsvector para search
ALTER TABLE notes ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) STORED;

CREATE INDEX idx_notes_search ON notes USING GIN(search_vector);

-- Query
SELECT * FROM notes
WHERE search_vector @@ plainto_tsquery('portuguese', 'termo de busca')
ORDER BY ts_rank(search_vector, plainto_tsquery('portuguese', 'termo de busca')) DESC;
```

---

## Supabase Setup Checklist

- [ ] Criar projeto no dashboard do Supabase (supabase.com)
- [ ] Anotar `Project URL` e `anon key` (pública) e `service_role key` (secreta)
- [ ] Configurar Auth providers:
  - [ ] Magic Link (email) — habilitar e configurar redirect URL
  - [ ] Google — obter Client ID e Secret no GCP Console
  - [ ] GitHub — obter Client ID e Secret no GitHub OAuth Apps
- [ ] Configurar `Site URL` no Supabase Auth (ex: `http://localhost:5173`)
- [ ] Executar migrations no SQL Editor
- [ ] Verificar RLS policies com `SELECT * FROM pg_policies`
- [ ] Criar variáveis `.env` no frontend e backend

---

## Troubleshooting Comum

| Problema | Causa | Solução |
|---|---|---|
| `new row violates row-level security` | RLS policy não permite insert | Verificar `WITH CHECK` na policy |
| `relation "notes" does not exist` | Tabela não criada | Rodar migration no SQL Editor |
| `JWT not found` | Sessão expirada | Chamar `supabase.auth.refreshSession()` |
| `auth.uid() is null` | Usuário não autenticado | Verificar se fez signIn |
| 401 nas queries | anon key errada ou expirada | Checar `VITE_SUPABASE_ANON_KEY` |
