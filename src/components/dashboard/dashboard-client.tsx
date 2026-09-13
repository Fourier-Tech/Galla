"use client";

import React, { useState } from "react";
import {
  DashboardOrder,
  DashboardProduct,
  DashboardCustomer,
  DashboardExpense,
  TabId,
  UserRole,
} from "@/types/dashboard";
import { Sidebar } from "@/components/dashboard/sidebar";
import { OverviewTab } from "@/components/dashboard/tabs/overview-tab";
import { OrdersTab } from "@/components/dashboard/tabs/orders-tab";
import { InventoryTab } from "@/components/dashboard/tabs/inventory-tab";
import { CustomersTab } from "@/components/dashboard/tabs/customers-tab";
import { ExpensesTab } from "@/components/dashboard/tabs/expenses-tab";
import { AnalyticsTab } from "@/components/dashboard/tabs/analytics-tab";
import { ProfileTab } from "@/components/dashboard/tabs/profile-tab";
import { NewOrderModal } from "@/components/dashboard/modals/new-order-modal";
import { NewExpenseModal } from "@/components/dashboard/modals/new-expense-modal";
import { transferStockAction } from "@/app/dashboard/actions";
import { DashboardSalonProfile } from "@/types/dashboard";

interface DashboardClientProps {
  salonName?: string;
  initialRole?: UserRole;
  initialOrders?: DashboardOrder[];
  initialProducts?: DashboardProduct[];
  initialCustomers?: DashboardCustomer[];
  initialExpenses?: DashboardExpense[];
  initialSalonProfile?: DashboardSalonProfile;
}

export function DashboardClient({
  salonName = "ShreeHari",
  initialRole = "owner",
  initialOrders = [],
  initialProducts = [],
  initialCustomers = [],
  initialExpenses = [],
  initialSalonProfile,
}: DashboardClientProps) {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [orders, setOrders] = useState<DashboardOrder[]>(initialOrders);
  const [products, setProducts] = useState<DashboardProduct[]>(initialProducts);
  const [customers] = useState<DashboardCustomer[]>(initialCustomers);
  const [expenses, setExpenses] = useState<DashboardExpense[]>(initialExpenses);
  const [salonProfile, setSalonProfile] = useState<DashboardSalonProfile>(
    initialSalonProfile || {
      id: "",
      name: salonName || "",
      slug: "",
      email: "",
      phone: "",
      address: "",
      profileImageUrl: "",
      status: "active",
      currency: "INR",
      ownerName: "",
    }
  );


  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);

  const todayExpenses = expenses.filter((e) => e.isToday !== false);
  const expensesTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const pendingAmount = orders.reduce(
    (sum, o) => sum + Math.max(0, o.amount - o.paid),
    0
  );

  const handleAddOrder = (order: DashboardOrder) => {
    setOrders((prev) => [order, ...prev]);
  };

  const handleAddExpense = (expense: DashboardExpense) => {
    setExpenses((prev) => [expense, ...prev]);
  };

  const handleMoveStock = async (id: number | string) => {
    try {
      const res = await transferStockAction({ productId: String(id) });
      if (res.success && res.updatedProduct) {
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? res.updatedProduct! : p))
        );
        if (res.newExpense) {
          setExpenses((prev) => [res.newExpense!, ...prev]);
        }
      }
    } catch (err) {
      console.error("Failed to move stock:", err);
    }
  };

  return (
    <div className="flex w-full min-h-screen bg-galla-paper text-galla-ink">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        role={role}
        onRoleChange={setRole}
        salonName={salonProfile.name || salonName}
        profileImageUrl={salonProfile.profileImageUrl}
      />

      {/* Main Tab Canvas (Table scrollable on overview, full scroll on other tabs) */}
      <main
        className={`flex-1 min-w-0 h-screen px-8 lg:px-12 py-5 lg:py-6 ${
          activeTab === "overview"
            ? "overflow-hidden flex flex-col"
            : "overflow-y-auto"
        }`}
      >
        <div
          className={`w-full max-w-7xl mx-auto ${
            activeTab === "overview" ? "h-full flex flex-col min-h-0" : "space-y-6"
          }`}
        >
          {activeTab === "overview" && (
            <OverviewTab
              orders={orders}
              products={products}
              expensesTotal={expensesTotal}
              onOpenNewOrder={() => setIsNewOrderOpen(true)}
              onOpenNewExpense={() => setIsNewExpenseOpen(true)}
            />
          )}

          {activeTab === "orders" && (
            <OrdersTab
              orders={orders}
              onOpenNewOrder={() => setIsNewOrderOpen(true)}
            />
          )}

          {activeTab === "inventory" && (
            <InventoryTab products={products} onMoveStock={handleMoveStock} />
          )}

          {activeTab === "customers" && <CustomersTab customers={customers} />}

          {activeTab === "expenses" && (
            <ExpensesTab
              expenses={expenses}
              onOpenNewExpense={() => setIsNewExpenseOpen(true)}
            />
          )}

          {activeTab === "analytics" && role === "owner" && (
            <AnalyticsTab pendingAmount={pendingAmount} />
          )}

          {activeTab === "profile" && (
            <ProfileTab
              salonProfile={salonProfile}
              onUpdateProfile={setSalonProfile}
            />
          )}
        </div>
      </main>

      {/* Action Modals */}
      <NewOrderModal
        isOpen={isNewOrderOpen}
        onClose={() => setIsNewOrderOpen(false)}
        onAddOrder={handleAddOrder}
      />

      <NewExpenseModal
        isOpen={isNewExpenseOpen}
        onClose={() => setIsNewExpenseOpen(false)}
        onAddExpense={handleAddExpense}
      />
    </div>
  );
}
