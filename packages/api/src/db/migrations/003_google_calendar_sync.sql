-- Migration 003: Google Calendar sync
-- Apply via: Supabase Dashboard > SQL Editor

-- Tabela para armazenar tokens OAuth do Google por usuário
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  calendar_id     TEXT NOT NULL DEFAULT 'primary',
  last_synced_at  TIMESTAMPTZ,
  sync_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_user_id
  ON google_calendar_tokens(user_id);

ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Novas colunas em calendar_events para rastrear sync
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS google_event_id   TEXT,
  ADD COLUMN IF NOT EXISTS google_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_calendar_events_google_event_id
  ON calendar_events(google_event_id)
  WHERE google_event_id IS NOT NULL;
