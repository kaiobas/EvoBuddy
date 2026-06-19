# Dev RAG — Specification

## Overview

Pacote `@evobuddy/dev-rag` para armazenar e consultar o contexto de
interações com IA durante o desenvolvimento, usando retrieval semântico
para reaproveitar decisões e padrões de código.

## Entities

### Session

```prisma
model Session {
  id        String   @id @default(uuid())
  title     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  messages  Message[]
  snippets  ContextSnippet[]
}
```

### Message

```prisma
model Message {
  id        String   @id @default(uuid())
  role      String   // "user" | "assistant" | "system"
  content   String
  embedding String?  // JSON: number[]
  session   Session  @relation(fields: [sessionId], references: [id])
  sessionId String
  createdAt DateTime @default(now())
}
```

### ContextSnippet

```prisma
model ContextSnippet {
  id        String   @id @default(uuid())
  filePath  String?
  content   String
  embedding String?  // JSON: number[]
  tags      String   // JSON: string[]
  session   Session? @relation(fields: [sessionId], references: [id])
  sessionId String?
  createdAt DateTime @default(now())
}
```

## Public API

```typescript
// --- Store ---

/** Adiciona uma interação completa (ex: prompt + resposta do Claude) */
async function addInteraction(params: {
  sessionTitle: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  snippets?: Array<{ filePath: string; content: string; tags: string[] }>;
}): Promise<{ sessionId: string }>;

/** Adiciona snippet avulso (ex: arquivo inteiro após edição) */
async function addSnippet(params: {
  filePath: string;
  content: string;
  tags?: string[];
  sessionId?: string;
}): Promise<{ id: string }>;

// --- Retrieve ---

/** Busca contexto relevante para uma query */
async function query(params: {
  text: string;
  topK?: number;        // default: 5
  threshold?: number;   // default: 0.75
  includeMessages?: boolean;
  includeSnippets?: boolean;
}): Promise<{
  messages: Array<{ content: string; sessionTitle: string; score: number }>;
  snippets: Array<{ content: string; filePath: string | null; score: number }>;
}>;

/** Gera prompt aumentado com contexto relevante */
async function augmentPrompt(prompt: string): Promise<{
  augmented: string;
  sources: Array<{ type: "message" | "snippet"; content: string; score: number }>;
}>;

// --- Manage ---

/** Lista sessões */
async function listSessions(): Promise<Array<{ id: string; title: string; createdAt: Date; messageCount: number }>>;

/** Remove sessão e dados associados */
async function deleteSession(id: string): Promise<void>;
```

## Embedding

```typescript
interface Embedder {
  embed(text: string): Promise<number[]>;
  embedMany(texts: string[]): Promise<number[][]>;
}
```

Implementação via Ollama:

```typescript
class OllamaEmbedder implements Embedder {
  constructor(private baseUrl: string = "http://localhost:11434") {}

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      body: JSON.stringify({ model: "llama3.2", prompt: text }),
    });
    const data = await res.json();
    return data.embedding; // number[] — 3072 dimensões
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}
```

## Vector Search

Similaridade por cosseno em memória (dataset local pequeno, < 10k registros):

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

Filtra por `threshold` e retorna top K.

## Prisma Setup

```bash
# schema gerado via:
npx prisma generate --schema packages/dev-rag/prisma/schema.prisma
npx prisma db push --schema packages/dev-rag/prisma/schema.prisma
```

## Dependencies

- `@prisma/client` — runtime
- `prisma` — dev, para generate/migrate
- SQLite via Prisma (built-in, sem driver extra)

## Configuração

```env
OLLAMA_URL=http://localhost:11434
EMBEDDING_MODEL=llama3.2
DEV_RAG_DB_PATH=./data/dev-rag.db
```

## CLI (próxima iteração)

```
evobuddy-rag add "mensagem"                    # adiciona interação manual
evobuddy-rag query "como fez X?"               # busca
evobuddy-rag ingest arquivo.ts                 # indexa arquivo
evobuddy-rag stats                             # estatísticas do banco
```
