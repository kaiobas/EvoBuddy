import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { OllamaEmbedder } from "../embedder.js";
import { RagEngine } from "../rag.js";
import { finishTask } from "../finish-task.js";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "llama3.2";
const DB_URL = process.env.DEV_RAG_DB_URL ?? "file:./data/dev-rag.db";

const TOOLS: Tool[] = [
  {
    name: "rag_query",
    description: "Search RAG for relevant context from past development sessions",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Search query" },
        topK: { type: "number", description: "Max results (default 5)" },
        threshold: {
          type: "number",
          description: "Similarity threshold 0-1 (default 0.75)",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "rag_augment",
    description:
      "Augment a prompt with relevant context from past sessions. Use BEFORE answering a complex question to retrieve previous context.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The prompt to augment" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "rag_ingest",
    description: "Index a file or text snippet into the RAG for future retrieval",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "File path (if indexing a file)",
        },
        content: { type: "string", description: "Text content to index" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags for categorization",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "rag_sessions",
    description: "List stored development sessions with message counts",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "rag_ingest_session",
    description: "Index a full conversation session with messages into the RAG. Creates a new session, embeds all messages, and stores them for future retrieval.",
    inputSchema: {
      type: "object",
      properties: {
        sessionTitle: { type: "string", description: "Title for the session" },
        messages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string", enum: ["user", "assistant", "system"] },
              content: { type: "string" },
            },
            required: ["role", "content"],
          },
          description: "Messages in the conversation",
        },
      },
      required: ["sessionTitle", "messages"],
    },
  },
  {
    name: "rag_finish_task",
    description: "Auto-index the latest work into RAG. Creates a summary from git history (commits, changed files, diff stats) and saves it as a session. Call at the end of a task/issue.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Session title (default: latest commit message)" },
        summary: { type: "string", description: "Custom summary (default: auto-generated)" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags",
        },
      },
    },
  },
  {
    name: "rag_add_messages",
    description: "Add messages to an existing RAG session with embeddings",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session ID to add messages to" },
        messages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string", enum: ["user", "assistant", "system"] },
              content: { type: "string" },
            },
            required: ["role", "content"],
          },
          description: "Messages to add",
        },
      },
      required: ["sessionId", "messages"],
    },
  },
];

let rag: RagEngine;

async function main() {
  const embedder = new OllamaEmbedder({
    baseUrl: OLLAMA_URL,
    model: EMBEDDING_MODEL,
  });

  rag = new RagEngine({ embedder, dbUrl: DB_URL });

  const server = new Server(
    { name: "evobuddy-dev-rag", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "rag_query": {
        const result = await rag.query({
          text: args?.text as string,
          topK: (args?.topK as number) ?? 5,
          threshold: (args?.threshold as number) ?? 0.75,
        });
        return {
          content: [{ type: "text", text: formatQueryResult(result) }],
        };
      }

      case "rag_augment": {
        const result = await rag.augmentPrompt(args?.prompt as string);
        return {
          content: [{ type: "text", text: result.augmented }],
        };
      }

      case "rag_ingest": {
        const id = await rag.addSnippet({
          filePath: (args?.filePath as string) ?? undefined,
          content: args?.content as string,
          tags: (args?.tags as string[]) ?? [],
        });
        return {
          content: [
            {
              type: "text",
              text: `Indexed successfully. Snippet ID: ${id.id}`,
            },
          ],
        };
      }

      case "rag_sessions": {
        const sessions = await rag.listSessions();
        const text =
          sessions.length === 0
            ? "No sessions yet."
            : sessions
                .map(
                  (s) =>
                    `- ${s.title} (${s.messageCount} msgs, ${s.createdAt.toISOString().slice(0, 10)})`,
                )
                .join("\n");
        return { content: [{ type: "text", text }] };
      }

      case "rag_ingest_session": {
        const result = await rag.addInteraction({
          sessionTitle: args?.sessionTitle as string,
          messages: args?.messages as Array<{ role: "user" | "assistant" | "system"; content: string }>,
        });
        return {
          content: [
            {
              type: "text",
              text: `Session indexed successfully. Session ID: ${result.sessionId}`,
            },
          ],
        };
      }

      case "rag_add_messages": {
        const result = await rag.addMessages({
          sessionId: args?.sessionId as string,
          messages: args?.messages as Array<{ role: "user" | "assistant" | "system"; content: string }>,
        });
        return {
          content: [
            {
              type: "text",
              text: `${result.count} messages added to session ${args?.sessionId}`,
            },
          ],
        };
      }

      case "rag_finish_task": {
        const result = await finishTask({
          title: (args?.title as string) ?? undefined,
          summary: (args?.summary as string) ?? undefined,
          tags: (args?.tags as string[]) ?? undefined,
        });
        return {
          content: [
            {
              type: "text",
              text: `Task session saved: ${result.sessionId}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function formatQueryResult(result: {
  messages: Array<{ content: string; sessionTitle: string; score: number }>;
  snippets: Array<{ content: string; filePath: string | null; score: number }>;
}): string {
  const parts: string[] = [];

  if (result.messages.length > 0) {
    parts.push("## Messages\n");
    for (const msg of result.messages) {
      parts.push(`[Score: ${msg.score.toFixed(3)}] ${msg.sessionTitle}`);
      parts.push(msg.content.slice(0, 500));
      parts.push("");
    }
  }

  if (result.snippets.length > 0) {
    parts.push("## Code Snippets\n");
    for (const snip of result.snippets) {
      parts.push(
        `[Score: ${snip.score.toFixed(3)}] ${snip.filePath ?? "no file"}`,
      );
      parts.push("```");
      parts.push(snip.content.slice(0, 500));
      parts.push("```");
      parts.push("");
    }
  }

  return parts.join("\n") || "No relevant context found.";
}

process.on("SIGINT", async () => {
  process.exit(0);
});

process.on("SIGTERM", async () => {
  process.exit(0);
});

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
