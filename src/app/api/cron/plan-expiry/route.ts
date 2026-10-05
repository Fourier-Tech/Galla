import { NextRequest, NextResponse } from "next/server";
import { processPlanExpirations } from "@/lib/services/plan-expiry-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Optional bearer secret check if CRON_SECRET is configured
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const urlSecret = request.nextUrl.searchParams.get("secret");
      if (urlSecret !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const result = await processPlanExpirations();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error: any) {
    console.error("[Cron/PlanExpiry] Failure running plan expiry check:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process plan expirations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
