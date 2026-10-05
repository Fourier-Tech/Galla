import { NextRequest, NextResponse } from "next/server";
import { processAllShopsExpiryReminders } from "@/lib/services/expiry-reminder-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Strict authorization: reject unless Authorization equals Bearer ${process.env.CRON_SECRET}
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const urlSecret = request.nextUrl.searchParams.get("secret");
      if (urlSecret !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (!cronSecret) {
      console.warn("[Cron/ExpiryReminders] CRON_SECRET is not configured in environment.");
    }

    const summary = await processAllShopsExpiryReminders();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
    });
  } catch (error: any) {
    console.error("[Cron/ExpiryReminders] Failure running expiry reminders cron:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process expiry reminders",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
