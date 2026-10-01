import { NextResponse } from "next/server";

/**
 * Notice: Automated code rotation is disabled in favor of the user-controlled
 * Two-Tier Authentication & Role PIN model.
 */
export async function GET() {
  return NextResponse.json({
    message: "Manual user-controlled Role PINs are active. Automated code rotation is disabled.",
    status: "inactive",
  });
}
