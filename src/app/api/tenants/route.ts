import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Tenant } from "@/lib/db/models/tenant.model";

export async function GET() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const tenant = await Tenant.findById(session.user.tenantId).select("-__v");

    if (!tenant) {
      return NextResponse.json({ error: "Tenant workspace not found" }, { status: 404 });
    }

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error("Failed to fetch tenant:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
