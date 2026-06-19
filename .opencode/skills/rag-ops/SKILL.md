# RAG Operations Skill

Specialized in RAG (Retrieval-Augmented Generation) operations using `@evobuddy/dev-rag`.

## MCP Tools

The following tools are available via the `evobuddy-rag` MCP server:

| Tool | Description |
|------|-------------|
| `rag_query` | Search RAG for relevant context from past sessions |
| `rag_augment` | Augment a prompt with context before answering |
| `rag_ingest` | Index a file or text snippet |
| `rag_sessions` | List stored sessions |
| `rag_ingest_session` | Index a full conversation with embeddings |
| `rag_add_messages` | Add messages to an existing session |
| `rag_finish_task` | Auto-index latest work from git context |

## Workflows

### Indexing new work
After completing a task, always call `rag_finish_task` to persist context.

### Searching context
Before answering complex questions, call `rag_augment` with the user's prompt.

### Ingesting files
Use `rag_ingest` to index important source files for future reference.

## Database

- SQLite via Prisma at `packages/dev-rag/data/dev-rag.db`
- Models: `Session`, `Message`, `ContextSnippet`
- Embeddings: `nomic-embed-text` via Ollama (localhost:11434)
