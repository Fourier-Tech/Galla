"use client";

import React from "react";
import { useDashboard } from "@/context/dashboard-context";
import { ExpensesTab } from "@/components/dashboard/tabs/expenses-tab";

export default function ExpensesPage() {
  const {
    expenses,
    totalExpensesCount,
    expenseCategoryCounts,
    expensesTotalAmount,
    openNewExpenseModal,
    orders,
    purchaseOrders,
    salonName,
  } = useDashboard();

  return (
    <ExpensesTab
      expenses={expenses}
      initialTotalCount={totalExpensesCount}
      initialCategoryCounts={expenseCategoryCounts}
      initialTotalAmount={expensesTotalAmount}
      onOpenNewExpense={openNewExpenseModal}
      orders={orders}
      purchaseOrders={purchaseOrders}
      salonName={salonName}
    />
  );
}
