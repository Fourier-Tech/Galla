"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DashboardOrder,
  DashboardProduct,
  DashboardCustomer,
  DashboardExpense,
  TabId,
  UserRole,
  DashboardSalonProfile,
  DashboardService,
  DashboardPackage,
  DashboardSupplier,
  DashboardPurchaseOrder,
  DashboardCustomerReplacement,
  OrderStatus,
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
import { RoleKeypadModal } from "@/components/auth/role-keypad-modal";
import { ChangePinModal } from "@/components/dashboard/modals/change-pin-modal";
import { lockRoleSessionAction } from "@/app/actions/auth-actions";
import { transferStockAction, completeOrderAction } from "@/app/dashboard/actions";
import { formatPhoneNumber, getPhoneDigits, BillStatusKey, formatDisplayNumber } from "@/lib/utils";
import { useTenantSubscription } from "@/lib/realtime/pusher-client";

interface DashboardClientProps {
  tenantId?: string;
  salonName?: string;
  initialRole?: UserRole;
  initialActiveSessionId?: string;
  isRoleLocked?: boolean;
  isEvicted?: boolean;
  initialTab?: TabId;
  initialUrlFilter?: string;
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
  initialCustomerReplacements?: DashboardCustomerReplacement[];
  initialOrderStatusCounts?: Record<string, number>;
  initialTotalExpensesCount?: number;
  initialExpenseCategoryCounts?: Record<string, number>;
  initialExpensesTotalAmount?: number;
  initialTodayIncome?: number;
  initialTodayExpense?: number;
  initialTodayAdvance?: number;
  initialTodayNetProfit?: number;
  initialCustomerDues?: number;
}

function resolveTabFromPathname(pathname: string): TabId {
  if (pathname.includes("/dashboard/orders")) return "orders";
  if (pathname.includes("/dashboard/services")) return "services";
  if (pathname.includes("/dashboard/inventory")) return "inventory";
  if (pathname.includes("/dashboard/suppliers")) return "suppliers";
  if (pathname.includes("/dashboard/customers")) return "customers";
  if (pathname.includes("/dashboard/expenses")) return "expenses";
  if (pathname.includes("/dashboard/analytics")) return "analytics";
  if (pathname.includes("/dashboard/profile")) return "profile";
  return "overview";
}

export function DashboardClient({
  tenantId,
  salonName = "Salon",
  initialRole = "owner",
  initialActiveSessionId,
  isRoleLocked: initialIsRoleLocked = false,
  isEvicted: initialIsEvicted = false,
  initialTab = "overview",
  initialUrlFilter,
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
  initialCustomerReplacements = [],
  initialOrderStatusCounts,
  initialTotalExpensesCount,
  initialExpenseCategoryCounts,
  initialExpensesTotalAmount,
  initialTodayIncome = 0,
  initialTodayExpense = 0,
  initialTodayAdvance = 0,
  initialCustomerDues = 0,
}: DashboardClientProps) {
  const router = useRouter();

  const [role, setRole] = useState<UserRole>(initialRole);
  const [isRoleLocked, setIsRoleLocked] = useState<boolean>(initialIsRoleLocked);
  const [isEvicted, setIsEvicted] = useState<boolean>(initialIsEvicted);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(initialActiveSessionId);
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);

  // Sync refs so realtime websocket subscriptions always see current values without re-subscribing
  const roleRef = useRef(role);
  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const currentSessionIdRef = useRef(currentSessionId);
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const isRoleLockedRef = useRef(isRoleLocked);
  useEffect(() => {
    isRoleLockedRef.current = isRoleLocked;
  }, [isRoleLocked]);

  // Synchronize window-level role session from sessionStorage across in-place refreshes and new tab openings
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (initialIsEvicted) {
        sessionStorage.removeItem("galla_role_session");
        setIsRoleLocked(true);
        isRoleLockedRef.current = true;
        setIsEvicted(true);
        return;
      }

      // If server determined role session is locked, any client-side sessionStorage is stale
      if (initialIsRoleLocked) {
        sessionStorage.removeItem("galla_role_session");
        setIsRoleLocked(true);
        isRoleLockedRef.current = true;
        return;
      }

      const rawStored = sessionStorage.getItem("galla_role_session");
      if (rawStored) {
        const parsed = JSON.parse(rawStored);
        if (parsed?.role && parsed?.activeSessionId) {
          // Keep window unlocked across in-place page refreshes
          setRole(parsed.role);
          roleRef.current = parsed.role;
          setCurrentSessionId(parsed.activeSessionId);
          currentSessionIdRef.current = parsed.activeSessionId;
          setIsRoleLocked(false);
          isRoleLockedRef.current = false;
          return;
        }
      }

      // If sessionStorage has no role session, this window was closed & reopened -> lock counter
      if (!rawStored) {
        setIsRoleLocked(true);
        isRoleLockedRef.current = true;
      }
    } catch {
      // Fallback to server props
    }
  }, [initialIsEvicted, initialIsRoleLocked]);

  const handleLockCounter = async () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("galla_role_session");
      try {
        const bc = new BroadcastChannel("galla_role_channel");
        bc.postMessage({ type: "ROLE_LOCK" });
        bc.close();
      } catch {}
    }
    await lockRoleSessionAction();
    setIsRoleLocked(true);
    isRoleLockedRef.current = true;
  };

  const handleRoleVerified = (newRole: UserRole, newActiveSessionId?: string) => {
    setRole(newRole);
    roleRef.current = newRole;
    if (newActiveSessionId) {
      setCurrentSessionId(newActiveSessionId);
      currentSessionIdRef.current = newActiveSessionId;
    }
    setIsRoleLocked(false);
    isRoleLockedRef.current = false;
    setIsEvicted(false);

    // If staff role unlocks while on an owner-only tab, redirect to orders
    if (newRole !== "owner" && (activeTab === "analytics" || activeTab === "profile")) {
      setActiveTab("orders");
      router.push("/dashboard/orders");
    }

    // Save to window sessionStorage so in-place page refreshes never lock
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(
          "galla_role_session",
          JSON.stringify({
            role: newRole,
            activeSessionId: newActiveSessionId,
          })
        );
      } catch {
        // Ignore sessionStorage errors
      }
    }

    // Cross-tab broadcast to displace any open tabs with this role in the same browser instantly
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        const bc = new BroadcastChannel("galla_role_channel");
        bc.postMessage({
          type: "ROLE_LOGIN",
          role: newRole,
          newSessionId: newActiveSessionId,
        });
        bc.close();
      }
    } catch {
      // Ignore broadcast errors
    }
  };

  // Instant in-memory tab state initialized directly from server props or URL path
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window !== "undefined") {
      return resolveTabFromPathname(window.location.pathname);
    }
    return initialTab;
  });

  const [ordersFilter, setOrdersFilter] = useState<OrderStatus | "all" | "replacement">(() => {
    if (initialTab === "orders" && initialUrlFilter) {
      return initialUrlFilter as any;
    }
    return "all";
  });
  const [ordersNavKey, setOrdersNavKey] = useState(0);

  const [billsFilter, setBillsFilter] = useState<BillStatusKey | "all" | "returns">(() => {
    if (initialTab === "suppliers" && initialUrlFilter) {
      return initialUrlFilter as any;
    }
    return "all";
  });
  const [billsNavKey, setBillsNavKey] = useState(0);

  // Handle browser Back / Forward buttons without server round trips
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      const matchedTab = resolveTabFromPathname(window.location.pathname);
      const params = new URLSearchParams(window.location.search);
      const filterParam = params.get("filter");

      setActiveTab(matchedTab);
      if (matchedTab === "orders") {
        setOrdersFilter((filterParam as any) || "all");
        setOrdersNavKey((k) => k + 1);
      }
      if (matchedTab === "suppliers") {
        setBillsFilter((filterParam as any) || "all");
        setBillsNavKey((k) => k + 1);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Instant 0ms tab navigation handler: updates state immediately and syncs URL with pushState
  const handleSelectTab = useCallback((tab: TabId, targetFilter?: string) => {
    if (tab === "analytics" && roleRef.current !== "owner") {
      tab = "orders";
    }
    if (tab === "profile" && roleRef.current !== "owner") {
      tab = "orders";
    }

    setActiveTab(tab);

    if (tab === "orders") {
      setOrdersFilter((targetFilter as any) || "all");
      setOrdersNavKey((k) => k + 1);
    }
    if (tab === "suppliers") {
      setBillsFilter((targetFilter as any) || "all");
      setBillsNavKey((k) => k + 1);
    }

    const basePath = tab === "overview" ? "/dashboard" : `/dashboard/${tab}`;
    const fullUrl = targetFilter ? `${basePath}?filter=${targetFilter}` : basePath;

    if (typeof window !== "undefined") {
      const currentFull = window.location.pathname + window.location.search;
      if (currentFull !== fullUrl) {
        window.history.pushState({ tab, filter: targetFilter }, "", fullUrl);
      }
    }
  }, []);

  const handleNavigateToAdvanceOrders = useCallback(() => {
    handleSelectTab("orders", "advance_paid");
  }, [handleSelectTab]);

  const handleNavigateToReplacementOrders = useCallback(() => {
    handleSelectTab("orders", "replacement");
  }, [handleSelectTab]);

  const handleNavigateToDueOrders = useCallback(() => {
    handleSelectTab("orders", "created");
  }, [handleSelectTab]);

  const handleNavigateToStockDeliveries = useCallback((filter: "pending" | "advance" = "pending") => {
    handleSelectTab("suppliers", filter);
  }, [handleSelectTab]);

  const [orders, setOrders] = useState<DashboardOrder[]>(initialOrders);
  const [totalOrdersCount, setTotalOrdersCount] = useState<number>(initialTotalOrdersCount);
  const [orderStatusCounts, setOrderStatusCounts] = useState<Record<string, number> | undefined>(initialOrderStatusCounts);

  const [products, setProducts] = useState<DashboardProduct[]>(initialProducts);
  const [suppliers, setSuppliers] = useState<DashboardSupplier[]>(initialSuppliers);
  const [purchaseOrders, setPurchaseOrders] = useState<DashboardPurchaseOrder[]>(initialPurchaseOrders);
  const [customers, setCustomers] = useState<DashboardCustomer[]>(initialCustomers);
  const [expenses, setExpenses] = useState<DashboardExpense[]>(initialExpenses);
  const [totalExpensesCount, setTotalExpensesCount] = useState<number>(initialTotalExpensesCount || 0);
  const [expenseCategoryCounts, setExpenseCategoryCounts] = useState<Record<string, number> | undefined>(initialExpenseCategoryCounts);
  const [expensesTotalAmount, setExpensesTotalAmount] = useState<number>(initialExpensesTotalAmount || 0);
  const [todayIncome, setTodayIncome] = useState<number>(initialTodayIncome || 0);
  const [todayExpense, setTodayExpense] = useState<number>(initialTodayExpense || 0);
  const [todayAdvance, setTodayAdvance] = useState<number>(initialTodayAdvance || 0);
  const [customerDues, setCustomerDues] = useState<number>(initialCustomerDues || 0);

  const [services, setServices] = useState<DashboardService[]>(initialServices);
  const [packages, setPackages] = useState<DashboardPackage[]>(initialPackages);
  const [customerReplacements, setCustomerReplacements] = useState<DashboardCustomerReplacement[]>(initialCustomerReplacements);
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

  const [prevInitialTotalOrdersCount, setPrevInitialTotalOrdersCount] = useState(initialTotalOrdersCount);
  if (initialTotalOrdersCount !== prevInitialTotalOrdersCount) {
    setPrevInitialTotalOrdersCount(initialTotalOrdersCount);
    setTotalOrdersCount(initialTotalOrdersCount);
  }

  const [prevInitialOrderStatusCounts, setPrevInitialOrderStatusCounts] = useState(initialOrderStatusCounts);
  if (initialOrderStatusCounts !== prevInitialOrderStatusCounts) {
    setPrevInitialOrderStatusCounts(initialOrderStatusCounts);
    setOrderStatusCounts(initialOrderStatusCounts);
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

  const [prevInitialTotalExpensesCount, setPrevInitialTotalExpensesCount] = useState(initialTotalExpensesCount);
  if (initialTotalExpensesCount !== prevInitialTotalExpensesCount) {
    setPrevInitialTotalExpensesCount(initialTotalExpensesCount);
    setTotalExpensesCount(initialTotalExpensesCount || 0);
  }

  const [prevInitialExpenseCategoryCounts, setPrevInitialExpenseCategoryCounts] = useState(initialExpenseCategoryCounts);
  if (initialExpenseCategoryCounts !== prevInitialExpenseCategoryCounts) {
    setPrevInitialExpenseCategoryCounts(initialExpenseCategoryCounts);
    setExpenseCategoryCounts(initialExpenseCategoryCounts);
  }

  const [prevInitialExpensesTotalAmount, setPrevInitialExpensesTotalAmount] = useState(initialExpensesTotalAmount);
  if (initialExpensesTotalAmount !== prevInitialExpensesTotalAmount) {
    setPrevInitialExpensesTotalAmount(initialExpensesTotalAmount);
    setExpensesTotalAmount(initialExpensesTotalAmount || 0);
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

  const [prevInitialPurchaseOrders, setPrevInitialPurchaseOrders] = useState(initialPurchaseOrders);
  if (initialPurchaseOrders !== prevInitialPurchaseOrders) {
    setPrevInitialPurchaseOrders(initialPurchaseOrders);
    setPurchaseOrders(initialPurchaseOrders);
  }

  const [prevInitialServices, setPrevInitialServices] = useState(initialServices);
  if (initialServices !== prevInitialServices) {
    setPrevInitialServices(initialServices);
    setServices(initialServices);
  }

  const [prevInitialPackages, setPrevInitialPackages] = useState(initialPackages);
  if (initialPackages !== prevInitialPackages) {
    setPrevInitialPackages(initialPackages);
    setPackages(initialPackages);
  }

  const [prevInitialCustomerReplacements, setPrevInitialCustomerReplacements] = useState(initialCustomerReplacements);
  if (initialCustomerReplacements !== prevInitialCustomerReplacements) {
    setPrevInitialCustomerReplacements(initialCustomerReplacements);
    setCustomerReplacements(initialCustomerReplacements);
  }

  const [prevInitialProfile, setPrevInitialProfile] = useState(initialSalonProfile);
  if (initialSalonProfile !== prevInitialProfile) {
    setPrevInitialProfile(initialSalonProfile);
    if (initialSalonProfile) {
      setSalonProfile(initialSalonProfile);
    }
  }

  const [prevInitialTodayIncome, setPrevInitialTodayIncome] = useState(initialTodayIncome);
  if (initialTodayIncome !== prevInitialTodayIncome) {
    setPrevInitialTodayIncome(initialTodayIncome);
    setTodayIncome(initialTodayIncome || 0);
  }

  const [prevInitialTodayExpense, setPrevInitialTodayExpense] = useState(initialTodayExpense);
  if (initialTodayExpense !== prevInitialTodayExpense) {
    setPrevInitialTodayExpense(initialTodayExpense);
    setTodayExpense(initialTodayExpense || 0);
  }

  const [prevInitialTodayAdvance, setPrevInitialTodayAdvance] = useState(initialTodayAdvance);
  if (initialTodayAdvance !== prevInitialTodayAdvance) {
    setPrevInitialTodayAdvance(initialTodayAdvance);
    setTodayAdvance(initialTodayAdvance || 0);
  }

  const [prevInitialCustomerDues, setPrevInitialCustomerDues] = useState(initialCustomerDues);
  if (initialCustomerDues !== prevInitialCustomerDues) {
    setPrevInitialCustomerDues(initialCustomerDues);
    setCustomerDues(initialCustomerDues || 0);
  }

  // Debounced real-time Pusher updates from remote devices
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useTenantSubscription({
    tenantId,
    event: "data_updated",
    onEvent: () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(() => {
        router.refresh();
      }, 2000);
    },
  });

  // Real-time instant displacement: instantly lock and evict if another device logs into this role
  useTenantSubscription<{ role: UserRole; newSessionId: string }>({
    tenantId,
    event: "role_session_displaced",
    onEvent: (data) => {
      if (!data || !data.role || !data.newSessionId) return;
      if (
        !isRoleLockedRef.current &&
        data.role === roleRef.current &&
        Boolean(currentSessionIdRef.current) &&
        data.newSessionId !== currentSessionIdRef.current
      ) {
        console.warn(
          `[Realtime] Session for role "${data.role}" displaced by a new login on another device. Instantly locking.`
        );
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("galla_role_session");
        }
        setIsRoleLocked(true);
        isRoleLockedRef.current = true;
        setIsEvicted(true);
        lockRoleSessionAction().catch(console.error);
      }
    },
  });

  // Same-browser cross-tab listener for instant multi-tab displacement
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const bc = new BroadcastChannel("galla_role_channel");
    bc.onmessage = (event) => {
      const data = event.data;

      if (data?.type === "ROLE_LOCK" || data?.type === "ROLE_LOGOUT") {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("galla_role_session");
        }
        setIsRoleLocked(true);
        isRoleLockedRef.current = true;
        return;
      }

      if (
        !isRoleLockedRef.current &&
        data?.type === "ROLE_LOGIN" &&
        data.role === roleRef.current &&
        Boolean(currentSessionIdRef.current) &&
        Boolean(data.newSessionId) &&
        data.newSessionId !== currentSessionIdRef.current
      ) {
        console.warn(
          `[Cross-Tab] Session for role "${data.role}" displaced by a new login in another tab. Instantly locking.`
        );
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("galla_role_session");
        }
        setIsRoleLocked(true);
        isRoleLockedRef.current = true;
        setIsEvicted(true);
        lockRoleSessionAction().catch(console.error);
      }
    };
    return () => {
      bc.close();
    };
  }, []);

  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
  const [refundOrder, setRefundOrder] = useState<DashboardOrder | null>(null);
  const [settleOrder, setSettleOrder] = useState<DashboardOrder | null>(null);

  // Directly use pre-saved O(1) persisted metrics (no client-side recomputation)
  const expensesTotal = todayExpense;
  const pendingAmount = customerDues;

  const handleAddOrder = (
    order: DashboardOrder,
    customerPhone?: string,
    clearedDueOrderIds?: string[],
    updatedProducts?: DashboardProduct[]
  ) => {
    const enrichedOrder = customerPhone && !order.customerPhone ? { ...order, customerPhone } : order;
    const phoneDigits = customerPhone ? getPhoneDigits(customerPhone) : "";

    setOrders((prev) => {
      const updated = prev.map((o) => {
        let mod = o;
        if (clearedDueOrderIds && clearedDueOrderIds.includes(o.id)) {
          mod = {
            ...mod,
            paid: mod.amount,
            status: "completed" as const,
            latestActivityAt: new Date().toISOString(),
          };
        }
        if (
          phoneDigits &&
          mod.customerPhone &&
          getPhoneDigits(mod.customerPhone) === phoneDigits &&
          order.customer &&
          order.customer !== "Walk-in Guest"
        ) {
          mod = {
            ...mod,
            customer: order.customer,
          };
        }
        return mod;
      });
      return [enrichedOrder, ...updated];
    });

    if (order.paid > 0) {
      setTodayIncome((prev) => prev + order.paid);
    }
    if (order.status === "advance_paid" || order.status === "paid_full") {
      setTodayAdvance((prev) => prev + (order.advanceAmount ?? order.paid));
    }
    const orderDue = Math.max(0, order.amount - order.paid);
    if (orderDue > 0) {
      setCustomerDues((prev) => prev + orderDue);
    }

    setTotalOrdersCount((prev) => prev + 1);
    setOrderStatusCounts((prev) => {
      const counts = { ...(prev || {}) };
      counts.all = (counts.all || 0) + 1;
      counts[order.status] = (counts[order.status] || 0) + 1;
      if (clearedDueOrderIds && clearedDueOrderIds.length > 0) {
        counts.created = Math.max(0, (counts.created || 0) - clearedDueOrderIds.length);
        counts.completed = (counts.completed || 0) + clearedDueOrderIds.length;
      }
      return counts;
    });

    if (updatedProducts && updatedProducts.length > 0) {
      setProducts((prev) => {
        const map = new Map(updatedProducts.map((p) => [p.id, p]));
        return prev.map((p) => (map.has(p.id) ? map.get(p.id)! : p));
      });
    }

    if (order.customer && order.customer !== "Walk-in Guest") {
      const formatted = customerPhone ? formatPhoneNumber(customerPhone) : "";
      setCustomers((prev) => {
        const idx = prev.findIndex((c) => {
          if (phoneDigits && c.phone) {
            return getPhoneDigits(c.phone) === phoneDigits;
          }
          return c.name.toLowerCase() === order.customer.toLowerCase();
        });
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            name: order.customer,
            phone: formatted || updated[idx].phone,
            visits: (updated[idx].visits || 0) + 1,
            lastVisit: "Today",
          };
          return updated;
        } else {
          return [
            {
              id: `cust-${Date.now()}`,
              name: order.customer,
              phone: formatted,
              visits: 1,
              lastVisit: "Today",
            },
            ...prev,
          ];
        }
      });
    }
  };

  const handleAddExpense = (expense: DashboardExpense) => {
    setExpenses((prev) => [expense, ...prev]);
    setTotalExpensesCount((prev) => prev + 1);
    setExpensesTotalAmount((prev) => prev + (expense.amount || 0));
    setTodayExpense((prev) => prev + (expense.amount || 0));
    setExpenseCategoryCounts((prev) => {
      const counts = { ...(prev || {}) };
      counts.all = (counts.all || 0) + 1;
      const cat = expense.category || "Day-to-day";
      counts[cat] = (counts[cat] || 0) + 1;
      return counts;
    });
  };

  const handleRefundSuccess = (
    updatedOrder: DashboardOrder,
    newExpense?: DashboardExpense,
    updatedProducts?: DashboardProduct[],
    linkedOrders?: DashboardOrder[]
  ) => {
    const linkedIds = new Set(
      (linkedOrders || []).flatMap((lo) => [lo.id, formatDisplayNumber(lo.id)].filter(Boolean))
    );
    const linkedMap = new Map<string, DashboardOrder>();
    for (const lo of (linkedOrders || [])) {
      if (lo.id) {
        linkedMap.set(lo.id, lo);
        const disp = formatDisplayNumber(lo.id);
        if (disp) linkedMap.set(disp, lo);
      }
    }

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === updatedOrder.id) {
          return { ...o, ...updatedOrder };
        }
        if (linkedIds.has(o.id) || linkedIds.has(formatDisplayNumber(o.id))) {
          const match = linkedMap.get(o.id) || linkedMap.get(formatDisplayNumber(o.id));
          return match ? { ...o, ...match } : o;
        }
        return o;
      })
    );
    setOrderStatusCounts((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cancelled_refunded: (prev.cancelled_refunded || 0) + 1 + (linkedOrders?.length || 0),
        replacement: Math.max(0, (prev.replacement || 0) - (linkedOrders?.length || 0)),
      };
    });
    if (updatedProducts && updatedProducts.length > 0) {
      setProducts((prev) => {
        const prodMap = new Map(prev.map((p) => [String(p.id), p]));
        for (const up of updatedProducts) {
          prodMap.set(String(up.id), up);
        }
        return Array.from(prodMap.values());
      });
    }
    if (newExpense) {
      setExpenses((prev) => [newExpense, ...prev]);
      setTotalExpensesCount((prev) => prev + 1);
      setExpensesTotalAmount((prev) => prev + (newExpense.amount || 0));
      setTodayExpense((prev) => prev + (newExpense.amount || 0));
      setExpenseCategoryCounts((prev) => {
        const counts = { ...(prev || {}) };
        counts.all = (counts.all || 0) + 1;
        const cat = newExpense.category || "Refund";
        counts[cat] = (counts[cat] || 0) + 1;
        return counts;
      });
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
    setOrderStatusCounts((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        created: Math.max(0, (prev.created || 0) - 1),
        completed: (prev.completed || 0) + 1,
      };
    });
  };

  const handleMoveStock = async (id: number | string) => {
    try {
      const res = await transferStockAction({ productId: String(id), quantity: 1 });
      if (res.success && res.updatedProduct) {
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? res.updatedProduct! : p))
        );
      }
    } catch (err) {
      console.error("Failed to move stock:", err);
    }
  };

  const handleTransferSuccess = (
    updatedProduct: DashboardProduct,
    newExpense?: DashboardExpense,
    updatedSupplier?: DashboardSupplier,
    refundAmount?: number,
    updatedPO?: DashboardPurchaseOrder
  ) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    if (newExpense) {
      setExpenses((prev) => [newExpense, ...prev]);
      setTotalExpensesCount((prev) => prev + 1);
      setExpensesTotalAmount((prev) => prev + (newExpense.amount || 0));
      setTodayExpense((prev) => prev + (newExpense.amount || 0));
    }
    if (refundAmount && refundAmount > 0) {
      setTodayIncome((prev) => prev + refundAmount);
    }
    if (updatedSupplier) {
      setSuppliers((prev) =>
        prev.map((s) => (s.id === updatedSupplier.id ? updatedSupplier : s))
      );
    }
    if (updatedPO) {
      setPurchaseOrders((prev) =>
        prev.map((po) => (po.id === updatedPO.id ? updatedPO : po))
      );
    }
  };

  const handleStockInSuccess = (
    updatedBatch: DashboardProduct[],
    newPO?: DashboardPurchaseOrder,
    newExpense?: DashboardExpense,
    updatedSupplier?: DashboardSupplier
  ) => {
    setProducts((prev) => {
      const map = new Map(updatedBatch.map((p) => [p.id, p]));
      return prev.map((p) => (map.has(p.id) ? map.get(p.id)! : p));
    });
    if (newPO) {
      setPurchaseOrders((prev) => [newPO, ...prev]);
    }
    if (newExpense) {
      setExpenses((prev) => [newExpense, ...prev]);
      setTotalExpensesCount((prev) => prev + 1);
      setExpensesTotalAmount((prev) => prev + (newExpense.amount || 0));
      setTodayExpense((prev) => prev + (newExpense.amount || 0));
      setExpenseCategoryCounts((prev) => {
        const counts = { ...(prev || {}) };
        counts.all = (counts.all || 0) + 1;
        const cat = newExpense.category || "Inventory purchase";
        counts[cat] = (counts[cat] || 0) + 1;
        return counts;
      });
    }
    if (updatedSupplier) {
      setSuppliers((prev) =>
        prev.map((s) => (s.id === updatedSupplier.id ? updatedSupplier : s))
      );
      const supplierPhoneDigits = updatedSupplier.phone ? getPhoneDigits(updatedSupplier.phone) : "";
      setPurchaseOrders((prev) =>
        prev.map((po) => {
          const matchId = po.supplierId === updatedSupplier.id;
          const matchPhone = Boolean(
            supplierPhoneDigits && po.supplierPhone && getPhoneDigits(po.supplierPhone) === supplierPhoneDigits
          );
          if (matchId || matchPhone) {
            return {
              ...po,
              supplierName: updatedSupplier.name,
              supplierCompany: updatedSupplier.companyName || po.supplierCompany,
            };
          }
          return po;
        })
      );
    }
  };

  const handlePurchaseOrderPaymentRecorded = (
    updatedPO: DashboardPurchaseOrder,
    updatedSupplier?: DashboardSupplier,
    newExpense?: DashboardExpense,
    updatedProducts?: DashboardProduct[]
  ) => {
    setPurchaseOrders((prev) =>
      prev.map((po) => (po.id === updatedPO.id ? updatedPO : po))
    );
    if (updatedProducts && updatedProducts.length > 0) {
      setProducts((prev) => {
        const prodMap = new Map(prev.map((p) => [String(p.id), p]));
        for (const up of updatedProducts) {
          prodMap.set(String(up.id), up);
        }
        return Array.from(prodMap.values());
      });
    }
    if (updatedSupplier) {
      setSuppliers((prev) =>
        prev.map((s) => (s.id === updatedSupplier.id ? updatedSupplier : s))
      );
    }
    if (newExpense) {
      setExpenses((prev) => [newExpense, ...prev]);
      setTotalExpensesCount((prev) => prev + 1);
      setExpensesTotalAmount((prev) => prev + (newExpense.amount || 0));
      setTodayExpense((prev) => prev + (newExpense.amount || 0));
      setExpenseCategoryCounts((prev) => {
        const counts = { ...(prev || {}) };
        counts.all = (counts.all || 0) + 1;
        const cat = newExpense.category || "Inventory purchase";
        counts[cat] = (counts[cat] || 0) + 1;
        return counts;
      });
    }
  };

  const handlePurchaseOrderDelivered = (
    updatedPO: DashboardPurchaseOrder,
    updatedProducts?: DashboardProduct[]
  ) => {
    setPurchaseOrders((prev) =>
      prev.map((po) => (po.id === updatedPO.id ? updatedPO : po))
    );
    if (updatedProducts && updatedProducts.length > 0) {
      setProducts((prev) => {
        const prodMap = new Map(prev.map((p) => [String(p.id), p]));
        for (const up of updatedProducts) {
          prodMap.set(String(up.id), up);
        }
        return Array.from(prodMap.values());
      });
    }
  };

  const handleReschedulePurchaseOrder = (updatedPO: DashboardPurchaseOrder) => {
    setPurchaseOrders((prev) =>
      prev.map((po) => (po.id === updatedPO.id ? updatedPO : po))
    );
  };

  const handleAddProduct = (newProduct: DashboardProduct) => {
    setProducts((prev) => [newProduct, ...prev]);
  };

  const handleUpdateProduct = (
    updatedProduct: DashboardProduct,
    updatedSupplier?: DashboardSupplier,
    refundAmount?: number,
    updatedPO?: DashboardPurchaseOrder
  ) => {
    setProducts((prev) =>
      prev.map((p) => (String(p.id) === String(updatedProduct.id) ? updatedProduct : p))
    );
    if (updatedSupplier) {
      setSuppliers((prev) =>
        prev.map((s) => (s.id === updatedSupplier.id ? updatedSupplier : s))
      );
    }
    if (updatedPO) {
      setPurchaseOrders((prev) =>
        prev.map((po) => (po.id === updatedPO.id ? updatedPO : po))
      );
    }
    if (refundAmount && refundAmount > 0) {
      setTodayIncome((prev) => prev + refundAmount);
    }
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
        setOrderStatusCounts((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            created: Math.max(0, (prev.created || 0) - 1),
            completed: (prev.completed || 0) + 1,
          };
        });
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
    const newDigits = newSupplier.phone ? getPhoneDigits(newSupplier.phone) : "";
    setSuppliers((prev) => {
      const existingIdx = prev.findIndex((s) => {
        if (s.id === newSupplier.id) return true;
        if (newDigits && s.phone) {
          return getPhoneDigits(s.phone) === newDigits;
        }
        return false;
      });
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = newSupplier;
        return updated;
      }
      return [newSupplier, ...prev];
    });
    setPurchaseOrders((prev) =>
      prev.map((po) => {
        const matchId = po.supplierId === newSupplier.id;
        const matchPhone = Boolean(
          newDigits && po.supplierPhone && getPhoneDigits(po.supplierPhone) === newDigits
        );
        if (matchId || matchPhone) {
          return {
            ...po,
            supplierName: newSupplier.name,
            supplierCompany: newSupplier.companyName || po.supplierCompany,
          };
        }
        return po;
      })
    );
  };

  const handleUpdateSupplier = (updatedSupplier: DashboardSupplier) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.id === updatedSupplier.id ? updatedSupplier : s))
    );
    const supplierPhoneDigits = updatedSupplier.phone ? getPhoneDigits(updatedSupplier.phone) : "";
    setPurchaseOrders((prev) =>
      prev.map((po) => {
        const matchId = po.supplierId === updatedSupplier.id;
        const matchPhone = Boolean(
          supplierPhoneDigits && po.supplierPhone && getPhoneDigits(po.supplierPhone) === supplierPhoneDigits
        );
        if (matchId || matchPhone) {
          return {
            ...po,
            supplierName: updatedSupplier.name,
            supplierCompany: updatedSupplier.companyName || po.supplierCompany,
          };
        }
        return po;
      })
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
        onLockCounter={handleLockCounter}
        onOpenChangePins={() => setIsChangePinOpen(true)}
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
              suppliers={suppliers}
              purchaseOrders={purchaseOrders}
              expensesTotal={expensesTotal}
              todayIncome={todayIncome}
              advancePayment={todayAdvance}
              pendingAmount={customerDues}
              salonName={salonProfile.name || salonName}
              customerReplacements={customerReplacements}
              onOpenNewOrder={() => setIsNewOrderOpen(true)}
              onOpenNewExpense={() => setIsNewExpenseOpen(true)}
              onNavigateToAdvanceOrders={handleNavigateToAdvanceOrders}
              onNavigateToDueOrders={handleNavigateToDueOrders}
              onNavigateToStockDeliveries={handleNavigateToStockDeliveries}
              onCompleteOrder={handleCompleteOrder}
              onOpenRefund={(order) => setRefundOrder(order)}
              onOpenSettle={(order) => setSettleOrder(order)}
              onRescheduleOrder={handleRescheduleOrder}
              onNavigateToInventory={() => handleSelectTab("inventory")}
              onNavigateToReplacementOrders={handleNavigateToReplacementOrders}
              onUpdateReplacement={(updated) => {
                setCustomerReplacements((prev) =>
                  prev.map((c) => (c.id === updated.id ? updated : c))
                );
              }}
              onRemoveReplacement={(id) => {
                setCustomerReplacements((prev) => prev.filter((c) => c.id !== id));
              }}
            />
          )}

          {activeTab === "orders" && (
            <OrdersTab
              key={`orders-${ordersNavKey}`}
              orders={orders}
              initialTotalCount={totalOrdersCount}
              initialStatusCounts={orderStatusCounts}
              initialFilter={ordersFilter}
              salonName={salonProfile.name}
              onOpenNewOrder={() => setIsNewOrderOpen(true)}
              onCompleteOrder={handleCompleteOrder}
              onOpenRefund={(order) => setRefundOrder(order)}
              onRescheduleOrder={handleRescheduleOrder}
              onOpenSettle={(order) => setSettleOrder(order)}
            />
          )}

          {activeTab === "services" && (
            <ServicesTab
              services={services}
              packages={packages}
              products={products}
              isReadOnly={role !== "owner"}
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
              purchaseOrders={purchaseOrders}
              salonName={salonProfile?.name || salonName}
              initialFilter={billsFilter}
              onAddSupplier={handleAddSupplier}
              onUpdateSupplier={handleUpdateSupplier}
              onStockInSuccess={handleStockInSuccess}
              onPaymentRecorded={handlePurchaseOrderPaymentRecorded}
              onStockDelivered={handlePurchaseOrderDelivered}
              onReschedulePurchaseOrder={handleReschedulePurchaseOrder}
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
              initialTotalCount={totalExpensesCount}
              initialCategoryCounts={expenseCategoryCounts}
              initialTotalAmount={expensesTotalAmount}
              onOpenNewExpense={() => setIsNewExpenseOpen(true)}
              orders={orders}
              purchaseOrders={purchaseOrders}
              salonName={salonName}
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

      {/* Role PIN Gate Keypad (Session / Window Lock) */}
      <RoleKeypadModal
        isOpen={isRoleLocked}
        salonName={salonProfile.name || salonName}
        isEvicted={isEvicted}
        onRoleVerified={handleRoleVerified}
      />

      {/* Owner PIN Management Modal */}
      <ChangePinModal
        isOpen={isChangePinOpen}
        onClose={() => setIsChangePinOpen(false)}
      />
    </div>
  );
}
