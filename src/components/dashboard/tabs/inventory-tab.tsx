"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  PackagePlus,
  Search,
  X,
  Plus,
  Tag,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
  TrendingUp,
} from "lucide-react";
import { DashboardProduct, DashboardExpense, DashboardSupplier, DashboardPurchaseOrder } from "@/types/dashboard";
import { formatRupee } from "@/lib/utils";
import { TransferStockModal } from "@/components/dashboard/modals/transfer-stock-modal";
import { StockInModal } from "@/components/dashboard/modals/stock-in-modal";
import { ProductModal } from "@/components/dashboard/modals/product-modal";
import { ConfirmModal } from "@/components/dashboard/modals/confirm-modal";
import { SettleReplacementModal } from "@/components/dashboard/modals/settle-replacement-modal";
import { deleteProductAction } from "@/app/dashboard/actions";

interface InventoryTabProps {
  products: DashboardProduct[];
  suppliers?: DashboardSupplier[];
  onMoveStock?: (id: number | string) => void;
  onStockInSuccess?: (
    updatedProducts: DashboardProduct[],
    createdPO?: DashboardPurchaseOrder,
    newExpense?: DashboardExpense,
    updatedSupplier?: DashboardSupplier
  ) => void;
  onTransferSuccess?: (updatedProduct: DashboardProduct, newExpense?: DashboardExpense) => void;
  onAddProduct?: (newProduct: DashboardProduct) => void;
  onUpdateProduct?: (updatedProduct: DashboardProduct) => void;
  onDeleteProduct?: (productId: string | number) => void;
}

export function InventoryTab({
  products,
  suppliers = [],
  onMoveStock,
  onStockInSuccess,
  onTransferSuccess,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
}: InventoryTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isFetching, setIsFetching] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isInitialMount = useRef(true);

  // Pagination state (20 per page, matching Orders logic)
  const pageSize = 20;
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState<number>(() =>
    products.filter((p) => p.isActive !== false).length
  );
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Modals & View state
  const [transferTargetProduct, setTransferTargetProduct] = useState<DashboardProduct | null>(null);
  const [settleTargetProduct, setSettleTargetProduct] = useState<DashboardProduct | null>(null);
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<DashboardProduct | null>(null);
  const [productToDelete, setProductToDelete] = useState<DashboardProduct | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Lock background scrolling when any inventory modal is open
  const isAnyModalOpen = Boolean(
    transferTargetProduct || settleTargetProduct || isStockInModalOpen || isProductModalOpen || productToDelete
  );

  useEffect(() => {
    if (!isAnyModalOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isAnyModalOpen]);

  // In-memory filter helper for 0ms instant UI feedback (low stock products on top by default)
  const filterInMemory = useCallback(
    (cat: string, query: string, lowStock: boolean) => {
      const filtered = products.filter((p) => {
        if (p.isActive === false) return false;
        const q = query.trim().toLowerCase();
        const matchesSearch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.category && p.category.toLowerCase().includes(q));
        const matchesLowStock = !lowStock || p.sell <= (p.lowStockThreshold ?? 2);
        const matchesCategory =
          cat === "all" || (p.category && p.category.toLowerCase() === cat.toLowerCase());
        return matchesSearch && matchesLowStock && matchesCategory;
      });

      return filtered.sort((a, b) => {
        const aLow = a.sell <= (a.lowStockThreshold ?? 2);
        const bLow = b.sell <= (b.lowStockThreshold ?? 2);

        if (aLow && !bLow) return -1;
        if (!aLow && bLow) return 1;

        if (aLow && bLow) {
          if (a.sell !== b.sell) return a.sell - b.sell;
          return a.name.localeCompare(b.name);
        }

        return a.name.localeCompare(b.name);
      });
    },
    [products]
  );

  // Sync displayed products state with prop changes
  const [prevProducts, setPrevProducts] = useState(products);
  const [displayedProducts, setDisplayedProducts] = useState<DashboardProduct[]>(() => {
    const initial = filterInMemory("all", "", false);
    return initial.slice(0, pageSize);
  });

  // Extract unique categories from active products
  const existingCategories = useMemo(() => {
    const cats = Array.from(
      new Set(
        products
          .filter((p) => p.isActive !== false)
          .map((p) => p.category?.trim())
          .filter(Boolean)
      )
    ) as string[];
    return cats.sort();
  }, [products]);

  // Identify products with higher profit among old/new batches or price variants
  const higherProfitProductIds = useMemo(() => {
    // ponytail: Regex grouping assumes standard salon batch naming conventions (Old/New/Batch #). Upgrade path: explicit parentProductId or productFamilyId field in schema for multi-batch tracking.
    const groups: Record<string, DashboardProduct[]> = {};

    for (const p of products) {
      if (!p.name) continue;
      const baseName = p.name
        .replace(/\s*\((?:old|new)(?:\s+batch)?\)$/i, "")
        .replace(/\s*\(batch[^\)]*\)$/i, "")
        .trim()
        .toLowerCase();

      if (!groups[baseName]) {
        groups[baseName] = [];
      }
      groups[baseName].push(p);
    }

    const bestIds = new Set<string>();

    for (const group of Object.values(groups)) {
      if (group.length < 2) continue;

      const variants = group
        .filter((p) => typeof p.price === "number")
        .map((p) => {
          const profit =
            typeof p.purchaseCost === "number"
              ? p.price - p.purchaseCost
              : p.price;
          return {
            id: String(p.id),
            profit,
          };
        });

      if (variants.length < 2) continue;

      const profits = variants.map((v) => v.profit);
      const maxProfit = Math.max(...profits);
      const minProfit = Math.min(...profits);

      if (maxProfit > minProfit) {
        for (const v of variants) {
          if (v.profit === maxProfit) {
            bestIds.add(v.id);
          }
        }
      }
    }

    return bestIds;
  }, [products]);


  // Keep displayed products in sync when products prop changes
  if (products !== prevProducts) {
    setPrevProducts(products);
    const updated = filterInMemory(selectedCategory, searchQuery, filterLowStockOnly);
    setTotalCount(updated.length);
    const maxPage = Math.max(1, Math.ceil(updated.length / pageSize));
    const targetPage = Math.min(page, maxPage);
    if (targetPage !== page) setPage(targetPage);
    setDisplayedProducts(updated.slice((targetPage - 1) * pageSize, targetPage * pageSize));
  }

  // On-demand fast GET fetch for pagination and filters (matching Orders tab logic)
  const fetchPage = useCallback(
    async (
      targetPage: number,
      currentCategory: string,
      currentSearch: string,
      currentLowStock: boolean
    ) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsFetching(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(targetPage));
        params.set("pageSize", String(pageSize));
        if (currentCategory !== "all") params.set("category", currentCategory);
        if (currentSearch.trim()) params.set("search", currentSearch.trim());
        if (currentLowStock) params.set("lowStockOnly", "true");

        const res = await fetch(`/api/products?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }

        const data = await res.json();
        if (data.success && Array.isArray(data.products)) {
          setDisplayedProducts(data.products);
          setTotalCount(data.totalCount);
          setPage(data.page || targetPage);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("Failed to load page of products:", err);
        // Seamless fallback to in-memory slicing
        const inMem = filterInMemory(currentCategory, currentSearch, currentLowStock);
        setTotalCount(inMem.length);
        setPage(targetPage);
        setDisplayedProducts(inMem.slice((targetPage - 1) * pageSize, targetPage * pageSize));
      } finally {
        setIsFetching(false);
      }
    },
    [pageSize, filterInMemory]
  );

  // Debounce search input (300ms) to prevent excessive requests while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Execute GET fetch on category/lowStock change or debounced search
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setPage(1);
    fetchPage(1, selectedCategory, debouncedSearch, filterLowStockOnly);
  }, [selectedCategory, debouncedSearch, filterLowStockOnly, fetchPage]);

  // Instant in-memory filter on button click (0ms visual feedback)
  const handleFilterClick = (newCategory: string) => {
    setSelectedCategory(newCategory);
    setPage(1);
    const inMem = filterInMemory(newCategory, searchQuery, filterLowStockOnly);
    setTotalCount(inMem.length);
    setDisplayedProducts(inMem.slice(0, pageSize));
  };


  const handleResetFilters = () => {
    setSelectedCategory("all");
    setSearchQuery("");
    setDebouncedSearch("");
    setFilterLowStockOnly(false);
    setPage(1);
    const inMem = filterInMemory("all", "", false);
    setTotalCount(inMem.length);
    setDisplayedProducts(inMem.slice(0, pageSize));
  };

  const handleOpenTransfer = (product: DashboardProduct) => {
    setTransferTargetProduct(product);
  };

  const handleTransferComplete = (
    updatedProduct: DashboardProduct,
    newExpense?: DashboardExpense
  ) => {
    setDisplayedProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    if (onTransferSuccess) {
      onTransferSuccess(updatedProduct, newExpense);
    } else if (onMoveStock) {
      onMoveStock(updatedProduct.id);
    }
  };

  const handleOpenCreate = () => {
    setProductToEdit(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEdit = (product: DashboardProduct) => {
    setProductToEdit(product);
    setIsProductModalOpen(true);
  };

  const executeDeleteProduct = async () => {
    if (!productToDelete) return;

    setIsDeleting(true);
    try {
      const res = await deleteProductAction({ id: String(productToDelete.id) });
      if (res.success) {
        onDeleteProduct?.(productToDelete.id);
        setProductToDelete(null);
      } else {
        alert(res.error || "Failed to delete product");
      }
    } catch {
      alert("A network error occurred while deleting product");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-heading font-semibold text-[21px] tracking-[-0.015em] text-galla-ink">
            Retail &amp; Salon Inventory
          </h2>
          <p className="font-sans text-[13px] text-galla-ink-soft mt-0.5">
            Dual split stock: Retail for customer sale &bull; Internal consumption for treatments
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 bg-galla-teal hover:opacity-95 text-white font-sans text-[13px] font-medium px-[13px] py-[8px] rounded-[5px] shadow-sm transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
          <button
            type="button"
            onClick={() => setIsStockInModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-galla-surface border border-galla-line hover:bg-galla-paper text-galla-ink font-sans text-[13px] font-medium px-[13px] py-[8px] rounded-[5px] shadow-2xs transition-all cursor-pointer"
          >
            <PackagePlus className="h-4 w-4 text-galla-teal" />
            <span>Stock In (PO)</span>
          </button>
        </div>
      </div>


      {/* 1. Search Bar (First Row, matching Orders & Expenses tab) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line w-full sm:w-72 focus-within:border-galla-teal focus-within:ring-1 focus-within:ring-galla-teal transition-all shadow-xs">
          <Search className="h-4 w-4 text-galla-ink-soft shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              setPage(1);
              const inMem = filterInMemory(selectedCategory, val, filterLowStockOnly);
              setTotalCount(inMem.length);
              setDisplayedProducts(inMem.slice(0, pageSize));
            }}
            placeholder="Search products by name or category..."
            className="w-full bg-transparent font-sans text-[13px] text-galla-ink placeholder:text-galla-ink-soft/50 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setDebouncedSearch("");
                setPage(1);
                const inMem = filterInMemory(selectedCategory, "", filterLowStockOnly);
                setTotalCount(inMem.length);
                setDisplayedProducts(inMem.slice(0, pageSize));
              }}
              className="text-galla-ink-soft hover:text-galla-ink cursor-pointer p-0.5"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Category Pills Filter & Reset Action (Second Row, matching Orders & Expenses tab) */}
      {existingCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleFilterClick("all")}
            className={`px-[13px] py-[6px] rounded-[5px] text-[13px] font-sans font-medium transition-all cursor-pointer border ${
              selectedCategory === "all"
                ? "bg-galla-teal text-white border-galla-teal shadow-xs"
                : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink hover:border-galla-ink-soft/40"
            }`}
          >
            All Categories ({products.filter((p) => p.isActive !== false).length})
          </button>
          {existingCategories.map((cat) => {
            const count = products.filter(
              (p) => p.isActive !== false && p.category === cat
            ).length;
            const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                type="button"
                key={cat}
                onClick={() => handleFilterClick(cat)}
                className={`px-[13px] py-[6px] rounded-[5px] text-[13px] font-sans font-medium transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-galla-teal text-white border-galla-teal shadow-xs"
                    : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink hover:border-galla-ink-soft/40"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}

          {(searchQuery || selectedCategory !== "all" || filterLowStockOnly) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="ml-auto text-[12.5px] font-sans text-galla-teal hover:underline font-medium cursor-pointer whitespace-nowrap py-1"
            >
              Reset all filters
            </button>
          )}
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-galla-surface border border-galla-line rounded-[6px] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[920px]">
            <thead>
              <tr className="border-b border-galla-line bg-galla-paper/70 font-heading text-[11px] font-semibold text-galla-ink-soft uppercase tracking-[0.06em]">
                <th className="w-[24%] py-3.5 pl-6 pr-4 text-left font-semibold">Product</th>
                <th className="w-[18%] py-3.5 px-4 text-left font-semibold">Category</th>
                <th className="w-[12%] py-3.5 px-4 text-right font-semibold whitespace-nowrap">Purchase Price</th>
                <th className="w-[11%] py-3.5 px-4 text-right font-semibold whitespace-nowrap">Sell Price</th>
                <th className="w-[12%] py-3.5 px-4 text-center font-semibold whitespace-nowrap">Sell Stock</th>
                <th className="w-[9%] py-3.5 px-4 text-center font-semibold whitespace-nowrap">Use Stock</th>
                <th className="w-[8%] py-3.5 px-4 text-center font-semibold whitespace-nowrap">Move / Use</th>
                <th className="w-[6%] py-3.5 pl-4 pr-6 text-right font-semibold whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-galla-line">
              {displayedProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-16 text-center text-galla-ink-soft text-[14px] font-sans"
                  >
                    No products found matching your search or category filter.
                  </td>
                </tr>
              ) : (
                displayedProducts.map((product) => {
                  const isLowStock =
                    product.isActive !== false &&
                    product.sell <= (product.lowStockThreshold ?? 2);
                  const isInactive = product.isActive === false;

                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-galla-paper/40 transition-colors ${
                        isInactive ? "opacity-60 bg-gray-50/50" : ""
                      }`}
                    >
                      {/* Product Name */}
                      <td className="py-3.5 pl-6 pr-4 align-middle">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-sans font-semibold text-[14px] text-galla-ink">
                            {product.name}
                          </span>
                          {product.name.includes("(Old)") && (
                            <span className="text-[10px] font-heading font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                              Old Batch
                            </span>
                          )}
                          {product.name.includes("(New)") && (
                            <span className="text-[10px] font-heading font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                              New Batch
                            </span>
                          )}
                          {higherProfitProductIds.has(String(product.id)) && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs"
                              title="This product variant yields higher profit for the salon"
                            >
                              <TrendingUp className="h-3 w-3 text-emerald-600 shrink-0" />
                              <span>More Profit &bull; Best to Sell</span>
                            </span>
                          )}
                        </div>
                        {product.description && (
                          <div className="font-sans text-[12px] text-galla-ink-soft truncate max-w-xs mt-0.5" title={product.description}>
                            {product.description}
                          </div>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-4 align-middle">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-galla-paper border border-galla-line text-[12px] font-sans text-galla-ink whitespace-nowrap">
                          <Tag className="h-3.5 w-3.5 text-galla-ink-soft shrink-0" />
                          <span>{product.category || "General Supplies"}</span>
                        </span>
                      </td>

                      {/* Purchase Price */}
                      <td className="py-3.5 px-4 text-right align-middle font-heading font-normal text-[14px] text-galla-ink-soft tabular-nums whitespace-nowrap">
                        {formatRupee(product.purchaseCost || 0)}
                      </td>

                      {/* Sell Price & Margin */}
                      <td className="py-3.5 px-4 text-right align-middle whitespace-nowrap">
                        <div className="font-heading font-semibold text-[14.5px] text-galla-ink tabular-nums">
                          {formatRupee(product.price)}
                        </div>
                        {product.purchaseCost !== undefined && (
                          <div className="text-[11px] font-mono text-emerald-700 font-medium tabular-nums mt-0.5">
                            +{formatRupee(Math.max(0, product.price - (product.purchaseCost || 0)))} (
                            {product.price > 0
                              ? Math.round(
                                  ((product.price - (product.purchaseCost || 0)) / product.price) * 100
                                )
                              : 0}
                            % margin)
                          </div>
                        )}
                      </td>

                      {/* Sell Stock */}
                      <td className="py-3.5 px-4 text-center align-middle whitespace-nowrap">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <div className="inline-flex items-center justify-center gap-2">
                            <span
                              className={`font-sans text-[13.5px] tabular-nums ${
                                isLowStock ? "text-red-700 font-bold" : "text-galla-ink font-medium"
                              }`}
                            >
                              {product.sell} pcs
                            </span>
                            {isLowStock && (
                              <span className="bg-red-50 text-red-800 border border-red-200 text-[10px] font-heading font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[3px]">
                                Low
                              </span>
                            )}
                          </div>
                          {product.defectiveStock > 0 && (
                            <button
                              type="button"
                              onClick={() => setSettleTargetProduct(product)}
                              className="inline-flex items-center gap-1 text-[10px] font-sans text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 px-1.5 py-0.5 rounded font-medium whitespace-nowrap cursor-pointer transition-colors shadow-2xs group"
                              title="Click to settle / receive replacement from dealer"
                            >
                              <span>+ {product.defectiveStock} defective</span>
                              <span className="text-[9px] text-rose-500 font-bold group-hover:underline">&bull; Settle</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Use Stock */}
                      <td className="py-3.5 px-4 text-center align-middle font-sans text-[13.5px] text-galla-ink-soft tabular-nums whitespace-nowrap">
                        {product.use} pcs
                      </td>

                      {/* Transfer / Use */}
                      <td className="py-3.5 px-4 text-center align-middle whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenTransfer(product)}
                          disabled={product.sell <= 0 && product.use <= 0}
                          className="inline-flex items-center gap-1 text-[12.5px] font-sans font-medium text-galla-teal hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-opacity"
                          title="Transfer between retail and salon use, or deduct consumed stock"
                        >
                          <span>Move / Use</span>
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pl-4 pr-6 text-right align-middle whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(product)}
                            className="p-1.5 text-galla-ink-soft hover:text-galla-teal hover:bg-galla-paper rounded transition-colors cursor-pointer"
                            title="Edit product details"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setProductToDelete(product)}
                            disabled={isDeleting}
                            className="p-1.5 text-galla-ink-soft hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer disabled:opacity-50"
                            title="Delete product permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer (20 per page on-demand, matching Orders tab) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 bg-galla-paper/50 border-t border-galla-line">
          <div className="font-sans text-[12.5px] text-galla-ink-soft">
            {totalCount > 0 ? (
              <>
                Showing <span className="font-medium text-galla-ink">{(page - 1) * pageSize + 1}</span> to{" "}
                <span className="font-medium text-galla-ink">{Math.min(page * pageSize, totalCount)}</span> of{" "}
                <span className="font-medium text-galla-ink">{totalCount}</span> products
              </>
            ) : (
              "0 products to display"
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => fetchPage(page - 1, selectedCategory, searchQuery, filterLowStockOnly)}
              disabled={page <= 1 || isFetching}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-sans font-medium rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink hover:bg-galla-paper transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              title="Load previous 20 products"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>

            <div className="flex items-center px-2 font-sans text-[12px] text-galla-ink font-medium">
              Page {page} of {totalPages}
            </div>

            <button
              type="button"
              onClick={() => fetchPage(page + 1, selectedCategory, searchQuery, filterLowStockOnly)}
              disabled={page >= totalPages || isFetching}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-sans font-medium rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink hover:bg-galla-paper transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              title="Load next 20 products"
            >
              <span>Next</span>
              {isFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-galla-teal" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Transfer Stock Modal (Pillar 2: Stock Move with custom quantity) */}
      <TransferStockModal
        product={transferTargetProduct}
        allProducts={products}
        isOpen={Boolean(transferTargetProduct)}
        onClose={() => setTransferTargetProduct(null)}
        onTransferSuccess={handleTransferComplete}
      />

      {/* Settle Dealer Replacement Modal */}
      <SettleReplacementModal
        product={settleTargetProduct}
        isOpen={Boolean(settleTargetProduct)}
        onClose={() => setSettleTargetProduct(null)}
        onSuccess={(updatedProduct) => {
          onUpdateProduct?.(updatedProduct);
          setSettleTargetProduct(null);
        }}
      />

      {/* Stock In Modal (Pillar 1: Purchase Order Entry) */}
      <StockInModal
        isOpen={isStockInModalOpen}
        onClose={() => setIsStockInModalOpen(false)}
        products={products}
        suppliers={suppliers}
        onStockInSuccess={(updatedBatch, newPO, newExpense, updatedSupplier) => {
          onStockInSuccess?.(updatedBatch, newPO, newExpense, updatedSupplier);
        }}
      />

      {/* Product Modal (Create & Edit) */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setProductToEdit(null);
        }}
        productToEdit={productToEdit}
        existingProducts={products}
        onSaveProduct={(savedProduct) => {
          if (productToEdit) {
            onUpdateProduct?.(savedProduct);
          } else {
            onAddProduct?.(savedProduct);
          }
        }}
      />

      {/* Permanent Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(productToDelete)}
        title="Confirm Delete Product"
        isDestructive={true}
        description={
          productToDelete ? (
            <span>
              Are you sure you want to permanently delete{" "}
              <strong className="font-semibold text-galla-ink">&ldquo;{productToDelete.name}&rdquo;</strong>{" "}
              from your inventory?
            </span>
          ) : null
        }
        confirmLabel="Yes, Delete Permanently"
        cancelLabel="Cancel"
        isLoading={isDeleting}
        onConfirm={executeDeleteProduct}
        onClose={() => {
          if (!isDeleting) setProductToDelete(null);
        }}
      />
    </div>
  );
}
