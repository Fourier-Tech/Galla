"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useDashboard } from "@/context/dashboard-context";
import { OverviewTab } from "@/components/dashboard/tabs/overview-tab";

export default function OverviewPage() {
  const router = useRouter();
  const {
    orders,
    products,
    suppliers,
    purchaseOrders,
    expensesTotal,
    todayIncome,
    todayAdvance,
    customerDues,
    salonName,
    salonProfile,
    customerReplacements,
    openNewOrderModal,
    openNewExpenseModal,
    handleCompleteOrder,
    openRefundModal,
    openSettleModal,
    handleRescheduleOrder,
    setCustomerReplacements,
  } = useDashboard();

  return (
    <OverviewTab
      orders={orders}
      products={products}
      suppliers={suppliers}
      purchaseOrders={purchaseOrders}
      expensesTotal={expensesTotal}
      todayIncome={todayIncome}
      advancePayment={todayAdvance}
      pendingAmount={customerDues}
      salonName={salonProfile.name || salonName}
      customerReplacements={customerReplacements}
      onOpenNewOrder={openNewOrderModal}
      onOpenNewExpense={openNewExpenseModal}
      onNavigateToAdvanceOrders={() => router.push("/dashboard/orders?filter=advance_paid")}
      onNavigateToDueOrders={() => router.push("/dashboard/orders?filter=created")}
      onNavigateToStockDeliveries={(filter = "pending") =>
        router.push(`/dashboard/suppliers?filter=${filter}`)
      }
      onNavigateToInventory={() => router.push("/dashboard/inventory")}
      onNavigateToReplacementOrders={() => router.push("/dashboard/orders?filter=replacement")}
      onCompleteOrder={handleCompleteOrder}
      onOpenRefund={openRefundModal}
      onOpenSettle={openSettleModal}
      onRescheduleOrder={handleRescheduleOrder}
      onUpdateReplacement={(updated) => {
        setCustomerReplacements((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
      }}
      onRemoveReplacement={(id) => {
        setCustomerReplacements((prev) => prev.filter((c) => c.id !== id));
      }}
    />
  );
}
