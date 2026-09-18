"use client";

import React, { useState, useMemo } from "react";
import {
  Truck,
  FileText,
  Plus,
  Search,
  X,
  Phone,
  Building2,
  AlertCircle,
  Pencil,
  MapPin,
  Mail,
  Receipt,
  PackagePlus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  DashboardSupplier,
  DashboardProduct,
  DashboardPurchaseOrder,
} from "@/types/dashboard";
import { formatRupee, formatPhoneNumber, BillStatusKey } from "@/lib/utils";
import { PurchaseOrdersView } from "@/components/dashboard/purchase-orders-view";
import { StockInModal } from "@/components/dashboard/modals/stock-in-modal";
import { SupplierModal } from "@/components/dashboard/modals/supplier-modal";
import { SupplierDetailsView } from "@/components/dashboard/supplier-details-view";

interface SuppliersTabProps {
  suppliers: DashboardSupplier[];
  products: DashboardProduct[];
  onAddSupplier: (supplier: DashboardSupplier) => void;
  onUpdateSupplier: (supplier: DashboardSupplier) => void;
  onStockInSuccess?: (updatedProducts: DashboardProduct[]) => void;
  salonName?: string;
  initialFilter?: "all" | BillStatusKey;
}

export function SuppliersTab({
  suppliers,
  products,
  onAddSupplier,
  onUpdateSupplier,
  onStockInSuccess,
  salonName,
  initialFilter,
}: SuppliersTabProps) {
  const [subView, setSubView] = useState<"bills" | "suppliers">("bills");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<DashboardSupplier | null>(null);

  // Modals
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<DashboardSupplier | null>(null);

  // Keep selectedSupplier synchronized if suppliers array updates
  const activeSelectedSupplier = useMemo(() => {
    if (!selectedSupplier) return null;
    return suppliers.find((s) => s.id === selectedSupplier.id) || selectedSupplier;
  }, [selectedSupplier, suppliers]);

  // Filter active suppliers
  const activeSuppliers = useMemo(() => {
    return suppliers.filter((s) => s.isActive !== false);
  }, [suppliers]);

  // Search and sort filtered suppliers: dues first, then A-Z
  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const digitsOnly = q.replace(/\D/g, "");

    const baseList = !q
      ? activeSuppliers
      : activeSuppliers.filter((s) => {
          const nameMatch = s.name.toLowerCase().includes(q);
          const companyMatch = s.companyName?.toLowerCase().includes(q) || false;
          const emailMatch = s.email?.toLowerCase().includes(q) || false;
          const gstinMatch = s.gstin?.toLowerCase().includes(q) || false;
          const phoneDigits = (s.phone || "").replace(/\D/g, "");
          const phoneMatch = digitsOnly.length > 0 && phoneDigits.includes(digitsOnly);

          return nameMatch || companyMatch || emailMatch || gstinMatch || phoneMatch;
        });

    return [...baseList].sort((a, b) => {
      const aDue = Boolean(a.totalPending && a.totalPending > 0);
      const bDue = Boolean(b.totalPending && b.totalPending > 0);

      // Prioritize suppliers with pending dues first
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;

      // Then sort alphabetically A-Z / a-z
      const nameComp = (a.name || "").localeCompare(b.name || "", undefined, {
        sensitivity: "base",
        numeric: true,
      });
      if (nameComp !== 0) return nameComp;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [activeSuppliers, searchQuery]);

  const [supplierPage, setSupplierPage] = useState(1);
  const supplierPageSize = 20;

  const totalSuppliersCount = filteredSuppliers.length;
  const totalSupplierPages = Math.max(1, Math.ceil(totalSuppliersCount / supplierPageSize));
  const currentSupplierPage = Math.min(supplierPage, totalSupplierPages);

  const paginatedSuppliers = useMemo(() => {
    const start = (currentSupplierPage - 1) * supplierPageSize;
    return filteredSuppliers.slice(start, start + supplierPageSize);
  }, [filteredSuppliers, currentSupplierPage, supplierPageSize]);

  const handleOpenAddSupplier = () => {
    setSupplierToEdit(null);
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (supplier: DashboardSupplier) => {
    setSupplierToEdit(supplier);
    setIsSupplierModalOpen(true);
  };

  // Sub-view: Supplier Detail View (same pattern as Customers tab)
  if (activeSelectedSupplier) {
    return (
      <>
        <SupplierDetailsView
          supplier={activeSelectedSupplier}
          onBack={() => setSelectedSupplier(null)}
          salonName={salonName}
          onOpenEditSupplier={handleOpenEditSupplier}
          onSupplierUpdated={(updatedSupplier) => {
            onUpdateSupplier(updatedSupplier);
            setSelectedSupplier(updatedSupplier);
          }}
        />

        {/* Supplier Modal (Create / Edit) */}
        <SupplierModal
          isOpen={isSupplierModalOpen}
          onClose={() => {
            setIsSupplierModalOpen(false);
            setSupplierToEdit(null);
          }}
          supplierToEdit={supplierToEdit}
          suppliers={suppliers}
          onSaveSupplier={(savedSupplier) => {
            if (supplierToEdit) {
              onUpdateSupplier(savedSupplier);
              if (selectedSupplier && selectedSupplier.id === savedSupplier.id) {
                setSelectedSupplier(savedSupplier);
              }
            } else {
              onAddSupplier(savedSupplier);
            }
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-150">
      {/* Header with Title and Modal Action Button (Identical to Services & Packages) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-semibold text-[21px] tracking-[-0.015em] text-galla-ink">
            Suppliers &amp; Bills
          </h2>
          <p className="font-sans text-[13px] text-galla-ink-soft mt-0.5">
            Manage dealer purchase bills, stock-in invoices and vendor directory
          </p>
        </div>

        {/* Modal Button above the tab buttons */}
        {subView === "bills" ? (
          <button
            type="button"
            onClick={() => setIsStockInModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-galla-teal hover:opacity-95 text-white font-sans text-[14px] font-medium px-[13px] py-[8px] rounded-[5px] shadow-sm transition-all cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Stock In (PO)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOpenAddSupplier}
            className="inline-flex items-center gap-1.5 bg-galla-teal hover:opacity-95 text-white font-sans text-[14px] font-medium px-[13px] py-[8px] rounded-[5px] shadow-sm transition-all cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Supplier</span>
          </button>
        )}
      </div>

      {/* Search Bar & View Switcher Controls (Identical to Services & Packages) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line w-full md:w-72 focus-within:border-galla-teal focus-within:ring-1 focus-within:ring-galla-teal transition-all shadow-xs">
          <Search className="h-4 w-4 text-galla-ink-soft shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSupplierPage(1);
            }}
            placeholder={
              subView === "bills"
                ? "Search bills by PO#, supplier, invoice..."
                : "Search suppliers by name, company, phone..."
            }
            className="w-full bg-transparent font-sans text-[13px] text-galla-ink placeholder:text-galla-ink-soft/50 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSupplierPage(1);
              }}
              className="text-galla-ink-soft hover:text-galla-ink cursor-pointer p-0.5"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* View Switcher Tabs (Aligned at same position as Services & Packages) */}
        <div className="flex items-center gap-1.5 p-1 bg-galla-surface border border-galla-line rounded-[5px] shadow-xs self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              setSubView("bills");
              setSearchQuery("");
              setSupplierPage(1);
            }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-[4px] text-[12.5px] font-sans font-medium transition-all cursor-pointer ${
              subView === "bills"
                ? "bg-galla-teal text-white shadow-xs"
                : "text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper/60"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Purchase Bills</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSubView("suppliers");
              setSearchQuery("");
              setSupplierPage(1);
            }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-[4px] text-[12.5px] font-sans font-medium transition-all cursor-pointer ${
              subView === "suppliers"
                ? "bg-galla-teal text-white shadow-xs"
                : "text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper/60"
            }`}
          >
            <Truck className="h-3.5 w-3.5" />
            <span>Suppliers ({activeSuppliers.length})</span>
          </button>
        </div>
      </div>

      {/* Sub-tab 1: Purchase Bills Ledger */}
      {subView === "bills" && (
        <div className="space-y-6">
          <PurchaseOrdersView
            showHeader={false}
            searchQuery={searchQuery}
            onOpenStockIn={() => setIsStockInModalOpen(true)}
            suppliers={suppliers}
            salonName={salonName}
            initialFilter={initialFilter}
          />
        </div>
      )}

      {/* Sub-tab 2: Suppliers List */}
      {subView === "suppliers" && (
        <div className="space-y-4">
          {/* Suppliers List Card */}
          <div className="bg-galla-surface border border-galla-line rounded-[8px] divide-y divide-galla-line overflow-hidden shadow-2xs">
            {paginatedSuppliers.map((supplier) => {
              const initials = supplier.name
                ? supplier.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()
                : "S";

              const hasPending = Boolean(supplier.totalPending && supplier.totalPending > 0);

              return (
                <div
                  key={supplier.id}
                  onClick={() => setSelectedSupplier(supplier)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-[20px] py-[15px] hover:bg-galla-paper/40 transition-all cursor-pointer group"
                >
                  {/* Left: Avatar & Info */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-galla-teal/10 border border-galla-teal/20 text-galla-teal font-heading font-bold text-[13.5px] flex items-center justify-center shrink-0 group-hover:bg-galla-teal group-hover:text-white transition-colors">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans font-semibold text-[15px] text-galla-ink group-hover:text-galla-teal transition-colors">
                          {supplier.name}
                        </span>
                        {supplier.companyName && (
                          <span className="inline-flex items-center gap-1 text-[11.5px] font-sans px-2 py-0.5 rounded bg-galla-paper border border-galla-line text-galla-ink-soft">
                            <Building2 className="h-3 w-3" />
                            <span>{supplier.companyName}</span>
                          </span>
                        )}
                        {hasPending && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-sans px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                            <AlertCircle className="h-3 w-3" />
                            <span>Due: {formatRupee(supplier.totalPending)}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[12.5px] text-galla-ink-soft mt-0.5 flex-wrap">
                        {supplier.phone && (
                          <a
                            href={`tel:${supplier.phone.replace(/\D/g, "")}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 font-mono text-galla-teal hover:underline"
                            title="Call supplier"
                          >
                            <Phone className="h-3 w-3" />
                            <span>{formatPhoneNumber(supplier.phone)}</span>
                          </a>
                        )}
                        {supplier.email && (
                          <>
                            <span>&bull;</span>
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3 w-3 text-galla-ink-soft/70" />
                              <span>{supplier.email}</span>
                            </span>
                          </>
                        )}
                        {supplier.address && (
                          <>
                            <span>&bull;</span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-galla-ink-soft/70" />
                              <span>{supplier.address}</span>
                            </span>
                          </>
                        )}
                        {supplier.gstin && (
                          <>
                            <span>&bull;</span>
                            <span className="font-mono text-[11.5px] text-galla-ink-soft/80">
                              GST: {supplier.gstin}
                            </span>
                          </>
                        )}
                      </div>
                      {supplier.notes && (
                        <div
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-amber-50/90 border border-amber-200 text-amber-950 font-sans text-[11.5px] mt-1 max-w-full shadow-2xs"
                          title={`Note: ${supplier.notes}`}
                        >
                          <span className="font-bold not-italic text-[9.5px] uppercase tracking-wider bg-amber-200 text-amber-950 px-1 py-0.2 rounded shrink-0">
                            Note
                          </span>
                          <span className="truncate font-medium">{supplier.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Ledger Stats, Edit Button & View Indicator */}
                  <div className="flex items-center justify-between sm:justify-end gap-3.5 text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-galla-line/60">
                    <div className="text-left sm:text-right">
                      <div className="font-sans text-[13px] text-galla-ink">
                        Purchases: <strong className="font-semibold">{formatRupee(supplier.totalPurchases || 0)}</strong>
                      </div>
                      <div className="font-sans text-[12px] text-galla-ink-soft mt-0.5">
                        Paid: <span className="font-medium text-emerald-700">{formatRupee(supplier.totalPaid || 0)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditSupplier(supplier);
                        }}
                        className="p-1.5 text-galla-ink-soft hover:text-galla-teal hover:bg-galla-paper rounded-[4px] transition-colors cursor-pointer"
                        title="Edit supplier details"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-galla-ink-soft/40 group-hover:text-galla-teal group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredSuppliers.length === 0 && (
              <div className="p-12 text-center">
                <Truck className="h-8 w-8 text-galla-ink-soft/40 mx-auto mb-2" />
                <p className="font-sans text-[13.5px] text-galla-ink font-medium">
                  {searchQuery ? "No suppliers found matching your search" : "No suppliers registered yet"}
                </p>
                <p className="font-sans text-[12px] text-galla-ink-soft mt-1">
                  {searchQuery
                    ? "Try a different search term or clear the filter."
                    : "Register your wholesale vendors, distributors, and dealer contacts."}
                </p>
                {!searchQuery && (
                  <button
                    type="button"
                    onClick={handleOpenAddSupplier}
                    className="inline-flex items-center gap-1.5 mt-3 bg-galla-teal text-white font-sans text-[12.5px] font-medium px-3 py-1.5 rounded-[4px] hover:opacity-95 transition-all cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add First Supplier</span>
                  </button>
                )}
              </div>
            )}

            {/* Pagination Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 bg-galla-paper/50 border-t border-galla-line">
              <div className="font-sans text-[12.5px] text-galla-ink-soft">
                {totalSuppliersCount > 0 ? (
                  <>
                    Showing <span className="font-medium text-galla-ink">{(currentSupplierPage - 1) * supplierPageSize + 1}</span> to{" "}
                    <span className="font-medium text-galla-ink">{Math.min(currentSupplierPage * supplierPageSize, totalSuppliersCount)}</span> of{" "}
                    <span className="font-medium text-galla-ink">{totalSuppliersCount}</span> suppliers
                  </>
                ) : (
                  "0 suppliers to display"
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setSupplierPage((p) => Math.max(1, p - 1))}
                  disabled={currentSupplierPage <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-sans font-medium rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink hover:bg-galla-paper transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                  title="Load previous 20 suppliers"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center px-2 font-sans text-[12px] text-galla-ink font-medium">
                  Page {currentSupplierPage} of {totalSupplierPages}
                </div>

                <button
                  type="button"
                  onClick={() => setSupplierPage((p) => Math.min(totalSupplierPages, p + 1))}
                  disabled={currentSupplierPage >= totalSupplierPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-sans font-medium rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink hover:bg-galla-paper transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                  title="Load next 20 suppliers"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock In Modal (Accessible from Purchase Bills sub-view) */}
      <StockInModal
        isOpen={isStockInModalOpen}
        onClose={() => setIsStockInModalOpen(false)}
        products={products}
        suppliers={activeSuppliers}
        onStockInSuccess={(updatedBatch) => {
          onStockInSuccess?.(updatedBatch);
        }}
      />

      {/* Supplier Modal (Create / Edit) */}
      <SupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => {
          setIsSupplierModalOpen(false);
          setSupplierToEdit(null);
        }}
        supplierToEdit={supplierToEdit}
        suppliers={suppliers}
        onSaveSupplier={(savedSupplier) => {
          if (supplierToEdit) {
            onUpdateSupplier(savedSupplier);
            if (selectedSupplier && selectedSupplier.id === savedSupplier.id) {
              setSelectedSupplier(savedSupplier);
            }
          } else {
            onAddSupplier(savedSupplier);
          }
        }}
      />
    </div>
  );
}
