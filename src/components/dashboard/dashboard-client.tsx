"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { ServicesTab } from "@/components/dashboard/tabs/services-tab";
import { NewOrderModal } from "@/components/dashboard/modals/new-order-modal";
import { NewExpenseModal } from "@/components/dashboard/modals/new-expense-modal";
import { RefundOrderModal } from "@/components/dashboard/modals/refund-order-modal";
import { transferStockAction, completeOrderAction } from "@/app/dashboard/actions";
import { calculatePendingAmount, formatPhoneNumber } from "@/lib/utils";
import {
  DashboardSalonProfile,
  DashboardService,
  DashboardPackage,
} from "@/types/dashboard";
import { useTenantSubscription } from "@/lib/realtime/pusher-client";

interface DashboardClientProps {
  tenantId?: string;
  salonName?: string;
  initialRole?: UserRole;
  initialOrders?: DashboardOrder[];
  initialTotalOrdersCount?: number;
  initialProducts?: DashboardProduct[];
  initialCustomers?: DashboardCustomer[];
  initialExpenses?: DashboardExpense[];
  initialSalonProfile?: DashboardSalonProfile;
  initialServices?: DashboardService[];
  initialPackages?: DashboardPackage[];
  initialOrderStatusCounts?: Record<string, number>;
}

export function DashboardClient({
  tenantId,
  salonName = "ShreeHari",
  initialRole = "owner",
  initialOrders = [],
  initialTotalOrdersCount = 0,
  initialProducts = [],
  initialCustomers = [],
  initialExpenses = [],
  initialSalonProfile,
  initialServices = [],
  initialPackages = [],
  initialOrderStatusCounts,
}: DashboardClientProps) {
  const router = useRouter();
  const role: UserRole = initialRole;
  const activeTabDefault: TabId = "overview";
  const [activeTab, setActiveTab] = useState<TabId>(activeTabDefault);

  const [orders, setOrders] = useState<DashboardOrder[]>(initialOrders);
  const [products, setProducts] = useState<DashboardProduct[]>(initialProducts);
  const [customers, setCustomers] = useState<DashboardCustomer[]>(initialCustomers);
  const [expenses, setExpenses] = useState<DashboardExpense[]>(initialExpenses);
  const [services, setServices] = useState<DashboardService[]>(initialServices);
  const [packages, setPackages] = useState<DashboardPackage[]>(initialPackages);
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

  // Synchronize state during render when server sends fresh data without cascading effects
  const [prevInitialOrders, setPrevInitialOrders] = useState(initialOrders);
  if (initialOrders !== prevInitialOrders) {
    setPrevInitialOrders(initialOrders);
    setOrders(initialOrders);
  }

  const [prevInitialProducts, setPrevInitialProducts] = useState(initialProducts);
  if (initialProducts !== prevInitialProducts) {
    setPrevInitialProducts(initialProducts);
    setProducts(initialProducts);
  }

  const [prevInitialExpenses, setPrevInitialExpenses] = useState(initialExpenses);
  if (initialExpenses !== prevInitialExpenses) {
    setPrevInitialExpenses(initialExpenses);
    setExpenses(initialExpenses);
  }

  const [prevInitialCustomers, setPrevInitialCustomers] = useState(initialCustomers);
  if (initialCustomers !== prevInitialCustomers) {
    setPrevInitialCustomers(initialCustomers);
    setCustomers(initialCustomers);
  }

  const [prevInitialProfile, setPrevInitialProfile] = useState(initialSalonProfile);
  if (initialSalonProfile !== prevInitialProfile) {
    setPrevInitialProfile(initialSalonProfile);
    if (initialSalonProfile) {
      setSalonProfile(initialSalonProfile);
    }
  }

  // Real-time Pusher updates across open devices (Owner & Staff)
  useTenantSubscription({
    tenantId,
    event: "data_updated",
    onEvent: () => {
      router.refresh();
    },
  });

  // Revalidate session and data when user switches back to tab or device unlocks
  useEffect(() => {
    const handleFocus = () => {
      router.refresh();
    };
    window.addEventListener("focus", handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Passive 30-second background sync fallback
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, 30000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [router]);


  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
  const [refundOrder, setRefundOrder] = useState<DashboardOrder | null>(null);

  const todayExpenses = expenses.filter((e) => e.isToday !== false);
  const expensesTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const pendingAmount = calculatePendingAmount(orders);

  const handleAddOrder = (order: DashboardOrder, customerPhone?: string) => {
    setOrders((prev) => [order, ...prev]);
    if (order.customer && order.customer !== "Walk-in Guest") {
      const phone = customerPhone ? formatPhoneNumber(customerPhone) : "";
      setCustomers((prev) => {
        const idx = prev.findIndex((c) =>
          phone ? c.phone === phone : c.name.toLowerCase() === order.customer.toLowerCase()
        );
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            name: order.customer,
            phone: phone || updated[idx].phone,
            visits: (updated[idx].visits || 0) + 1,
            lastVisit: "Today",
          };
          return updated;
        } else {
          return [
            {
              name: order.customer,
              phone: phone,
              visits: 1,
              lastVisit: "Today",
            },
            ...prev,
          ];
        }
      });
    }
    router.refresh();
  };

  const handleAddExpense = (expense: DashboardExpense) => {
    setExpenses((prev) => [expense, ...prev]);
  };

  const handleRefundSuccess = (
    updatedOrder: DashboardOrder,
    newExpense?: DashboardExpense
  ) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o))
    );
    if (newExpense) {
      setExpenses((prev) => [newExpense, ...prev]);
    }
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

  const handleAddService = (newService: DashboardService) => {
    setServices((prev) => [newService, ...prev]);
  };

  const handleUpdateService = (updatedService: DashboardService) => {
    setServices((prev) =>
      prev.map((s) => (s.id === updatedService.id ? updatedService : s))
    );
  };

  const handleDeleteService = (serviceId: string) => {
    setServices((prev) => prev.filter((s) => s.id !== serviceId));
  };

  const handleAddPackage = (newPkg: DashboardPackage) => {
    setPackages((prev) => [newPkg, ...prev]);
  };

  const handleUpdatePackage = (updatedPkg: DashboardPackage) => {
    setPackages((prev) =>
      prev.map((p) => (p.id === updatedPkg.id ? updatedPkg : p))
    );
  };

  const handleDeletePackage = (packageId: string) => {
    setPackages((prev) => prev.filter((p) => p.id !== packageId));
  };

  return (
    <div className="flex w-full min-h-screen bg-galla-paper text-galla-ink">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        role={role}
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
              onNavigateToInventory={() => setActiveTab("inventory")}
            />
          )}

          {activeTab === "orders" && (
            <OrdersTab
              orders={orders}
              initialTotalCount={initialTotalOrdersCount}
              initialStatusCounts={initialOrderStatusCounts}
              onOpenNewOrder={() => setIsNewOrderOpen(true)}
              onCompleteOrder={handleCompleteOrder}
              onOpenRefund={(order) => setRefundOrder(order)}
            />
          )}

          {activeTab === "services" && role === "owner" && (
            <ServicesTab
              services={services}
              packages={packages}
              products={products}
              onAddService={handleAddService}
              onUpdateService={handleUpdateService}
              onDeleteService={handleDeleteService}
              onAddPackage={handleAddPackage}
              onUpdatePackage={handleUpdatePackage}
              onDeletePackage={handleDeletePackage}
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

          {activeTab === "profile" && role === "owner" && (
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
        customers={customers}
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
