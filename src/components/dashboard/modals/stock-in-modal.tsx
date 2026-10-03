"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  PackagePlus,
  Building2,
  Check,
  Calendar,
  Sparkles,
  ArrowLeft,
  IndianRupee,
  CheckCircle2,
  Clock,
  ShoppingBag,
  ChevronDown,
} from "lucide-react";
import {
  DashboardProduct,
  DashboardSupplier,
  DashboardPurchaseOrder,
  DashboardExpense,
} from "@/types/dashboard";
import {
  createPurchaseOrderAction,
  getSuppliersAction,
  getSupplierPendingReplacementsAction,
} from "@/app/dashboard/actions";
import {
  formatRupee,
  formatPhoneNumber,
  formatBookingDate,
  formatAppointmentTime,
  getLocalDateString,
  formatDisplayNumber,
} from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";
import { PaymentModeSelect } from "../payment-mode-select";

const SETTLEMENT_MODE_OPTIONS = [
  {
    value: "completed",
    label: "Complete",
    sublabel: "Receive stock & pay dealer immediately",
    icon: CheckCircle2,
    badge: "Instant",
  },
  {
    value: "pending",
    label: "Pay Later / Credit",
    sublabel: "Receive stock now, pay balance later",
    icon: Clock,
    badge: "Credit",
  },
  {
    value: "advance",
    label: "Advance Order",
    sublabel: "Partial deposit now, stock arrives later",
    icon: Calendar,
    badge: "Deposit",
  },
  {
    value: "paid_full",
    label: "Paid in Full (Advance PO)",
    sublabel: "100% upfront payment, stock arrives later",
    icon: ShoppingBag,
    badge: "Prepaid",
  },
] as const;

function SettlementModeSelect({
  value,
  onChange,
}: {
  value: "completed" | "pending" | "advance" | "paid_full";
  onChange: (val: "completed" | "pending" | "advance" | "paid_full") => void;
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

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 text-[12.5px] transition-colors cursor-pointer ${isSelected
                      ? "bg-galla-teal/10"
                      : "hover:bg-galla-paper/70"
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
                        {opt.sublabel}
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

interface StockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: DashboardProduct[];
  suppliers?: DashboardSupplier[];
  onStockInSuccess: (
    updatedProducts: DashboardProduct[],
    createdPO?: DashboardPurchaseOrder,
    newExpense?: DashboardExpense,
    updatedSupplier?: DashboardSupplier,
  ) => void;
}

interface StockInItemDraft {
  productId: string;
  productName: string;
  isNewProduct: boolean;
  category: string;
  customCategory: string;
  quantityForSell: string;
  quantityForUse: string;
  purchaseCost: string;
  expectedSellPrice: string;
  isReplacement?: boolean;
  originalPoId?: string;
}

export function StockInModal({
  isOpen,
  onClose,
  products,
  suppliers = [],
  onStockInSuccess,
}: StockInModalProps) {
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    null,
  );
  const [internalSuppliers, setInternalSuppliers] = useState<
    DashboardSupplier[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const supplierInputRef = useRef<HTMLInputElement | null>(null);
  const [dealerInvoiceNumber, setDealerInvoiceNumber] = useState("");

  // Settlement Mode & Payment states
  const [settlementMode, setSettlementMode] = useState<
    "completed" | "pending" | "advance" | "paid_full"
  >("completed");
  const [payLaterPaid, setPayLaterPaid] = useState("");
  const [advance, setAdvance] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [paymentMode, setPaymentMode] = useState<
    "cash" | "upi" | "card" | "bank_transfer"
  >("cash");
  const [notes, setNotes] = useState("");
  const [applyLedgerBalance, setApplyLedgerBalance] = useState(false);

  // Preload suppliers once if not passed in props (fallback)
  useEffect(() => {
    if (suppliers.length > 0) return;
    let ignore = false;
    getSuppliersAction()
      .then((res) => {
        if (!ignore && res.success && res.suppliers) {
          setInternalSuppliers(res.suppliers);
        }
      })
      .catch(() => { });
    return () => {
      ignore = true;
    };
  }, [suppliers]);

  const allSuppliers = suppliers.length > 0 ? suppliers : internalSuppliers;

  // Filter suppliers in-memory by name query — identical to customer search in NewOrderModal (0ms, 0 network requests)
  const filteredSuppliers = useMemo(() => {
    const query = supplierName.trim().toLowerCase();
    if (!query || allSuppliers.length === 0) return [];

    return allSuppliers
      .filter(
        (s) =>
          s &&
          s.name &&
          (s.name.toLowerCase().includes(query) ||
            (s.companyName && s.companyName.toLowerCase().includes(query))),
      )
      .slice(0, 5);
  }, [supplierName, allSuppliers]);

  // Warn if phone matches an existing supplier with a different name
  const phoneConflictSupplier = useMemo(() => {
    const digits = supplierPhone.replace(/\D/g, "").slice(-10);
    if (digits.length < 10 || !supplierName.trim()) return null;
    return (
      allSuppliers.find((s) => {
        const sDigits = (s.phone || "").replace(/\D/g, "").slice(-10);
        return (
          sDigits === digits &&
          s.name.trim().toLowerCase() !== supplierName.trim().toLowerCase()
        );
      }) || null
    );
  }, [supplierPhone, supplierName, allSuppliers]);

  // Unique list of categories from active database products
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) cats.add(p.category.trim());
    });
    return Array.from(cats).sort();
  }, [products]);

  // Alphabetically sorted products for dropdown selection
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
    );
  }, [products]);

  // Click outside listener for suggestions dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        supplierInputRef.current &&
        !supplierInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const createInitialDraftItem = useCallback(
    (prodList: DashboardProduct[]): StockInItemDraft => {
      if (prodList.length > 0) {
        const p = prodList[0];
        return {
          productId: String(p.id),
          productName: p.name || "",
          isNewProduct: false,
          category: p.category || (availableCategories[0] ?? "General"),
          customCategory: "",
          quantityForSell: "0",
          quantityForUse: "0",
          purchaseCost:
            p.purchaseCost !== undefined && p.purchaseCost !== null
              ? String(p.purchaseCost)
              : "0",
          expectedSellPrice: p.price ? String(p.price) : "0",
        };
      }
      return {
        productId: "__new__",
        productName: "",
        isNewProduct: true,
        category: availableCategories[0] ?? "General",
        customCategory: "",
        quantityForSell: "0",
        quantityForUse: "0",
        purchaseCost: "0",
        expectedSellPrice: "0",
      };
    },
    [availableCategories],
  );

  const [items, setItems] = useState<StockInItemDraft[]>([
    createInitialDraftItem(products),
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [pendingDealerReplacements, setPendingDealerReplacements] = useState<
    Array<{
      poId: string;
      purchaseOrderNumber: string;
      productId: string;
      productName: string;
      quantity: number;
      purchaseCost: number;
      returnedAt: string;
    }>
  >([]);
  const [_isLoadingReplacements, setIsLoadingReplacements] = useState(false);

  // Fetch pending dealer replacements when supplier is identified
  useEffect(() => {
    const trimmed = supplierName.trim();
    if (!isOpen || (!trimmed && !selectedSupplierId)) {
      setPendingDealerReplacements([]);
      return;
    }

    let ignore = false;
    setIsLoadingReplacements(true);
    getSupplierPendingReplacementsAction(
      selectedSupplierId || undefined,
      trimmed || undefined,
    )
      .then((res) => {
        if (!ignore && res.success && res.pendingReplacements) {
          setPendingDealerReplacements(res.pendingReplacements);
        } else if (!ignore) {
          setPendingDealerReplacements([]);
        }
      })
      .catch(() => {
        if (!ignore) setPendingDealerReplacements([]);
      })
      .finally(() => {
        if (!ignore) setIsLoadingReplacements(false);
      });

    return () => {
      ignore = true;
    };
  }, [isOpen, selectedSupplierId, supplierName]);

  const handleFillReplacement = (rep: {
    poId: string;
    purchaseOrderNumber: string;
    productId: string;
    productName: string;
    quantity: number;
    purchaseCost: number;
  }) => {
    setErrorMsg(null);
    const matched = products.find(
      (p) =>
        (rep.productId && String(p.id) === rep.productId) ||
        (p.name && p.name.trim().toLowerCase() === rep.productName.trim().toLowerCase()),
    );

    const existingIndex = items.findIndex(
      (it) =>
        (matched && it.productId === String(matched.id)) ||
        (it.productName.trim().toLowerCase() === rep.productName.trim().toLowerCase()),
    );

    if (existingIndex >= 0) {
      setItems((prev) =>
        prev.map((it, i) =>
          i === existingIndex
            ? {
              ...it,
              quantityForSell: String(rep.quantity),
              quantityForUse: "0",
              purchaseCost: "0",
              isReplacement: true,
              originalPoId: rep.poId,
            }
            : it,
        ),
      );
    } else {
      const isFirstItemBlank =
        items.length === 1 &&
        Number(items[0].quantityForSell) === 0 &&
        Number(items[0].quantityForUse) === 0 &&
        !items[0].isReplacement;

      const newDraftItem: StockInItemDraft = {
        productId: matched ? String(matched.id) : (rep.productId || "__new__"),
        productName: matched ? matched.name : rep.productName,
        isNewProduct: !matched,
        category: matched?.category || (availableCategories[0] ?? "General"),
        customCategory: "",
        quantityForSell: String(rep.quantity),
        quantityForUse: "0",
        purchaseCost: "0",
        expectedSellPrice: matched?.price ? String(matched.price) : "0",
        isReplacement: true,
        originalPoId: rep.poId,
      };

      if (isFirstItemBlank) {
        setItems([newDraftItem]);
      } else {
        setItems((prev) => [...prev, newDraftItem]);
      }
    }
  };

  // Reset form with clean defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      setSupplierName("");
      setSupplierPhone("");
      setSelectedSupplierId(null);
      setPendingDealerReplacements([]);
      setDealerInvoiceNumber("");
      setSettlementMode("completed");
      setPayLaterPaid("");
      setAdvance("");
      setDueDate("");
      setExpectedDeliveryDate("");
      setDeliveryTime("");
      setPaymentMode("cash");
      setNotes("");
      setErrorMsg(null);
      setShowConfirm(false);
      setItems([createInitialDraftItem(products)]);
    }
  }, [isOpen, products, createInitialDraftItem]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen && !showConfirm) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showConfirm, onClose]);

  const handleProductSelect = (index: number, selectedId: string) => {
    if (selectedId === "__new__") {
      setItems((prev) =>
        prev.map((it, i) =>
          i === index
            ? {
              ...it,
              productId: "__new__",
              productName: "",
              isNewProduct: true,
              category: availableCategories[0] ?? "General",
              customCategory: "",
              expectedSellPrice: "0",
              purchaseCost: "0",
            }
            : it,
        ),
      );
      return;
    }

    if (selectedId !== "__new__") {
      const alreadySelected = items.some(
        (it, i) => i !== index && it.productId === selectedId,
      );
      if (alreadySelected) {
        setErrorMsg(
          "This product is already added to this purchase order. Please increase its quantity instead.",
        );
        return;
      }
      setErrorMsg(null);
    }

    const matched = products.find((p) => String(p.id) === selectedId);
    if (!matched) return;

    setItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
            ...it,
            productId: String(matched.id),
            productName: matched.name,
            isNewProduct: false,
            category:
              matched.category || (availableCategories[0] ?? "General"),
            customCategory: "",
            expectedSellPrice: matched.price ? String(matched.price) : "0",
            purchaseCost:
              matched.purchaseCost !== undefined &&
                matched.purchaseCost !== null
                ? String(matched.purchaseCost)
                : "0",
          }
          : it,
      ),
    );
  };

  const handleItemFieldChange = (
    index: number,
    field: keyof StockInItemDraft,
    value: string,
  ) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)),
    );
  };

  const handleAddItem = () => {
    setErrorMsg(null);
    const selectedIds = new Set(
      items.map((it) => it.productId).filter((id) => id && id !== "__new__"),
    );
    const unselectedProd = products.find((p) => !selectedIds.has(String(p.id)));

    if (unselectedProd) {
      setItems((prev) => [
        ...prev,
        {
          productId: String(unselectedProd.id),
          productName: unselectedProd.name || "",
          isNewProduct: false,
          category:
            unselectedProd.category || (availableCategories[0] ?? "General"),
          customCategory: "",
          quantityForSell: "0",
          quantityForUse: "0",
          purchaseCost:
            unselectedProd.purchaseCost !== undefined &&
              unselectedProd.purchaseCost !== null
              ? String(unselectedProd.purchaseCost)
              : "0",
          expectedSellPrice: unselectedProd.price
            ? String(unselectedProd.price)
            : "0",
        },
      ]);
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: "__new__",
          productName: "",
          isNewProduct: true,
          category: availableCategories[0] ?? "General",
          customCategory: "",
          quantityForSell: "0",
          quantityForUse: "0",
          purchaseCost: "0",
          expectedSellPrice: "0",
        },
      ]);
    }
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalUnits = useMemo(() => {
    return items.reduce((acc, it) => {
      const qSell = Number(it.quantityForSell) || 0;
      const qUse = Number(it.quantityForUse) || 0;
      return acc + qSell + qUse;
    }, 0);
  }, [items]);

  const totalCalculatedCost = items.reduce((sum, it) => {
    const qSell = Number(it.quantityForSell) || 0;
    const qUse = Number(it.quantityForUse) || 0;
    const cost = Number(it.purchaseCost) || 0;
    return sum + (qSell + qUse) * cost;
  }, 0);

  const enteredPayLaterPaid = Number(payLaterPaid) || 0;
  const enteredAdvance = Number(advance) || 0;

  const matchedSupplier = useMemo(() => {
    const queryName = supplierName.trim().toLowerCase();
    const queryPhone = supplierPhone.trim();
    if (!queryName) return null;
    return (
      allSuppliers.find(
        (s) =>
          s.name.trim().toLowerCase() === queryName &&
          (!queryPhone ||
            s.phone === queryPhone ||
            s.phone === formatPhoneNumber(queryPhone)),
      ) || null
    );
  }, [supplierName, supplierPhone, allSuppliers]);

  const supplierPending = matchedSupplier?.totalPending || 0;
  const isLedgerBalanceApplicable = settlementMode !== "pending";
  const effectiveApplyLedgerBalance =
    applyLedgerBalance && isLedgerBalanceApplicable;

  // If effectiveApplyLedgerBalance is checked, we adjust the target payable amount
  const netPayable = effectiveApplyLedgerBalance
    ? totalCalculatedCost + supplierPending
    : totalCalculatedCost;
  const minPayable = Math.max(0, netPayable);

  const currentAmountPaid =
    settlementMode === "completed" || settlementMode === "paid_full"
      ? minPayable
      : settlementMode === "pending"
        ? Math.min(minPayable, enteredPayLaterPaid)
        : settlementMode === "advance"
          ? Math.min(minPayable, enteredAdvance)
          : 0;

  const ledgerAdj =
    effectiveApplyLedgerBalance && supplierPending !== 0
      ? supplierPending < 0
        ? Math.min(Math.abs(supplierPending), totalCalculatedCost)
        : -supplierPending
      : 0;

  // The true pending amount on THIS bill matches backend logic: totalCalculatedCost - amountPaid - ledgerAdj
  const amountPending = totalCalculatedCost - currentAmountPaid - ledgerAdj;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMsg(null);

    const trimmedSupplier = supplierName.trim();
    if (!trimmedSupplier) {
      setErrorMsg("Please enter supplier or distributor name");
      return;
    }

    if (items.length === 0) {
      setErrorMsg("Please add at least one item to this purchase order");
      return;
    }

    // Guard: Prevent duplicate products in the purchase order
    const seenProductKeys = new Map<string, string>();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let key = "";
      const displayName = it.productName.trim() || `Item #${i + 1}`;

      if (!it.isNewProduct && it.productId && it.productId !== "__new__") {
        key = `id:${it.productId}`;
      } else if (it.productName.trim()) {
        key = `name:${it.productName.trim().toLowerCase()}`;
      }

      if (key) {
        if (seenProductKeys.has(key)) {
          setErrorMsg(
            `Duplicate product "${displayName}": You cannot enter the same product multiple times in a single PO. Please adjust the quantities in a single row instead.`,
          );
          return;
        }
        seenProductKeys.set(key, displayName);
      }

      // If new product has the same name as an existing catalog product that's also in the PO
      if (it.isNewProduct && it.productName.trim()) {
        const matchingExisting = products.find(
          (p) =>
            p.name.trim().toLowerCase() === it.productName.trim().toLowerCase(),
        );
        if (matchingExisting) {
          const existingKey = `id:${matchingExisting.id}`;
          if (seenProductKeys.has(existingKey)) {
            setErrorMsg(
              `Duplicate product "${it.productName.trim()}": Already selected from catalog in another row. Please adjust its quantities instead.`,
            );
            return;
          }
          seenProductKeys.set(existingKey, matchingExisting.name);
        }
      }
    }

    // Validate all items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.isNewProduct) {
        if (!it.productName.trim()) {
          setErrorMsg(
            `Item #${i + 1}: Please enter the name for the new product`,
          );
          return;
        }

        // Check if new product name already exists in inventory (matching Add New Product modal)
        const matchingExisting = products.find(
          (p) =>
            p.isActive !== false &&
            p.name.trim().toLowerCase() === it.productName.trim().toLowerCase(),
        );
        if (matchingExisting) {
          setErrorMsg(
            `Item #${i + 1}: A product with this name already exists ("${matchingExisting.name}"). Please select it from the Catalog Products dropdown instead of adding as new.`,
          );
          return;
        }

        const resolvedCategory =
          it.category === "custom"
            ? it.customCategory.trim()
            : it.category.trim();
        if (!resolvedCategory) {
          setErrorMsg(
            `Item #${i + 1} (${it.productName || "New Product"}): Please select or specify a category`,
          );
          return;
        }
      } else if (!it.productId) {
        setErrorMsg(`Item #${i + 1} has no product selected`);
        return;
      }

      const qSell = Number(it.quantityForSell);
      const qUse = Number(it.quantityForUse);
      const cost = Number(it.purchaseCost);
      const sellPrice = Number(it.expectedSellPrice);

      if (isNaN(qSell) || qSell < 0 || !Number.isInteger(qSell)) {
        setErrorMsg(
          `Item #${i + 1} (${it.productName || "Product"}): invalid sell quantity`,
        );
        return;
      }

      if (isNaN(qUse) || qUse < 0 || !Number.isInteger(qUse)) {
        setErrorMsg(
          `Item #${i + 1} (${it.productName || "Product"}): invalid use quantity`,
        );
        return;
      }

      if (qSell + qUse <= 0) {
        setErrorMsg(
          `Item #${i + 1} (${it.productName || "Product"}): total quantity must be at least 1`,
        );
        return;
      }

      if (isNaN(cost) || cost < 0) {
        setErrorMsg(
          `Item #${i + 1} (${it.productName || "Product"}): invalid purchase cost`,
        );
        return;
      }

      if (isNaN(sellPrice) || sellPrice < 0) {
        setErrorMsg(
          `Item #${i + 1} (${it.productName || "Product"}): invalid expected sell price`,
        );
        return;
      }
    }

    // Settlement validations
    if (settlementMode === "advance") {
      if (enteredAdvance <= 0) {
        setErrorMsg("Please enter an advance deposit amount greater than 0");
        return;
      }
      if (enteredAdvance >= minPayable) {
        setErrorMsg(
          "Advance amount cannot equal or exceed total payable amount. Use 'Completed' or 'Paid in Full' instead.",
        );
        return;
      }
      if (!expectedDeliveryDate) {
        setErrorMsg(
          "Please select expected arrival date for this advance order",
        );
        return;
      }
    }

    if (settlementMode === "paid_full" && !expectedDeliveryDate) {
      setErrorMsg("Please select expected arrival date for this order");
      return;
    }

    if (settlementMode === "pending" && enteredPayLaterPaid > minPayable) {
      setErrorMsg(
        `Amount paid now cannot exceed total payable amount of ${formatRupee(minPayable)}`,
      );
      return;
    }

    setShowConfirm(true);
  };

  const executeStockIn = async () => {
    setShowConfirm(false);
    if (isSubmittingRef.current) return; isSubmittingRef.current = true; setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Use user-entered supplier name; fallback to conflict supplier or empty
      const trimmedSupplier =
        supplierName.trim() || phoneConflictSupplier?.name || "";
      const parsedItems = items.map((it) => ({
        productId: it.isNewProduct ? undefined : it.productId,
        isNewProduct: it.isNewProduct,
        productName: it.productName.trim(),
        category: it.isNewProduct
          ? (it.category === "custom"
            ? it.customCategory.trim()
            : it.category.trim()) || "General"
          : it.category,
        quantityForSell: Number(it.quantityForSell),
        quantityForUse: Number(it.quantityForUse),
        purchaseCost: Number(it.purchaseCost),
        expectedSellPrice: Number(it.expectedSellPrice),
        isReplacement: it.isReplacement,
        originalPoId: it.originalPoId,
      }));

      const res = await createPurchaseOrderAction({
        supplierId: phoneConflictSupplier
          ? phoneConflictSupplier.id
          : selectedSupplierId || undefined,
        supplierName: trimmedSupplier,
        supplierPhone: supplierPhone.trim()
          ? formatPhoneNumber(supplierPhone)
          : undefined,
        dealerInvoiceNumber: dealerInvoiceNumber.trim() || undefined,
        items: parsedItems,
        settlementMode,
        dueDate: settlementMode === "pending" && dueDate ? dueDate : undefined,
        expectedDeliveryDate:
          (settlementMode === "advance" || settlementMode === "paid_full") &&
            expectedDeliveryDate
            ? expectedDeliveryDate
            : undefined,
        deliveryTime:
          (settlementMode === "advance" || settlementMode === "paid_full") &&
            deliveryTime
            ? deliveryTime
            : undefined,
        paymentMode: currentAmountPaid > 0 ? paymentMode : "credit",
        amountPaid: currentAmountPaid,
        ledgerAdjustment: ledgerAdj !== 0 ? ledgerAdj : undefined,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.updatedProducts) {
        onStockInSuccess(
          res.updatedProducts,
          res.purchaseOrder,
          res.newExpense,
          res.updatedSupplier,
        );
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to record purchase entry");
      }
    } catch {
      setErrorMsg("Network error occurred during purchase entry");
    } finally {
      isSubmittingRef.current = false; setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div
      role="region"
      aria-label="Stock In (Purchase Order)"
      className="fixed inset-0 z-50 bg-galla-paper flex flex-col overflow-y-auto"
    >
      {/* Top Header (Sticky) */}
      <header className="sticky top-0 z-30 bg-galla-surface border-b border-galla-line px-5 sm:px-8 py-3.5 flex items-center justify-between shadow-2xs shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 w-9 rounded-[6px] bg-galla-surface border border-galla-line hover:bg-galla-paper flex items-center justify-center text-galla-ink shadow-2xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
            title="Back to inventory"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-[5px] bg-galla-teal-soft text-galla-teal">
              <PackagePlus className="h-4 w-4" />
            </div>
            <h1 className="text-[16px] font-bold text-galla-ink">Stock In (Purchase Order)</h1>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
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
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-[12.5px] rounded-[6px] flex items-center justify-between gap-2 shadow-2xs">
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

      {/* Main Two-Column Layout */}
      <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start flex-1">
        {/* ====================================================== */}
        {/* LEFT COLUMN: SUPPLIER, ITEMS & PAYMENT TERMS          */}
        {/* ====================================================== */}
        <main className="space-y-6 min-w-0 order-1">
          {/* Card 1: Supplier & Invoice Details */}
          <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-galla-teal" />
              <h2 className="text-[14px] font-bold text-galla-ink uppercase tracking-wider">
                1. Supplier &amp; Invoice Details
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Supplier Name with Autocomplete */}
              <div className="relative">
                <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                  Supplier Name <span className="text-red-600">*</span>
                </label>
                <input
                  ref={supplierInputRef}
                  type="text"
                  autoFocus
                  required
                  value={supplierName}
                  onChange={(e) => {
                    setSupplierName(e.target.value);
                    setSelectedSupplierId(null);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => {
                    if (supplierName.trim().length > 0) setShowSuggestions(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setShowSuggestions(false);
                  }}
                  placeholder="Type supplier or distributor..."
                  className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-2 text-[13px] font-medium text-galla-ink placeholder:text-galla-ink-soft/60 focus:outline-none focus:border-galla-teal transition-all shadow-2xs"
                  autoComplete="off"
                />

                {/* Suggestions Dropdown */}
                {showSuggestions && filteredSuppliers.length > 0 && (
                  <div
                    ref={dropdownRef}
                    className="absolute top-full left-0 z-50 mt-1 w-full sm:w-[320px] min-w-full max-h-56 overflow-y-auto bg-galla-surface border border-galla-line rounded-[5px] shadow-lg divide-y divide-galla-line/60 animate-in fade-in zoom-in-95 duration-100"
                  >
                    <div className="px-3 py-1.5 bg-galla-paper/60 text-[11px] font-semibold text-galla-ink-soft">
                      Existing Suppliers ({filteredSuppliers.length})
                    </div>
                    {filteredSuppliers.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSupplierName(s.name);
                          if (s.phone) setSupplierPhone(s.phone);
                          setSelectedSupplierId(s.id);
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-galla-paper/80 flex flex-col gap-0.5 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-1.5 w-full">
                          <Building2 className="h-3.5 w-3.5 text-galla-teal shrink-0" />
                          <span className="text-[13px] font-semibold text-galla-ink group-hover:text-galla-teal transition-colors">
                            {s.name}
                          </span>
                          {s.companyName && (
                            <span className="text-[11.5px] text-galla-ink-soft font-normal">
                              ({s.companyName})
                            </span>
                          )}
                        </div>
                        {s.phone && (
                          <span className="tabular-nums text-[12px] text-galla-ink-soft pl-5">
                            {s.phone}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dealer Phone */}
              <div>
                <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                  Dealer Phone
                </label>
                <input
                  type="tel"
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  onBlur={() => {
                    if (supplierPhone.trim())
                      setSupplierPhone(formatPhoneNumber(supplierPhone));
                  }}
                  placeholder="+91 98250 00000"
                  className={`w-full bg-galla-surface border rounded-[5px] px-3 py-2 text-[13px] font-medium text-galla-ink placeholder:text-galla-ink-soft/60 focus:outline-none transition-all shadow-2xs ${phoneConflictSupplier
                      ? "border-amber-400 focus:border-amber-500"
                      : "border-galla-line focus:border-galla-teal"
                    }`}
                />
                {phoneConflictSupplier && (
                  <div className="flex items-start gap-1.5 mt-1.5 p-2 bg-amber-50 border border-amber-200 text-amber-900 text-[11.5px] rounded-[6px] font-sans">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                    <div className="leading-tight">
                      <span>This number belongs to </span>
                      <strong>{phoneConflictSupplier.name}</strong>
                      {phoneConflictSupplier.companyName
                        ? ` (${phoneConflictSupplier.companyName})`
                        : ""}
                      . Creating will associate with this supplier.
                      <button
                        type="button"
                        onClick={() => {
                          setSupplierName(phoneConflictSupplier.name);
                          setSelectedSupplierId(phoneConflictSupplier.id);
                        }}
                        className="ml-1.5 underline font-semibold text-amber-800 hover:text-amber-950 cursor-pointer"
                      >
                        Keep {phoneConflictSupplier.name}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Invoice / Bill Number */}
              <div>
                <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                  Invoice / Bill #
                </label>
                <input
                  type="text"
                  value={dealerInvoiceNumber}
                  onChange={(e) => setDealerInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-2026-89"
                  className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-2 text-[13px] font-medium text-galla-ink placeholder:text-galla-ink-soft/60 focus:outline-none focus:border-galla-teal transition-all shadow-2xs font-mono"
                />
              </div>
            </div>

            {/* Pending Dealer Replacements Card */}
            {pendingDealerReplacements.length > 0 && (
              <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-[6px] space-y-2.5 animate-in fade-in duration-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-700" />
                    <span className="font-semibold text-[13px] text-amber-900">
                      Pending Dealer Replacements ({pendingDealerReplacements.length})
                    </span>
                  </div>
                  <span className="text-[11.5px] font-sans text-amber-800">
                    Claim defective pieces back at ₹0 cost
                  </span>
                </div>

                <div className="space-y-2">
                  {pendingDealerReplacements.map((rep, rIdx) => {
                    const isAlreadyAdded = items.some(
                      (it) =>
                        it.isReplacement &&
                        ((it.productId && it.productId === rep.productId) ||
                          it.productName.trim().toLowerCase() === rep.productName.trim().toLowerCase()),
                    );

                    return (
                      <div
                        key={rIdx}
                        className="flex items-center justify-between p-2.5 rounded-[6px] bg-white border border-amber-200/80 gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-sans font-semibold text-[13px] text-galla-ink">
                              {rep.productName}
                            </span>
                            <span className="text-[11px] tabular-nums px-2 py-0.5 rounded-[4px] bg-amber-100 text-amber-900 border border-amber-300 font-medium">
                              {rep.quantity} pcs defective
                            </span>
                            <span className="text-[11.5px] tabular-nums text-galla-ink-soft">
                              From PO #{formatDisplayNumber(rep.purchaseOrderNumber)}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleFillReplacement(rep)}
                          disabled={isAlreadyAdded}
                          className={`shrink-0 px-3 py-1.5 rounded-[5px] font-sans text-[12px] font-semibold transition-all cursor-pointer ${isAlreadyAdded
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                              : "bg-amber-600 hover:bg-amber-700 text-white shadow-2xs"
                            }`}
                        >
                          {isAlreadyAdded ? (
                            <span className="inline-flex items-center gap-1">
                              <Check className="h-3.5 w-3.5" /> Added (@ ₹0)
                            </span>
                          ) : (
                            <span>+ Fill Replacement (@ ₹0)</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Card 2: Products In Batch */}
          <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <PackagePlus className="h-4 w-4 text-galla-teal" />
              <h2 className="text-[14px] font-bold text-galla-ink uppercase tracking-wider">
                2. Purchase Items &amp; Stock Allocation ({items.length})
              </h2>
            </div>

            <div className="space-y-4">
              {items.map((item, idx) => {
                const qSell = Number(item.quantityForSell) || 0;
                const qUse = Number(item.quantityForUse) || 0;
                const cost = Number(item.purchaseCost) || 0;
                const itemTotal = (qSell + qUse) * cost;

                const isDuplicate = items.some(
                  (other, otherIdx) =>
                    otherIdx !== idx &&
                    ((!item.isNewProduct &&
                      !other.isNewProduct &&
                      item.productId === other.productId) ||
                      (Boolean(item.productName.trim()) &&
                        Boolean(other.productName.trim()) &&
                        item.productName.trim().toLowerCase() ===
                        other.productName.trim().toLowerCase())),
                );

                const trimmedNewName = item.productName.trim().toLowerCase();
                const existingInventoryProduct =
                  item.isNewProduct && trimmedNewName && products.length > 0
                    ? products.find(
                      (p) =>
                        p.isActive !== false &&
                        p.name.trim().toLowerCase() === trimmedNewName,
                    )
                    : null;
                const duplicateWarning = existingInventoryProduct
                  ? "A product with this name already exists."
                  : null;

                return (
                  <div
                    key={idx}
                    className={`p-4 bg-galla-paper/30 border rounded-[6px] space-y-3.5 transition-colors ${isDuplicate
                        ? "border-red-300 bg-red-50/20"
                        : "border-galla-line"
                      }`}
                  >
                    {/* Item Card Header */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11.5px] font-bold px-2 py-0.5 rounded-[4px] bg-galla-paper text-galla-ink-soft border border-galla-line">
                          Item #{idx + 1}
                        </span>
                        <span className="text-[13px] font-semibold text-galla-ink">
                          {item.isNewProduct ? "✨ New Catalog Product" : "Catalog Product"}
                        </span>
                      </div>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="inline-flex items-center gap-1 text-[12px] text-galla-ink-soft hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    {/* Product Selection Dropdown */}
                    <div>
                      <select
                        value={item.isNewProduct ? "__new__" : item.productId}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        className={`w-full bg-galla-surface border rounded-[5px] px-3 py-2 text-[13px] font-medium text-galla-ink focus:outline-none focus:border-galla-teal transition-all cursor-pointer shadow-2xs ${isDuplicate ? "border-red-400" : "border-galla-line"
                          }`}
                      >
                        {sortedProducts.length > 0 && (
                          <optgroup label="Catalog Products">
                            {sortedProducts.map((p) => {
                              const isSelectedElsewhere = items.some(
                                (other, otherIdx) =>
                                  otherIdx !== idx &&
                                  other.productId === String(p.id),
                              );
                              return (
                                <option
                                  key={p.id}
                                  value={p.id}
                                  disabled={isSelectedElsewhere}
                                  className={
                                    isSelectedElsewhere
                                      ? "text-galla-ink-soft/40 italic bg-gray-50"
                                      : ""
                                  }
                                >
                                  {p.name}{" "}
                                  {isSelectedElsewhere
                                    ? "(Already added)"
                                    : `(Current Stock: ${p.sell} sell / ${p.use} use)`}
                                </option>
                              );
                            })}
                          </optgroup>
                        )}
                        <optgroup label="New Product Entry">
                          <option value="__new__">✨ + Add New Product...</option>
                        </optgroup>
                      </select>
                    </div>

                    {isDuplicate && (
                      <div className="flex items-center gap-1.5 p-2 bg-red-50 border border-red-200 text-red-700 text-[11.5px] rounded-[6px] font-sans">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                        <span>
                          Duplicate product: already added in another row. Adjust quantities instead.
                        </span>
                      </div>
                    )}

                    {item.isReplacement && (
                      <div className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-300 rounded-[6px] text-[12px] font-sans text-amber-900">
                        <span className="font-semibold flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-amber-700 shrink-0" />
                          Dealer Replacement Item (@ ₹0 cost)
                        </span>
                        <span className="text-[11px] text-amber-800">
                          Clears defective stock &amp; restores shelf stock
                        </span>
                      </div>
                    )}

                    {/* New Product Inline Card */}
                    {item.isNewProduct && (
                      <div className="p-3.5 bg-galla-teal-soft/20 border border-galla-teal/30 rounded-[6px] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-galla-teal">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>New Product Specification</span>
                          </span>
                          <span className="text-[11px] font-sans text-galla-ink-soft">
                            Will be created in catalog automatically
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                          <div>
                            <label className="block text-[12px] font-medium text-galla-ink mb-1">
                              Product Name <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="text"
                              autoFocus
                              value={item.productName}
                              onChange={(e) =>
                                handleItemFieldChange(idx, "productName", e.target.value)
                              }
                              placeholder="e.g. L'Oreal Serum 100ml"
                              className={`w-full bg-galla-surface border rounded-[5px] px-3 py-1.5 text-[13px] text-galla-ink focus:outline-none transition-all ${duplicateWarning
                                  ? "border-amber-400 focus:border-amber-500"
                                  : "border-galla-line focus:border-galla-teal"
                                }`}
                            />

                            {duplicateWarning && (
                              <div className="font-sans text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-[4px] px-2 py-1 mt-1.5 flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                                  <span>{duplicateWarning}</span>
                                </div>
                                {existingInventoryProduct && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleProductSelect(idx, String(existingInventoryProduct.id))
                                    }
                                    className="shrink-0 text-[11px] font-semibold text-amber-900 underline hover:text-amber-950 cursor-pointer ml-1"
                                  >
                                    Select from catalog
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-[12px] font-medium text-galla-ink mb-1">
                              Category <span className="text-red-600">*</span>
                            </label>
                            <select
                              value={item.category}
                              onChange={(e) =>
                                handleItemFieldChange(idx, "category", e.target.value)
                              }
                              className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-1.5 text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal cursor-pointer"
                            >
                              {availableCategories.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                              <option value="custom">+ New Category...</option>
                            </select>
                          </div>
                        </div>

                        {item.category === "custom" && (
                          <div className="text-[12px]">
                            <label className="block text-[12px] font-medium text-galla-ink mb-1">
                              Custom Category Name <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="text"
                              autoFocus
                              value={item.customCategory}
                              onChange={(e) =>
                                handleItemFieldChange(idx, "customCategory", e.target.value)
                              }
                              placeholder="Type new category name (e.g. Organic Hair Care)..."
                              className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-1.5 text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quantity & Cost Grid (Clean 4-column layout) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11.5px] font-medium text-galla-ink mb-1">
                          + Retail Sell Stock
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.quantityForSell}
                            onChange={(e) =>
                              handleItemFieldChange(idx, "quantityForSell", e.target.value)
                            }
                            className="w-full bg-galla-surface border border-galla-line rounded-[5px] pl-3 pr-8 py-1.5 text-[13px] font-medium text-galla-ink focus:outline-none focus:border-galla-teal tabular-nums shadow-2xs"
                            placeholder="0"
                          />
                          <span className="absolute right-2.5 text-[11px] font-sans text-galla-ink-soft pointer-events-none">
                            pcs
                          </span>
                        </div>
                        <span className="text-[10.5px] text-galla-ink-soft mt-0.5 block">
                          For counter sale
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11.5px] font-medium text-galla-ink mb-1">
                          + Salon Use Stock
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.quantityForUse}
                            onChange={(e) =>
                              handleItemFieldChange(idx, "quantityForUse", e.target.value)
                            }
                            className="w-full bg-galla-surface border border-galla-line rounded-[5px] pl-3 pr-8 py-1.5 text-[13px] font-medium text-galla-ink focus:outline-none focus:border-galla-teal tabular-nums shadow-2xs"
                            placeholder="0"
                          />
                          <span className="absolute right-2.5 text-[11px] font-sans text-galla-ink-soft pointer-events-none">
                            pcs
                          </span>
                        </div>
                        <span className="text-[10.5px] text-galla-ink-soft mt-0.5 block">
                          For treatments
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11.5px] font-medium text-galla-ink mb-1">
                          Unit Purchase Cost
                        </label>
                        <div className="relative flex items-center">
                          <IndianRupee className="absolute left-2.5 h-3.5 w-3.5 text-galla-ink-soft/60 pointer-events-none" />
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.purchaseCost}
                            onChange={(e) =>
                              handleItemFieldChange(idx, "purchaseCost", e.target.value)
                            }
                            className="w-full bg-galla-surface border border-galla-line rounded-[5px] pl-8 pr-3 py-1.5 text-[13px] font-medium text-galla-ink focus:outline-none focus:border-galla-teal tabular-nums shadow-2xs"
                            placeholder="0"
                          />
                        </div>
                        <span className="text-[10.5px] text-galla-ink-soft mt-0.5 block">
                          Wholesale buy cost
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11.5px] font-medium text-galla-ink mb-1">
                          Retail Sell Price
                        </label>
                        <div className="relative flex items-center">
                          <IndianRupee className="absolute left-2.5 h-3.5 w-3.5 text-galla-ink-soft/60 pointer-events-none" />
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.expectedSellPrice}
                            onChange={(e) =>
                              handleItemFieldChange(idx, "expectedSellPrice", e.target.value)
                            }
                            className="w-full bg-galla-surface border border-galla-line rounded-[5px] pl-8 pr-3 py-1.5 text-[13px] font-medium text-galla-ink focus:outline-none focus:border-galla-teal tabular-nums shadow-2xs"
                            placeholder="0"
                          />
                        </div>
                        <span className="text-[10.5px] text-galla-ink-soft mt-0.5 block">
                          Counter retail price
                        </span>
                      </div>
                    </div>

                    {/* New Price Detected Banner */}
                    {(() => {
                      const matched = products.find((p) => String(p.id) === item.productId);
                      const isPriceChanged =
                        matched &&
                        ((matched.price !== undefined &&
                          Number(item.expectedSellPrice) !== matched.price) ||
                          (matched.purchaseCost !== undefined &&
                            Number(item.purchaseCost) !== matched.purchaseCost));
                      if (!isPriceChanged) return null;
                      return (
                        <div className="text-[11.5px] font-sans text-blue-800 bg-blue-50/80 border border-blue-200/80 px-2.5 py-1.5 rounded-[6px]">
                          ✨ <strong>New Price Detected:</strong> Incoming stock will be automatically saved as a separate <em>(New)</em> batch, leaving current stock as <em>(Old)</em>.
                        </div>
                      );
                    })()}

                    {/* Card Subtotal Bar */}
                    <div className="flex items-center justify-between text-[12px] pt-2 border-t border-galla-line/60">
                      <span className="text-galla-ink-soft">
                        Total Units: <strong className="text-galla-ink font-semibold">{qSell + qUse} pcs</strong>
                      </span>
                      <span className="font-bold text-[13px] text-galla-teal tabular-nums">
                        Subtotal: {formatRupee(itemTotal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              className="w-full py-2.5 rounded-[5px] border border-dashed border-galla-line hover:border-galla-teal text-galla-ink-soft hover:text-galla-teal text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-galla-paper/20 hover:bg-galla-paper/50"
            >
              <Plus className="h-4 w-4" />
              <span>Add Another Item</span>
            </button>
          </section>

          {/* Card 3: Settlement Terms & Payment */}
          <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-4">
            <h2 className="text-[14px] font-bold text-galla-ink uppercase tracking-wider">
              3. Settlement Terms &amp; Payment
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SettlementModeSelect
                value={settlementMode}
                onChange={setSettlementMode}
              />

              {(settlementMode !== "pending" || enteredPayLaterPaid > 0) && (
                <PaymentModeSelect
                  label={
                    settlementMode === "pending"
                      ? `Mode of Upfront Payment (${formatRupee(enteredPayLaterPaid)})`
                      : settlementMode === "advance"
                        ? `Mode of Advance Payment (${formatRupee(enteredAdvance)})`
                        : "Mode of Payment"
                  }
                  value={paymentMode}
                  onChange={setPaymentMode}
                  allowedModes={["cash", "upi", "card", "bank_transfer"]}
                />
              )}
            </div>

            {/* Pending / Pay Later Card */}
            {settlementMode === "pending" && (
              <div className="p-4 rounded-[6px] space-y-3 border bg-amber-50/40 border-amber-300/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[12px] font-medium text-galla-ink">
                        Amount Paid Now (₹){" "}
                        <span className="text-galla-ink-soft/70 font-normal">(Optional)</span>
                      </label>
                      <span className="text-[11.5px] font-sans text-galla-ink-soft">
                        Pending:{" "}
                        <strong className="text-rose-700 font-semibold">
                          {formatRupee(amountPending)}
                        </strong>
                      </span>
                    </div>
                    <input
                      type="text"
                      value={payLaterPaid}
                      onChange={(e) => setPayLaterPaid(e.target.value.replace(/\D/g, ""))}
                      placeholder={`0 (Full ${formatRupee(totalCalculatedCost)} due later)`}
                      className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-2 text-[13px] font-medium tabular-nums text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-amber-500 transition-all shadow-2xs"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[12px] font-medium text-galla-ink">
                        Expected Payment Due Date{" "}
                        <span className="text-galla-ink-soft/70 font-normal">(Optional)</span>
                      </label>
                      {dueDate && (
                        <button
                          type="button"
                          onClick={() => setDueDate("")}
                          className="text-[11px] text-galla-ink-soft hover:text-red-600 transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <input
                      type="date"
                      value={dueDate}
                      min={getLocalDateString()}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-2 text-[12.5px] font-sans text-galla-ink focus:outline-none focus:border-amber-500 transition-all cursor-pointer shadow-2xs"
                    />
                  </div>
                </div>

                <p className="text-[11.5px] text-galla-ink-soft leading-snug">
                  ℹ️ Purchase order will be recorded with{" "}
                  <strong className="text-amber-800 font-semibold">Payment Due</strong>. You can settle the remaining balance anytime in the Suppliers &amp; Purchase Bills register.
                </p>
              </div>
            )}

            {/* Advance / Paid in Full Details Card */}
            {(settlementMode === "advance" || settlementMode === "paid_full") && (
              <div
                className={`p-4 rounded-[6px] space-y-3 border ${settlementMode === "advance"
                    ? "bg-galla-brass-soft/40 border-galla-brass/30"
                    : "bg-galla-teal-soft/40 border-galla-teal/30"
                  }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {settlementMode === "advance" && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[12px] font-medium text-galla-ink">
                          Advance Paid (₹) <span className="text-red-500">*</span>
                        </label>
                        {advance.trim() !== "" && Number(advance) > 0 && (
                          <span className="text-[11px] font-sans text-galla-ink-soft">
                            Pending:{" "}
                            <strong className="text-red-700">
                              {formatRupee(amountPending)}
                            </strong>
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={advance}
                        onChange={(e) => setAdvance(e.target.value.replace(/\D/g, ""))}
                        placeholder="e.g. 500"
                        className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-2 text-[13px] font-medium tabular-nums text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-brass transition-all shadow-2xs"
                      />
                    </div>
                  )}

                  <div className={settlementMode === "advance" ? "sm:col-span-1" : "sm:col-span-2"}>
                    <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                      Expected Arrival Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={expectedDeliveryDate}
                      min={getLocalDateString()}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                      className={`w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-2 text-[12.5px] font-sans text-galla-ink focus:outline-none transition-all cursor-pointer shadow-2xs ${settlementMode === "advance"
                          ? "focus:border-galla-brass"
                          : "focus:border-galla-teal"
                        }`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[12px] font-medium text-galla-ink">
                        Expected Time{" "}
                        <span className="text-galla-ink-soft/70 font-normal">(Optional)</span>
                      </label>
                      {deliveryTime && (
                        <button
                          type="button"
                          onClick={() => setDeliveryTime("")}
                          className="text-[11px] text-galla-ink-soft hover:text-red-600 transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <input
                      type="time"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      className={`w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-2 text-[12.5px] font-sans text-galla-ink focus:outline-none transition-all cursor-pointer shadow-2xs ${settlementMode === "advance"
                          ? "focus:border-galla-brass"
                          : "focus:border-galla-teal"
                        }`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[12px] pt-1.5 border-t border-galla-line/40 text-galla-ink-soft">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-galla-teal" />
                    <span>
                      Expected delivery:{" "}
                      <strong className="text-galla-ink font-semibold">
                        {formatBookingDate(expectedDeliveryDate) || "Not scheduled"}
                        {deliveryTime ? ` at ${formatAppointmentTime(deliveryTime)}` : ""}
                      </strong>
                    </span>
                  </span>
                  {settlementMode === "advance" ? (
                    advance.trim() !== "" && Number(advance) > 0 ? (
                      <span>
                        Remaining due: <strong className="text-rose-700 font-semibold">{formatRupee(amountPending)}</strong>
                      </span>
                    ) : null
                  ) : (
                    <span className="text-galla-teal font-semibold">
                      Paid in Full ({formatRupee(totalCalculatedCost)})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Notes / Memo (Optional) */}
            <div>
              <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                PO Notes / Memo <span className="text-galla-ink-soft/70 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Batch notes, vendor payment conditions, delivery instructions..."
                className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-2 text-[13px] font-medium text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal transition-all shadow-2xs"
              />
            </div>
          </section>
        </main>

        {/* ====================================================== */}
        {/* RIGHT COLUMN: PO SUMMARY & SETTLEMENT                   */}
        {/* ====================================================== */}
        <aside className="bg-galla-surface border border-galla-line rounded-[8px] shadow-xs overflow-hidden flex flex-col lg:sticky lg:top-[68px] lg:max-h-[calc(100vh-92px)] order-2">
          {/* Summary Header */}
          <div className="p-4 border-b border-galla-line/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold text-galla-ink">PO Summary</h2>
              {items.length > 0 && (
                <span className="text-[11.5px] font-medium px-2 py-0.5 rounded-[4px] bg-galla-teal-soft text-galla-teal">
                  {items.length} {items.length === 1 ? "product" : "products"}
                </span>
              )}
            </div>
            <span className="text-[12px] font-semibold text-galla-ink-soft tabular-nums">
              {totalUnits} pcs total
            </span>
          </div>

          {/* Items Breakdown List */}
          <div className="flex-1 overflow-y-auto p-4 divide-y divide-galla-line/40 min-h-[140px] max-h-[300px] lg:max-h-[340px]">
            {items.length === 0 ? (
              <div className="py-10 text-center text-galla-ink-soft border border-dashed border-galla-line rounded-[6px] bg-galla-paper/30">
                <p className="text-[13px] font-medium">No items in this purchase order</p>
                <p className="text-[11.5px] mt-0.5">Add products on the left</p>
              </div>
            ) : (
              items.map((item, idx) => {
                const qSell = Number(item.quantityForSell) || 0;
                const qUse = Number(item.quantityForUse) || 0;
                const cost = Number(item.purchaseCost) || 0;
                const itemTotal = (qSell + qUse) * cost;
                const displayName = item.productName.trim() || `Item #${idx + 1}`;

                return (
                  <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-[12.5px]">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-galla-ink truncate" title={displayName}>
                        {displayName}
                      </div>
                      <div className="text-[11px] text-galla-ink-soft flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="tabular-nums font-medium">
                          {qSell + qUse} pcs ({qSell} sell / {qUse} use)
                        </span>
                        <span>&bull;</span>
                        <span className="tabular-nums">
                          {formatRupee(cost)}/pc
                        </span>
                        {item.isReplacement && (
                          <span className="text-amber-800 font-medium">
                            &bull; Replacement
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="font-bold text-[13px] text-galla-ink tabular-nums shrink-0 text-right">
                      {formatRupee(itemTotal)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Financial Breakdown & Actions */}
          <div className="p-4 border-t border-galla-line/60 bg-galla-surface space-y-3.5 shrink-0">
            {/* Supplier Ledger Balance checkbox if applicable */}
            {matchedSupplier && supplierPending !== 0 && isLedgerBalanceApplicable && (
              <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-[6px] text-[12px]">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={applyLedgerBalance}
                    onChange={(e) => setApplyLedgerBalance(e.target.checked)}
                    className="h-4 w-4 mt-0.5 rounded-[4px] border-amber-400 text-galla-teal focus:ring-galla-teal cursor-pointer shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-galla-ink flex items-center justify-between">
                      <span>
                        {supplierPending < 0 ? "Apply Supplier Credit" : "Settle Past Dues"}
                      </span>
                      <span className={supplierPending < 0 ? "text-emerald-700" : "text-rose-700"}>
                        {supplierPending < 0 ? "-" : "+"}
                        {formatRupee(Math.abs(supplierPending))}
                      </span>
                    </div>
                    <p className="text-[11px] text-galla-ink-soft mt-0.5 leading-snug">
                      {supplierPending < 0
                        ? "Credit balance from previous returns applied to this bill."
                        : "Outstanding supplier dues added to this payment."}
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Calculations Breakdown */}
            <div className="space-y-1 text-[12.5px]">
              <div className="flex justify-between text-galla-ink-soft">
                <span>Total Batch Cost</span>
                <span className="tabular-nums font-medium text-galla-ink">
                  {formatRupee(totalCalculatedCost)}
                </span>
              </div>

              {effectiveApplyLedgerBalance && supplierPending !== 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Ledger Adjustment</span>
                  <span className="tabular-nums font-medium">
                    {supplierPending < 0 ? "- " : "+ "}
                    {formatRupee(Math.abs(supplierPending))}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-2 border-t border-galla-line text-[16px] font-bold text-galla-ink">
                <span>{effectiveApplyLedgerBalance ? "Net Payable" : "Total Payable"}</span>
                <span className="text-xl tabular-nums text-galla-teal">
                  {formatRupee(effectiveApplyLedgerBalance ? minPayable : totalCalculatedCost)}
                </span>
              </div>

              {/* Settlement specifics */}
              {settlementMode === "pending" && (
                <div className="pt-1.5 text-[11.5px] space-y-0.5 border-t border-galla-line/40">
                  <div className="flex justify-between text-galla-ink font-medium">
                    <span>Paid Upfront Now</span>
                    <span className="tabular-nums">{formatRupee(enteredPayLaterPaid)}</span>
                  </div>
                  <div className="flex justify-between text-rose-700 font-semibold">
                    <span>Pending Due Later</span>
                    <span className="tabular-nums">{formatRupee(amountPending)}</span>
                  </div>
                </div>
              )}

              {settlementMode === "advance" && (
                <div className="pt-1.5 text-[11.5px] space-y-0.5 border-t border-galla-line/40">
                  <div className="flex justify-between text-teal-800 font-medium">
                    <span>Advance Paid Now</span>
                    <span className="tabular-nums">{formatRupee(enteredAdvance)}</span>
                  </div>
                  <div className="flex justify-between text-rose-700 font-semibold">
                    <span>Balance Due Upon Delivery</span>
                    <span className="tabular-nums">{formatRupee(amountPending)}</span>
                  </div>
                </div>
              )}

              {settlementMode === "paid_full" && (
                <div className="pt-1.5 text-[11.5px] flex justify-between text-teal-800 font-medium border-t border-galla-line/40">
                  <span>Advance Status</span>
                  <span>100% Paid in Full</span>
                </div>
              )}
            </div>

            {/* Create PO CTA Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={isSubmitting || items.length === 0 || !supplierName.trim()}
                className="w-full py-3 rounded-[5px] bg-galla-teal hover:opacity-95 text-white font-semibold text-[14px] shadow-sm disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2 transition-all"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Recording Purchase...</span>
                  </span>
                ) : (
                  <span>
                    {settlementMode === "pending"
                      ? enteredPayLaterPaid > 0
                        ? `Confirm Stock In (Paid: ${formatRupee(enteredPayLaterPaid)}, Due: ${formatRupee(amountPending)})`
                        : `Confirm Stock In (Due: ${formatRupee(totalCalculatedCost)})`
                      : settlementMode === "advance"
                        ? `Confirm Stock In (Advance: ${formatRupee(enteredAdvance)}, Due: ${formatRupee(amountPending)})`
                        : settlementMode === "paid_full"
                          ? `Confirm Stock In (Paid in Full: ${formatRupee(totalCalculatedCost)})`
                          : `Confirm Stock In (${formatRupee(effectiveApplyLedgerBalance ? minPayable : totalCalculatedCost)})`}
                  </span>
                )}
              </button>

              {!supplierName.trim() && items.length > 0 && (
                <p className="text-[11.5px] text-galla-ink-soft text-center mt-1.5">
                  Enter supplier name on the left to complete purchase order
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>


      <ConfirmModal
        isOpen={showConfirm}
        title={
          settlementMode === "pending"
            ? "Confirm Pay Later Stock In"
            : settlementMode === "advance"
              ? "Confirm Advance Stock In"
              : settlementMode === "paid_full"
                ? "Confirm Paid in Full Stock In"
                : "Confirm Stock In"
        }
        description={
          settlementMode === "pending" ? (
            <span>
              Record purchase order from{" "}
              <strong className="font-semibold text-galla-ink">
                &ldquo;{supplierName.trim()}&rdquo;
              </strong>{" "}
              for{" "}
              <strong className="font-semibold text-galla-ink">
                {items.length} item(s)
              </strong>{" "}
              totalling{" "}
              <strong className="font-semibold text-galla-ink">
                {formatRupee(totalCalculatedCost)}
              </strong>{" "}
              with{" "}
              {enteredPayLaterPaid > 0 ? (
                <>
                  upfront payment of{" "}
                  <strong className="font-semibold text-galla-ink">
                    {formatRupee(enteredPayLaterPaid)}
                  </strong>{" "}
                  via{" "}
                  <strong className="font-semibold text-galla-ink">
                    {paymentMode.toUpperCase().replace("_", " ")}
                  </strong>{" "}
                  and{" "}
                </>
              ) : null}
              remaining due balance of{" "}
              <strong className="font-semibold text-rose-700">
                {formatRupee(amountPending)}
              </strong>
              {dueDate ? ` due by ${formatBookingDate(dueDate)}` : ""}?
            </span>
          ) : settlementMode === "advance" ? (
            <span>
              Record advance purchase order from{" "}
              <strong className="font-semibold text-galla-ink">
                &ldquo;{supplierName.trim()}&rdquo;
              </strong>{" "}
              with deposit of{" "}
              <strong className="font-semibold text-galla-ink">
                {formatRupee(enteredAdvance)}
              </strong>{" "}
              via{" "}
              <strong className="font-semibold text-galla-ink">
                {paymentMode.toUpperCase().replace("_", " ")}
              </strong>{" "}
              and pending balance of{" "}
              <strong className="font-semibold text-rose-700">
                {formatRupee(amountPending)}
              </strong>
              {expectedDeliveryDate
                ? ` (Expected arrival: ${formatBookingDate(expectedDeliveryDate)}${deliveryTime ? ` at ${formatAppointmentTime(deliveryTime)}` : ""})`
                : ""}
              ?
            </span>
          ) : settlementMode === "paid_full" ? (
            <span>
              Record 100% advance purchase order from{" "}
              <strong className="font-semibold text-galla-ink">
                &ldquo;{supplierName.trim()}&rdquo;
              </strong>{" "}
              for{" "}
              <strong className="font-semibold text-galla-ink">
                {formatRupee(totalCalculatedCost)}
              </strong>{" "}
              via{" "}
              <strong className="font-semibold text-galla-ink">
                {paymentMode.toUpperCase().replace("_", " ")}
              </strong>
              {expectedDeliveryDate
                ? ` (Expected arrival: ${formatBookingDate(expectedDeliveryDate)}${deliveryTime ? ` at ${formatAppointmentTime(deliveryTime)}` : ""})`
                : ""}
              ?
            </span>
          ) : (
            <span>
              Record purchase order from{" "}
              <strong className="font-semibold text-galla-ink">
                &ldquo;{supplierName.trim()}&rdquo;
              </strong>{" "}
              for{" "}
              <strong className="font-semibold text-galla-ink">
                {items.length} item(s)
              </strong>{" "}
              totalling{" "}
              <strong className="font-semibold text-galla-ink">
                {formatRupee(totalCalculatedCost)}
              </strong>{" "}
              via{" "}
              <strong className="font-semibold text-galla-ink">
                {paymentMode.toUpperCase().replace("_", " ")}
              </strong>
              ? Inventory stock levels will be updated atomically.
            </span>
          )
        }
        confirmLabel="Confirm & Record"
        isLoading={isSubmitting}
        onConfirm={executeStockIn}
        onClose={() => setShowConfirm(false)}
      />
    </div>
  );
}
