/**
 * Script para executar migrations no Supabase via Management API.
 *
 * Uso:
 *   cd packages/api && npx tsx src/db/run-migrations.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carrega .env
const envPath = resolve(__dirname, "../../.env");
try {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
} catch {
  // .env não encontrado — usa env do sistema
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface Migration {
  version: number;
  name: string;
  file: string;
}

const migrations: Migration[] = [
  { version: 1, name: "Create notes table", file: "001_create_notes.sql" },
  { version: 2, name: "Create tasks table", file: "002_create_tasks.sql" },
  { version: 3, name: "Google Calendar sync", file: "003_google_calendar_sync.sql" },
];

async function main() {
  console.log("🚀 Running migrations...\n");

  for (const m of migrations) {
    const filePath = resolve(__dirname, "migrations", m.file);
    const sql = readFileSync(filePath, "utf-8");

    console.log(`📦 [${m.version}] ${m.name}...`);

    // Tenta via RPC exec_sql (disponível no Supabase com service_role)
    const { error } = await supabase.rpc("exec_sql", { query: sql });

    if (error) {
      if (error.message?.includes("function") && error.message?.includes("not found")) {
        console.log(`   ⚠️  RPC exec_sql not available.`);
        console.log(`   📋 Copy this SQL to Supabase Dashboard > SQL Editor:\n`);
        console.log(sql);
        console.log("\n");
      } else {
        console.log(`   ❌ ${error.message}`);
      }
      continue;
    }

    console.log(`   ✅ Done`);
  }

  // Testa conectividade
  console.log("\n🔍 Testing connection...");
  const { data, error } = await supabase.from("notes").select("count", { count: "exact", head: true });
  if (error?.message?.includes("relation") || error?.message?.includes("does not exist")) {
    console.log("   ⚠️  Tables not found. Use Supabase Dashboard > SQL Editor.");
  } else if (error) {
    console.log(`   ❌ ${error.message}`);
  } else {
    console.log("   ✅ Connection OK!");
  }
}

main().catch(console.error);
