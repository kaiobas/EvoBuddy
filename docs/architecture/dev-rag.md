# Dev RAG — Architecture

## Goal

Capturar automaticamente o contexto das interações com IA (opencode, Claude)
durante o desenvolvimento e disponibilizar retrieval semântico para sessões
futuras.

## Entities

```
Session              # Uma sessão de desenvolvimento (ex: "implementar storage")
├── id               # ULID
├── title            # "Implementar camada de storage"
├── createdAt
├── updatedAt
└── Messages
    ├── id           # ULID
    ├── role         # "user" | "assistant" | "system"
    ├── content      # Texto completo
    ├── embedding    # Float[] (768d llama3.2)
    ├── sessionId
    └── createdAt

ContextSnippet       # Pedaços de código/contexto relevantes
├── id
├── filePath         # "packages/database/src/driver.ts"
├── content          # Conteúdo do snippet
├── embedding
├── sessionId        # Opcional — de qual sessão veio
├── tags             # ["storage", "sqlite", "driver"]
└── createdAt
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Database  | Prisma + SQLite |
| Embeddings | Ollama (llama3.2) |
| Vector search | SQLite + cosine similarity in-app |
| Runtime | Node.js (Electron/CLI) |

## Package Structure

```
packages/dev-rag/
├── prisma/
│   └── schema.prisma       # Prisma schema
├── src/
│   ├── index.ts            # Public API
│   ├── rag.ts              # RAG engine (embed + retrieve)
│   ├── embedder.ts         # Ollama embedding client
│   └── types.ts            # Shared types
├── package.json
└── tsconfig.json
```

## Data Flow

```
1. STORE
   Nova interação (prompt + resposta)
     → extractSnippets() (opcional, extrai blocos de código)
       → embedder.embed(text) → Ollama API
         → Prisma: save Message + ContextSnippet com embeddings

2. RETRIEVE
   Query do usuário
     → embedder.embed(query)
       → cosineSimilarity(embeddings armazenados)
         → top K resultados (messages + snippets)
           → formatContext() → prompt augmentado
```

## Why Prisma + SQLite

- Schema declarativo e versionado
- Cliente TypeScript tipado
- Suporte nativo a SQLite (zero setup)
- Embeddings armazenados como String (JSON serializado) no SQLite
- Busca por similaridade via carregamento + cálculo em memória (dataset pequeno)

## Embedding Strategy

- Modelo: `llama3.2` via Ollama (dimensão 3072)
- Geração sob demanda (não batch)
- Cache de embeddings em memória para consultas repetidas
- Threshold de similaridade: 0.75 (configurável)

## CLI (futuro)

```bash
npx evobuddy-rag query "como implementei o storage?"
npx evobuddy-rag ingest --file packages/database/src/driver.ts
npx evobuddy-rag session --last 5
```
