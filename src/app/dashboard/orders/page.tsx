"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useDashboard } from "@/context/dashboard-context";
import { OrdersTab } from "@/components/dashboard/tabs/orders-tab";
import { OrderStatus } from "@/types/dashboard";

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const rawFilter = searchParams.get("filter");
  const filter = (rawFilter as OrderStatus | "all" | "replacement") || "all";

  const {
    orders,
    totalOrdersCount,
    orderStatusCounts,
    salonProfile,
    openNewOrderModal,
    handleCompleteOrder,
    openRefundModal,
    handleRescheduleOrder,
    openSettleModal,
  } = useDashboard();

  return (
    <OrdersTab
      key={filter}
      orders={orders}
      initialTotalCount={totalOrdersCount}
      initialStatusCounts={orderStatusCounts}
      initialFilter={filter}
      salonName={salonProfile.name}
      onOpenNewOrder={openNewOrderModal}
      onCompleteOrder={handleCompleteOrder}
      onOpenRefund={openRefundModal}
      onRescheduleOrder={handleRescheduleOrder}
      onOpenSettle={openSettleModal}
    />
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-galla-ink-soft text-sm">Loading orders...</div>}>
      <OrdersPageContent />
    </Suspense>
  );
}
