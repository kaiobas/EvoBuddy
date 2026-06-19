# ARCHITECTURE.md

> Documento vivo. Toda decisão arquitetural significativa deve ser registrada aqui antes de ser implementada.

---

## 1. Visão Geral

Telos é uma aplicação de produtividade pessoal **offline-first** e **local-first**, distribuída como app mobile (React Native) e desktop (Electron). A sincronização é um complemento opcional — o sistema funciona completamente sem internet.

### Princípios Inegociáveis

| Princípio | Implicação prática |
|---|---|
| **Offline First** | Toda operação deve funcionar sem rede. Sync é eventual, nunca bloqueante. |
| **Local First** | Dados residem no dispositivo. Nuvem é espelho, não fonte da verdade. |
| **Core independente** | Regras de negócio não importam SQLite, Electron ou React Native. |
| **Storage substituível** | Trocar SQLite por outro mecanismo não deve alterar o core. |
| **IA como assistente** | O app funciona 100% sem IA. IA é camada opt-in. |
| **Simplicidade** | Nenhuma abstração sem necessidade demonstrada. |

---

## 2. Estrutura do Monorepo

```
telos/
├── apps/
│   ├── mobile/          # React Native CLI
│   └── desktop/         # Electron + React
│
├── packages/
│   ├── core/            # Entidades, interfaces, event bus — zero deps externas
│   ├── modules/         # Use cases por domínio (notes, tasks, assistant…)
│   ├── ui/              # Componentes compartilhados (RN + React)
│   ├── storage/         # Implementações concretas de storage
│   ├── sync/            # Engine de sincronização (P2P + cloud)
│   └── ai/              # Adapters para LLMs locais e remotos
│
├── tools/
│   ├── eslint-config/
│   ├── tsconfig/
│   └── scripts/         # build, test, gen-types
│
├── docs/
│   ├── PLAN.md
│   ├── ARCHITECTURE.md  # este arquivo
│   ├── features/        # FEATURE.md por funcionalidade
│   └── specs/           # SPEC.md + TASKS.md por feature
│
├── package.json         # workspace root (pnpm workspaces)
├── pnpm-workspace.yaml
└── turbo.json
```

### Regras de Dependência (acíclicas)

```
apps/* → packages/modules → packages/core
apps/* → packages/ui
apps/* → packages/storage
apps/* → packages/sync (opcional)
apps/* → packages/ai (opcional)

packages/storage → packages/core
packages/sync    → packages/core
packages/ai      → packages/core
packages/modules → packages/core

# Proibido:
packages/core → qualquer outro package
packages/modules → packages/storage (só via interfaces do core)
packages/modules → packages/sync
packages/modules → packages/ai
```

> **Regra de ouro:** `packages/core` não pode importar nada de fora de si mesmo. Se uma abstração precisa de uma dependência externa, ela pertence a `packages/storage`, `packages/sync` ou `packages/ai`.

---

## 3. packages/core

O núcleo do sistema. **Sem dependências de runtime** além de TypeScript e Zod.

### Estrutura interna

```
packages/core/
├── entities/
│   ├── Note.ts          # Zod schema + TypeScript type
│   ├── Task.ts
│   ├── Attachment.ts
│   └── index.ts
│
├── repositories/        # Interfaces puras (contratos)
│   ├── INoteRepository.ts
│   ├── ITaskRepository.ts
│   └── index.ts
│
├── events/
│   ├── EventBus.ts      # Interface + implementação in-memory
│   ├── EventTypes.ts    # Discriminated union de todos os eventos
│   └── index.ts
│
├── errors/
│   ├── AppError.ts      # Hierarquia de erros tipados
│   └── index.ts
│
└── utils/
    ├── id.ts            # nanoid wrapper
    ├── date.ts          # utilitários de data (sem moment/dayjs no core)
    └── index.ts
```

### Entidade — exemplo canônico

```typescript
// packages/core/entities/Note.ts
import { z } from 'zod'

export const NoteSchema = z.object({
  id: z.string().nanoid(),
  title: z.string().max(500),
  content: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  version: z.number().int().min(0),   // para CRDT / sync
  deviceId: z.string(),               // origem da última modificação
})

export type Note = z.infer<typeof NoteSchema>
export type NoteInput = z.infer<typeof NoteSchema.omit({ id: true, createdAt: true, updatedAt: true, version: true }>>
```

### Repositório — interface pura

```typescript
// packages/core/repositories/INoteRepository.ts
import type { Note, NoteInput } from '../entities/Note'

export interface INoteRepository {
  findById(id: string): Promise<Note | null>
  findAll(filters?: NoteFilters): Promise<Note[]>
  save(note: Note): Promise<Note>
  delete(id: string): Promise<void>
  findByUpdatedSince(timestamp: string): Promise<Note[]>  // para sync
}

export interface NoteFilters {
  tags?: string[]
  search?: string
  deletedAt?: 'include' | 'exclude' | 'only'
}
```

### Event Bus

```typescript
// packages/core/events/EventTypes.ts
export type AppEvent =
  | { type: 'note:created';  payload: Note }
  | { type: 'note:updated';  payload: Note }
  | { type: 'note:deleted';  payload: { id: string } }
  | { type: 'task:created';  payload: Task }
  | { type: 'task:updated';  payload: Task }
  | { type: 'sync:started' }
  | { type: 'sync:completed'; payload: SyncResult }
  | { type: 'sync:conflict';  payload: ConflictInfo }

export interface IEventBus {
  emit<T extends AppEvent>(event: T): void
  on<T extends AppEvent['type']>(
    type: T,
    handler: (event: Extract<AppEvent, { type: T }>) => void
  ): () => void  // retorna unsubscribe
}
```

---

## 4. packages/modules

Cada módulo é um pacote com use cases (application layer). Importa apenas interfaces do `core`, nunca implementações concretas.

### Estrutura por módulo

```
packages/modules/
├── notes/
│   ├── src/
│   │   ├── CreateNote.ts      # use case
│   │   ├── UpdateNote.ts
│   │   ├── DeleteNote.ts
│   │   ├── SearchNotes.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── tasks/
│   └── src/ ...
│
└── assistant/
    └── src/ ...
```

### Use case — exemplo

```typescript
// packages/modules/notes/src/CreateNote.ts
import type { INoteRepository } from '@telos/core/repositories'
import type { IEventBus } from '@telos/core/events'
import { NoteSchema, type NoteInput } from '@telos/core/entities'
import { generateId } from '@telos/core/utils'

export class CreateNote {
  constructor(
    private readonly notes: INoteRepository,
    private readonly events: IEventBus,
  ) {}

  async execute(input: NoteInput): Promise<Note> {
    const note = NoteSchema.parse({
      ...input,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      version: 0,
      deviceId: getDeviceId(),
    })

    const saved = await this.notes.save(note)
    this.events.emit({ type: 'note:created', payload: saved })
    return saved
  }
}
```

> Os módulos nunca instanciam repositórios — recebem por injeção de dependência. O app (mobile/desktop) faz a composição.

---

## 5. packages/storage

Implementações concretas dos repositórios. Depende de `core` (interfaces) e das libs nativas (SQLite, etc.).

### Estrutura

```
packages/storage/
├── sqlite/
│   ├── adapters/
│   │   ├── SqliteNoteRepository.ts   # implementa INoteRepository
│   │   ├── SqliteTaskRepository.ts
│   │   └── index.ts
│   ├── migrations/
│   │   ├── 001_initial.ts
│   │   ├── 002_add_tags.ts
│   │   └── runner.ts
│   ├── platform/
│   │   ├── mobile.ts    # better-sqlite3 wrapper para RN
│   │   └── desktop.ts   # better-sqlite3 para Electron
│   └── index.ts
│
└── memory/
    ├── MemoryNoteRepository.ts   # para testes e dev
    └── index.ts
```

### Desacoplamento via Platform Abstraction

```typescript
// packages/storage/sqlite/platform/interface.ts
export interface ISQLiteDriver {
  execute(sql: string, params?: unknown[]): Promise<void>
  query<T>(sql: string, params?: unknown[]): Promise<T[]>
  transaction(fn: () => Promise<void>): Promise<void>
}

// A implementação mobile usa op-sqlite ou react-native-sqlite-storage
// A implementação desktop usa better-sqlite3 via Electron IPC
// O SqliteNoteRepository só conhece ISQLiteDriver
```

### Migrations

```typescript
// packages/storage/sqlite/migrations/runner.ts
interface Migration {
  version: number
  name: string
  up: (db: ISQLiteDriver) => Promise<void>
  down: (db: ISQLiteDriver) => Promise<void>
}

// Migrations são independentes de plataforma — rodam via ISQLiteDriver
```

---

## 6. packages/sync

Engine de sincronização. **Completamente opcional** — o app funciona sem inicializar este pacote.

### Fase 1: P2P Local (sem backend)

```
packages/sync/
├── core/
│   ├── SyncEngine.ts          # orquestra o processo
│   ├── ConflictResolver.ts    # estratégia CRDT
│   └── ChangeLog.ts           # registro de mudanças pendentes
│
├── adapters/
│   ├── p2p/
│   │   ├── MdnsDiscovery.ts   # descobre peers na rede local
│   │   ├── WebRtcTransport.ts # canal de comunicação
│   │   └── P2PSyncAdapter.ts
│   └── cloud/                 # Fase 2 — placeholder
│       └── CloudSyncAdapter.ts
│
└── crdt/
    ├── operations.ts          # operações CRDT por tipo de entidade
    └── merge.ts               # algoritmo de merge
```

### Estratégia CRDT

Cada entidade tem um campo `version` (Lamport clock) e `deviceId`. Conflitos são resolvidos por:

1. **Last-Write-Wins (LWW)** como padrão inicial para simplicidade
2. Campo `version` incrementado a cada mudança local
3. Merge: ganha a versão com maior `version`; em empate, ganha `deviceId` lexicograficamente maior
4. **Deleções** são soft-deletes (`deletedAt`) para evitar conflitos de ressurreição

> Para V1 o LWW é suficiente. Automerge/Yjs será avaliado se houver edição colaborativa real-time.

### Change Log (offline queue)

```typescript
interface ChangeLogEntry {
  id: string
  entityType: 'note' | 'task'
  entityId: string
  operation: 'create' | 'update' | 'delete'
  payload: unknown
  timestamp: string
  deviceId: string
  synced: boolean
}
```

Toda mutação local grava no `ChangeLog`. O sync engine drena essa fila quando um peer está disponível.

### Fluxo P2P

```
[Device A]                          [Device B]
   │                                    │
   ├─ mDNS: anuncia presença ──────────►│
   │◄──────── mDNS: descobre A ─────────┤
   │                                    │
   ├─ WebRTC: estabelece canal ─────────►│
   │◄────────── handshake ───────────────┤
   │                                    │
   ├─ envia ChangeLog delta ────────────►│
   │◄──────── aplica + ACK ──────────────┤
   │◄──────── envia delta inverso ───────┤
   ├─ aplica + ACK ─────────────────────►│
   │                                    │
```

---

## 7. packages/ai

Adapters para diferentes provedores de IA. O módulo `assistant` no `packages/modules` depende apenas da interface, nunca do adapter concreto.

```
packages/ai/
├── interface/
│   └── IAIAdapter.ts        # contrato único
│
├── adapters/
│   ├── OllamaAdapter.ts     # LLM local via Ollama (desktop)
│   ├── OpenAIAdapter.ts     # API remota
│   ├── AnthropicAdapter.ts  # API remota
│   └── MockAdapter.ts       # para testes
│
└── context/
    └── ContextBuilder.ts    # monta o contexto relevante para o prompt
```

```typescript
// packages/ai/interface/IAIAdapter.ts
export interface IAIAdapter {
  isAvailable(): Promise<boolean>
  complete(prompt: string, options?: AIOptions): Promise<string>
  stream(prompt: string, options?: AIOptions): AsyncIterable<string>
}
```

O app tenta em ordem: local → remoto → graceful degradation (funcionalidade desabilitada, não erro).

---

## 8. packages/ui

Componentes visuais compartilhados entre mobile e desktop.

### Estratégia de abstração de plataforma

```
packages/ui/
├── primitives/
│   ├── Text.tsx           # abstração sobre RN Text e HTML span
│   ├── View.tsx           # abstração sobre RN View e HTML div
│   ├── Pressable.tsx      # abstração sobre RN e HTML button
│   └── index.ts
│
├── components/
│   ├── NoteCard.tsx       # usa primitives — funciona em ambas plataformas
│   ├── TaskItem.tsx
│   └── index.ts
│
├── tokens/
│   ├── colors.ts          # design tokens
│   ├── spacing.ts
│   └── typography.ts
│
└── theme/
    └── ThemeProvider.tsx
```

> Primitives usam a plataforma correta via detecção (Platform.OS no RN, padrão web fora). Componentes de produto ficam nos apps quando têm muita lógica de plataforma.

---

## 9. apps/mobile e apps/desktop

Os apps são **invólucros finos**. Responsabilidades:

- Inicializar dependências (IoC container simples ou factory functions)
- Navegar entre telas
- Adaptar plataforma (permissões, notificações, file system)
- **Não contêm regras de negócio**

### Composição de dependências (DI manual)

```typescript
// apps/mobile/src/bootstrap.ts
import { SqliteNoteRepository } from '@telos/storage/sqlite'
import { InMemoryEventBus } from '@telos/core/events'
import { CreateNote, SearchNotes } from '@telos/modules/notes'

export function createNoteUseCases() {
  const db = getSQLiteDriver()   // instância nativa mobile
  const events = new InMemoryEventBus()
  const notes = new SqliteNoteRepository(db)

  return {
    createNote: new CreateNote(notes, events),
    searchNotes: new SearchNotes(notes),
    events,
  }
}
```

Zustand atua como camada de estado da UI — chama os use cases e armazena o resultado em store.

---

## 10. Estado Global (Zustand)

```typescript
// apps/mobile/src/stores/notesStore.ts
import { create } from 'zustand'
import type { Note } from '@telos/core/entities'

interface NotesStore {
  notes: Note[]
  loading: boolean
  load: () => Promise<void>
  create: (input: NoteInput) => Promise<void>
}

// O store chama o use case — nunca acessa repositório diretamente
export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  loading: false,
  load: async () => {
    set({ loading: true })
    const notes = await useCases.searchNotes.execute({})
    set({ notes, loading: false })
  },
  // ...
}))
```

---

## 11. Tooling do Monorepo

### Package Manager: pnpm + workspaces

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tools/*'
```

### Build Orchestration: Turborepo

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

### TypeScript: paths aliases

```json
// tools/tsconfig/base.json
{
  "compilerOptions": {
    "paths": {
      "@telos/core/*":    ["../../packages/core/src/*"],
      "@telos/modules/*": ["../../packages/modules/*/src/*"],
      "@telos/storage/*": ["../../packages/storage/src/*"],
      "@telos/sync/*":    ["../../packages/sync/src/*"],
      "@telos/ai/*":      ["../../packages/ai/src/*"],
      "@telos/ui/*":      ["../../packages/ui/src/*"]
    }
  }
}
```

---

## 12. Estratégia de Testes

| Camada | Tipo | Ferramenta | Velocidade |
|---|---|---|---|
| `packages/core` | Unit | Vitest | < 1s |
| `packages/modules` | Unit (com MemoryAdapter) | Vitest | < 1s |
| `packages/storage` | Integration (SQLite em memória) | Vitest | segundos |
| `packages/sync` | Integration (two instances) | Vitest | segundos |
| `apps/*` | E2E | Detox (mobile) / Playwright (desktop) | minutos |

> A inversão de dependências via interfaces torna os módulos 100% testáveis sem banco de dados real.

---

## 13. Fluxo de Desenvolvimento com IA

Toda feature segue a sequência obrigatória:

```
PLAN.md
  └─► ARCHITECTURE.md  (este arquivo — atualizado quando há decisão arquitetural)
        └─► docs/features/FEATURE-{nome}.md   (escopo da feature)
              └─► docs/specs/SPEC-{nome}.md   (especificação técnica detalhada)
                    └─► docs/specs/TASKS-{nome}.md  (tarefas atômicas)
                          └─► IMPLEMENTATION
                                └─► REVIEW.md
```

Nenhuma linha de código é escrita sem SPEC aprovada. Cada task em `TASKS.md` deve ser pequena o suficiente para uma única sessão de pair-programming com IA.

---

## 14. Decisões Registradas (ADR)

| # | Decisão | Razão | Data |
|---|---|---|---|
| 001 | pnpm + Turborepo como monorepo tooling | Performance de instalação, suporte nativo a workspaces, cache incremental | — |
| 002 | Zod para validação de entidades no core | Schemas servem como documentação viva e runtime validation sem codegen | — |
| 003 | LWW como estratégia CRDT inicial | Simplicidade para V1; Automerge avaliado quando houver colaboração real-time | — |
| 004 | Soft-delete em todas as entidades | Evita conflitos de ressurreição na sincronização | — |
| 005 | DI manual (sem container) | Sem overhead, sem magia, fácil de rastrear em debug | — |
| 006 | Zustand apenas nos apps, não nos módulos | Módulos são agnósticos de framework de estado | — |
| 007 | mDNS + WebRTC para P2P Fase 1 | Sem servidor de sinalização, funciona em LAN, implementação madura disponível | — |

---

## 15. Próximos Passos

- [ ] Criar `PLAN.md` com roadmap de milestones
- [ ] Configurar monorepo base (pnpm + turbo + tsconfig)
- [ ] Implementar `packages/core` completo com testes
- [ ] Criar `MemoryAdapter` e testar módulo `notes` contra ele
- [ ] Criar `SqliteAdapter` mobile
- [ ] Criar `SqliteAdapter` desktop
- [ ] Integrar no app mobile (tela de notas funcionando offline)
- [ ] Repetir para tasks
- [ ] Implementar sync P2P básico
- [ ] Integrar AI adapter (Ollama desktop primeiro)
