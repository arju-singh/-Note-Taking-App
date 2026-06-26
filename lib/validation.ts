import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const shareConfigSchema = z
  .object({
    shareType: z.enum(["ONE_TIME", "TIME_BASED"]),
    accessType: z.enum(["PUBLIC", "PASSWORD_PROTECTED"]),
    // ISO string; required only for TIME_BASED
    expiresAt: z.string().datetime().optional().nullable(),
  })
  .refine(
    (v) => v.shareType !== "TIME_BASED" || !!v.expiresAt,
    { message: "Time-based links require an expiry date/time", path: ["expiresAt"] }
  )
  .refine(
    (v) =>
      v.shareType !== "TIME_BASED" ||
      !v.expiresAt ||
      new Date(v.expiresAt).getTime() > Date.now(),
    { message: "Expiry must be in the future", path: ["expiresAt"] }
  );

export const createNoteSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    content: z.string().min(1, "Content is required").max(20000),
  })
  .and(shareConfigSchema);

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type ShareConfigInput = z.infer<typeof shareConfigSchema>;
