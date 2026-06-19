# Claude Desktop — MCP Config

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "evobuddy-rag": {
      "command": "node",
      "args": [
        "/absolute/path/to/EvoBuddy/packages/dev-rag/dist/mcp/server.js"
      ],
      "env": {
        "DEV_RAG_DB_URL": "file:/absolute/path/to/EvoBuddy/packages/dev-rag/data/dev-rag.db",
        "OLLAMA_URL": "http://localhost:11434",
        "EMBEDDING_MODEL": "llama3.2"
      }
    }
  }
}
```

Replace `/absolute/path/to/EvoBuddy` with the real path.
