import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRoleSession } from "@/lib/auth/role-session";
import { getDashboardInitialData } from "@/lib/dashboard/get-dashboard-data";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { TabId, UserRole } from "@/types/dashboard";

export const metadata: Metadata = {
  title: "Counter Dashboard — Galla",
  description: "Live parlour counter operations, orders, split inventory & owner analytics",
};

const VALID_TABS: Record<string, TabId> = {
  overview: "overview",
  orders: "orders",
  services: "services",
  inventory: "inventory",
  suppliers: "suppliers",
  customers: "customers",
  expenses: "expenses",
  analytics: "analytics",
  profile: "profile",
};

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?error=session_expired");
  }

  const { section } = await params;
  const rawSection = section?.[0] || "overview";
  const initialTab = VALID_TABS[rawSection] || "overview";

  const { filter } = await searchParams;
  const initialFilter = typeof filter === "string" ? filter : undefined;

  // Check ephemeral role session (window / tab state)
  const roleSessionResult = await getRoleSession();
  const isRoleLocked = !roleSessionResult || !roleSessionResult.role;
  const isEvicted = roleSessionResult?.evicted === true;
  const initialRole: UserRole = roleSessionResult?.role || "owner";

  // Role gating: staff cannot view owner-only tabs
  if (initialRole !== "owner" && (initialTab === "analytics" || initialTab === "profile")) {
    redirect("/dashboard/orders");
  }

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
    <DashboardClient
      tenantId={data.resolvedTenantId}
      salonName={data.salonName}
      initialRole={initialRole}
      initialActiveSessionId={roleSessionResult?.activeSessionId}
      isRoleLocked={isRoleLocked}
      isEvicted={isEvicted}
      initialTab={initialTab}
      initialUrlFilter={initialFilter}
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
    />
  );
}
