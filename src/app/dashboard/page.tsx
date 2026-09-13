import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { Tenant } from "@/lib/db/models/tenant.model";
import { connectToDatabase } from "@/lib/db/mongodb";
import { UserRole } from "@/types/dashboard";

export const metadata: Metadata = {
  title: "Counter Dashboard — Galla",
  description: "Live parlour counter operations, orders, split inventory & owner analytics",
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  let salonName = "Kiran Beauty Parlour";

  try {
    if (session.user.tenantId) {
      await connectToDatabase();
      const tenant = await Tenant.findById(session.user.tenantId).lean();
      if (tenant && tenant.name) {
        salonName = tenant.name;
      }
    }
  } catch {
    // If DB is offline or in development mock mode, gracefully retain salonName
  }

  const initialRole: UserRole =
    session.user.role === "staff" ? "staff" : "owner";

  return <DashboardClient salonName={salonName} initialRole={initialRole} />;
}
