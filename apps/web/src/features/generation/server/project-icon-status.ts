import { z } from "zod";

export const projectIconStatusSchema = z.union([z.object({ favorite: z.boolean() }), z.object({ recycled: z.boolean() })]);

export function projectIconStatusChanges(input: z.infer<typeof projectIconStatusSchema>, now = new Date().toISOString()) {
  return "favorite" in input
    ? { is_favorite: input.favorite, ...(input.favorite ? { recycled_at: null } : {}) }
    : { recycled_at: input.recycled ? now : null, ...(input.recycled ? { is_favorite: false } : {}) };
}
