#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { OllamaEmbedder } from "./embedder.js";
import { RagEngine } from "./rag.js";

export interface FinishTaskOptions {
  title?: string;
  summary?: string;
  files?: string[];
  tags?: string[];
}

export async function finishTask(options: FinishTaskOptions = {}): Promise<{ sessionId: string }> {
  const gitLog = getGitLog();
  const gitStat = getGitStat();
  const staged = getStagedFiles();
  const unstaged = getUnstagedFiles();
  const untracked = getUntrackedFiles();
  const changedFiles = options.files ?? [...staged, ...unstaged, ...untracked].filter((f, i, a) => a.indexOf(f) === i);
  const commits = getGitCommits();

  const summary = options.summary ?? buildSummary(commits, gitLog, changedFiles, gitStat, staged, unstaged, untracked);

  const title = options.title ?? (commits[0] ? `Task: ${commits[0]}` : "Development session");

  const embedder = new OllamaEmbedder({
    baseUrl: process.env.OLLAMA_URL ?? "http://localhost:11434",
    model: process.env.EMBEDDING_MODEL ?? "nomic-embed-text",
  });

  const rag = new RagEngine({
    embedder,
    dbUrl: process.env.DEV_RAG_DB_URL ?? "file:./data/dev-rag.db",
  });

  try {
    const result = await rag.addInteraction({
      sessionTitle: title,
      messages: [
        { role: "user", content: `Task: ${title}` },
        { role: "assistant", content: summary },
      ],
      snippets: changedFiles.map((f) => ({
        filePath: f,
        content: readFileSafe(f).slice(0, 3000),
        tags: options.tags ?? extractTags(f),
      })),
    });

    return result;
  } finally {
    await rag.destroy();
  }
}

function getGitLog(): string {
  try {
    return execSync("git log --oneline -10 --no-decorate 2>/dev/null", { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

function getGitStat(): string {
  try {
    return execSync("git diff --stat HEAD~1..HEAD 2>/dev/null || git diff --stat 2>/dev/null", { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

function getGitCommits(): string[] {
  try {
    const out = execSync("git log --oneline -10 --no-decorate 2>/dev/null", { encoding: "utf-8" }).trim();
    return out ? out.split("\n").map((l) => l.replace(/^[a-f0-9]+\s+/, "")) : [];
  } catch {
    return [];
  }
}

function getChangedFiles(): string[] {
  try {
    const out = execSync(
      "git diff --name-only HEAD~1..HEAD 2>/dev/null || git diff --cached --name-only 2>/dev/null || git status --porcelain 2>/dev/null",
      { encoding: "utf-8" },
    ).trim();
    return out ? out.split("\n").map((f) => f.replace(/^..\s*/, "").trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function getStagedFiles(): string[] {
  try {
    const out = execSync("git diff --cached --name-only 2>/dev/null", { encoding: "utf-8" }).trim();
    return out ? out.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

function getUnstagedFiles(): string[] {
  try {
    const out = execSync("git diff --name-only 2>/dev/null", { encoding: "utf-8" }).trim();
    return out ? out.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

function getUntrackedFiles(): string[] {
  try {
    const out = execSync("git ls-files --others --exclude-standard 2>/dev/null", { encoding: "utf-8" }).trim();
    return out ? out.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

function readFileSafe(filePath: string): string {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function extractTags(filePath: string): string[] {
  const tags: string[] = [];
  const parts = filePath.split("/");
  if (parts.length > 1) tags.push(parts[0]!);

  const ext = filePath.split(".").pop();
  if (ext) tags.push(ext);

  if (/test|spec|\.test\.|\.spec\./i.test(filePath)) tags.push("test");
  if (/doc|\.md$/i.test(filePath)) tags.push("docs");
  if (/config|\.json$|\.yaml$|\.yml$/i.test(filePath)) tags.push("config");

  return tags;
}

function buildSummary(
  commits: string[],
  log: string,
  files: string[],
  stat: string,
  staged: string[],
  unstaged: string[],
  untracked: string[],
): string {
  const parts: string[] = [];

  if (commits.length > 0) {
    parts.push("## Commits\n");
    parts.push(log);
    parts.push("");
  }

  const notCommitted: string[] = [];
  if (staged.length > 0) notCommitted.push(`staged: ${staged.length} files`);
  if (unstaged.length > 0) notCommitted.push(`unstaged: ${unstaged.length} files`);
  if (untracked.length > 0) notCommitted.push(`untracked: ${untracked.length} files`);
  if (notCommitted.length > 0) {
    parts.push("## Uncommitted Changes\n");
    parts.push(notCommitted.join(", "));
    parts.push("");
  }

  if (files.length > 0) {
    parts.push("## Files Changed\n");
    for (const f of files) {
      const content = readFileSafe(f);
      const lines = content ? content.split("\n").length : 0;
      parts.push(`- ${f} (${lines} lines)`);
    }
    parts.push("");
  }

  if (stat) {
    parts.push("## Diff Stats\n");
    parts.push(stat);
    parts.push("");
  }

  return parts.join("\n") || "No git context available.";
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: evobuddy-rag finish-task [options]

Options:
  --title <text>    Session title (default: first commit message)
  --summary <text>  Custom summary (default: auto-generated from git)
  --tags <tags>     Comma-separated tags (default: auto-detected)
  --help, -h        Show this help
`);
    process.exit(0);
  }

  const title = parseArg(args, "--title");
  const summary = parseArg(args, "--summary");
  const tags = parseArg(args, "--tags")?.split(",").map((t) => t.trim()).filter(Boolean);

  const result = await finishTask({
    title,
    summary,
    tags,
  });

  console.log(`Session saved: ${result.sessionId}`);
}

function parseArg(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("finish-task error:", err);
    process.exit(1);
  });
}
