import { z } from "zod";

/**
 * Note schema - alinhado com a tabela PostgreSQL notes.
 * user_id é UUID do Supabase Auth.
 * Timestamps em ISO 8601 (gerados pelo banco).
 */
export const noteSchema = z.object({
  id: z.string().ulid(),
  user_id: z.string().uuid(),
  title: z.string().default(""),
  content: z.string().default(""),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Note = z.infer<typeof noteSchema>;

export const noteInputSchema = noteSchema.omit({
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true,
});
export type NoteInput = z.infer<typeof noteInputSchema>;
