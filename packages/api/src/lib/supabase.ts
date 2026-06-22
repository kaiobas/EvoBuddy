import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    "[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Admin client will not be available."
  );
}

/**
 * Supabase Admin Client with service_role key.
 * Usado para operações server-side (migrações, webhooks, admin).
 * NÃO expor esta chave para o frontend.
 */
export const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;
