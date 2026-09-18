"use client";

import React, { useState } from "react";
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
import { SuppliersTab } from "@/components/dashboard/tabs/suppliers-tab";
import { CustomersTab } from "@/components/dashboard/tabs/customers-tab";
import { ExpensesTab } from "@/components/dashboard/tabs/expenses-tab";
import { AnalyticsTab } from "@/components/dashboard/tabs/analytics-tab";
import { ProfileTab } from "@/components/dashboard/tabs/profile-tab";
import { ServicesTab } from "@/components/dashboard/tabs/services-tab";
import { NewOrderModal } from "@/components/dashboard/modals/new-order-modal";
import { NewExpenseModal } from "@/components/dashboard/modals/new-expense-modal";
import { RefundOrderModal } from "@/components/dashboard/modals/refund-order-modal";
import { SettleOrderModal } from "@/components/dashboard/modals/settle-order-modal";
import { transferStockAction, completeOrderAction } from "@/app/dashboard/actions";
import { calculatePendingAmount, formatPhoneNumber, BillStatusKey } from "@/lib/utils";
import {
  DashboardSalonProfile,
  DashboardService,
  DashboardPackage,
  DashboardSupplier,
  DashboardPurchaseOrder,
  OrderStatus,
} from "@/types/dashboard";
import { useTenantSubscription } from "@/lib/realtime/pusher-client";

interface DashboardClientProps {
  tenantId?: string;
  salonName?: string;
  initialRole?: UserRole;
  initialOrders?: DashboardOrder[];
  initialTotalOrdersCount?: number;
  initialProducts?: DashboardProduct[];
  initialSuppliers?: DashboardSupplier[];
  initialPurchaseOrders?: DashboardPurchaseOrder[];
  initialCustomers?: DashboardCustomer[];
  initialExpenses?: DashboardExpense[];
  initialSalonProfile?: DashboardSalonProfile;
  initialServices?: DashboardService[];
  initialPackages?: DashboardPackage[];
  initialOrderStatusCounts?: Record<string, number>;
  initialTotalExpensesCount?: number;
  initialExpenseCategoryCounts?: Record<string, number>;
  initialExpensesTotalAmount?: number;
}

export function DashboardClient({
  tenantId,
  salonName = "Salon",
  initialRole = "owner",
  initialOrders = [],
  initialTotalOrdersCount = 0,
  initialProducts = [],
  initialSuppliers = [],
  initialPurchaseOrders = [],
  initialCustomers = [],
  initialExpenses = [],
  initialSalonProfile,
  initialServices = [],
  initialPackages = [],
  initialOrderStatusCounts,
  initialTotalExpensesCount,
  initialExpenseCategoryCounts,
  initialExpensesTotalAmount,
}: DashboardClientProps) {
  const router = useRouter();
  const role: UserRole = initialRole;
  const activeTabDefault: TabId = "overview";
  const [activeTab, setActiveTab] = useState<TabId>(activeTabDefault);
  const [ordersFilter, setOrdersFilter] = useState<OrderStatus | "all">("all");
  const [ordersNavKey, setOrdersNavKey] = useState(0);
  const [billsFilter, setBillsFilter] = useState<BillStatusKey | "all">("all");
  const [billsNavKey, setBillsNavKey] = useState(0);

  const handleNavigateToAdvanceOrders = () => {
    setOrdersFilter("advance_paid");
    setOrdersNavKey((k) => k + 1);
    setActiveTab("orders");
  };

  const handleNavigateToDueOrders = () => {
    setOrdersFilter("created");
    setOrdersNavKey((k) => k + 1);
    setActiveTab("orders");
  };

  const handleNavigateToStockDeliveries = (filter: "pending" | "advance" = "pending") => {
    setBillsFilter(filter);
    setBillsNavKey((k) => k + 1);
    setActiveTab("suppliers");
  };

  const handleSelectTab = (tab: TabId) => {
    if (tab === "orders") {
      setOrdersFilter("all");
      setOrdersNavKey((k) => k + 1);
    }
    if (tab === "suppliers") {
      setBillsFilter("all");
      setBillsNavKey((k) => k + 1);
    }
    setActiveTab(tab);
  };

  const [orders, setOrders] = useState<DashboardOrder[]>(initialOrders);
  const [products, setProducts] = useState<DashboardProduct[]>(initialProducts);
  const [suppliers, setSuppliers] = useState<DashboardSupplier[]>(initialSuppliers);
  const [purchaseOrders, setPurchaseOrders] = useState<DashboardPurchaseOrder[]>(initialPurchaseOrders);
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

  const [prevInitialSuppliers, setPrevInitialSuppliers] = useState(initialSuppliers);
  if (initialSuppliers !== prevInitialSuppliers) {
    setPrevInitialSuppliers(initialSuppliers);
    setSuppliers(initialSuppliers);
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

  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
  const [refundOrder, setRefundOrder] = useState<DashboardOrder | null>(null);
  const [settleOrder, setSettleOrder] = useState<DashboardOrder | null>(null);

  const todayExpenses = expenses.filter((e) => e.isToday !== false);
  const expensesTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const pendingAmount = calculatePendingAmount(orders);

  const handleAddOrder = (order: DashboardOrder, customerPhone?: string, clearedDueOrderIds?: string[]) => {
    const enrichedOrder = customerPhone && !order.customerPhone ? { ...order, customerPhone } : order;
    setOrders((prev) => {
      const updated = prev.map((o) => {
        if (clearedDueOrderIds && clearedDueOrderIds.includes(o.id)) {
          return {
            ...o,
            paid: o.amount,
            status: "completed" as const,
            latestActivityAt: new Date().toISOString(),
          };
        }
        return o;
      });
      return [enrichedOrder, ...updated];
    });
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

  const handleRescheduleOrder = (updatedOrder: DashboardOrder) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );
  };

  const handleSettleSuccess = (updatedOrder: DashboardOrder) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o))
    );
  };

  const handleMoveStock = async (id: number | string) => {
    try {
      const res = await transferStockAction({ productId: String(id), quantity: 1 });
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

  const handleTransferSuccess = (
    updatedProduct: DashboardProduct,
    newExpense?: DashboardExpense
  ) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    if (newExpense) {
      setExpenses((prev) => [newExpense, ...prev]);
    }
  };

  const handleStockInSuccess = (updatedBatch: DashboardProduct[]) => {
    setProducts((prev) => {
      const map = new Map(updatedBatch.map((p) => [p.id, p]));
      return prev.map((p) => (map.has(p.id) ? map.get(p.id)! : p));
    });
  };

  const handleAddProduct = (newProduct: DashboardProduct) => {
    setProducts((prev) => [newProduct, ...prev]);
  };

  const handleUpdateProduct = (updatedProduct: DashboardProduct) => {
    setProducts((prev) =>
      prev.map((p) => (String(p.id) === String(updatedProduct.id) ? updatedProduct : p))
    );
  };

  const handleDeleteProduct = (productId: string | number) => {
    setProducts((prev) => prev.filter((p) => String(p.id) !== String(productId)));
  };

  const handleCompleteOrder = async (orderId: string) => {
    try {
      const res = await completeOrderAction({ orderId });
      if (res.success && res.order) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, ...res.order } : o))
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

  const handleAddSupplier = (newSupplier: DashboardSupplier) => {
    setSuppliers((prev) => [newSupplier, ...prev]);
  };

  const handleUpdateSupplier = (updatedSupplier: DashboardSupplier) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.id === updatedSupplier.id ? updatedSupplier : s))
    );
  };

  const handleUpdateCustomer = (updatedCustomer: DashboardCustomer) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === updatedCustomer.id || c.phone === updatedCustomer.phone
          ? { ...c, ...updatedCustomer }
          : c
      )
    );
  };

  return (
    <div className="flex w-full min-h-screen bg-galla-paper text-galla-ink">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        role={role}
        salonName={salonProfile.name || salonName}
        profileImageUrl={salonProfile.profileImageUrl}
      />

      {/* Main Tab Canvas (Table scrollable on overview, full scroll on other tabs) */}
      <main
        className={`flex-1 min-w-0 h-screen px-8 lg:px-12 py-5 lg:py-6 ${activeTab === "overview"
            ? "overflow-hidden flex flex-col"
            : "overflow-y-auto"
          }`}
      >
        <div
          className={`w-full max-w-7xl mx-auto ${activeTab === "overview" ? "h-full flex flex-col min-h-0" : "space-y-6"
            }`}
        >
          {activeTab === "overview" && (
            <OverviewTab
              orders={orders}
              products={products}
              suppliers={suppliers}
              purchaseOrders={purchaseOrders}
              expensesTotal={expensesTotal}
              salonName={salonProfile.name || salonName}
              onOpenNewOrder={() => setIsNewOrderOpen(true)}
              onOpenNewExpense={() => setIsNewExpenseOpen(true)}
              onNavigateToAdvanceOrders={handleNavigateToAdvanceOrders}
              onNavigateToDueOrders={handleNavigateToDueOrders}
              onNavigateToStockDeliveries={handleNavigateToStockDeliveries}
              onCompleteOrder={handleCompleteOrder}
              onOpenRefund={(order) => setRefundOrder(order)}
              onOpenSettle={(order) => setSettleOrder(order)}
              onRescheduleOrder={handleRescheduleOrder}
              onNavigateToInventory={() => setActiveTab("inventory")}
            />
          )}

          {activeTab === "orders" && (
            <OrdersTab
              key={ordersNavKey}
              orders={orders}
              initialTotalCount={initialTotalOrdersCount}
              initialStatusCounts={initialOrderStatusCounts}
              initialFilter={ordersFilter}
              salonName={salonProfile.name}
              onOpenNewOrder={() => setIsNewOrderOpen(true)}
              onCompleteOrder={handleCompleteOrder}
              onOpenRefund={(order) => setRefundOrder(order)}
              onRescheduleOrder={handleRescheduleOrder}
              onOpenSettle={(order) => setSettleOrder(order)}
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
            <InventoryTab
              products={products}
              suppliers={suppliers}
              onMoveStock={handleMoveStock}
              onTransferSuccess={handleTransferSuccess}
              onStockInSuccess={handleStockInSuccess}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
            />
          )}

          {activeTab === "suppliers" && (
            <SuppliersTab
              key={`suppliers-${billsNavKey}`}
              suppliers={suppliers}
              products={products}
              salonName={salonProfile?.name || salonName}
              initialFilter={billsFilter}
              onAddSupplier={handleAddSupplier}
              onUpdateSupplier={handleUpdateSupplier}
              onStockInSuccess={handleStockInSuccess}
            />
          )}

          {activeTab === "customers" && (
            <CustomersTab
              customers={customers}
              orders={orders}
              salonName={salonProfile?.name || salonName}
              onOpenSettle={(order) => setSettleOrder(order)}
              onOpenRefund={(order) => setRefundOrder(order)}
              onOpenReschedule={handleRescheduleOrder}
              onUpdateCustomer={handleUpdateCustomer}
            />
          )}

          {activeTab === "expenses" && (
            <ExpensesTab
              expenses={expenses}
              initialTotalCount={initialTotalExpensesCount}
              initialCategoryCounts={initialExpenseCategoryCounts}
              initialTotalAmount={initialExpensesTotalAmount}
              onOpenNewExpense={() => setIsNewExpenseOpen(true)}
            />
          )}

          {activeTab === "analytics" && role === "owner" && (
            <AnalyticsTab
              orders={orders}
              expenses={expenses}
              pendingAmount={pendingAmount}
            />
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
        services={services}
        packages={packages}
        initialProducts={products}
        orders={orders}
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

      <SettleOrderModal
        key={settleOrder?.id || "settle-modal"}
        order={settleOrder}
        isOpen={Boolean(settleOrder)}
        onClose={() => setSettleOrder(null)}
        onSettleSuccess={handleSettleSuccess}
      />
    </div>
  );
}
