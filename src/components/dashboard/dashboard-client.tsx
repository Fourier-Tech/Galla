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
import { RefundOrderModal } from "@/components/dashboard/modals/refund-order-modal";
import { transferStockAction, completeOrderAction } from "@/app/dashboard/actions";
import { calculatePendingAmount } from "@/lib/utils";
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
  const [refundOrder, setRefundOrder] = useState<DashboardOrder | null>(null);

  const todayExpenses = expenses.filter((e) => e.isToday !== false);
  const expensesTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const pendingAmount = calculatePendingAmount(orders);

  const handleAddOrder = (order: DashboardOrder) => {
    setOrders((prev) => [order, ...prev]);
  };

  const handleAddExpense = (expense: DashboardExpense) => {
    setExpenses((prev) => [expense, ...prev]);
  };

  const handleRefundSuccess = (updatedOrder: DashboardOrder) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o))
    );
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

  const handleCompleteOrder = async (orderId: string) => {
    try {
      const res = await completeOrderAction({ orderId });
      if (res.success && res.order) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: "completed",
                  paid: o.amount,
                }
              : o
          )
        );
      }
    } catch (err) {
      console.error("Failed to complete order:", err);
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
              onCompleteOrder={handleCompleteOrder}
              onOpenRefund={(order) => setRefundOrder(order)}
            />
          )}

          {activeTab === "orders" && (
            <OrdersTab
              orders={orders}
              onOpenNewOrder={() => setIsNewOrderOpen(true)}
              onCompleteOrder={handleCompleteOrder}
              onOpenRefund={(order) => setRefundOrder(order)}
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

      <RefundOrderModal
        key={refundOrder?.id || "refund-modal"}
        order={refundOrder}
        isOpen={Boolean(refundOrder)}
        onClose={() => setRefundOrder(null)}
        onRefundSuccess={handleRefundSuccess}
      />
    </div>
  );
}
