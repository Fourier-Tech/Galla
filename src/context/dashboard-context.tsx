"use client";

import React, { createContext, useContext } from "react";
import {
  DashboardOrder,
  DashboardProduct,
  DashboardCustomer,
  DashboardExpense,
  DashboardSupplier,
  DashboardPurchaseOrder,
  DashboardSalonProfile,
  DashboardService,
  DashboardPackage,
  DashboardCustomerReplacement,
  UserRole,
} from "@/types/dashboard";

export interface DashboardContextType {
  // Tenancy & Role Session
  tenantId?: string;
  salonName: string;
  role: UserRole;
  isRoleLocked: boolean;
  isEvicted: boolean;
  currentSessionId?: string;
  handleLockCounter: () => Promise<void>;
  handleRoleVerified: (newRole: UserRole, newActiveSessionId?: string) => void;
  isChangePinOpen: boolean;
  setIsChangePinOpen: (open: boolean) => void;

  // Data Collections
  orders: DashboardOrder[];
  setOrders: React.Dispatch<React.SetStateAction<DashboardOrder[]>>;
  totalOrdersCount: number;
  setTotalOrdersCount: React.Dispatch<React.SetStateAction<number>>;
  orderStatusCounts?: Record<string, number>;
  setOrderStatusCounts: React.Dispatch<React.SetStateAction<Record<string, number> | undefined>>;

  products: DashboardProduct[];
  setProducts: React.Dispatch<React.SetStateAction<DashboardProduct[]>>;

  suppliers: DashboardSupplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<DashboardSupplier[]>>;

  purchaseOrders: DashboardPurchaseOrder[];
  setPurchaseOrders: React.Dispatch<React.SetStateAction<DashboardPurchaseOrder[]>>;

  customers: DashboardCustomer[];
  setCustomers: React.Dispatch<React.SetStateAction<DashboardCustomer[]>>;

  expenses: DashboardExpense[];
  setExpenses: React.Dispatch<React.SetStateAction<DashboardExpense[]>>;
  totalExpensesCount: number;
  setTotalExpensesCount: React.Dispatch<React.SetStateAction<number>>;
  expenseCategoryCounts?: Record<string, number>;
  setExpenseCategoryCounts: React.Dispatch<React.SetStateAction<Record<string, number> | undefined>>;
  expensesTotalAmount: number;
  setExpensesTotalAmount: React.Dispatch<React.SetStateAction<number>>;

  services: DashboardService[];
  setServices: React.Dispatch<React.SetStateAction<DashboardService[]>>;

  packages: DashboardPackage[];
  setPackages: React.Dispatch<React.SetStateAction<DashboardPackage[]>>;

  customerReplacements: DashboardCustomerReplacement[];
  setCustomerReplacements: React.Dispatch<React.SetStateAction<DashboardCustomerReplacement[]>>;

  salonProfile: DashboardSalonProfile;
  setSalonProfile: React.Dispatch<React.SetStateAction<DashboardSalonProfile>>;

  // Persisted O(1) Rollup Metrics
  todayIncome: number;
  todayExpense: number;
  todayAdvance: number;
  customerDues: number;
  expensesTotal: number;
  pendingAmount: number;

  // Modals & Action Triggers
  openNewOrderModal: () => void;
  openNewExpenseModal: () => void;
  openRefundModal: (order: DashboardOrder) => void;
  openSettleModal: (order: DashboardOrder) => void;

  // Mutation Handlers
  handleAddOrder: (
    order: DashboardOrder,
    customerPhone?: string,
    clearedDueOrderIds?: string[],
    updatedProducts?: DashboardProduct[]
  ) => void;
  handleCompleteOrder: (orderId: string) => Promise<void>;
  handleRefundSuccess: (
    updatedOrder: DashboardOrder,
    newExpense?: DashboardExpense,
    updatedProducts?: DashboardProduct[]
  ) => void;
  handleRescheduleOrder: (updatedOrder: DashboardOrder) => void;
  handleSettleSuccess: (updatedOrder: DashboardOrder) => void;
  handleAddExpense: (expense: DashboardExpense) => void;
  handleMoveStock: (id: number | string) => Promise<void>;
  handleTransferSuccess: (
    updatedProduct: DashboardProduct,
    newExpense?: DashboardExpense,
    updatedSupplier?: DashboardSupplier
  ) => void;
  handleStockInSuccess: (
    updatedBatch: DashboardProduct[],
    newPO?: DashboardPurchaseOrder,
    newExpense?: DashboardExpense,
    updatedSupplier?: DashboardSupplier
  ) => void;
  handlePurchaseOrderPaymentRecorded: (
    updatedPO: DashboardPurchaseOrder,
    updatedSupplier?: DashboardSupplier,
    newExpense?: DashboardExpense,
    updatedProducts?: DashboardProduct[]
  ) => void;
  handlePurchaseOrderDelivered: (
    updatedPO: DashboardPurchaseOrder,
    updatedProducts?: DashboardProduct[]
  ) => void;
  handleReschedulePurchaseOrder: (updatedPO: DashboardPurchaseOrder) => void;
  handleAddProduct: (newProduct: DashboardProduct) => void;
  handleUpdateProduct: (
    updatedProduct: DashboardProduct,
    updatedSupplier?: DashboardSupplier,
    refundAmount?: number
  ) => void;
  handleDeleteProduct: (productId: string | number) => void;
  handleAddSupplier: (newSupplier: DashboardSupplier) => void;
  handleUpdateSupplier: (updatedSupplier: DashboardSupplier) => void;
  handleUpdateCustomer: (updatedCustomer: DashboardCustomer) => void;
  handleAddService: (newService: DashboardService) => void;
  handleUpdateService: (updatedService: DashboardService) => void;
  handleDeleteService: (serviceId: string) => void;
  handleAddPackage: (newPkg: DashboardPackage) => void;
  handleUpdatePackage: (updatedPkg: DashboardPackage) => void;
  handleDeletePackage: (packageId: string) => void;
}

export const DashboardContext = createContext<DashboardContextType | null>(null);

export function useDashboard(): DashboardContextType {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider (DashboardShell)");
  }
  return context;
}
