import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Tenant } from "@/lib/db/models/tenant.model";
import { User } from "@/lib/db/models/user.model";
import { Counter } from "@/lib/db/models/counter.model";
import {
  generateUnique8DigitCode,
  calculateRotationDate,
  calculateGraceExpiry,
} from "@/lib/auth/code-service";
import { sendAccessCodesEmail } from "@/lib/email/email-service";

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
    const { salonName, ownerEmail } = body;

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
    const rotationDate = calculateRotationDate(now);
    const graceExpiresAt = calculateGraceExpiry(rotationDate);

    // Generate unique 8-digit codes for Owner and Staff
    const exclude = new Set<string>();
    const ownerGen = await generateUnique8DigitCode(exclude);
    const staffGen = await generateUnique8DigitCode(exclude);

    // Create single User record for the salon
    await User.create({
      tenantId: tenant._id,
      ownerEmail: cleanEmail,
      ownerCodeHash: ownerGen.hash,
      staffCodeHash: staffGen.hash,
      codeExpiresAt: rotationDate,
      graceExpiresAt: null,
    });

    // Send initial access codes email
    await sendAccessCodesEmail({
      to: cleanEmail,
      ownerCode: ownerGen.code,
      staffCode: staffGen.code,
      rotationDate: now,
      graceExpiresAt,
    });

    return NextResponse.json(
      {
        message: "Salon workspace provisioned successfully. Access codes sent to owner email.",
        tenantId: tenant._id.toString(),
        tenantCode: tenant.tenantCode,
        salonName: tenant.name,
        ownerEmail: cleanEmail,
        codeExpiresAt: rotationDate.toISOString(),
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
