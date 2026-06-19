import { z } from "zod";

export const taskSchema = z.object({
  id: z.string().ulid(),
  title: z.string().min(1),
  description: z.string().default(""),
  completed: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable().default(null),
});

export type Task = z.infer<typeof taskSchema>;
