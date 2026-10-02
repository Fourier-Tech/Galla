"use client";

import React from "react";
import { useDashboard } from "@/context/dashboard-context";
import { InventoryTab } from "@/components/dashboard/tabs/inventory-tab";

export default function InventoryPage() {
  const {
    products,
    suppliers,
    handleMoveStock,
    handleTransferSuccess,
    handleStockInSuccess,
    handleAddProduct,
    handleUpdateProduct,
    handleDeleteProduct,
  } = useDashboard();

  return (
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
  );
}
