# Desktop Development Skill

Specialized in Electron development with `@evobuddy/desktop`.

## Stack

- Electron (main + preload)
- Vite + React (renderer)
- TypeScript strict
- ESM modules

## Structure

```
apps/desktop/
├── electron/
│   ├── main.ts          # Electron main process
│   └── preload.ts       # Preload script
├── src/
│   ├── App.tsx          # React entry
│   └── main.tsx         # Renderer entry
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Conventions

- IPC between main and renderer via contextBridge
- State management via Zustand (from `@evobuddy/shared`)
- Database via `better-sqlite3` in main process (when implemented)
- No business logic in the app — delegate to packages
