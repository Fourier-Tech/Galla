import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Tenant } from "@/lib/db/models/tenant.model";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  let tenantName = "Salon Workspace";

  if (session.user.tenantId) {
    try {
      await connectToDatabase();
      const tenant = await Tenant.findById(session.user.tenantId).select("name");
      if (tenant?.name) {
        tenantName = tenant.name;
      }
    } catch (e) {
      console.warn("Could not fetch tenant name:", e);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DashboardHeader user={session.user} tenantName={tenantName} />
      <div className="flex flex-1">
        <DashboardSidebar />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
