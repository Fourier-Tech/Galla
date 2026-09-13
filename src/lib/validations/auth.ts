import { z } from "zod";

export const accessCodeSchema = z.object({
  code: z
    .string()
    .transform((val) => val.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{8}$/, "Access code must be exactly 8 digits")),
});

export type AccessCodeInput = z.infer<typeof accessCodeSchema>;

// Backward-compatible for admin provisioning
export const registerSchema = z.object({
  salonName: z.string().min(2, "Salon name must be at least 2 characters"),
  ownerEmail: z.string().email("Please enter a valid owner email address"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
