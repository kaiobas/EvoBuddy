# Shared Package Skill

Specialized in core business logic with `@evobuddy/shared`.

## Structure

```
packages/shared/src/
├── index.ts                        # Re-exports
├── modules/
│   ├── notes/
│   │   ├── index.ts
│   │   ├── schema.ts               # NoteSchema (Zod)
│   │   └── store.ts                # useNotesStore (Zustand)
│   └── tasks/
│       ├── index.ts
│       ├── schema.ts               # TaskSchema (Zod)
│       └── store.ts                # useTasksStore (Zustand)
├── storage/
│   └── index.ts                    # Storage interface (placeholder)
└── sync/
    └── index.ts                    # Sync interface (placeholder)
```

## Conventions

- TypeScript strict, ESM (`"type": "module"`)
- Zod for validation — every entity has a Zod schema
- Zustand for state — stores are local-first
- Module pattern: `schema.ts` → `store.ts` → `index.ts`
- Offline-first: never depend on external services
- Zero runtime deps beyond Zod and Zustand

## Module Pattern

```
schema.ts       # Zod schema + TypeScript type
store.ts        # Zustand store with CRUD actions
index.ts        # Public API exports
```

## Available Stores

| Store | State | Actions |
|-------|-------|---------|
| `useNotesStore` | `notes: Note[]` | `add`, `remove`, `setNotes` |
| `useTasksStore` | `tasks: Task[]` | `add`, `toggle`, `remove`, `setTasks` |
