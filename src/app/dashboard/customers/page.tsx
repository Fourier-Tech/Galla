"use client";

import React from "react";
import { useDashboard } from "@/context/dashboard-context";
import { CustomersTab } from "@/components/dashboard/tabs/customers-tab";

export default function CustomersPage() {
  const {
    customers,
    orders,
    salonProfile,
    salonName,
    openSettleModal,
    openRefundModal,
    handleRescheduleOrder,
    handleUpdateCustomer,
  } = useDashboard();

  return (
    <CustomersTab
      customers={customers}
      orders={orders}
      salonName={salonProfile?.name || salonName}
      onOpenSettle={openSettleModal}
      onOpenRefund={openRefundModal}
      onOpenReschedule={handleRescheduleOrder}
      onUpdateCustomer={handleUpdateCustomer}
    />
  );
}
