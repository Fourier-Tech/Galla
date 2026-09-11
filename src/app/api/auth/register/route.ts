import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Tenant } from "@/lib/db/models/tenant.model";
import { User } from "@/lib/db/models/user.model";
import { registerSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password, salonName } = result.data;

    await connectToDatabase();

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Generate clean slug for tenant
    const baseSlug = salonName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const tenantSlug = `${baseSlug}-${randomSuffix}`;

    // Create Tenant
    const tenant = await Tenant.create({
      name: salonName.trim(),
      slug: tenantSlug,
      status: "active",
    });

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create User linked to Tenant
    const user = await User.create({
      tenantId: tenant._id,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: "owner",
    });

    return NextResponse.json(
      {
        message: "Account and salon workspace created successfully",
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          tenantId: tenant._id.toString(),
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
