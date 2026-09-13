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
import { NewOrderModal } from "@/components/dashboard/modals/new-order-modal";
import { NewExpenseModal } from "@/components/dashboard/modals/new-expense-modal";

const INITIAL_ORDERS: DashboardOrder[] = [
  {
    id: "#1042",
    customer: "Priya Shah",
    type: "Service booking",
    amount: 1200,
    paid: 1200,
    status: "completed",
    time: "10:30 AM",
  },
  {
    id: "#1043",
    customer: "Rahul Mehta",
    type: "Product sale",
    amount: 540,
    paid: 200,
    status: "advance_paid",
    time: "11:15 AM",
  },
  {
    id: "#1044",
    customer: "Neha Patel",
    type: "Package sale",
    amount: 2500,
    paid: 2500,
    status: "paid_full",
    time: "12:00 PM",
  },
  {
    id: "#1045",
    customer: "Amit Joshi",
    type: "Product sale",
    amount: 350,
    paid: 0,
    status: "cancelled_refunded",
    time: "1:20 PM",
  },
];

const INITIAL_PRODUCTS: DashboardProduct[] = [
  { id: 1, name: "Shampoo 200ml", sell: 12, use: 3, price: 180 },
  { id: 2, name: "Hair colour kit", sell: 5, use: 0, price: 350 },
  { id: 3, name: "Face cream", sell: 0, use: 2, price: 220 },
  { id: 4, name: "Nail polish", sell: 20, use: 0, price: 90 },
];

const INITIAL_CUSTOMERS: DashboardCustomer[] = [
  { phone: "98250 12345", name: "Priya Shah", visits: 14, lastVisit: "Today" },
  { phone: "99040 67890", name: "Rahul Mehta", visits: 3, lastVisit: "Today" },
  { phone: "97230 45678", name: "Neha Patel", visits: 22, lastVisit: "Today" },
  { phone: "90210 98765", name: "Amit Joshi", visits: 1, lastVisit: "Today" },
];

const INITIAL_EXPENSES: DashboardExpense[] = [
  {
    desc: "Shampoo stock — Sharma Dealers",
    amount: 4200,
    category: "Inventory purchase",
    time: "9:00 AM",
  },
  {
    desc: "Tea & snacks",
    amount: 150,
    category: "Day-to-day",
    time: "11:00 AM",
  },
  {
    desc: "Staff salary — advance",
    amount: 2000,
    category: "Salary",
    time: "1:00 PM",
  },
];

interface DashboardClientProps {
  salonName?: string;
  initialRole?: UserRole;
}

export function DashboardClient({
  salonName = "Kiran Beauty Parlour",
  initialRole = "owner",
}: DashboardClientProps) {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [orders, setOrders] = useState<DashboardOrder[]>(INITIAL_ORDERS);
  const [products, setProducts] = useState<DashboardProduct[]>(INITIAL_PRODUCTS);
  const [customers] = useState<DashboardCustomer[]>(INITIAL_CUSTOMERS);
  const [expenses, setExpenses] = useState<DashboardExpense[]>(INITIAL_EXPENSES);

  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);

  const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const pendingAmount = orders.reduce((sum, o) => sum + (o.amount - o.paid), 0);

  const handleAddOrder = (order: DashboardOrder) => {
    setOrders((prev) => [order, ...prev]);
  };

  const handleAddExpense = (expense: DashboardExpense) => {
    setExpenses((prev) => [expense, ...prev]);
  };

  const handleMoveStock = (id: number | string) => {
    let movedProduct: DashboardProduct | undefined;

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === id && p.sell > 0) {
          movedProduct = p;
          return { ...p, sell: p.sell - 1, use: p.use + 1 };
        }
        return p;
      })
    );

    // Invariant: Moving sellStock -> useStock logs an immediate expense
    if (movedProduct) {
      setExpenses((prev) => [
        {
          desc: `Internal transfer — 1x ${movedProduct?.name}`,
          amount: Math.round((movedProduct?.price || 100) * 0.6), // Purchase cost estimate
          category: "Day-to-day",
          time: "Just now",
        },
        ...prev,
      ]);
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
        salonName={salonName}
      />

      {/* Main Tab Canvas */}
      <main className="flex-1 px-8 lg:px-12 py-8 overflow-y-auto">
        {activeTab === "overview" && (
          <OverviewTab
            orders={orders}
            products={products}
            expensesTotal={expensesTotal}
            role={role}
            onOpenNewOrder={() => setIsNewOrderOpen(true)}
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
