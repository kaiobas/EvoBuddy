#!/usr/bin/env node

import { execSync } from "child_process";
import { mkdirSync, existsSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const DB_PATH = resolve(ROOT, "data");

async function main() {
  if (!existsSync(DB_PATH)) {
    mkdirSync(DB_PATH, { recursive: true });
    console.log(`Created data directory: ${DB_PATH}`);
  }

  const envPath = resolve(ROOT, ".env");
  if (!existsSync(envPath)) {
    writeFileSync(
      envPath,
      [
        `DEV_RAG_DB_URL="file:${resolve(DB_PATH, "dev-rag.db")}"`,
        'OLLAMA_URL="http://localhost:11434"',
        'EMBEDDING_MODEL="llama3.2"',
      ].join("\n"),
    );
    console.log(`Created .env: ${envPath}`);
  }

  console.log("Pushing database schema...");
  execSync("npx prisma db push", {
    cwd: ROOT,
    stdio: "inherit",
  });

  console.log("Setup complete. RAG database ready.");

  console.log("\nNext steps:");
  console.log("  1. Ensure Ollama is running: ollama serve");
  console.log(`  2. Pull the model: ollama pull llama3.2`);
  console.log("  3. Restart opencode to activate the MCP server");
}

main().catch(console.error);
