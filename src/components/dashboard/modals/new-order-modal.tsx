"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  X,
  AlertCircle,
  Scissors,
  Package,
  Search,
  Check,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Banknote,
  QrCode,
  CreditCard,
  Plus,
  Calendar,
  ShoppingBag,
} from "lucide-react";
import {
  DashboardCustomer,
  DashboardOrder,
  DashboardService,
  DashboardPackage,
  DashboardProduct,
} from "@/types/dashboard";
import { createOrderAction, getLiveProductsAction } from "@/app/dashboard/actions";
import { formatPhoneNumber, formatRupee, formatBookingDate, formatAppointmentTime, getLocalDateString } from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";

function getPhoneDigits(val: string): string {
  const digits = val.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export interface SelectedOrderItem {
  id: string;
  type: "service" | "package" | "product";
  name: string;
  price: number;
  quantity: number;
}

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddOrder: (order: DashboardOrder, customerPhone?: string, clearedDueOrderIds?: string[]) => void;
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
  // Step 1: Customer & Order Type, Step 2: Catalog Selection, Step 3: Review & Checkout
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 State
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [orderType, setOrderType] = useState<"Service booking" | "Product sale">("Service booking");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Step 2 State
  const [catalogTab, setCatalogTab] = useState<"services" | "packages" | "products">("services");
  const activeCatalogTab = orderType === "Product sale" ? "products" : (catalogTab === "products" ? "services" : catalogTab);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<SelectedOrderItem[]>([]);
  const [liveProducts, setLiveProducts] = useState<DashboardProduct[]>(initialProducts);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Fetch live products on open and dropdown interaction to bypass stale cache
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

  // Step 3 State
  const [customPrice, setCustomPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card">("cash");
  const [settlementMode, setSettlementMode] = useState<"completed" | "pay_later" | "advance" | "paid_full">("completed");
  const [payLaterPaid, setPayLaterPaid] = useState("");
  const [advance, setAdvance] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [includePreviousDue, setIncludePreviousDue] = useState(false);
  const [bookingDate, setBookingDate] = useState(() => getLocalDateString());
  const [bookingTime, setBookingTime] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Filter customers by name query
  const filteredCustomers = useMemo(() => {
    const query = customer.trim().toLowerCase();
    if (!query || !customers || customers.length === 0) return [];

    return customers
      .filter((c) => c && c.name && c.name.toLowerCase().includes(query))
      .slice(0, 5);
  }, [customer, customers]);

  // Check if phone matches an existing customer with a different name
  const phoneConflictCustomer = useMemo(() => {
    const digits = getPhoneDigits(phone);
    if (digits.length !== 10 || !customers || customers.length === 0) return null;

    const match = customers.find((c) => getPhoneDigits(c.phone) === digits);
    if (!match) return null;

    const currentName = customer.trim().toLowerCase();
    const registeredName = (match.name || "").trim().toLowerCase();

    if (currentName && registeredName && currentName !== registeredName) {
      return match;
    }
    return null;
  }, [phone, customer, customers]);

  // Outside click listener for customer autocomplete
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        nameInputRef.current &&
        !nameInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter active catalog items
  const filteredServices = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return services.filter((s) => {
      if (s.isActive === false) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q))
      );
    });
  }, [services, catalogSearch]);

  const filteredPackages = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return packages.filter((p) => {
      if (p.isActive === false) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.services.some((s) => s.name.toLowerCase().includes(q))
      );
    });
  }, [packages, catalogSearch]);

  const filteredProducts = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return liveProducts.filter((p) => {
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    });
  }, [liveProducts, catalogSearch]);

  // Customer previous due orders detection
  const customerDueOrders = useMemo(() => {
    const trimmedName = customer.trim().toLowerCase();
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (!trimmedName && !cleanPhone) return [];

    return orders.filter((o) => {
      const isDue =
        o.status === "created" ||
        (o.paid < o.amount &&
          o.status !== "advance_paid" &&
          o.status !== "paid_full" &&
          o.status !== "cancelled_refunded" &&
          o.status !== "cancelled_converted");
      if (!isDue) return false;

      const orderPhone = o.customerPhone ? o.customerPhone.replace(/\D/g, "").slice(-10) : "";
      const phoneMatch = Boolean(cleanPhone && orderPhone && cleanPhone === orderPhone);
      const nameMatch = Boolean(trimmedName && o.customer.trim().toLowerCase() === trimmedName);

      return phoneMatch || nameMatch;
    });
  }, [orders, customer, phone]);

  const totalPreviousDue = useMemo(() => {
    return customerDueOrders.reduce((sum, o) => sum + Math.max(0, o.amount - o.paid), 0);
  }, [customerDueOrders]);

  // Pricing calculations
  const calculatedSubtotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
  }, [selectedItems]);

  const basePrice = useMemo(() => {
    if (customPrice !== "" && !isNaN(Number(customPrice))) {
      return Number(customPrice);
    }
    return calculatedSubtotal;
  }, [customPrice, calculatedSubtotal]);

  const discountPercent = useMemo(() => {
    if (discount !== "" && !isNaN(Number(discount))) {
      return Math.min(100, Math.max(0, Number(discount)));
    }
    return 0;
  }, [discount]);

  const calculatedDiscountAmount = useMemo(() => {
    return Math.round((basePrice * discountPercent) / 100);
  }, [basePrice, discountPercent]);

  const finalTotal = useMemo(() => {
    return Math.max(0, basePrice - calculatedDiscountAmount);
  }, [basePrice, calculatedDiscountAmount]);

  const totalWithDue = useMemo(() => {
    return finalTotal + (includePreviousDue ? totalPreviousDue : 0);
  }, [finalTotal, includePreviousDue, totalPreviousDue]);

  const enteredAdvance = useMemo(() => {
    if (advance !== "" && !isNaN(Number(advance))) {
      return Math.max(0, Number(advance));
    }
    return 0;
  }, [advance]);

  const enteredPayLaterPaid = useMemo(() => {
    if (payLaterPaid !== "" && !isNaN(Number(payLaterPaid))) {
      return Math.max(0, Number(payLaterPaid));
    }
    return 0;
  }, [payLaterPaid]);

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

  if (!isOpen) return null;

  const handleReset = () => {
    setStep(1);
    setCustomer("");
    setPhone("");
    setOrderType("Service booking");
    setSelectedItems([]);
    setCustomPrice("");
    setDiscount("");
    setPaymentMode("cash");
    setSettlementMode("completed");
    setPayLaterPaid("");
    setAdvance("");
    setDueDate("");
    setIncludePreviousDue(false);
    setBookingDate(getLocalDateString());
    setBookingTime("");
    setShowConfirm(false);
    setErrorMsg(null);
    setShowSuggestions(false);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      handleReset();
      onClose();
    }
  };

  // Toggle service/package/product selection in Step 2
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
    setSelectedItems((prev) => {
      const next = prev.filter((i) => !(i.id === id && i.type === type));
      const nextSubtotal = next.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
      setCustomPrice(String(nextSubtotal));
      return next;
    });
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
      const nextSubtotal = next.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
      setCustomPrice(String(nextSubtotal));
      return next;
    });
  };

  // Step 1 -> Step 2 validation
  const handleNextFromStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!customer.trim()) {
      setErrorMsg("Please enter customer name");
      return;
    }
    if (orderType === "Product sale") {
      setCatalogTab("products");
      fetchLiveProducts();
    } else {
      setCatalogTab("services");
    }
    setStep(2);
  };

  // Step 2 -> Step 3 validation
  const handleNextFromStep2 = () => {
    setErrorMsg(null);
    if (selectedItems.length === 0) {
      setErrorMsg("Please select at least one item to continue.");
      return;
    }
    // Always refresh custom price with current calculated subtotal when moving to Step 3
    setCustomPrice(String(calculatedSubtotal));
    setStep(3);
  };

  // Final submit in Step 3
  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (selectedItems.length === 0) {
      setErrorMsg("Please select at least one item.");
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

    if (orderType !== "Product sale" && (settlementMode === "advance" || settlementMode === "paid_full") && !bookingDate) {
      setErrorMsg("Please select the appointment / booking date for this advance booking");
      return;
    }

    setShowConfirm(true);
  };

  const executeSubmitOrder = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const formattedPhone = phone.trim() ? formatPhoneNumber(phone) : undefined;
      const status = settlementMode === "completed"
        ? "completed"
        : settlementMode === "paid_full"
        ? "paid_full"
        : settlementMode === "pay_later"
        ? "created"
        : "advance_paid";

      const resolvedOrderType: "Product sale" | "Service booking" | "Package sale" =
        orderType === "Product sale"
          ? "Product sale"
          : selectedItems.some((i) => i.type === "package")
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

      const lineItems = selectedItems.map((item) => ({
        itemId: item.id,
        itemType: item.type,
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
        finalPrice: item.price * item.quantity,
      }));

      const res = await createOrderAction({
        customerName: customer.trim(),
        customerPhone: formattedPhone,
        orderType: resolvedOrderType,
        totalAmount: finalTotal,
        paidAmount: paidAmount,
        status: status,
        subtotal: calculatedSubtotal,
        discountType: "percentage",
        discountValue: discountPercent,
        discountAmount: calculatedDiscountAmount,
        paymentMode: paymentMode,
        bookingDate: resolvedBookingDate,
        bookingTime: resolvedBookingTime,
        lineItems,
        clearedDueOrderIds,
        clearedDueAmount,
      });

      if (res.success && res.order) {
        onAddOrder(res.order, formattedPhone, res.clearedDueOrderIds);
        handleReset();
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to save order");
      }
    } catch {
      setErrorMsg("Network error occurred while creating order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-[540px] bg-galla-surface border border-galla-line rounded-[8px] p-6 shadow-2xl transition-all max-h-[90vh] flex flex-col">
        {/* Header with Title and Step Dots */}
        <div className="flex items-center justify-between pb-3 border-b border-galla-line/60 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-semibold text-[18px] text-galla-ink">
                New Order
              </h3>
              <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded-full bg-galla-teal-soft text-galla-teal">
                Step {step} of 3
              </span>
            </div>
            <p className="text-[12px] font-sans text-galla-ink-soft mt-0.5">
              {step === 1 && "Customer details and order category"}
              {step === 2 && (orderType === "Product sale" ? "Select retail products from inventory" : "Select services and bundled packages")}
              {step === 3 && "Review items, custom pricing & settlement"}
            </p>
          </div>

          <button
            onClick={handleClose}
            type="button"
            disabled={isSubmitting}
            className="text-galla-ink-soft hover:text-galla-ink p-1 rounded transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="mt-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-[12px] rounded-[4px] flex items-center gap-2 shrink-0">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 1: CUSTOMER & ORDER TYPE                             */}
        {/* ======================================================== */}
        {step === 1 && (
          <form onSubmit={handleNextFromStep1} className="space-y-4 pt-4 overflow-y-auto flex-1">
            {/* Customer Name with Autocomplete */}
            <div className="relative">
              <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                autoFocus
                required
                value={customer}
                onChange={(e) => {
                  setCustomer(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (customer.trim().length > 0) setShowSuggestions(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowSuggestions(false);
                }}
                autoComplete="off"
                placeholder="Enter customer name"
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
              />

              {showSuggestions && filteredCustomers.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute left-0 right-0 top-full mt-1 z-30 bg-galla-surface border border-galla-line rounded-[5px] shadow-lg overflow-hidden py-1 max-h-48 overflow-y-auto"
                >
                  {filteredCustomers.map((c, index) => (
                    <button
                      key={`${c.phone || c.name}-${index}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setCustomer(c.name);
                        if (c.phone) setPhone(c.phone);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-galla-paper/80 transition-colors flex items-center justify-between group cursor-pointer border-b border-galla-line/40 last:border-b-0"
                    >
                      <span className="font-heading font-medium text-[13px] text-galla-ink group-hover:text-galla-teal transition-colors">
                        {c.name}
                      </span>
                      <span className="font-mono text-[12px] text-galla-ink-soft">
                        {c.phone || "No phone"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Customer Phone */}
            <div>
              <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
                Customer Mobile (Optional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => {
                  if (phone.trim()) setPhone(formatPhoneNumber(phone));
                }}
                placeholder="Enter mobile number"
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
              />

              {phoneConflictCustomer && (
                <div className="mt-1.5 flex items-start gap-1.5 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-[4px] p-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-tight">
                    <span>This mobile number is already registered with </span>
                    <span className="font-semibold">{phoneConflictCustomer.name}</span>.
                    <button
                      type="button"
                      onClick={() => setCustomer(phoneConflictCustomer.name)}
                      className="ml-1 underline font-medium text-amber-800 hover:text-amber-900 cursor-pointer"
                    >
                      Use {phoneConflictCustomer.name}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Order Type Selection (Only Product sale & Service booking) */}
            <div>
              <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1.5">
                Order Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOrderType("Service booking");
                    setCatalogTab("services");
                  }}
                  className={`p-3 rounded-[6px] border text-left transition-all cursor-pointer ${
                    orderType === "Service booking"
                      ? "bg-galla-teal-soft border-galla-teal text-galla-teal shadow-2xs"
                      : "bg-galla-paper/40 border-galla-line text-galla-ink-soft hover:text-galla-ink"
                  }`}
                >
                  <div className="flex items-center gap-2 font-heading font-medium text-[13.5px]">
                    <Scissors className="h-4 w-4" />
                    <span>Service booking</span>
                  </div>
                  <div className="text-[11.5px] text-galla-ink-soft mt-1 leading-snug">
                    Salon treatments &amp; package deals
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOrderType("Product sale");
                    setCatalogTab("products");
                    fetchLiveProducts();
                  }}
                  className={`p-3 rounded-[6px] border text-left transition-all cursor-pointer ${
                    orderType === "Product sale"
                      ? "bg-galla-teal-soft border-galla-teal text-galla-teal shadow-2xs"
                      : "bg-galla-paper/40 border-galla-line text-galla-ink-soft hover:text-galla-ink"
                  }`}
                >
                  <div className="flex items-center gap-2 font-heading font-medium text-[13.5px]">
                    <Package className="h-4 w-4" />
                    <span>Product sale</span>
                  </div>
                  <div className="text-[11.5px] text-galla-ink-soft mt-1 leading-snug">
                    Retail shampoo, serums &amp; retail products
                  </div>
                </button>
              </div>
            </div>

            {/* Step 1 Actions */}
            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={!customer.trim()}
                className="inline-flex items-center gap-1.5 bg-galla-teal hover:opacity-95 text-white font-sans text-[13.5px] font-medium px-5 py-2 rounded-[5px] shadow-sm transition-opacity cursor-pointer disabled:opacity-50"
              >
                <span>Next</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* STEP 2: CATALOG SELECTION (SERVICES, PACKAGES & PRODUCTS) */}
        {/* ======================================================== */}
        {step === 2 && (
          <div className="pt-3 flex-1 flex flex-col overflow-hidden space-y-3">
              {/* Switcher & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
                {/* Service vs Package vs Product Toggle */}
                {orderType === "Product sale" ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] bg-galla-teal text-white text-[12px] font-sans font-medium shadow-xs">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>Products ({filteredProducts.length})</span>
                  </div>
                ) : (
                  <div className="flex items-center p-0.5 bg-galla-paper/60 border border-galla-line rounded-[6px]">
                    <button
                      type="button"
                      onClick={() => setCatalogTab("services")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-[12px] font-sans font-medium transition-all cursor-pointer ${
                        activeCatalogTab === "services"
                          ? "bg-galla-teal text-white shadow-xs"
                          : "text-galla-ink-soft hover:text-galla-ink"
                      }`}
                    >
                      <Scissors className="h-3.5 w-3.5" />
                      <span>Services ({filteredServices.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCatalogTab("packages")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-[12px] font-sans font-medium transition-all cursor-pointer ${
                        activeCatalogTab === "packages"
                          ? "bg-galla-teal text-white shadow-xs"
                          : "text-galla-ink-soft hover:text-galla-ink"
                      }`}
                    >
                      <Package className="h-3.5 w-3.5" />
                      <span>Packages ({filteredPackages.length})</span>
                    </button>
                  </div>
                )}

                {/* Search Bar */}
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="h-3.5 w-3.5 text-galla-ink-soft/60 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    autoFocus
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder={
                      activeCatalogTab === "services"
                        ? "Search services or category..."
                        : activeCatalogTab === "packages"
                        ? "Search package bundles..."
                        : "Search retail products..."
                    }
                    className="w-full bg-galla-paper/40 border border-galla-line rounded-[5px] pl-8 pr-2.5 py-1.5 text-[12px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal transition-all"
                  />
                </div>
              </div>

              {/* Catalog Items List */}
              <div className="flex-1 overflow-y-auto border border-galla-line rounded-[6px] divide-y divide-galla-line/40 max-h-[320px] bg-galla-paper/20">
                {activeCatalogTab === "products" ? (
                filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-galla-ink-soft">
                    {isLoadingProducts ? "Loading live products..." : "No active retail products found matching your search."}
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const isSelected = selectedItems.some((i) => i.id === String(p.id) && i.type === "product");
                    const isOutOfStock = p.sell <= 0;
                    const stockLabel = p.sell > 0 ? `${p.sell} in stock` : "out of stock";
                    return (
                      <div
                        key={p.id}
                        onClick={() =>
                          handleToggleItem({
                            id: String(p.id),
                            type: "product",
                            name: p.name,
                            price: p.price,
                          })
                        }
                        className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-galla-teal/5 hover:bg-galla-teal/10"
                            : "hover:bg-galla-paper/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-4 h-4 rounded-[3px] border flex items-center justify-center transition-all ${
                              isSelected
                                ? "bg-galla-teal border-galla-teal text-white"
                                : "border-galla-line bg-galla-surface"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <div>
                            <div className="font-heading font-medium text-[13.5px] text-galla-ink flex items-center gap-2">
                              <span>{p.name}</span>
                              <span className="font-mono text-[11px] text-galla-ink-soft">
                                — {stockLabel} — {formatRupee(p.price)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11.5px] text-galla-ink-soft mt-0.5">
                              {isOutOfStock ? (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10.5px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                  Out of stock (Backorder allowed)
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {p.sell} in stock
                                </span>
                              )}
                              {p.category && (
                                <span className="bg-galla-paper px-1.5 py-0.5 rounded border border-galla-line/60">
                                  {p.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="font-heading font-semibold text-[13.5px] text-galla-ink tabular-nums">
                          {formatRupee(p.price)}
                        </div>
                      </div>
                    );
                  })
                )
              ) : activeCatalogTab === "services" ? (
                filteredServices.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-galla-ink-soft">
                    No active services found matching your search.
                  </div>
                ) : (
                  filteredServices.map((s) => {
                    const isSelected = selectedItems.some((i) => i.id === s.id && i.type === "service");
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
                        className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-galla-teal/5 hover:bg-galla-teal/10"
                            : "hover:bg-galla-paper/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-4 h-4 rounded-[3px] border flex items-center justify-center transition-all ${
                              isSelected
                                ? "bg-galla-teal border-galla-teal text-white"
                                : "border-galla-line bg-galla-surface"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <div>
                            <div className="font-heading font-medium text-[13.5px] text-galla-ink">
                              {s.name}
                            </div>
                            <div className="flex items-center gap-2 text-[11.5px] text-galla-ink-soft mt-0.5">
                              {s.category && (
                                <span className="bg-galla-paper px-1.5 py-0.5 rounded border border-galla-line/60">
                                  {s.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="font-heading font-semibold text-[13.5px] text-galla-ink tabular-nums">
                          {formatRupee(s.price)}
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                filteredPackages.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-galla-ink-soft">
                    No active packages found matching your search.
                  </div>
                ) : (
                  filteredPackages.map((p) => {
                    const isSelected = selectedItems.some((i) => i.id === p.id && i.type === "package");
                    const price = p.packagePrice || 0;
                    return (
                      <div
                        key={p.id}
                        onClick={() =>
                          handleToggleItem({
                            id: p.id,
                            type: "package",
                            name: p.name,
                            price: price,
                          })
                        }
                        className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-galla-teal/5 hover:bg-galla-teal/10"
                            : "hover:bg-galla-paper/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-4 h-4 rounded-[3px] border flex items-center justify-center transition-all ${
                              isSelected
                                ? "bg-galla-teal border-galla-teal text-white"
                                : "border-galla-line bg-galla-surface"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <div>
                            <div className="font-heading font-medium text-[13.5px] text-galla-ink">
                              {p.name}
                            </div>
                            <div className="text-[11.5px] text-galla-ink-soft mt-0.5 truncate max-w-xs">
                              {p.services.length} services included: {p.services.map((s) => s.name).join(", ")}
                            </div>
                          </div>
                        </div>

                        <div className="font-heading font-semibold text-[13.5px] text-galla-ink tabular-nums">
                          {formatRupee(price)}
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>

            {/* Selection Summary Bar & Navigation */}
            <div className="pt-2 border-t border-galla-line/60 flex items-center justify-between shrink-0">
              <div className="text-[12.5px] font-sans text-galla-ink">
                <span className="font-semibold text-galla-teal">{selectedItems.length}</span> item
                {selectedItems.length === 1 ? "" : "s"} selected{" "}
                <span className="text-galla-ink-soft">
                  ({formatRupee(calculatedSubtotal)})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[5px] text-[12.5px] font-sans text-galla-ink-soft hover:text-galla-ink border border-galla-line transition-all cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextFromStep2}
                  disabled={selectedItems.length === 0}
                  className="inline-flex items-center gap-1.5 bg-galla-teal hover:opacity-95 text-white font-sans text-[12.5px] font-medium px-4 py-1.5 rounded-[5px] shadow-sm transition-opacity cursor-pointer disabled:opacity-50"
                >
                  <span>Review &amp; Price</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: REVIEW, EDITABLE PRICE, DISCOUNT & SETTLEMENT     */}
        {/* ======================================================== */}
        {step === 3 && (
          <form onSubmit={handleFinalSubmit} className="pt-3 flex-1 flex flex-col overflow-y-auto space-y-4">
            {/* Customer Snapshot Pill */}
            <div className="p-2.5 bg-galla-paper/50 border border-galla-line rounded-[5px] flex items-center justify-between text-[12.5px]">
              <div>
                <span className="text-galla-ink-soft">Customer: </span>
                <span className="font-semibold text-galla-ink">{customer}</span>
                {phone && (
                  <span className="font-mono text-galla-ink-soft text-[11.5px] ml-1.5">
                    ({phone})
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium bg-galla-teal-soft text-galla-teal px-1.5 py-0.5 rounded">
                {orderType === "Product sale" ? "Product Sale" : "Service Booking"}
              </span>
            </div>

            {/* Selected Items List (Editable / Deletable) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-sans text-[12px] font-medium text-galla-ink-soft">
                  Selected Items ({selectedItems.length})
                </label>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1 text-[11.5px] font-sans font-medium text-galla-teal hover:underline cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add more items</span>
                </button>
              </div>

              <div className="border border-galla-line rounded-[5px] divide-y divide-galla-line/40 max-h-36 overflow-y-auto bg-galla-paper/20">
                {selectedItems.length === 0 ? (
                  <div className="p-4 text-center text-[12px] text-galla-ink-soft">
                    No items selected.{" "}
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-galla-teal font-medium hover:underline cursor-pointer ml-1"
                    >
                      Add items from catalog
                    </button>
                  </div>
                ) : (
                  selectedItems.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="px-3 py-2 flex items-center justify-between text-[12.5px] hover:bg-galla-paper/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                            item.type === "package"
                              ? "bg-galla-brass-soft text-galla-brass border border-galla-brass/30"
                              : item.type === "product"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-galla-teal-soft text-galla-teal border border-galla-teal/30"
                          }`}
                        >
                          {item.type}
                        </span>
                        <span className="font-medium text-galla-ink truncate">
                          {item.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {/* Quantity Controls */}
                        <div className="flex items-center border border-galla-line rounded bg-galla-surface text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, item.type, -1)}
                            className="px-1.5 py-0.5 text-galla-ink-soft hover:text-galla-ink transition-colors cursor-pointer font-bold"
                            title="Decrease quantity"
                          >
                            -
                          </button>
                          <span className="px-1.5 py-0.5 font-semibold text-galla-ink tabular-nums min-w-[16px] text-center">
                            {item.quantity || 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, item.type, 1)}
                            className="px-1.5 py-0.5 text-galla-ink-soft hover:text-galla-ink transition-colors cursor-pointer font-bold"
                            title="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        <span className="font-heading font-semibold text-galla-ink tabular-nums min-w-[55px] text-right">
                          {formatRupee(item.price * (item.quantity || 1))}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id, item.type)}
                          className="text-galla-ink-soft hover:text-red-600 p-0.5 rounded transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Previous Due Alert & Inclusion Checkbox */}
            {customerDueOrders.length > 0 && totalPreviousDue > 0 && (
              <div className="p-3 bg-amber-50/75 border border-amber-300 rounded-[6px] space-y-2 animate-in fade-in duration-150">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-sans font-semibold text-[13px] text-amber-950">
                      Previous Outstanding Due: {formatRupee(totalPreviousDue)}
                    </span>
                    <p className="font-sans text-[11.5px] text-amber-800 mt-0.5">
                      {customer} has pending payment due from {customerDueOrders.map((o) => o.id).join(", ")}.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none text-[12.5px] font-medium text-amber-950">
                  <input
                    type="checkbox"
                    checked={includePreviousDue}
                    onChange={(e) => setIncludePreviousDue(e.target.checked)}
                    className="h-4 w-4 rounded border-amber-400 text-galla-teal focus:ring-galla-teal cursor-pointer"
                  />
                  <span>Add previous due ({formatRupee(totalPreviousDue)}) to this bill</span>
                </label>
              </div>
            )}

            {/* Editable Pricing & Direct Discount Section */}
            <div className="p-3 bg-galla-paper/30 border border-galla-line rounded-[6px] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Editable Base Price */}
                <div>
                  <label className="block font-sans text-[11.5px] font-medium text-galla-ink-soft mb-1">
                    Entered Price (₹) <span className="text-[10px] text-galla-ink-soft/70">(Editable)</span>
                  </label>
                  <input
                    type="text"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value.replace(/\D/g, ""))}
                    placeholder={String(calculatedSubtotal)}
                    className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-2.5 py-1.5 text-[13.5px] font-heading font-semibold text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal transition-all"
                  />
                </div>

                {/* Percentage Discount */}
                <div>
                  <label className="block font-sans text-[11.5px] font-medium text-galla-ink-soft mb-1">
                    Discount (%)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={discount}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                        if ((cleaned.match(/\./g) || []).length > 1) return;
                        const num = Number(cleaned);
                        if (!isNaN(num) && num > 100) {
                          setDiscount("100");
                        } else {
                          setDiscount(cleaned);
                        }
                      }}
                      placeholder="e.g. 10"
                      className="w-full bg-galla-surface border border-galla-line rounded-[5px] pl-2.5 pr-8 py-1.5 text-[13.5px] font-heading font-semibold text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal transition-all"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] font-bold text-galla-ink-soft select-none">
                      %
                    </span>
                  </div>
                </div>
              </div>

              {/* Real-time Final Total Calculation */}
              <div className="space-y-1.5 pt-2 border-t border-galla-line/60">
                {discountPercent > 0 && (
                  <div className="flex items-center justify-between text-[11.5px] text-galla-ink-soft">
                    <span>Discount ({discountPercent}%)</span>
                    <span className="font-heading font-semibold text-emerald-600">
                      - {formatRupee(calculatedDiscountAmount)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-heading font-semibold text-[13px] text-galla-ink-soft uppercase tracking-wider">
                    {includePreviousDue && totalPreviousDue > 0 ? "Today's Order Amount" : "Order Total"}
                  </span>
                  <span className="font-heading font-bold text-[18px] text-galla-ink tabular-nums">
                    {formatRupee(finalTotal)}
                  </span>
                </div>

                {includePreviousDue && totalPreviousDue > 0 && (
                  <div className="pt-2 border-t border-galla-line/60 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-[12px] text-amber-900 bg-amber-50/80 px-2.5 py-1.5 rounded border border-amber-200">
                      <div>
                        <span className="font-medium">Previous Due to Settle</span>
                        <div className="text-[10px] text-amber-700/80">
                          Order {customerDueOrders.map((o) => o.id).join(", ")} will be marked settled
                        </div>
                      </div>
                      <span className="font-heading font-bold text-rose-700">
                        + {formatRupee(totalPreviousDue)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-galla-line/60">
                      <div>
                        <span className="font-heading font-bold text-[13.5px] text-galla-ink uppercase tracking-wider block">
                          Total Price
                        </span>
                        <span className="text-[11px] text-galla-ink-soft">
                          (Today&apos;s Order + Due Amount)
                        </span>
                      </div>
                      <span className="font-heading font-bold text-[20px] text-galla-teal tabular-nums">
                        {formatRupee(totalWithDue)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Settlement Mode Dropdown */}
            <div>
              <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1.5">
                Settlement Mode <span className="text-red-500">*</span>
              </label>
              <select
                value={settlementMode}
                onChange={(e) => setSettlementMode(e.target.value as "completed" | "pay_later" | "advance" | "paid_full")}
                className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-2 text-[13px] font-sans font-medium text-galla-ink focus:outline-none focus:border-galla-teal transition-all cursor-pointer shadow-2xs"
              >
                <option value="completed">Completed (Paid in full now)</option>
                <option value="pay_later">Pay Later / Due (Delivery now, payment later)</option>
                <option value="advance">
                  {orderType === "Product sale"
                    ? "Pre-order / Advance (Partial deposit, pickup later)"
                    : "Advance Booking (Partial deposit, appointment later)"}
                </option>
                <option value="paid_full">
                  {orderType === "Product sale"
                    ? "Pre-order (Paid in full, pickup later)"
                    : "Advance Booking (Paid in full, appointment later)"}
                </option>
              </select>
            </div>

            {/* Pay Later / Due Card */}
            {settlementMode === "pay_later" && (
              <div className="p-3 rounded-[6px] space-y-2.5 border bg-amber-50/40 border-amber-300/50">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11.5px] font-medium text-galla-ink">
                      Amount Paid Now (₹) <span className="text-galla-ink-soft/70 font-normal">(Optional)</span>
                    </label>
                    <span className="text-[11.5px] font-sans text-galla-ink-soft">
                      Pending Due: <strong className="text-rose-700 font-semibold">{formatRupee(amountPending)}</strong>
                    </span>
                  </div>
                  <input
                    type="text"
                    value={payLaterPaid}
                    onChange={(e) => setPayLaterPaid(e.target.value.replace(/\D/g, ""))}
                    placeholder={`0 (Full ${formatRupee(finalTotal)} due later)`}
                    className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-2.5 py-1.5 text-[13px] font-heading font-semibold text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-amber-500 transition-all"
                  />
                </div>

                {/* Optional Expected Due Date */}
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11.5px] font-medium text-galla-ink">
                      Expected Payment Due Date <span className="text-galla-ink-soft/70 font-normal">(Optional)</span>
                    </label>
                    {dueDate && (
                      <button
                        type="button"
                        onClick={() => setDueDate("")}
                        className="text-[10.5px] text-galla-ink-soft hover:text-red-600 transition-colors cursor-pointer"
                      >
                        Clear date
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={dueDate}
                    min={getLocalDateString()}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-2.5 py-1.5 text-[12.5px] font-sans text-galla-ink focus:outline-none focus:border-amber-500 transition-all cursor-pointer"
                  />
                </div>

                <div className="text-[11.5px] text-galla-ink-soft pt-1 leading-snug">
                  ℹ️ Order will be recorded as <strong className="text-amber-800 font-semibold">Payment Due</strong> and product/service delivered immediately. You can settle the remaining balance anytime in the Orders tab.
                </div>
              </div>
            )}

            {/* Advance Booking Details (Date & Deposit) */}
            {(settlementMode === "advance" || settlementMode === "paid_full") && (
              <div
                className={`p-3 rounded-[6px] space-y-2.5 border ${
                  settlementMode === "advance"
                    ? "bg-galla-brass-soft/40 border-galla-brass/30"
                    : "bg-galla-teal-soft/40 border-galla-teal/30"
                }`}
              >
                <div className="space-y-2.5">
                  {/* Advance Amount (only for partial deposit) */}
                  {settlementMode === "advance" && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11.5px] font-medium text-galla-ink">
                          Advance Paid (₹)
                        </label>
                        {advance.trim() !== "" && Number(advance) > 0 && (
                          <span className="text-[11px] font-sans text-galla-ink-soft">
                            Pending: <strong className="text-red-700">{formatRupee(amountPending)}</strong>
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={advance}
                        onChange={(e) => setAdvance(e.target.value.replace(/\D/g, ""))}
                        placeholder="e.g. 500"
                        className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-2.5 py-1.5 text-[13px] font-heading font-semibold text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-brass transition-all"
                      />
                    </div>
                  )}

                  {/* Booking Date & Time Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Booking Date */}
                    <div className="space-y-1">
                      <label className="block text-[11.5px] font-medium text-galla-ink whitespace-nowrap">
                        {orderType === "Product sale" ? "Expected Pickup / Arrival Date" : "Appointment Date"}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={bookingDate}
                        min={getLocalDateString()}
                        onChange={(e) => setBookingDate(e.target.value)}
                        className={`w-full bg-galla-surface border border-galla-line rounded-[5px] px-2.5 py-1.5 text-[12.5px] font-sans text-galla-ink focus:outline-none transition-all cursor-pointer ${
                          settlementMode === "advance" ? "focus:border-galla-brass" : "focus:border-galla-teal"
                        }`}
                      />
                    </div>

                    {/* Booking Time (Optional) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11.5px] font-medium text-galla-ink whitespace-nowrap">
                          Time <span className="text-galla-ink-soft/70 font-normal">(Optional)</span>
                        </label>
                        {bookingTime && (
                          <button
                            type="button"
                            onClick={() => setBookingTime("")}
                            className="text-[10px] text-galla-ink-soft hover:text-red-600 transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <input
                        type="time"
                        value={bookingTime}
                        onChange={(e) => setBookingTime(e.target.value)}
                        className={`w-full bg-galla-surface border border-galla-line rounded-[5px] px-2.5 py-1.5 text-[12.5px] font-sans text-galla-ink focus:outline-none transition-all cursor-pointer ${
                          settlementMode === "advance" ? "focus:border-galla-brass" : "focus:border-galla-teal"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div
                  className={`flex items-center justify-between text-[11.5px] pt-1.5 border-t text-galla-ink-soft ${
                    settlementMode === "advance" ? "border-galla-brass/25" : "border-galla-teal/20"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    <Calendar
                      className={`h-3 w-3 shrink-0 ${
                        settlementMode === "advance" ? "text-galla-brass" : "text-galla-teal"
                      }`}
                    />
                    <span>
                      {orderType === "Product sale" ? "Expected pickup: " : "Booked for: "}
                      <strong className="text-galla-ink">
                        {formatBookingDate(bookingDate) || "Not set"}
                        {bookingTime ? ` at ${formatAppointmentTime(bookingTime)}` : " (Time not set)"}
                      </strong>
                    </span>
                  </span>
                  {settlementMode === "advance" ? (
                    advance.trim() !== "" && Number(advance) > 0 ? (
                      <span>
                        Remaining: <strong className="text-red-700">{formatRupee(amountPending)}</strong>
                      </span>
                    ) : null
                  ) : (
                    <span className="text-galla-teal font-medium">
                      Paid in Full ({formatRupee(finalTotal)})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Mode of Payment (Shown when not pay_later or when paying partial upfront in pay_later) */}
            {(settlementMode !== "pay_later" || enteredPayLaterPaid > 0) && (
              <div>
                <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1.5">
                  {settlementMode === "pay_later"
                    ? `Mode of Upfront Payment (${formatRupee(enteredPayLaterPaid)})`
                    : settlementMode === "advance"
                    ? "Mode of Advance Payment"
                    : "Mode of Payment"}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode("cash")}
                    className={`py-2 px-2 text-[12.5px] font-sans font-medium rounded-[5px] border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      paymentMode === "cash"
                        ? "bg-galla-teal-soft border-galla-teal text-galla-teal shadow-2xs font-semibold"
                        : "bg-galla-paper/40 border-galla-line text-galla-ink-soft hover:text-galla-ink"
                    }`}
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode("upi")}
                    className={`py-2 px-2 text-[12.5px] font-sans font-medium rounded-[5px] border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      paymentMode === "upi"
                        ? "bg-galla-teal-soft border-galla-teal text-galla-teal shadow-2xs font-semibold"
                        : "bg-galla-paper/40 border-galla-line text-galla-ink-soft hover:text-galla-ink"
                    }`}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>UPI / QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode("card")}
                    className={`py-2 px-2 text-[12.5px] font-sans font-medium rounded-[5px] border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      paymentMode === "card"
                        ? "bg-galla-teal-soft border-galla-teal text-galla-teal shadow-2xs font-semibold"
                        : "bg-galla-paper/40 border-galla-line text-galla-ink-soft hover:text-galla-ink"
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Card</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 Actions */}
            <div className="pt-2 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-[5px] text-[13px] font-sans text-galla-ink-soft hover:text-galla-ink border border-galla-line transition-all cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting || selectedItems.length === 0}
                className="bg-galla-teal hover:opacity-95 text-white font-sans text-[13.5px] font-medium px-5 py-2 rounded-[5px] shadow-sm transition-opacity cursor-pointer disabled:opacity-50"
              >
                {isSubmitting
                  ? "Creating Order..."
                  : settlementMode === "pay_later"
                  ? (enteredPayLaterPaid > 0
                      ? `Create Order (Paid: ${formatRupee(enteredPayLaterPaid)}, Due: ${formatRupee(amountPending)})`
                      : `Create Pay Later Order (Due: ${formatRupee(finalTotal)})`)
                  : settlementMode === "advance" && enteredAdvance > 0
                  ? `Create Order (Advance: ${formatRupee(enteredAdvance)})`
                  : includePreviousDue && totalPreviousDue > 0
                  ? `Create Order & Settle Due (Total: ${formatRupee(totalWithDue)})`
                  : `Create Order (${formatRupee(finalTotal)})`}
              </button>
            </div>
          </form>
        )}
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        title={
          settlementMode === "pay_later"
            ? "Confirm Pay Later Order"
            : settlementMode === "advance" || settlementMode === "paid_full"
            ? "Confirm Advance Booking"
            : "Confirm New Order"
        }
        description={
          settlementMode === "pay_later" ? (
            <span>
              Create Pay Later order for <strong className="font-semibold text-galla-ink">&ldquo;{customer.trim()}&rdquo;</strong> with{" "}
              <strong className="font-semibold text-galla-ink">{selectedItems.length} item(s)</strong> totalling{" "}
              <strong className="font-semibold text-galla-ink">{formatRupee(finalTotal)}</strong>:{" "}
              {enteredPayLaterPaid > 0 ? (
                <>
                  <strong className="font-semibold text-galla-ink">{formatRupee(enteredPayLaterPaid)}</strong> paid upfront via{" "}
                  <strong className="font-semibold text-galla-ink">{paymentMode.toUpperCase()}</strong>, with{" "}
                  <strong className="font-semibold text-rose-700">{formatRupee(amountPending)}</strong> pending due later
                </>
              ) : (
                <>
                  <strong className="font-semibold text-rose-700">{formatRupee(amountPending)}</strong> marked as pending due to be paid later
                </>
              )}
              {dueDate && (
                <>
                  , with expected payment due by{" "}
                  <strong className="font-semibold text-galla-ink">
                    {formatBookingDate(dueDate)}
                  </strong>
                </>
              )}
              ?
            </span>
          ) : settlementMode === "advance" ? (
            <span>
              Create advance booking for <strong className="font-semibold text-galla-ink">&ldquo;{customer.trim()}&rdquo;</strong> with{" "}
              <strong className="font-semibold text-galla-ink">{selectedItems.length} item(s)</strong>:{" "}
              <strong className="font-semibold text-galla-ink">{formatRupee(enteredAdvance)}</strong> advance paid (
              <strong className="font-semibold text-amber-800">{formatRupee(Math.max(0, finalTotal - enteredAdvance))}</strong> pending) via{" "}
              <strong className="font-semibold text-galla-ink">{paymentMode.toUpperCase()}</strong>
              {bookingDate && (
                <>
                  {" "}scheduled for{" "}
                  <strong className="font-semibold text-galla-ink">
                    {formatBookingDate(bookingDate)}{bookingTime ? ` at ${formatAppointmentTime(bookingTime)}` : ""}
                  </strong>
                </>
              )}
              ?
            </span>
          ) : (
            <span>
              Create order for <strong className="font-semibold text-galla-ink">&ldquo;{customer.trim()}&rdquo;</strong> with{" "}
              <strong className="font-semibold text-galla-ink">{selectedItems.length} item(s)</strong> totalling{" "}
              <strong className="font-semibold text-galla-ink">{formatRupee(finalTotal)}</strong>
              {includePreviousDue && totalPreviousDue > 0 ? (
                <>, plus settle previous due of <strong className="font-semibold text-rose-700">{formatRupee(totalPreviousDue)}</strong> (Total: <strong className="font-semibold text-galla-teal">{formatRupee(totalWithDue)}</strong>)</>
              ) : null} via{" "}
              <strong className="font-semibold text-galla-ink">{paymentMode.toUpperCase()}</strong>?
            </span>
          )
        }
        confirmLabel="Confirm Order"
        isLoading={isSubmitting}
        onConfirm={executeSubmitOrder}
        onClose={() => setShowConfirm(false)}
      />
    </div>
  );
}
