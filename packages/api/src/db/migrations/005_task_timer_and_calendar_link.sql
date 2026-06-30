-- Migration 005: Task timer and calendar event link
-- Apply via: Supabase Dashboard > SQL Editor

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS starts_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS calendar_event_id  TEXT REFERENCES calendar_events(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_calendar_event_id
  ON tasks(calendar_event_id)
  WHERE calendar_event_id IS NOT NULL;
