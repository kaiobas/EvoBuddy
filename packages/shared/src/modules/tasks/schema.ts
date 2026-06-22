import { z } from "zod";

/**
 * Task schema - alinhado com a tabela PostgreSQL tasks.
 */
export const taskSchema = z.object({
  id: z.string().ulid(),
  user_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().default(""),
  completed: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Task = z.infer<typeof taskSchema>;

export const taskInputSchema = taskSchema.omit({
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true,
});
export type TaskInput = z.infer<typeof taskInputSchema>;
