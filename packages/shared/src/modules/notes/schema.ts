import { z } from "zod";

export const noteSchema = z.object({
  id: z.string().ulid(),
  title: z.string().default(""),
  content: z.string().default(""),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable().default(null),
});

export type Note = z.infer<typeof noteSchema>;
