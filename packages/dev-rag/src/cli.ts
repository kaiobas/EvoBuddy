#!/usr/bin/env node

import { finishTask } from "./finish-task.js";
import { OllamaEmbedder } from "./embedder.js";
import { RagEngine } from "./rag.js";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "llama3.2";
const DB_URL = process.env.DEV_RAG_DB_URL ?? "file:./data/dev-rag.db";

function printHelp(): void {
  console.log(`
Usage: evobuddy-rag <command> [options]

Commands:
  query <text>         Search RAG for relevant context
  ingest <file>        Index a file
  sessions             List sessions
  finish-task          Index a summary of the latest work (git context)
  help                 Show this help
`);
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "help") {
    printHelp();
    return;
  }

  const embedder = new OllamaEmbedder({
    baseUrl: OLLAMA_URL,
    model: EMBEDDING_MODEL,
  });

  const rag = new RagEngine({ embedder, dbUrl: DB_URL });

  try {
    switch (cmd) {
      case "query": {
        const text = args.slice(1).join(" ");
        if (!text) {
          console.error("Usage: evobuddy-rag query <text>");
          process.exit(1);
        }
        const result = await rag.query({ text });
        console.log("\nMessages:");
        for (const msg of result.messages) {
          console.log(`  [${msg.score.toFixed(3)}] ${msg.sessionTitle}`);
          console.log(`  ${msg.content.slice(0, 200)}...\n`);
        }
        console.log("Snippets:");
        for (const snip of result.snippets) {
          console.log(`  [${snip.score.toFixed(3)}] ${snip.filePath ?? "no file"}`);
          console.log(`  ${snip.content.slice(0, 200)}...\n`);
        }
        break;
      }

      case "sessions": {
        const sessions = await rag.listSessions();
        for (const s of sessions) {
          console.log(`${s.id.slice(0, 8)} | ${s.messageCount} msgs | ${s.title}`);
        }
        break;
      }

      case "finish-task": {
        const title = parseArg(args, "--title");
        const summary = parseArg(args, "--summary");
        const tags = parseArg(args, "--tags")?.split(",").map((t) => t.trim()).filter(Boolean);
        const result = await finishTask({ title, summary, tags });
        console.log(`Session saved: ${result.sessionId}`);
        break;
      }

      case "ingest": {
        const filePath = args[1];
        if (!filePath) {
          console.error("Usage: evobuddy-rag ingest <file>");
          process.exit(1);
        }
        const fs = await import("fs/promises");
        const content = await fs.readFile(filePath, "utf-8");
        const id = await rag.addSnippet({
          filePath,
          content,
          tags: [],
        });
        console.log(`Indexed ${filePath} (id: ${id.id})`);
        break;
      }

      default:
        console.error(`Unknown command: ${cmd}`);
        printHelp();
        process.exit(1);
    }
  } finally {
    await rag.destroy();
  }
}

function parseArg(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

main().catch(console.error);
