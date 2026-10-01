import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Tenant } from "@/lib/db/models/tenant.model";
import { User } from "@/lib/db/models/user.model";
import { Counter } from "@/lib/db/models/counter.model";

export async function POST(request: Request) {
  const adminSecret = request.headers.get("x-admin-provisioning-secret");
  const configuredSecret = process.env.ADMIN_PROVISIONING_SECRET;

  if (!configuredSecret || adminSecret !== configuredSecret) {
    return NextResponse.json(
      {
        error:
          "Public registration is closed. Salon accounts are provisioned exclusively by FourierTech administration.",
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { salonName, ownerEmail, password, ownerPin, staffPin } = body;

    if (!salonName || !ownerEmail) {
      return NextResponse.json(
        { error: "salonName and ownerEmail are required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const cleanEmail = ownerEmail.toLowerCase().trim();
    const existingUser = await User.findOne({ ownerEmail: cleanEmail });
    if (existingUser) {
      return NextResponse.json(
        { error: "A salon account with this owner email already exists" },
        { status: 409 }
      );
    }

    // Generate clean slug base for tenant
    const baseSlug = salonName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Global sequential tenant code
    const tenantCode = await Counter.getNextTenantCode();

    // Hash passwords and PINs
    const bcrypt = await import("bcryptjs");
    const rawPassword = password || "password123";
    const rawOwnerPin = ownerPin || "8888";
    const rawStaffPin = staffPin || "5678";

    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const ownerPinHash = await bcrypt.hash(rawOwnerPin, 10);
    const staffPinHash = await bcrypt.hash(rawStaffPin, 10);

    // Create Tenant with slug collision retry loop (max 5 attempts)
    let tenant = null;
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const tenantSlug = `${baseSlug}-${randomSuffix}`;
      try {
        tenant = await Tenant.create({
          name: salonName.trim(),
          slug: tenantSlug,
          tenantCode,
          status: "active",
          ownerPinHash,
          staffPinHash,
        });
        break;
      } catch (err: any) {
        const isSlugCollision =
          err?.code === 11000 &&
          (err?.keyPattern?.slug || JSON.stringify(err).includes("slug"));
        if (isSlugCollision && attempt < maxAttempts) {
          continue;
        }
        throw err;
      }
    }

    if (!tenant) {
      throw new Error("Failed to provision tenant workspace after multiple attempts");
    }

    const now = new Date();

    // Create single User record for the salon
    await User.create({
      tenantId: tenant._id,
      ownerEmail: cleanEmail,
      passwordHash,
      ownerPinHash,
      staffPinHash,
      lastRoleLoginAt: now,
    });

    return NextResponse.json(
      {
        message: "Salon workspace provisioned successfully with email/password and Role PINs.",
        tenantId: tenant._id.toString(),
        tenantCode: tenant.tenantCode,
        salonName: tenant.name,
        ownerEmail: cleanEmail,
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
