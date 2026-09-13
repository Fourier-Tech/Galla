import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/lib/db/models/user.model";
import { rotateTenantCodes } from "@/lib/auth/code-service";

/**
 * Scheduled rotation job (runs daily at 7:00 AM).
 * Checks all salons whose codes are due for rotation,
 * generates new 8-digit codes, shifts old to 12h grace,
 * and emails the shop owners.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.AUTH_SECRET;

  // Protect cron endpoint with bearer token if CRON_SECRET is set
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const now = new Date();

    // Find all users whose codes have reached expiration
    const dueUsers = await User.find({
      codeExpiresAt: { $lte: now },
    });

    const results = [];
    for (const user of dueUsers) {
      try {
        const rotated = await rotateTenantCodes(user.tenantId);
        results.push({
          tenantId: user.tenantId.toString(),
          ownerEmail: user.ownerEmail,
          rotated: true,
          newRotationDate: rotated.codeExpiresAt,
        });
      } catch (err) {
        console.error(`Failed to rotate codes for tenant ${user.tenantId}:`, err);
        results.push({
          tenantId: user.tenantId.toString(),
          rotated: false,
          error: String(err),
        });
      }
    }

    return NextResponse.json({
      message: `Rotation cycle processed at ${now.toISOString()}`,
      rotatedCount: results.filter((r) => r.rotated).length,
      totalDue: dueUsers.length,
      results,
    });
  } catch (error) {
    console.error("Cron rotation error:", error);
    return NextResponse.json(
      { error: "Failed to process code rotation" },
      { status: 500 }
    );
  }
}
