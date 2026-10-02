import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRoleSession } from "@/lib/auth/role-session";
import { getDashboardInitialData } from "@/lib/dashboard/get-dashboard-data";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { UserRole } from "@/types/dashboard";

export const metadata: Metadata = {
  title: "Counter Dashboard — Galla",
  description: "Live parlour counter operations, orders, split inventory & owner analytics",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?error=session_expired");
  }

  // Check ephemeral role session (window / tab state)
  const roleSessionResult = await getRoleSession();
  const isRoleLocked = !roleSessionResult || !roleSessionResult.role;
  const isEvicted = roleSessionResult?.evicted === true;
  const initialRole: UserRole = roleSessionResult?.role || "owner";

  const data = await getDashboardInitialData(
    session.user.id || "",
    session.user.tenantId,
    session.user.email || undefined,
    session.user.name || undefined
  );

  if (!data) {
    redirect("/login?error=AccessDenied");
  }

  return (
    <DashboardShell
      tenantId={data.resolvedTenantId}
      salonName={data.salonName}
      initialRole={initialRole}
      initialActiveSessionId={roleSessionResult?.activeSessionId}
      isRoleLocked={isRoleLocked}
      isEvicted={isEvicted}
      initialOrders={data.initialOrders}
      initialTotalOrdersCount={data.initialTotalOrdersCount}
      initialProducts={data.initialProducts}
      initialSuppliers={data.initialSuppliers}
      initialPurchaseOrders={data.initialPurchaseOrders}
      initialCustomers={data.initialCustomers}
      initialExpenses={data.initialExpenses}
      initialTotalExpensesCount={data.initialTotalExpensesCount}
      initialExpenseCategoryCounts={data.initialExpenseCategoryCounts}
      initialExpensesTotalAmount={data.initialExpensesTotalAmount}
      initialSalonProfile={data.initialSalonProfile}
      initialServices={data.initialServices}
      initialPackages={data.initialPackages}
      initialCustomerReplacements={data.initialCustomerReplacements}
      initialOrderStatusCounts={data.initialOrderStatusCounts}
      initialTodayIncome={data.initialTodayIncome}
      initialTodayExpense={data.initialTodayExpense}
      initialTodayAdvance={data.initialTodayAdvance}
      initialTodayNetProfit={data.initialTodayNetProfit}
      initialCustomerDues={data.initialCustomerDues}
    >
      {children}
    </DashboardShell>
  );
}
