import { z } from "zod";

export const adminListSchema = z.object({
  page: z.number().int().min(1).max(10000).default(1),
  query: z.string().trim().max(100).default(""),
  status: z.string().trim().max(40).default("all"),
});
