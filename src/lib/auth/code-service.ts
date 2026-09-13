import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/lib/db/models/user.model";
import { sendAccessCodesEmail } from "@/lib/email/email-service";

function getAuthSalt(): string {
  let salt = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!salt) {
    try {
      const envLocalPath = path.resolve(process.cwd(), ".env.local");
      if (fs.existsSync(envLocalPath)) {
        const content = fs.readFileSync(envLocalPath, "utf8");
        const match = content.match(/AUTH_SECRET=["']?([^"'\r\n]+)/);
        if (match) salt = match[1];
      }
    } catch {
      // fallback
    }
  }
  return salt || "galla-secret-access-code-salt-2026";
}

/**
 * Computes an HMAC-SHA256 hash of an 8-digit code.
 * Deterministic for fast indexed lookups while one-way secure.
 */
export function hashAccessCode(code: string): string {
  return crypto
    .createHmac("sha256", getAuthSalt())
    .update(code.trim())
    .digest("hex");
}

/**
 * Generates a random 8-digit numeric string (10000000 - 99999999).
 */
export function generate8DigitNumeric(): string {
  return crypto.randomInt(10000000, 100000000).toString();
}

/**
 * Generates an 8-digit code guaranteed to be globally unique
 * across all salons (active and grace codes).
 */
export async function generateUnique8DigitCode(
  excludeHashes: Set<string> = new Set()
): Promise<{ code: string; hash: string }> {
  await connectToDatabase();

  let attempts = 0;
  // ponytail: 50-attempt collision retry assumes active salon keys are well below the 100M 8-digit space. Upgrade path: pre-allocated code pool or alphanumeric keys if tenant count exceeds 500k.
  while (attempts < 50) {
    attempts++;
    const code = generate8DigitNumeric();
    const hash = hashAccessCode(code);

    if (excludeHashes.has(hash)) continue;

    // Check collision in database
    const collision = await User.collection.findOne({
      $or: [
        { ownerCodeHash: hash },
        { staffCodeHash: hash },
        { previousOwnerCodeHash: hash },
        { previousStaffCodeHash: hash },
      ],
    });

    if (!collision) {
      excludeHashes.add(hash);
      return { code, hash };
    }
  }

  throw new Error("Failed to generate unique 8-digit code after 50 attempts.");
}

/**
 * Calculates the next 7-day rotation date at 7:00 AM based on account creation time:
 * - If created before 1:00 PM (13:00): creation day counts as Day 1 -> 6 days added, target 7:00 AM (e.g. 14th 9 AM -> 20th 7 AM)
 * - If created after 1:00 PM (13:00): creation day does not count -> 7 days added, target 7:00 AM (e.g. 14th 9 PM -> 21st 7 AM)
 */
export function calculateRotationDate(from: Date = new Date()): Date {
  const target = new Date(from);
  const hour = target.getHours();

  if (hour < 13) {
    target.setDate(target.getDate() + 6);
  } else {
    target.setDate(target.getDate() + 7);
  }

  target.setHours(7, 0, 0, 0);
  return target;
}

/**
 * Grace period expires at 7:00 PM (19:00) on the rotation day (12 hours after 7:00 AM).
 */
export function calculateGraceExpiry(rotationDate: Date): Date {
  const grace = new Date(rotationDate);
  grace.setHours(19, 0, 0, 0);
  return grace;
}

/**
 * Rotates codes for a given tenant:
 * 1. Shifts current hashes to previous (grace) hashes.
 * 2. Generates 2 new unique 8-digit codes (Owner & Staff).
 * 3. Sets 12-hour grace period (expires at 7:00 PM).
 * 4. Updates codeExpiresAt to the next cycle.
 * 5. Sends email to shop owner with both codes and instructions.
 */
export async function rotateTenantCodes(tenantId: string | Types.ObjectId) {
  await connectToDatabase();

  const user = await User.findOne({ tenantId });
  if (!user) {
    throw new Error(`No user record found for tenant ID: ${tenantId}`);
  }

  const now = new Date();
  const exclude = new Set<string>();

  const ownerGen = await generateUnique8DigitCode(exclude);
  const staffGen = await generateUnique8DigitCode(exclude);

  const newRotationDate = calculateRotationDate(now);
  const graceExpiresAt = calculateGraceExpiry(now);

  user.previousOwnerCodeHash = user.ownerCodeHash;
  user.previousStaffCodeHash = user.staffCodeHash;
  user.ownerCodeHash = ownerGen.hash;
  user.staffCodeHash = staffGen.hash;
  user.codeExpiresAt = newRotationDate;
  user.graceExpiresAt = graceExpiresAt;

  await user.save();

  // Send email with new codes
  await sendAccessCodesEmail({
    to: user.ownerEmail,
    ownerCode: ownerGen.code,
    staffCode: staffGen.code,
    rotationDate: now,
    graceExpiresAt,
  });

  return {
    ownerCode: ownerGen.code,
    staffCode: staffGen.code,
    codeExpiresAt: newRotationDate,
    graceExpiresAt,
  };
}
