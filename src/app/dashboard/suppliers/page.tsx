"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useDashboard } from "@/context/dashboard-context";
import { SuppliersTab } from "@/components/dashboard/tabs/suppliers-tab";
import { BillStatusKey } from "@/lib/utils";

function SuppliersPageContent() {
  const searchParams = useSearchParams();
  const rawFilter = searchParams.get("filter");
  const filter = (rawFilter as "all" | BillStatusKey | "returns") || "all";

  const {
    suppliers,
    products,
    purchaseOrders,
    salonProfile,
    salonName,
    handleAddSupplier,
    handleUpdateSupplier,
    handleStockInSuccess,
    handlePurchaseOrderPaymentRecorded,
    handlePurchaseOrderDelivered,
    handleReschedulePurchaseOrder,
  } = useDashboard();

  return (
    <SuppliersTab
      key={filter}
      suppliers={suppliers}
      products={products}
      purchaseOrders={purchaseOrders}
      salonName={salonProfile?.name || salonName}
      initialFilter={filter}
      onAddSupplier={handleAddSupplier}
      onUpdateSupplier={handleUpdateSupplier}
      onStockInSuccess={handleStockInSuccess}
      onPaymentRecorded={handlePurchaseOrderPaymentRecorded}
      onStockDelivered={handlePurchaseOrderDelivered}
      onReschedulePurchaseOrder={handleReschedulePurchaseOrder}
    />
  );
}

export default function SuppliersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-galla-ink-soft text-sm">Loading suppliers...</div>}>
      <SuppliersPageContent />
    </Suspense>
  );
}
