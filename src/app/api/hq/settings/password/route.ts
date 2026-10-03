import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db/mongodb";
import SuperAdmin from "@/lib/db/models/super-admin.model";
import { getHqSession } from "@/lib/auth/admin-auth";

export async function POST(request: Request) {
  try {
    const session = await getHqSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body ?? {};

    if (!currentPassword || !newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json({ success: false, error: "Invalid input." }, { status: 400 });
    }

    await connectToDatabase();
    const admin = await SuperAdmin.findById(session.adminId);
    if (!admin) {
      return NextResponse.json({ success: false, error: "Admin account not found." }, { status: 404 });
    }

    const isValid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isValid) {
      return NextResponse.json({ success: false, error: "Incorrect current password." }, { status: 400 });
    }

    admin.passwordHash = await bcrypt.hash(newPassword, 10);
    await admin.save();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Server error." }, { status: 500 });
  }
}
