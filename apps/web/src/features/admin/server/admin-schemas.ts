import { z } from "zod";

export const adminListSchema = z.object({
  page: z.number().int().min(1).max(10000).default(1),
  query: z.string().trim().max(100).default(""),
  status: z.string().trim().max(40).default("all"),
});

export const createCdKeyBatchSchema = z.object({
  name: z.string().trim().min(1).max(80),
  credits: z.number().int().min(1).max(10000),
  count: z.number().int().min(1).max(500),
  expiresAt: z.string().datetime().nullable().default(null),
  channel: z.string().trim().max(80).default(""),
  note: z.string().trim().max(500).default(""),
});

export const disableCdKeyBatchSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
