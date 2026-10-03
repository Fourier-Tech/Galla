"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  X,
  AlertCircle,
  Search,
  Check,
  Trash2,
  ArrowLeft,
  Calendar,
  ShoppingBag,
  CheckCircle2,
  Clock,
  ChevronDown,
  Eye,
  Package,
  Plus,
  TrendingUp,
} from "lucide-react";
import {
  DashboardCustomer,
  DashboardOrder,
  DashboardService,
  DashboardPackage,
  DashboardProduct,
} from "@/types/dashboard";
import { createOrderAction, getLiveProductsAction } from "@/app/dashboard/actions";
import {
  formatPhoneNumber,
  formatCustomerName,
  formatRupee,
  getLocalDateString,
  formatDisplayNumber,
  getPhoneDigits,
  getOrderPendingDue,
} from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";
import { OrderDetailsModal } from "./order-details-modal";
import { PaymentModeSelect } from "../payment-mode-select";

export interface RequiredProductItem {
  productId?: string;
  name: string;
  quantity: number;
}

export interface StockEvaluationResult {
  hasProducts: boolean;
  hasEnoughUse: boolean;
  needsSellStock: boolean;
  isOutOfStock: boolean;
  missingNames: string[];
  itemsNeedingSellStock: {
    name: string;
    neededFromSell: number;
    sellAvailable: number;
    useAvailable: number;
  }[];
  hasRetailBackup: boolean;
  retailAvailable: number;
  allRequiredProducts: {
    name: string;
    needed: number;
    useAvailable: number;
    sellAvailable: number;
  }[];
}

function getPackageRequiredProducts(
  pkg: DashboardPackage,
  services: DashboardService[] = [],
  quantity: number = 1
): RequiredProductItem[] {
  const map = new Map<string, RequiredProductItem>();

  // 1. Direct products in package
  if (pkg.products && pkg.products.length > 0) {
    for (const pItem of pkg.products) {
      const key = (pItem.productId || pItem.name).trim().toLowerCase();
      const needed = (pItem.quantity || 1) * quantity;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += needed;
      } else {
        map.set(key, {
          productId: pItem.productId,
          name: pItem.name,
          quantity: needed,
        });
      }
    }
  }

  // 2. Products used inside bundled services
  if (pkg.services && pkg.services.length > 0) {
    for (const sItem of pkg.services) {
      const srv = services.find(
        (s) =>
          s.id === sItem.serviceId ||
          s.name.trim().toLowerCase() === sItem.name.trim().toLowerCase()
      );
      if (srv && srv.products && srv.products.length > 0) {
        for (const spItem of srv.products) {
          const key = (spItem.productId || spItem.name).trim().toLowerCase();
          const needed = (spItem.quantity || 1) * quantity;
          const existing = map.get(key);
          if (existing) {
            existing.quantity += needed;
          } else {
            map.set(key, {
              productId: spItem.productId,
              name: spItem.name,
              quantity: needed,
            });
          }
        }
      }
    }
  }

  return Array.from(map.values());
}

function getServiceRequiredProducts(
  service: DashboardService,
  quantity: number = 1
): RequiredProductItem[] {
  if (!service.products || service.products.length === 0) return [];
  return service.products.map((p) => ({
    productId: p.productId,
    name: p.name,
    quantity: (p.quantity || 1) * quantity,
  }));
}

function evaluateProductsStock(
  requiredItems: RequiredProductItem[],
  products: DashboardProduct[]
): StockEvaluationResult {
  if (requiredItems.length === 0) {
    return {
      hasProducts: false,
      hasEnoughUse: true,
      needsSellStock: false,
      isOutOfStock: false,
      missingNames: [],
      itemsNeedingSellStock: [],
      hasRetailBackup: false,
      retailAvailable: 0,
      allRequiredProducts: [],
    };
  }

  const missingNames: string[] = [];
  const itemsNeedingSellStock: {
    name: string;
    neededFromSell: number;
    sellAvailable: number;
    useAvailable: number;
  }[] = [];
  const allRequiredProducts: {
    name: string;
    needed: number;
    useAvailable: number;
    sellAvailable: number;
  }[] = [];

  let totalRetail = 0;
  let hasRetailBackup = false;

  for (const item of requiredItems) {
    const cleanItemName = item.name
      .replace(/\s*\((?:old|new)(?:\s+batch)?\)$/i, "")
      .replace(/\s*\(batch[^\)]*\)$/i, "")
      .trim()
      .toLowerCase();

    const matchingProducts = products.filter((p) => {
      if (item.productId && String(p.id) === String(item.productId)) return true;
      const base = p.name
        .replace(/\s*\((?:old|new)(?:\s+batch)?\)$/i, "")
        .replace(/\s*\(batch[^\)]*\)$/i, "")
        .trim()
        .toLowerCase();
      if (base === cleanItemName) return true;
      return base.includes(cleanItemName) || cleanItemName.includes(base);
    });

    const useAvailable = matchingProducts.reduce((sum, p) => sum + (p.use || 0), 0);
    const sellAvailable = matchingProducts.reduce((sum, p) => sum + (p.sell || 0), 0);

    allRequiredProducts.push({
      name: item.name,
      needed: item.quantity,
      useAvailable,
      sellAvailable,
    });

    if (useAvailable < item.quantity) {
      const shortage = item.quantity - useAvailable;
      if (useAvailable + sellAvailable >= item.quantity) {
        itemsNeedingSellStock.push({
          name: item.name,
          neededFromSell: shortage,
          sellAvailable,
          useAvailable,
        });
        hasRetailBackup = true;
        totalRetail += sellAvailable;
      } else {
        missingNames.push(item.name);
      }
    }
  }

  const isOutOfStock = missingNames.length > 0;
  const needsSellStock = itemsNeedingSellStock.length > 0;
  const hasEnoughUse = !isOutOfStock && !needsSellStock;

  return {
    hasProducts: true,
    hasEnoughUse,
    needsSellStock,
    isOutOfStock,
    missingNames,
    itemsNeedingSellStock,
    hasRetailBackup,
    retailAvailable: totalRetail,
    allRequiredProducts,
  };
}

function getPackageStockInfo(
  pkg: DashboardPackage,
  products: DashboardProduct[],
  services: DashboardService[] = [],
  quantity: number = 1
): StockEvaluationResult {
  const reqs = getPackageRequiredProducts(pkg, services, quantity);
  return evaluateProductsStock(reqs, products);
}

function getServiceStockInfo(
  service: DashboardService,
  products: DashboardProduct[],
  quantity: number = 1
): StockEvaluationResult {
  const reqs = getServiceRequiredProducts(service, quantity);
  return evaluateProductsStock(reqs, products);
}

export interface SelectedOrderItem {
  id: string;
  type: "service" | "package" | "product";
  name: string;
  price: number;
  quantity: number;
}

const SETTLEMENT_MODE_OPTIONS = [
  {
    value: "completed",
    label: "Complete",
    sublabel: "Fulfill & collect payment immediately",
    icon: CheckCircle2,
    badge: "Instant",
  },
  {
    value: "pay_later",
    label: "Pay Later / Due",
    sublabel: "Deliver now, collect balance later",
    icon: Clock,
    badge: "Credit",
  },
  {
    value: "advance",
    label: "Advance Booking / Pre-order",
    sublabel: "Partial deposit now, fulfillment later",
    icon: Calendar,
    badge: "Deposit",
  },
  {
    value: "paid_full",
    label: "Paid in Full (Advance / Pre-order)",
    sublabel: "100% upfront payment, fulfillment later",
    icon: ShoppingBag,
    badge: "Prepaid",
  },
] as const;

function SettlementModeSelect({
  value,
  onChange,
  hasOutOfStockItems,
  needsSellStock,
  allowSellStockUsage,
  needsUseStock,
  allowUseStockUsage,
}: {
  value: "completed" | "pay_later" | "advance" | "paid_full";
  onChange: (val: "completed" | "pay_later" | "advance" | "paid_full") => void;
  hasOutOfStockItems: boolean;
  needsSellStock: boolean;
  allowSellStockUsage: boolean;
  needsUseStock?: boolean;
  allowUseStockUsage?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption =
    SETTLEMENT_MODE_OPTIONS.find((opt) => opt.value === value) ||
    SETTLEMENT_MODE_OPTIONS[0];
  const SelectedIcon = selectedOption.icon;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="space-y-1.5 w-full relative" ref={containerRef}>
      <label className="block text-[12px] font-medium text-galla-ink">
        Settlement Mode <span className="text-red-500">*</span>
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`w-full bg-galla-surface border rounded-[5px] px-3 py-2 text-[13px] font-sans flex items-center justify-between gap-2 transition-all cursor-pointer shadow-2xs select-none ${isOpen
              ? "border-galla-teal ring-1 ring-galla-teal"
              : "border-galla-line hover:border-galla-ink-soft/40"
            }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-6 w-6 rounded-[4px] bg-galla-teal-soft/80 border border-galla-teal/20 text-galla-teal flex items-center justify-center shrink-0">
              <SelectedIcon className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-2 truncate text-left">
              <span className="font-semibold text-galla-ink text-[13px] truncate">
                {selectedOption.label}
              </span>
              <span className="text-[11.5px] text-galla-ink-soft hidden sm:inline truncate">
                &bull; {selectedOption.sublabel}
              </span>
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-galla-ink-soft shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180 text-galla-teal" : ""
              }`}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-galla-surface border border-galla-line rounded-[6px] shadow-xl z-30 overflow-hidden divide-y divide-galla-line/40 animate-in fade-in-50 zoom-in-95 duration-100">
            {SETTLEMENT_MODE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = opt.value === value;
              const isDisabled = (() => {
                const hasUnconfirmedStock =
                  (needsSellStock && !allowSellStockUsage) ||
                  (needsUseStock && !allowUseStockUsage);

                const hasConfirmedStock =
                  (needsSellStock && allowSellStockUsage) ||
                  (needsUseStock && allowUseStockUsage);

                if (hasOutOfStockItems || hasUnconfirmedStock) {
                  return opt.value === "completed" || opt.value === "pay_later";
                }

                if (hasConfirmedStock) {
                  return opt.value === "advance" || opt.value === "paid_full";
                }

                return false;
              })();

              const disabledReason = (() => {
                if (!isDisabled) return null;
                if (hasOutOfStockItems) {
                  return "Disabled (some items out of stock)";
                }
                if (needsUseStock && !allowUseStockUsage) {
                  return "Disabled (retail stock unavailable — check salon use-stock above to enable)";
                }
                if (needsSellStock && !allowSellStockUsage) {
                  return "Disabled (in-use stock unavailable — confirm shelf transfer above to enable)";
                }
                if (needsUseStock && allowUseStockUsage) {
                  return "Disabled (salon use-stock selected for immediate fulfillment)";
                }
                if (needsSellStock && allowSellStockUsage) {
                  return "Disabled (shelf transfer selected for immediate fulfillment)";
                }
                return "Disabled";
              })();

              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled) {
                      onChange(opt.value);
                      setIsOpen(false);
                    }
                  }}
                  className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 text-[12.5px] transition-colors ${isDisabled
                      ? "opacity-50 cursor-not-allowed bg-galla-paper/40"
                      : isSelected
                        ? "bg-galla-teal/10 cursor-pointer"
                        : "hover:bg-galla-paper/70 cursor-pointer"
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`h-6 w-6 rounded-[4px] flex items-center justify-center shrink-0 ${isSelected
                          ? "bg-galla-teal text-white"
                          : "bg-galla-paper text-galla-ink-soft border border-galla-line"
                        }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold text-[13px] ${isSelected ? "text-galla-teal" : "text-galla-ink"
                            }`}
                        >
                          {opt.label}
                        </span>
                        <span className="text-[10.5px] px-1.5 py-0.2 rounded-[4px] font-medium bg-galla-paper border border-galla-line text-galla-ink-soft">
                          {opt.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-galla-ink-soft truncate">
                        {isDisabled
                          ? disabledReason
                          : opt.sublabel}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-galla-teal shrink-0 stroke-[2.5]" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddOrder: (
    order: DashboardOrder,
    customerPhone?: string,
    clearedDueOrderIds?: string[],
    updatedProducts?: DashboardProduct[]
  ) => void;
  customers?: DashboardCustomer[];
  services?: DashboardService[];
  packages?: DashboardPackage[];
  initialProducts?: DashboardProduct[];
  orders?: DashboardOrder[];
}

export function NewOrderModal({
  isOpen,
  onClose,
  onAddOrder,
  customers = [],
  services = [],
  packages = [],
  initialProducts = [],
  orders = [],
}: NewOrderModalProps) {
  // Customer State
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Catalog State
  const [catalogTab, setCatalogTab] = useState<"services" | "packages" | "products">("services");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<SelectedOrderItem[]>([]);
  const [liveProducts, setLiveProducts] = useState<DashboardProduct[]>(initialProducts);
  const [, setIsLoadingProducts] = useState(false);

  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      setLiveProducts(initialProducts);
    }
  }, [initialProducts]);

  // Fetch live products on open to ensure live stock accurate
  const fetchLiveProducts = React.useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const res = await getLiveProductsAction();
      if (res.success && res.products) {
        setLiveProducts(res.products);
      }
    } catch (err) {
      console.error("Failed to fetch live products:", err);
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchLiveProducts();
    }
  }, [isOpen, fetchLiveProducts]);

  // Pricing & Settlement State
  const [discount, setDiscount] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "flat">("percentage");
  const [extraCharge, setExtraCharge] = useState<number>(0);
  const [totalInput, setTotalInput] = useState<string>("");
  const [isEditingTotal, setIsEditingTotal] = useState<boolean>(false);
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card">("cash");
  const [settlementMode, setSettlementMode] = useState<"completed" | "pay_later" | "advance" | "paid_full">("completed");
  const [payLaterPaid, setPayLaterPaid] = useState("");
  const [advance, setAdvance] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [includePreviousDue, setIncludePreviousDue] = useState(false);
  const [bookingDate, setBookingDate] = useState(() => getLocalDateString());
  const [bookingTime, setBookingTime] = useState("");
  const [notes, setNotes] = useState("");
  const [allowSellStockUsage, setAllowSellStockUsage] = useState(false);
  const [allowUseStockUsage, setAllowUseStockUsage] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inspectingOrder, setInspectingOrder] = useState<DashboardOrder | null>(null);
  const [viewingPackage, setViewingPackage] = useState<DashboardPackage | null>(null);
  const [createdOrderResult, setCreatedOrderResult] = useState<DashboardOrder | null>(null);

  useEffect(() => {
    if (!viewingPackage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setViewingPackage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewingPackage]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus customer name when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close customer suggestions dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter customers by name query
  const filteredCustomers = useMemo(() => {
    if (!customer.trim()) return [];
    const query = customer.toLowerCase();
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          getPhoneDigits(c.phone).includes(query)
      )
      .slice(0, 5);
  }, [customer, customers]);

  // Check phone conflicts
  const phoneConflictCustomer = useMemo(() => {
    const cleanPhone = getPhoneDigits(phone);
    if (cleanPhone.length < 10) return null;
    return (
      customers.find(
        (c) =>
          getPhoneDigits(c.phone) === cleanPhone &&
          c.name.toLowerCase() !== customer.trim().toLowerCase()
      ) || null
    );
  }, [phone, customer, customers]);

  // Previous due orders calculation
  const customerDueOrders = useMemo(() => {
    if (!customer.trim() && !phone.trim()) return [];
    const cleanPhone = getPhoneDigits(phone);
    return orders.filter((o) => {
      if (o.status !== "created" && o.status !== "advance_paid") return false;
      const orderPending = getOrderPendingDue(o);
      if (orderPending <= 0) return false;
      if (cleanPhone && o.customerPhone && getPhoneDigits(o.customerPhone) === cleanPhone) {
        return true;
      }
      if (customer.trim() && o.customer.toLowerCase() === customer.trim().toLowerCase()) {
        return true;
      }
      return false;
    });
  }, [customer, phone, orders]);

  const totalPreviousDue = useMemo(() => {
    return customerDueOrders.reduce((sum, o) => sum + getOrderPendingDue(o), 0);
  }, [customerDueOrders]);

  // Financial calculations
  const calculatedSubtotal = useMemo(() => {
    return selectedItems.reduce((acc, it) => acc + (it.price * (it.quantity || 1)), 0);
  }, [selectedItems]);

  const discountValue = Number(discount) || 0;
  const calculatedDiscountAmount = useMemo(() => {
    if (discountValue <= 0) return 0;
    if (discountType === "percentage") {
      const pct = Math.min(100, discountValue);
      return Math.round((calculatedSubtotal * pct) / 100);
    }
    return Math.min(calculatedSubtotal, discountValue);
  }, [calculatedSubtotal, discountValue, discountType]);

  const baseOrderTotal = useMemo(() => {
    const base = Math.max(0, calculatedSubtotal - calculatedDiscountAmount);
    return includePreviousDue ? base + totalPreviousDue : base;
  }, [calculatedSubtotal, calculatedDiscountAmount, includePreviousDue, totalPreviousDue]);

  const finalTotal = useMemo(() => {
    return baseOrderTotal + extraCharge;
  }, [baseOrderTotal, extraCharge]);

  const isTotalBelowBase = useMemo(() => {
    if (!isEditingTotal || totalInput.trim() === "") return false;
    return Number(totalInput) < baseOrderTotal;
  }, [isEditingTotal, totalInput, baseOrderTotal]);

  useEffect(() => {
    if (selectedItems.length === 0) {
      setExtraCharge(0);
      setTotalInput("");
      setIsEditingTotal(false);
    }
  }, [selectedItems.length]);

  const enteredPayLaterPaid = Number(payLaterPaid) || 0;
  const enteredAdvance = Number(advance) || 0;

  const paidAmount = useMemo(() => {
    if (settlementMode === "completed" || settlementMode === "paid_full") {
      return finalTotal;
    }
    if (settlementMode === "pay_later") {
      return Math.min(finalTotal, enteredPayLaterPaid);
    }
    return Math.min(finalTotal, enteredAdvance);
  }, [settlementMode, finalTotal, enteredAdvance, enteredPayLaterPaid]);

  const amountPending = useMemo(() => {
    return Math.max(0, finalTotal - paidAmount);
  }, [finalTotal, paidAmount]);

  // Stock evaluation for selected items
  const hasOutOfStockItems = useMemo(() => {
    for (const item of selectedItems) {
      if (item.type === "product") {
        const p = liveProducts.find((prod) => String(prod.id) === item.id);
        const sellAvailable = p?.sell || 0;
        const useAvailable = p?.use || 0;
        const needed = item.quantity || 1;
        if (!p || (sellAvailable + useAvailable) < needed) return true;
      } else if (item.type === "service") {
        const s = services.find((srv) => srv.id === item.id);
        if (s) {
          const res = getServiceStockInfo(s, liveProducts, item.quantity || 1);
          if (res.isOutOfStock) return true;
        }
      } else if (item.type === "package") {
        const pkg = packages.find((p) => p.id === item.id);
        if (pkg) {
          const res = getPackageStockInfo(pkg, liveProducts, services, item.quantity || 1);
          if (res.isOutOfStock) return true;
        }
      }
    }
    return false;
  }, [selectedItems, liveProducts, services, packages]);

  const orderSellStockItems = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of selectedItems) {
      if (item.type === "service") {
        const s = services.find((srv) => srv.id === item.id);
        if (s) {
          const res = getServiceStockInfo(s, liveProducts, item.quantity || 1);
          if (res.needsSellStock) {
            for (const it of res.itemsNeedingSellStock) {
              map.set(it.name, (map.get(it.name) || 0) + it.neededFromSell);
            }
          }
        }
      } else if (item.type === "package") {
        const pkg = packages.find((p) => p.id === item.id);
        if (pkg) {
          const res = getPackageStockInfo(pkg, liveProducts, services, item.quantity || 1);
          if (res.needsSellStock) {
            for (const it of res.itemsNeedingSellStock) {
              map.set(it.name, (map.get(it.name) || 0) + it.neededFromSell);
            }
          }
        }
      }
    }
    return Array.from(map.entries()).map(([name, neededFromSell]) => ({ name, neededFromSell }));
  }, [selectedItems, services, packages, liveProducts]);

  const orderUseStockItems = useMemo(() => {
    const list: { id: string; name: string; neededFromUse: number; useAvailable: number; sellAvailable: number }[] = [];
    for (const item of selectedItems) {
      if (item.type === "product") {
        const p = liveProducts.find((prod) => String(prod.id) === item.id);
        const sellAvailable = p?.sell || 0;
        const useAvailable = p?.use || 0;
        const needed = item.quantity || 1;
        if (p && sellAvailable < needed && (sellAvailable + useAvailable) >= needed) {
          list.push({
            id: item.id,
            name: item.name,
            neededFromUse: needed - sellAvailable,
            useAvailable,
            sellAvailable,
          });
        }
      }
    }
    return list;
  }, [selectedItems, liveProducts]);

  // Adjust settlement mode automatically based on stock availability and shelf/salon use opt-in
  useEffect(() => {
    if (hasOutOfStockItems) {
      if (settlementMode === "completed" || settlementMode === "pay_later") {
        setSettlementMode("advance");
      }
    } else {
      const hasUnconfirmedStock =
        (orderSellStockItems.length > 0 && !allowSellStockUsage) ||
        (orderUseStockItems.length > 0 && !allowUseStockUsage);

      const hasConfirmedStock =
        (orderSellStockItems.length > 0 && allowSellStockUsage) ||
        (orderUseStockItems.length > 0 && allowUseStockUsage);

      if (hasUnconfirmedStock) {
        if (settlementMode === "completed" || settlementMode === "pay_later") {
          setSettlementMode("advance");
        }
      } else if (hasConfirmedStock) {
        if (settlementMode === "advance" || settlementMode === "paid_full") {
          setSettlementMode("completed");
        }
      }
    }
  }, [
    hasOutOfStockItems,
    orderSellStockItems.length,
    allowSellStockUsage,
    orderUseStockItems.length,
    allowUseStockUsage,
    settlementMode,
  ]);

  // Filter catalog items
  const filteredServices = useMemo(() => {
    const q = catalogSearch.toLowerCase().trim();
    return services.filter((s) => (s.name + " " + (s.category || "")).toLowerCase().includes(q));
  }, [services, catalogSearch]);

  const filteredPackages = useMemo(() => {
    const q = catalogSearch.toLowerCase().trim();
    return packages.filter((p) => p.name.toLowerCase().includes(q));
  }, [packages, catalogSearch]);

  const filteredProducts = useMemo(() => {
    const q = catalogSearch.toLowerCase().trim();
    return liveProducts.filter((p) => (p.name + " " + (p.category || "")).toLowerCase().includes(q));
  }, [liveProducts, catalogSearch]);

  // Identify products with higher margin among old/new batches
  const higherMarginProductsMap = useMemo(() => {
    // ponytail: Regex grouping assumes standard salon batch naming conventions (Old/New/Batch #). Upgrade path: explicit parentProductId or productFamilyId field in schema for multi-batch tracking.
    const groups: Record<string, DashboardProduct[]> = {};

    for (const p of liveProducts) {
      if (!p.name) continue;
      const baseName = p.name
        .replace(/\s*[\(\[](?:old|new)(?:\s+batch)?[\)\]]$/i, "")
        .replace(/\s*[\(\[]batch[^\)\]]*[\)\]]$/i, "")
        .replace(/\s*[-–—]\s*(?:old|new)(?:\s+batch)?$/i, "")
        .trim()
        .toLowerCase();

      if (!groups[baseName]) {
        groups[baseName] = [];
      }
      groups[baseName].push(p);
    }

    const resultMap = new Map<string, { isHigher: boolean; margin: number; diff: number }>();

    for (const group of Object.values(groups)) {
      if (group.length < 2) continue;
      const hasBatchIndicator = group.some((p) =>
        /(?:[\(\[]|\b)(?:old|new|batch)(?:[\)\]]|\b)/i.test(p.name)
      );
      if (!hasBatchIndicator) continue;

      const variants = group
        .filter((p) => typeof p.price === "number")
        .map((p) => {
          const margin =
            typeof p.purchaseCost === "number"
              ? p.price - p.purchaseCost
              : p.price;
          return {
            id: String(p.id),
            margin,
          };
        });

      if (variants.length < 2) continue;

      const margins = variants.map((v) => v.margin);
      const maxMargin = Math.max(...margins);
      const minMargin = Math.min(...margins);

      if (maxMargin > minMargin) {
        const diff = maxMargin - minMargin;
        for (const v of variants) {
          if (v.margin === maxMargin) {
            resultMap.set(v.id, { isHigher: true, margin: v.margin, diff });
          } else {
            resultMap.set(v.id, { isHigher: false, margin: v.margin, diff: 0 });
          }
        }
      }
    }

    return resultMap;
  }, [liveProducts]);

  if (!isOpen) return null;

  const handleReset = () => {
    setCustomer("");
    setPhone("");
    setCatalogTab("services");
    setSelectedItems([]);
    setDiscount("");
    setDiscountType("percentage");
    setExtraCharge(0);
    setTotalInput("");
    setIsEditingTotal(false);
    setPaymentMode("cash");
    setSettlementMode("completed");
    setPayLaterPaid("");
    setAdvance("");
    setDueDate("");
    setIncludePreviousDue(false);
    setBookingDate(getLocalDateString());
    setBookingTime("");
    setNotes("");
    setAllowSellStockUsage(false);
    setAllowUseStockUsage(false);
    setShowConfirm(false);
    setErrorMsg(null);
    setShowSuggestions(false);
    setInspectingOrder(null);
    setCreatedOrderResult(null);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      handleReset();
      onClose();
    }
  };

  // Toggle item in catalog
  const handleToggleItem = (item: {
    id: string;
    type: "service" | "package" | "product";
    name: string;
    price: number;
  }) => {
    setSelectedItems((prev) => {
      const exists = prev.some((i) => i.id === item.id && i.type === item.type);
      if (exists) {
        return prev.filter((i) => !(i.id === item.id && i.type === item.type));
      } else {
        return [
          ...prev,
          {
            id: item.id,
            type: item.type,
            name: item.name,
            price: item.price,
            quantity: 1,
          },
        ];
      }
    });
  };

  const handleRemoveItem = (id: string, type: "service" | "package" | "product") => {
    setSelectedItems((prev) => prev.filter((i) => !(i.id === id && i.type === type)));
  };

  const handleUpdateQuantity = (id: string, type: "service" | "package" | "product", delta: number) => {
    setSelectedItems((prev) => {
      const next = prev
        .map((item) => {
          if (item.id === id && item.type === type) {
            const nextQty = (item.quantity || 1) + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as SelectedOrderItem[];
      return next;
    });
  };

  // Handle final submission check
  const handleFinalSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const formattedName = formatCustomerName(customer);
    if (!formattedName) {
      setErrorMsg("Please enter customer name");
      return;
    }

    const phoneDigits = getPhoneDigits(phone);
    if (!phoneDigits) {
      setErrorMsg("Please enter customer mobile number");
      return;
    }

    if (phoneDigits.length < 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number");
      return;
    }

    if (selectedItems.length === 0) {
      setErrorMsg("Please select at least one item to create the order.");
      return;
    }

    if (isTotalBelowBase) {
      setErrorMsg(`Total cannot be less than order amount (${formatRupee(baseOrderTotal)}). To give a discount, use the Discount field.`);
      return;
    }

    if (settlementMode === "advance") {
      if (!advance.trim() || Number(advance) <= 0) {
        setErrorMsg("Please enter the advance amount paid");
        return;
      }
      if (Number(advance) > finalTotal) {
        setErrorMsg(`Advance amount cannot exceed the final total of ${formatRupee(finalTotal)}`);
        return;
      }
    }

    if (settlementMode === "pay_later") {
      if (payLaterPaid.trim() !== "" && Number(payLaterPaid) > finalTotal) {
        setErrorMsg(`Upfront paid amount cannot exceed the final total of ${formatRupee(finalTotal)}`);
        return;
      }
    }

    if (orderSellStockItems.length > 0) {
      if (allowSellStockUsage && (settlementMode === "advance" || settlementMode === "paid_full")) {
        setErrorMsg("Shelf transfer is confirmed for immediate fulfillment. Please choose Complete or Pay Later (Due).");
        return;
      }
      if (!allowSellStockUsage && (settlementMode === "completed" || settlementMode === "pay_later")) {
        setErrorMsg("In-use stock is insufficient. Confirm shelf transfer to complete now, or choose Advance Booking / Paid in Full.");
        return;
      }
    }

    if (orderUseStockItems.length > 0) {
      if (allowUseStockUsage && (settlementMode === "advance" || settlementMode === "paid_full")) {
        setErrorMsg("Salon use-stock is confirmed for immediate fulfillment. Please choose Complete or Pay Later (Due).");
        return;
      }
      if (!allowUseStockUsage && (settlementMode === "completed" || settlementMode === "pay_later")) {
        setErrorMsg("Retail stock is insufficient. Confirm salon use-stock above to fulfill now, or choose Advance Booking / Paid in Full.");
        return;
      }
    }

    if ((settlementMode === "advance" || settlementMode === "paid_full") && !bookingDate) {
      setErrorMsg("Please select the appointment / delivery date for this booking");
      return;
    }

    setShowConfirm(true);
  };

  const executeSubmitOrder = async () => {
    setShowConfirm(false);
    if (isSubmittingRef.current) return; isSubmittingRef.current = true; setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const formattedPhone = phone.trim() ? formatPhoneNumber(phone) : undefined;
      const status = hasOutOfStockItems
        ? paidAmount >= finalTotal
          ? "paid_full"
          : "advance_paid"
        : settlementMode === "completed"
          ? "completed"
          : settlementMode === "paid_full"
            ? "paid_full"
            : settlementMode === "pay_later"
              ? "created"
              : "advance_paid";

      const hasProductsOnly = selectedItems.length > 0 && selectedItems.every((i) => i.type === "product");
      const hasPackages = selectedItems.some((i) => i.type === "package");
      const resolvedOrderType: "Product sale" | "Service booking" | "Package sale" =
        hasProductsOnly
          ? "Product sale"
          : hasPackages
            ? "Package sale"
            : "Service booking";

      const resolvedBookingDate = settlementMode === "pay_later"
        ? (dueDate ? dueDate : undefined)
        : (settlementMode === "advance" || settlementMode === "paid_full")
          ? (bookingDate ? bookingDate : undefined)
          : undefined;

      const resolvedBookingTime =
        settlementMode === "advance" || settlementMode === "paid_full"
          ? (bookingTime ? bookingTime : undefined)
          : undefined;

      const clearedDueOrderIds = includePreviousDue && totalPreviousDue > 0
        ? customerDueOrders.map((o) => o.id)
        : undefined;
      const clearedDueAmount = includePreviousDue && totalPreviousDue > 0
        ? totalPreviousDue
        : undefined;

      let remainingDiscountToDistribute = calculatedDiscountAmount;
      const lineItems = selectedItems.map((item, index) => {
        const itemTotal = item.price * (item.quantity || 1);
        let itemDiscount = 0;
        if (calculatedDiscountAmount > 0 && calculatedSubtotal > 0) {
          if (index === selectedItems.length - 1) {
            itemDiscount = Math.max(0, Math.min(itemTotal, remainingDiscountToDistribute));
          } else {
            itemDiscount = Math.min(
              itemTotal,
              Math.round(calculatedDiscountAmount * (itemTotal / calculatedSubtotal))
            );
            remainingDiscountToDistribute -= itemDiscount;
          }
        }
        const itemFinalPrice = Math.max(0, itemTotal - itemDiscount);
        return {
          itemId: item.id,
          itemType: item.type,
          name: item.name,
          unitPrice: item.price,
          quantity: item.quantity,
          discount: itemDiscount,
          finalPrice: itemFinalPrice,
        };
      });

      const resolvedCustomerName = formatCustomerName(customer) || phoneConflictCustomer?.name || "Walk-in Guest";

      const extraChargeNote = extraCharge > 0 ? `Extra Charge: ₹${extraCharge}` : undefined;
      const combinedNotes = [notes.trim(), extraChargeNote].filter(Boolean).join(" | ") || undefined;

      const res = await createOrderAction({
        customerName: resolvedCustomerName,
        customerPhone: formattedPhone,
        orderType: resolvedOrderType,
        totalAmount: finalTotal,
        paidAmount: paidAmount,
        status: status,
        subtotal: calculatedSubtotal,
        discountType: discountType,
        discountValue: discountValue,
        discountAmount: calculatedDiscountAmount,
        paymentMode: paymentMode,
        bookingDate: resolvedBookingDate,
        bookingTime: resolvedBookingTime,
        notes: combinedNotes,
        lineItems,
        clearedDueOrderIds,
        clearedDueAmount,
        allowSellStockUsage,
        allowUseStockUsage,
      });

      if (res.success && res.order) {
        onAddOrder(res.order, formattedPhone, res.clearedDueOrderIds, res.updatedProducts);
        setCreatedOrderResult(res.order);
      } else {
        setErrorMsg(res.error || "Failed to save order");
      }
    } catch {
      setErrorMsg("Network error occurred while creating order");
    } finally {
      isSubmittingRef.current = false; setIsSubmitting(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="New Order"
      className="fixed inset-0 z-50 bg-galla-paper flex flex-col overflow-y-auto"
    >
      {/* ======================================================== */}
      {/* SUCCESS SCREEN OVERLAY                                   */}
      {/* ======================================================== */}
      {createdOrderResult && (
        <div className="fixed inset-0 z-50 bg-galla-paper flex items-center justify-center p-4">
          <div className="bg-galla-surface border border-galla-line rounded-[8px] p-8 max-w-md w-full text-center shadow-xl space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-3xl font-bold shadow-2xs">
              ✓
            </div>
            <div>
              <h2 className="text-xl font-bold text-galla-ink">Order Created Successfully</h2>
              <p className="text-[13px] text-galla-ink-soft mt-1">
                Order has been confirmed and saved to your register.
              </p>
            </div>

            <div className="text-[13.5px] text-galla-ink bg-galla-paper/70 p-4 rounded-[6px] border border-galla-line/60 space-y-1.5 text-left">
              <div className="flex justify-between items-center pb-1.5 border-b border-galla-line/50">
                <span className="text-galla-ink-soft text-[12.5px]">Order ID</span>
                <span className="font-semibold text-galla-ink">
                  {formatDisplayNumber(createdOrderResult.id)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-galla-ink-soft text-[12.5px]">Customer</span>
                <span className="font-medium text-galla-ink">
                  {createdOrderResult.customer}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-galla-ink-soft text-[12.5px]">Total Amount</span>
                <span className="font-bold text-galla-teal">
                  {formatRupee(createdOrderResult.amount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-galla-ink-soft text-[12.5px]">Payment Mode</span>
                <span className="font-medium text-galla-ink uppercase">
                  {createdOrderResult.paymentMode || paymentMode}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-galla-ink-soft text-[12.5px]">Settlement</span>
                <span className="font-medium text-galla-ink">
                  {createdOrderResult.status === "completed"
                    ? "Complete"
                    : createdOrderResult.status === "paid_full"
                      ? "Paid in Full (Advance)"
                      : createdOrderResult.status === "advance_paid"
                        ? `Advance: ${formatRupee(createdOrderResult.paid)}`
                        : `Due: ${formatRupee((createdOrderResult.amount || 0) - (createdOrderResult.paid || 0))}`}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3 rounded-[5px] bg-galla-teal hover:opacity-95 text-white font-semibold text-[14px] transition-all cursor-pointer shadow-sm"
            >
              Back to counter
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TOP HEADER (Sticky, covers sidebar, cancel button)       */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-30 bg-galla-surface border-b border-galla-line px-5 sm:px-8 py-3.5 flex items-center justify-between shadow-2xs shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="h-9 w-9 rounded-[6px] bg-galla-surface border border-galla-line hover:bg-galla-paper flex items-center justify-center text-galla-ink shadow-2xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
            title="Back to counter"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-[16px] font-bold text-galla-ink">New Order</h1>
        </div>

        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          className="h-9 w-9 rounded-[6px] bg-galla-surface border border-galla-line hover:bg-galla-paper flex items-center justify-center text-galla-ink shadow-2xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4">
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-[12.5px] rounded-[5px] flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-red-600 hover:text-red-800 p-0.5 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MAIN TWO-COLUMN LAYOUT:                                  */}
      {/* LEFT: Customer, Catalog Selection, Payment              */}
      {/* RIGHT: Bill Summary (Cart, Discount, Total, Create Button)*/}
      {/* ======================================================== */}
      <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start flex-1">

        {/* ====================================================== */}
        {/* RIGHT COLUMN: BILL                                     */}
        {/* ====================================================== */}
        <aside className="bg-galla-surface border border-galla-line rounded-[8px] shadow-xs overflow-hidden flex flex-col lg:sticky lg:top-[68px] lg:max-h-[calc(100vh-92px)] order-2">
          {/* Bill Header */}
          <div className="p-4 border-b border-galla-line/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold text-galla-ink">Bill</h2>
              {selectedItems.length > 0 && (
                <span className="text-[11.5px] font-medium px-2 py-0.5 rounded-full bg-galla-teal-soft text-galla-teal">
                  {selectedItems.length} {selectedItems.length === 1 ? "item" : "items"}
                </span>
              )}
            </div>
            {selectedItems.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedItems([])}
                className="text-[12px] text-galla-ink-soft hover:text-rose-600 transition-colors cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Selected Items List */}
          <div className="flex-1 overflow-y-auto p-3 divide-y divide-galla-line/40 min-h-[140px] max-h-[300px] lg:max-h-[360px]">
            {selectedItems.length === 0 ? (
              <div className="py-12 text-center text-galla-ink-soft border border-dashed border-galla-line rounded-[5px] bg-galla-paper/30">
                <p className="text-[13px] font-medium">No items added yet</p>
                <p className="text-[11.5px] mt-0.5">Select services, packages, or products from the catalog on the left</p>
              </div>
            ) : (
              selectedItems.map((item) => {
                const itemTotal = item.price * (item.quantity || 1);
                return (
                  <div key={`${item.type}-${item.id}`} className="py-2.5 flex items-center gap-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-medium text-galla-ink truncate">{item.name}</span>
                        {item.type === "package" && (
                          <span className="text-[10px] font-medium bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded-[4px] shrink-0">
                            Package
                          </span>
                        )}
                        {item.type === "product" && higherMarginProductsMap.get(String(item.id))?.isHigher && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded-[4px] shrink-0 shadow-2xs"
                            title={`Higher profit margin: ${formatRupee(higherMarginProductsMap.get(String(item.id))!.margin)} per unit (+${formatRupee(higherMarginProductsMap.get(String(item.id))!.diff)} vs other batch)`}
                          >
                            <TrendingUp className="h-2.5 w-2.5 text-emerald-600 shrink-0" />
                            <span>More Margin</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-galla-ink-soft tabular-nums mt-0.5">
                        <span>{formatRupee(item.price)} each</span>
                        {item.type === "package" && (() => {
                          const pkg = packages.find((p) => p.id === item.id);
                          if (!pkg) return null;
                          return (
                            <button
                              type="button"
                              onClick={() => setViewingPackage(pkg)}
                              className="inline-flex items-center gap-0.5 text-[10.5px] font-medium text-galla-teal hover:underline cursor-pointer"
                              title={`View services included in ${pkg.name}`}
                            >
                              <Eye className="h-2.5 w-2.5" />
                              <span>View</span>
                            </button>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center border border-galla-line rounded-[5px] bg-galla-paper/40 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.id, item.type, -1)}
                        className="w-7 h-7 flex items-center justify-center text-galla-ink-soft hover:text-galla-ink cursor-pointer hover:bg-galla-paper rounded-l-[4px] transition-colors"
                      >
                        -
                      </button>
                      <span className="w-7 text-center text-[12px] font-semibold text-galla-ink tabular-nums">
                        {item.quantity || 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.id, item.type, 1)}
                        className="w-7 h-7 flex items-center justify-center text-galla-ink-soft hover:text-galla-ink cursor-pointer hover:bg-galla-paper rounded-r-[4px] transition-colors"
                      >
                        +
                      </button>
                    </div>

                    {/* Total for item */}
                    <div className="text-[13px] font-semibold text-galla-ink tabular-nums text-right min-w-[56px] shrink-0">
                      {formatRupee(itemTotal)}
                    </div>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id, item.type)}
                      className="text-galla-ink-soft/60 hover:text-rose-600 p-1 cursor-pointer transition-colors shrink-0"
                      title="Remove item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Bill Footer & Financials */}
          <div className="p-4 border-t border-galla-line/60 bg-galla-surface space-y-3 shrink-0">
            {/* Previous Due Alert & Opt-in */}
            {customerDueOrders.length > 0 && settlementMode !== "pay_later" && (
              <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-[5px] text-[12px] space-y-1.5">
                <div className="text-amber-900 font-medium">
                  Previous unpaid due: <strong className="text-rose-700">{formatRupee(totalPreviousDue)}</strong>
                </div>
                <label className="flex items-center gap-2 font-medium text-galla-ink cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includePreviousDue}
                    onChange={(e) => setIncludePreviousDue(e.target.checked)}
                    className="h-4 w-4 rounded-[4px] border-amber-400 text-galla-teal focus:ring-galla-teal cursor-pointer shrink-0"
                  />
                  <span>Add previous due to this bill</span>
                </label>
              </div>
            )}

            {/* Discount Row */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[12px]">
                <label className="font-medium text-galla-ink">Discount</label>
                <span className="text-galla-ink-soft text-[11px]">
                  {discountType === "percentage" ? "Percentage (%)" : "Flat (₹)"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ""))}
                  placeholder={discountType === "percentage" ? "e.g. 10%" : "e.g. 100"}
                  className="flex-1 bg-galla-surface border border-galla-line rounded-[5px] px-3 py-1.5 text-[13px] text-galla-ink tabular-nums focus:outline-none focus:border-galla-teal transition-all shadow-2xs"
                />
                <div className="inline-flex border border-galla-line rounded-[5px] p-0.5 bg-galla-paper/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDiscountType("percentage")}
                    className={`px-2.5 py-1 text-[12px] font-semibold rounded-[4px] transition-colors cursor-pointer ${discountType === "percentage"
                      ? "bg-galla-teal text-white shadow-2xs"
                      : "text-galla-ink-soft hover:text-galla-ink"
                      }`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType("flat")}
                    className={`px-2.5 py-1 text-[12px] font-semibold rounded-[4px] transition-colors cursor-pointer ${discountType === "flat"
                      ? "bg-galla-teal text-white shadow-2xs"
                      : "text-galla-ink-soft hover:text-galla-ink"
                      }`}
                  >
                    ₹
                  </button>
                </div>
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="pt-2 border-t border-galla-line/50 space-y-1 text-[12.5px]">
              <div className="flex justify-between text-galla-ink-soft">
                <span>Subtotal</span>
                <span className="tabular-nums font-medium text-galla-ink">{formatRupee(calculatedSubtotal)}</span>
              </div>

              {calculatedDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount</span>
                  <span className="tabular-nums font-medium">&minus; {formatRupee(calculatedDiscountAmount)}</span>
                </div>
              )}

              {includePreviousDue && totalPreviousDue > 0 && (
                <div className="flex justify-between text-amber-800">
                  <span>Previous Dues Added</span>
                  <span className="tabular-nums font-medium">+ {formatRupee(totalPreviousDue)}</span>
                </div>
              )}

              {extraCharge > 0 && (
                <div className="flex justify-between text-amber-800">
                  <div className="flex items-center gap-1.5">
                    <span>Extra Charge</span>
                    <button
                      type="button"
                      onClick={() => {
                        setExtraCharge(0);
                        setTotalInput(String(baseOrderTotal));
                        setIsEditingTotal(false);
                      }}
                      className="text-[10.5px] text-galla-ink-soft hover:text-rose-600 underline cursor-pointer"
                      title="Reset extra charge"
                    >
                      Reset
                    </button>
                  </div>
                  <span className="tabular-nums font-medium">+ {formatRupee(extraCharge)}</span>
                </div>
              )}

              {/* Editable Total Field */}
              <div className="pt-2 border-t border-galla-line space-y-1">
                <div className="flex justify-between items-center text-[15px] font-bold text-galla-ink">
                  <div className="flex flex-col">
                    <span>Total</span>
                  </div>
                  <div className="relative flex items-center w-36">
                    <span className="absolute left-2.5 text-[15px] font-bold text-galla-teal select-none pointer-events-none">
                      ₹
                    </span>
                    <input
                      type="text"
                      value={isEditingTotal ? totalInput : (finalTotal > 0 ? String(finalTotal) : "0")}
                      onFocus={() => {
                        setIsEditingTotal(true);
                        setTotalInput(String(finalTotal));
                      }}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        setTotalInput(raw);
                        if (raw !== "") {
                          const val = Number(raw);
                          if (val >= baseOrderTotal) {
                            setExtraCharge(val - baseOrderTotal);
                          } else {
                            setExtraCharge(0);
                          }
                        } else {
                          setExtraCharge(0);
                        }
                      }}
                      onBlur={() => {
                        setIsEditingTotal(false);
                        if (totalInput !== "") {
                          const val = Number(totalInput);
                          if (val < baseOrderTotal) {
                            setExtraCharge(0);
                            setTotalInput(String(baseOrderTotal));
                          } else {
                            setExtraCharge(val - baseOrderTotal);
                            setTotalInput(String(val));
                          }
                        } else {
                          setExtraCharge(0);
                          setTotalInput(String(baseOrderTotal));
                        }
                      }}
                      placeholder={String(baseOrderTotal)}
                      disabled={selectedItems.length === 0}
                      className={`w-full pl-6 pr-2.5 py-1.5 text-right text-[17px] font-bold tabular-nums rounded-[5px] border transition-all focus:outline-none shadow-2xs ${
                        isTotalBelowBase
                          ? "border-rose-400 bg-rose-50/50 text-rose-700 focus:border-rose-500 ring-1 ring-rose-300"
                          : extraCharge > 0
                          ? "border-amber-300 bg-amber-50/40 text-galla-teal focus:border-amber-400 ring-1 ring-amber-200"
                          : "border-galla-line bg-galla-surface text-galla-teal focus:border-galla-teal focus:ring-1 focus:ring-galla-teal"
                      } disabled:opacity-50 disabled:bg-galla-paper/50 cursor-text`}
                    />
                  </div>
                </div>
                {isTotalBelowBase && (
                  <p className="text-[11px] text-rose-600 text-center font-medium">
                    Total cannot be less than order amount ({formatRupee(baseOrderTotal)}). Use the Discount field for discounts.
                  </p>
                )}
              </div>

              {/* Settlement specifics */}
              {settlementMode === "advance" && (
                <div className="pt-1.5 text-[11.5px] space-y-0.5">
                  <div className="flex justify-between text-teal-800 font-medium">
                    <span>Advance Paid Now</span>
                    <span className="tabular-nums">{formatRupee(paidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-rose-700 font-semibold">
                    <span>Balance Due Later</span>
                    <span className="tabular-nums">{formatRupee(amountPending)}</span>
                  </div>
                </div>
              )}

              {settlementMode === "pay_later" && (
                <div className="pt-1.5 text-[11.5px] space-y-0.5">
                  <div className="flex justify-between text-galla-ink font-medium">
                    <span>Paid Upfront</span>
                    <span className="tabular-nums">{formatRupee(paidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-rose-700 font-semibold">
                    <span>Pending Due</span>
                    <span className="tabular-nums">{formatRupee(amountPending)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Create Order Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleFinalSubmit()}
                disabled={
                  isSubmitting ||
                  selectedItems.length === 0 ||
                  !customer.trim() ||
                  getPhoneDigits(phone).length < 10 ||
                  isTotalBelowBase
                }
                className="w-full py-3 rounded-[5px] bg-galla-teal hover:opacity-95 text-white font-semibold text-[14px] shadow-sm disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2 transition-all"
              >
                {isSubmitting ? (
                  <span>Creating order...</span>
                ) : (
                  <span>
                    Create order {selectedItems.length > 0 && finalTotal > 0 ? `(${formatRupee(finalTotal)})` : ""}
                  </span>
                )}
              </button>

              {!customer.trim() && selectedItems.length > 0 && (
                <p className="text-[11.5px] text-galla-ink-soft text-center mt-1.5">
                  Enter customer name on the left to complete order
                </p>
              )}
              {customer.trim() && getPhoneDigits(phone).length < 10 && selectedItems.length > 0 && (
                <p className="text-[11.5px] text-galla-ink-soft text-center mt-1.5">
                  Enter a valid 10-digit mobile number to complete order
                </p>
              )}
              {selectedItems.length === 0 && (
                <p className="text-[11.5px] text-galla-ink-soft text-center mt-1.5">
                  Select at least one item from the catalog
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* ====================================================== */}
        {/* LEFT COLUMN: CUSTOMER, CATALOG & PAYMENT               */}
        {/* ====================================================== */}
        <main className="space-y-5 min-w-0 order-1">

          {/* Card 1: Customer Details */}
          <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-4">
            <h2 className="text-[14px] font-bold text-galla-ink uppercase tracking-wider">
              1. Customer
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Customer Name with Autocomplete */}
              <div className="relative" ref={dropdownRef}>
                <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  autoFocus
                  type="text"
                  value={customer}
                  onChange={(e) => {
                    setCustomer(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    if (customer.trim()) {
                      setCustomer(formatCustomerName(customer));
                    }
                  }}
                  placeholder="e.g. John Doe"
                  className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-2 font-sans text-[13.5px] font-medium text-galla-ink placeholder:text-galla-ink-soft/60 focus:outline-none focus:border-galla-teal transition-all shadow-2xs"
                />

                {/* Autocomplete Suggestions */}
                {showSuggestions && filteredCustomers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-galla-surface border border-galla-line rounded-[6px] shadow-lg z-20 overflow-hidden divide-y divide-galla-line/40">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCustomer(c.name);
                          if (c.phone) setPhone(formatPhoneNumber(c.phone));
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-galla-paper/70 flex items-center justify-between text-[12.5px] cursor-pointer transition-colors"
                      >
                        <span className="font-semibold text-galla-ink">{c.name}</span>
                        <span className="text-galla-ink-soft font-mono text-[11px]">{c.phone ? formatPhoneNumber(c.phone) : "No phone"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Phone */}
              <div>
                <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  maxLength={15}
                  value={phone}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!raw.trim()) {
                      setPhone("");
                      return;
                    }
                    let s = raw.trim();
                    if (s.startsWith("+91") || s.startsWith("+ 91")) {
                      s = s.replace(/^\+\s*91[\s-]*/, "");
                    }
                    const rawDigits = s.replace(/\D/g, "");
                    if (!rawDigits) {
                      setPhone("");
                      return;
                    }
                    // Limit strictly to 10 digits
                    const digits = rawDigits.slice(0, 10);
                    const formatted = formatPhoneNumber(digits);
                    setPhone(formatted);
                    if (digits.length === 10) {
                      const matched = customers.find(
                        (c) => getPhoneDigits(c.phone) === digits
                      );
                      if (matched && !customer.trim()) {
                        setCustomer(matched.name);
                      }
                    }
                  }}
                  onBlur={() => {
                    if (phone.trim()) {
                      const digits = getPhoneDigits(phone).slice(0, 10);
                      setPhone(digits ? formatPhoneNumber(digits) : "");
                    }
                  }}
                  placeholder="+91 98765 43210"
                  className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-2 font-sans tabular-nums text-[13.5px] font-medium text-galla-ink placeholder:text-galla-ink-soft/60 focus:outline-none focus:border-galla-teal transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Phone conflict banner */}
            {phoneConflictCustomer && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-[5px] text-[12px] flex items-center justify-between">
                <span>
                  Phone belongs to existing customer: <strong>{phoneConflictCustomer.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setCustomer(phoneConflictCustomer.name)}
                  className="text-galla-teal font-semibold hover:underline cursor-pointer ml-2"
                >
                  Use {phoneConflictCustomer.name}
                </button>
              </div>
            )}
          </section>

          {/* Card 2: Catalog Selection */}
          <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-[14px] font-bold text-galla-ink uppercase tracking-wider">
                2. Catalog Selection
              </h2>

              {/* All 3 Catalog Tabs */}
              <div className="inline-flex border border-galla-line rounded-[5px] p-1 bg-galla-paper/70 self-start sm:self-auto gap-1">
                <button
                  type="button"
                  onClick={() => setCatalogTab("services")}
                  className={`px-3.5 py-1.5 text-[12px] font-sans font-medium rounded-[4px] transition-all cursor-pointer ${catalogTab === "services"
                    ? "bg-galla-teal text-white shadow-xs font-semibold"
                    : "text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper"
                    }`}
                >
                  Services ({services.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogTab("packages")}
                  className={`px-3.5 py-1.5 text-[12px] font-sans font-medium rounded-[4px] transition-all cursor-pointer ${catalogTab === "packages"
                    ? "bg-galla-teal text-white shadow-xs font-semibold"
                    : "text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper"
                    }`}
                >
                  Packages ({packages.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCatalogTab("products");
                    fetchLiveProducts();
                  }}
                  className={`px-3.5 py-1.5 text-[12px] font-sans font-medium rounded-[4px] transition-all cursor-pointer ${catalogTab === "products"
                    ? "bg-galla-teal text-white shadow-xs font-semibold"
                    : "text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper"
                    }`}
                >
                  Products ({liveProducts.length})
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-galla-ink-soft/70" />
              <input
                type="search"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder={
                  catalogTab === "products"
                    ? "Search products by name or category..."
                    : catalogTab === "packages"
                      ? "Search bundled packages..."
                      : "Search services by name or category..."
                }
                className="w-full bg-galla-surface border border-galla-line rounded-[5px] pl-9 pr-3 py-2 text-[13px] font-medium text-galla-ink placeholder:text-galla-ink-soft/60 focus:outline-none focus:border-galla-teal transition-all shadow-2xs"
              />
            </div>

            {/* Catalog Items List */}
            <div className="border border-galla-line rounded-[6px] overflow-hidden divide-y divide-galla-line/40 max-h-[420px] overflow-y-auto bg-galla-paper/10">
              {/* Product Sale View */}
              {catalogTab === "products" && (
                filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-galla-ink-soft">
                    No products found matching your search.
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const isSelected = selectedItems.some((i) => i.id === String(p.id) && i.type === "product");
                    const price = p.price || 0;
                    const isOutOfStock = (p.sell || 0) <= 0;

                    return (
                      <div
                        key={p.id}
                        onClick={() =>
                          handleToggleItem({
                            id: String(p.id),
                            type: "product",
                            name: p.name,
                            price: price,
                          })
                        }
                        className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${isSelected
                          ? "bg-galla-teal/8 hover:bg-galla-teal/12"
                          : "hover:bg-galla-paper/60"
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all shrink-0 ${isSelected
                              ? "bg-galla-teal border-galla-teal text-white"
                              : "border-galla-line bg-galla-surface"
                              }`}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-[13.5px] text-galla-ink truncate">
                                {p.name}
                              </span>
                              {isOutOfStock ? (
                                (p.use || 0) > 0 ? (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-blue-50 text-blue-800 border border-blue-200">
                                    0 shelf &bull; {p.use} in salon use
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-rose-50 text-rose-800 border border-rose-200">
                                    Out of Stock &bull; Pre-order only
                                  </span>
                                )
                              ) : (
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  {p.sell} in stock
                                </span>
                              )}
                              {higherMarginProductsMap.get(String(p.id))?.isHigher && (
                                <span
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs"
                                  title={`Higher profit margin: ${formatRupee(higherMarginProductsMap.get(String(p.id))!.margin)} per unit (+${formatRupee(higherMarginProductsMap.get(String(p.id))!.diff)} vs other batch)`}
                                >
                                  <TrendingUp className="h-3 w-3 text-emerald-600 shrink-0" />
                                  <span>
                                    More Margin
                                    {higherMarginProductsMap.get(String(p.id))!.diff > 0
                                      ? ` (+${formatRupee(higherMarginProductsMap.get(String(p.id))!.diff)})`
                                      : ""}
                                  </span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11.5px] text-galla-ink-soft mt-0.5">
                              {p.category || "Retail"}
                            </div>
                          </div>
                        </div>

                        <div className="font-bold text-[14px] text-galla-ink tabular-nums shrink-0 ml-3">
                          {formatRupee(price)}
                        </div>
                      </div>
                    );
                  })
                )
              )}

              {/* Service Booking: Services View */}
              {catalogTab === "services" && (
                filteredServices.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-galla-ink-soft">
                    No services found matching your search.
                  </div>
                ) : (
                  filteredServices.map((s) => {
                    const isSelected = selectedItems.some((i) => i.id === s.id && i.type === "service");
                    const stockInfo = getServiceStockInfo(s, liveProducts);

                    return (
                      <div
                        key={s.id}
                        onClick={() =>
                          handleToggleItem({
                            id: s.id,
                            type: "service",
                            name: s.name,
                            price: s.price,
                          })
                        }
                        className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${isSelected
                          ? "bg-galla-teal/8 hover:bg-galla-teal/12"
                          : "hover:bg-galla-paper/60"
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all shrink-0 ${isSelected
                              ? "bg-galla-teal border-galla-teal text-white"
                              : "border-galla-line bg-galla-surface"
                              }`}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-[13.5px] text-galla-ink truncate">
                                {s.name}
                              </span>
                              {stockInfo.hasProducts && (
                                stockInfo.isOutOfStock ? (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-rose-50 text-rose-800 border border-rose-200">
                                    Out of Stock
                                  </span>
                                ) : stockInfo.needsSellStock ? (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-amber-50 text-amber-800 border border-amber-200">
                                    In-use short &bull; shelf available
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    In Stock
                                  </span>
                                )
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11.5px] text-galla-ink-soft mt-0.5">
                              {s.category && (
                                <span className="bg-galla-paper px-1.5 py-0.5 rounded-[4px] border border-galla-line/60">
                                  {s.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="font-bold text-[14px] text-galla-ink tabular-nums shrink-0 ml-3">
                          {formatRupee(s.price)}
                        </div>
                      </div>
                    );
                  })
                )
              )}

              {/* Service Booking: Packages View */}
              {catalogTab === "packages" && (
                filteredPackages.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-galla-ink-soft">
                    No packages found matching your search.
                  </div>
                ) : (
                  filteredPackages.map((pkg) => {
                    const isSelected = selectedItems.some((i) => i.id === pkg.id && i.type === "package");
                    const price = pkg.packagePrice || 0;
                    const stockInfo = getPackageStockInfo(pkg, liveProducts, services);

                    return (
                      <div
                        key={pkg.id}
                        onClick={() =>
                          handleToggleItem({
                            id: pkg.id,
                            type: "package",
                            name: pkg.name,
                            price: price,
                          })
                        }
                        className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${isSelected
                          ? "bg-galla-teal/8 hover:bg-galla-teal/12"
                          : "hover:bg-galla-paper/60"
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all shrink-0 ${isSelected
                              ? "bg-galla-teal border-galla-teal text-white"
                              : "border-galla-line bg-galla-surface"
                              }`}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-[13.5px] text-galla-ink truncate">
                                {pkg.name}
                              </span>
                              {stockInfo.hasProducts && (
                                stockInfo.isOutOfStock ? (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-rose-50 text-rose-800 border border-rose-200">
                                    Out of Stock
                                  </span>
                                ) : stockInfo.needsSellStock ? (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-amber-50 text-amber-800 border border-amber-200">
                                    In-use short &bull; shelf available
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    In Stock
                                  </span>
                                )
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11.5px] text-galla-ink-soft mt-0.5">
                              <span>
                                {pkg.services.length} {pkg.services.length === 1 ? "service" : "services"}
                                {pkg.products && pkg.products.length > 0 && ` • ${pkg.products.length} product${pkg.products.length > 1 ? "s" : ""}`}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingPackage(pkg);
                                }}
                                className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-galla-teal hover:text-galla-teal/80 bg-galla-teal/10 hover:bg-galla-teal/15 px-2 py-0.5 rounded-[4px] border border-galla-teal/20 transition-all cursor-pointer shadow-2xs"
                                title={`View all services and items included in ${pkg.name}`}
                              >
                                <Eye className="h-3 w-3" />
                                <span>View</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="font-bold text-[14px] text-galla-ink tabular-nums shrink-0 ml-3">
                          {formatRupee(price)}
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>
          </section>

          {/* Card 3: Payment & Settlement */}
          <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-4">
            <h2 className="text-[14px] font-bold text-galla-ink uppercase tracking-wider">
              3. Payment &amp; Settlement
            </h2>

            {/* Retail Shelf Stock Transfer Opt-in (if services/packages need shelf backup) */}
            {orderSellStockItems.length > 0 && (
              <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-[6px] text-[12px] space-y-2">
                <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
                  <span>Transfer Shelf Stock to In-Use?</span>
                </div>
                <p className="text-amber-900 leading-snug">
                  Some services require products that are low in operational stock, but available on your retail shelf:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {orderSellStockItems.map((it) => (
                    <span key={it.name} className="px-2 py-0.5 bg-amber-100/90 text-amber-950 font-medium rounded-[4px] border border-amber-300/80">
                      {it.neededFromSell}x {it.name}
                    </span>
                  ))}
                </div>
                <label className="flex items-center gap-2 pt-1 font-semibold text-amber-950 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allowSellStockUsage}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAllowSellStockUsage(checked);
                      if (checked) {
                        if (settlementMode === "advance" || settlementMode === "paid_full") {
                          setSettlementMode("completed");
                        }
                      } else {
                        if (settlementMode === "completed" || settlementMode === "pay_later") {
                          setSettlementMode("advance");
                        }
                      }
                    }}
                    className="h-4 w-4 rounded-[4px] border-amber-400 text-galla-teal focus:ring-galla-teal cursor-pointer"
                  />
                  <span>Confirm transfer from retail shelf inventory for this order</span>
                </label>
              </div>
            )}

            {/* Salon Use-Stock Transfer Opt-in (if retail products need salon use stock backup) */}
            {orderUseStockItems.length > 0 && (
              <div className="p-3.5 bg-blue-50/80 border border-blue-300 rounded-[6px] text-[12px] space-y-2">
                <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-blue-700 shrink-0" />
                  <span>Sell from Salon Use-Stock?</span>
                </div>
                <p className="text-blue-900 leading-snug">
                  Some products are out of retail shelf stock, but available in salon operational use stock:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {orderUseStockItems.map((it) => (
                    <span key={it.id} className="px-2 py-0.5 bg-blue-100/90 text-blue-950 font-medium rounded-[4px] border border-blue-300/80">
                      {it.neededFromUse}x {it.name} (from salon use)
                    </span>
                  ))}
                </div>
                <label className="flex items-center gap-2 pt-1 font-semibold text-blue-950 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allowUseStockUsage}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAllowUseStockUsage(checked);
                      if (checked) {
                        if (settlementMode === "advance" || settlementMode === "paid_full") {
                          setSettlementMode("completed");
                        }
                      } else {
                        if (settlementMode === "completed" || settlementMode === "pay_later") {
                          setSettlementMode("advance");
                        }
                      }
                    }}
                    className="h-4 w-4 rounded-[4px] border-blue-400 text-galla-teal focus:ring-galla-teal cursor-pointer"
                  />
                  <span>Fulfill this sale using salon operational use-stock</span>
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Settlement Mode Dropdown */}
              <SettlementModeSelect
                value={settlementMode}
                onChange={setSettlementMode}
                hasOutOfStockItems={hasOutOfStockItems}
                needsSellStock={orderSellStockItems.length > 0}
                allowSellStockUsage={allowSellStockUsage}
                needsUseStock={orderUseStockItems.length > 0}
                allowUseStockUsage={allowUseStockUsage}
              />

              {/* Payment Mode Dropdown */}
              <PaymentModeSelect
                label="Payment Mode"
                value={paymentMode}
                onChange={(val) => setPaymentMode(val as "cash" | "upi" | "card")}
                allowedModes={["cash", "upi", "card"]}
              />
            </div>

            {/* Dynamic Settlement Fields */}
            {settlementMode === "advance" && (
              <div className="p-4 bg-teal-50/40 border border-teal-200/80 rounded-[6px] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                      Advance Deposit Amount (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={advance}
                      onChange={(e) => setAdvance(e.target.value.replace(/\D/g, ""))}
                      placeholder="e.g. 500"
                      className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-1.5 text-[13px] text-galla-ink tabular-nums font-semibold focus:outline-none focus:border-galla-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                      Appointment / Delivery Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-1.5 text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal"
                    />
                  </div>
                </div>
              </div>
            )}

            {settlementMode === "pay_later" && (
              <div className="p-4 bg-amber-50/40 border border-amber-200/80 rounded-[6px] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                      Amount Paid Now (₹) <span className="text-galla-ink-soft/70 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={payLaterPaid}
                      onChange={(e) => setPayLaterPaid(e.target.value.replace(/\D/g, ""))}
                      placeholder={`0 (Full ${formatRupee(finalTotal)} due later)`}
                      className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-1.5 text-[13px] text-galla-ink tabular-nums font-semibold focus:outline-none focus:border-galla-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                      Payment Due Date <span className="text-galla-ink-soft/70 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-1.5 text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal"
                    />
                  </div>
                </div>
              </div>
            )}

            {settlementMode === "paid_full" && (
              <div className="p-4 bg-indigo-50/40 border border-indigo-200/80 rounded-[6px] space-y-3">
                <div>
                  <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                    Appointment / Delivery Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-1.5 text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal"
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                Notes <span className="text-galla-ink-soft/70 font-normal">(Optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Client requested herbal wash, allergic to chemical dye"
                className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-2 text-[13px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal transition-all shadow-2xs"
              />
            </div>
          </section>
        </main>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirm}
        title="Confirm New Order"
        description={
          <div className="space-y-2 text-left">
            <span>
              Create order for <strong className="font-semibold text-galla-ink">{formatCustomerName(customer)}</strong>
              {phone.trim() ? <> (<strong className="font-mono">{formatPhoneNumber(phone)}</strong>)</> : null} for{" "}
              <strong className="font-semibold text-galla-ink">{formatRupee(finalTotal)}</strong>
              {includePreviousDue && totalPreviousDue > 0 ? (
                <>, including previous due of <strong className="font-semibold text-rose-700">{formatRupee(totalPreviousDue)}</strong></>
              ) : null} via <strong className="font-semibold text-galla-ink">{paymentMode.toUpperCase()}</strong>?
            </span>

            {allowSellStockUsage && orderSellStockItems.length > 0 && (
              <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-[5px] text-[12px] text-amber-950">
                <strong>Retail Shelf Stock Transfer:</strong>
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  {orderSellStockItems.map((it) => (
                    <li key={it.name}>
                      {it.neededFromSell}x {it.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {allowUseStockUsage && orderUseStockItems.length > 0 && (
              <div className="mt-2 p-2.5 bg-blue-50 border border-blue-300 rounded-[5px] text-[12px] text-blue-950">
                <strong>Salon Use-Stock Fulfillment:</strong>
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  {orderUseStockItems.map((it) => (
                    <li key={it.id}>
                      {it.neededFromUse}x {it.name} (from salon use)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        }
        confirmLabel="Confirm Order"
        isLoading={isSubmitting}
        onConfirm={executeSubmitOrder}
        onClose={() => setShowConfirm(false)}
      />

      {/* Inspect Past Order Details Modal */}
      {inspectingOrder && (
        <OrderDetailsModal
          order={inspectingOrder}
          isOpen={Boolean(inspectingOrder)}
          onClose={() => setInspectingOrder(null)}
          zIndex="z-[70]"
        />
      )}

      {/* View Package Services Modal */}
      {viewingPackage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150"
          onClick={() => setViewingPackage(null)}
        >
          <div
            className="w-full max-w-[480px] bg-galla-surface border border-galla-line rounded-[8px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-galla-line bg-galla-paper/50 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-[6px] bg-galla-teal/10 border border-galla-teal/20 flex items-center justify-center text-galla-teal shrink-0">
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold text-galla-ink truncate leading-tight">
                    {viewingPackage.name}
                  </h3>
                  <p className="text-[11.5px] text-galla-ink-soft mt-0.5">
                    Package Details &amp; Included Services
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingPackage(null)}
                className="text-galla-ink-soft hover:text-galla-ink p-1 rounded-[4px] transition-colors cursor-pointer"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Price & Summary Info Banner */}
            <div className="px-5 py-3 bg-galla-paper/20 border-b border-galla-line/60 flex items-center justify-between gap-3 shrink-0">
              <div>
                <span className="text-[11px] text-galla-ink-soft uppercase tracking-wider font-semibold block">
                  Package Price
                </span>
                <span className="text-[18px] font-bold text-galla-ink tabular-nums">
                  {formatRupee(viewingPackage.packagePrice || 0)}
                </span>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-galla-teal/10 border border-galla-teal/20 text-galla-teal text-[12px] font-semibold">
                  <Check className="h-3 w-3 stroke-[2.5]" />
                  {viewingPackage.services.length} {viewingPackage.services.length === 1 ? "Service" : "Services"} Included
                </span>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {viewingPackage.description && (
                <div className="text-[12.5px] text-galla-ink-soft bg-galla-paper/50 p-3 rounded-[5px] border border-galla-line/70">
                  <p className="leading-relaxed">{viewingPackage.description}</p>
                </div>
              )}

              <div>
                <h4 className="text-[12.5px] font-bold text-galla-ink uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span>Provided Services</span>
                  <span className="text-[11px] font-normal text-galla-ink-soft">
                    ({viewingPackage.services.length})
                  </span>
                </h4>

                <div className="border border-galla-line/80 rounded-[6px] divide-y divide-galla-line/60 overflow-hidden bg-galla-surface">
                  {viewingPackage.services.map((svc, idx) => {
                    const fullService = services.find((s) => s.id === svc.serviceId);
                    return (
                      <div
                        key={svc.serviceId || idx}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-galla-paper/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-6 w-6 rounded-full bg-galla-paper border border-galla-line flex items-center justify-center text-[11px] font-bold text-galla-ink-soft shrink-0 tabular-nums">
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-galla-ink truncate">
                              {svc.name}
                            </div>
                            {fullService && fullService.category && (
                              <div className="text-[11px] text-galla-ink-soft flex items-center gap-1.5 mt-0.5">
                                <span className="px-1.5 py-0.2 rounded-[4px] bg-galla-paper text-galla-ink-soft border border-galla-line/60">
                                  {fullService.category}
                                </span>
                                {fullService.description && (
                                  <span className="truncate max-w-[240px] italic">
                                    {fullService.description}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {svc.componentPrice > 0 && (
                          <div className="text-[12.5px] font-semibold text-galla-ink tabular-nums shrink-0">
                            {formatRupee(svc.componentPrice)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {viewingPackage.products && viewingPackage.products.length > 0 && (
                <div>
                  <h4 className="text-[12.5px] font-bold text-galla-ink uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span>Included Products / Materials</span>
                    <span className="text-[11px] font-normal text-galla-ink-soft">
                      ({viewingPackage.products.length})
                    </span>
                  </h4>
                  <div className="border border-galla-line/80 rounded-[6px] divide-y divide-galla-line/60 overflow-hidden bg-galla-surface">
                    {viewingPackage.products.map((prod, pIdx) => (
                      <div
                        key={prod.productId || pIdx}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-galla-paper/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-6 w-6 rounded-full bg-galla-paper border border-galla-line flex items-center justify-center text-[11px] font-bold text-galla-ink-soft shrink-0 tabular-nums">
                            {pIdx + 1}
                          </div>
                          <div className="text-[13px] font-medium text-galla-ink truncate">
                            {prod.name}
                          </div>
                        </div>
                        <div className="text-[11.5px] font-medium text-galla-ink-soft px-2 py-0.5 bg-galla-paper rounded-[4px] border border-galla-line shrink-0">
                          Qty: {prod.quantity}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-galla-line bg-galla-paper/40 flex items-center justify-between gap-3 shrink-0">
              {selectedItems.some((i) => i.id === viewingPackage.id && i.type === "package") ? (
                <div className="flex items-center gap-1.5 text-emerald-800 text-[12.5px] font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Added to Current Order</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    handleToggleItem({
                      id: viewingPackage.id,
                      type: "package",
                      name: viewingPackage.name,
                      price: viewingPackage.packagePrice || 0,
                    });
                    setViewingPackage(null);
                  }}
                  className="px-4 py-2 rounded-[5px] bg-galla-teal hover:opacity-95 text-white font-medium text-[13px] transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Package to Order</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingPackage(null)}
                className="px-4 py-2 rounded-[5px] border border-galla-line bg-galla-surface hover:bg-galla-paper text-galla-ink font-medium text-[13px] transition-colors cursor-pointer ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
