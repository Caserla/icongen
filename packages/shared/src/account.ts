import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(8).max(128);

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  acceptedTerms: z.literal(true),
  next: z.string().optional(),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  next: z.string().optional(),
});

export const emailRequestSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({ password: passwordSchema });

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(18)
    .regex(/^[\p{L}\p{N} ]+$/u, "Display name may contain only letters, numbers, and spaces.")
    .nullable(),
});

export const accountStatusSchema = z.enum(["active", "restricted"]);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

export type AccountSummary = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  creditBalance: number;
  status: AccountStatus;
  createdAt: string;
};
