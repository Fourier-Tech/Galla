import { z } from "zod";

// Tier 1: Shop Account Login (Email + Password)
export const loginCredentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid shop email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
});

export type LoginCredentialsInput = z.infer<typeof loginCredentialsSchema>;

// Tier 2: Role Code / PIN Verification
export const verifyRolePinSchema = z.object({
  pin: z
    .string()
    .transform((val) => val.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "Role PIN must be exactly 6 digits")),
});

export type VerifyRolePinInput = z.infer<typeof verifyRolePinSchema>;

// Owner: Change Role PINs
export const changeRolePinsSchema = z
  .object({
    emailPassword: z
      .string()
      .min(1, "Shop email password is required for verification"),
    newOwnerPin: z
      .string()
      .transform((val) => val.replace(/\s+/g, ""))
      .pipe(z.string().regex(/^\d{6}$/, "New Owner PIN must be exactly 6 digits"))
      .optional()
      .or(z.literal("")),
    newStaffPin: z
      .string()
      .transform((val) => val.replace(/\s+/g, ""))
      .pipe(z.string().regex(/^\d{6}$/, "New Staff PIN must be exactly 6 digits"))
      .optional()
      .or(z.literal("")),
    newShopPassword: z
      .string()
      .min(6, "New master shop password must be at least 6 characters")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => Boolean(data.newOwnerPin || data.newStaffPin || data.newShopPassword),
    { message: "Please specify a new password or at least one new PIN to update", path: ["newShopPassword"] }
  )
  .refine(
    (data) => !(data.newOwnerPin && data.newStaffPin && data.newOwnerPin === data.newStaffPin),
    { message: "Owner PIN and Staff PIN cannot be the same", path: ["newStaffPin"] }
  );

export type ChangeRolePinsInput = z.infer<typeof changeRolePinsSchema>;

// Owner: Forgot PIN OTP Reset
export const resetPinOtpSchema = z
  .object({
    otp: z
      .string()
      .transform((val) => val.replace(/\s+/g, ""))
      .pipe(z.string().regex(/^\d{6}$/, "Verification code must be exactly 6 digits")),
    newOwnerPin: z
      .string()
      .transform((val) => val.replace(/\s+/g, ""))
      .pipe(z.string().regex(/^\d{6}$/, "New Owner PIN must be exactly 6 digits"))
      .optional()
      .or(z.literal("")),
    newStaffPin: z
      .string()
      .transform((val) => val.replace(/\s+/g, ""))
      .pipe(z.string().regex(/^\d{6}$/, "New Staff PIN must be exactly 6 digits"))
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => Boolean(data.newOwnerPin || data.newStaffPin),
    { message: "Please specify at least one new PIN to reset", path: ["newOwnerPin"] }
  )
  .refine(
    (data) => !(data.newOwnerPin && data.newStaffPin && data.newOwnerPin === data.newStaffPin),
    { message: "Owner PIN and Staff PIN cannot be the same", path: ["newStaffPin"] }
  );

export type ResetPinOtpInput = z.infer<typeof resetPinOtpSchema>;

// Backward-compatible for admin provisioning & legacy access codes
export const accessCodeSchema = z.object({
  code: z
    .string()
    .transform((val) => val.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{4,8}$/, "Access code must be between 4 and 8 digits")),
});

export type AccessCodeInput = z.infer<typeof accessCodeSchema>;

export const registerSchema = z
  .object({
    salonName: z.string().min(2, "Salon name must be at least 2 characters"),
    ownerEmail: z.string().email("Please enter a valid owner email address"),
    password: z.string().min(6, "Password must be at least 6 characters").optional(),
    ownerPin: z.string().regex(/^\d{6}$/, "Owner PIN must be exactly 6 digits").optional(),
    staffPin: z.string().regex(/^\d{6}$/, "Staff PIN must be exactly 6 digits").optional(),
  })
  .refine(
    (data) => !data.ownerPin || !data.staffPin || data.ownerPin !== data.staffPin,
    { message: "Owner PIN and Staff PIN cannot be the same", path: ["staffPin"] }
  );

export type RegisterInput = z.infer<typeof registerSchema>;
