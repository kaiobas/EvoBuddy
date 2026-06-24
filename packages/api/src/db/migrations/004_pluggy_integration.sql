-- Migration 004: Pluggy Open Finance integration
-- Apply via: Supabase Dashboard > SQL Editor

-- Novas colunas na tabela accounts
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS pluggy_item_id     TEXT,
  ADD COLUMN IF NOT EXISTS pluggy_account_id  TEXT,
  ADD COLUMN IF NOT EXISTS source             TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS last_synced_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_accounts_pluggy_item_id
  ON accounts(pluggy_item_id)
  WHERE pluggy_item_id IS NOT NULL;

-- Novas colunas na tabela transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS pluggy_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS source                TEXT NOT NULL DEFAULT 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_pluggy_transaction_id
  ON transactions(pluggy_transaction_id)
  WHERE pluggy_transaction_id IS NOT NULL;

-- Nova tabela pluggy_connections
CREATE TABLE IF NOT EXISTS pluggy_connections (
  id             TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id        TEXT NOT NULL UNIQUE,
  connector_name TEXT,
  status         TEXT NOT NULL DEFAULT 'updated',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pluggy_connections_user_id
  ON pluggy_connections(user_id);

ALTER TABLE pluggy_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_access" ON pluggy_connections
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
