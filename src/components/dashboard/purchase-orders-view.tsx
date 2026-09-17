"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Phone,
  Search,
  Loader2,
  PackagePlus,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { DashboardPurchaseOrder, DashboardSupplier } from "@/types/dashboard";
import { formatRupee, formatPhoneNumber } from "@/lib/utils";
import {
  getPurchaseOrdersAction,
  recordPurchaseOrderPaymentAction,
} from "@/app/dashboard/actions";
import { PurchaseBillDetailsModal } from "./modals/purchase-bill-details-modal";
import { SettlePurchaseBillModal } from "./modals/settle-purchase-bill-modal";

function formatInvoiceDate(dateStr?: string | Date): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

interface PurchaseOrdersViewProps {
  onBack?: () => void;
  onOpenStockIn?: () => void;
  onPaymentRecorded?: (updatedPO: DashboardPurchaseOrder) => void;
  showHeader?: boolean;
  searchQuery?: string;
  suppliers?: DashboardSupplier[];
}

export function PurchaseOrdersView({
  onBack,
  onOpenStockIn,
  onPaymentRecorded,
  showHeader = true,
  searchQuery: externalSearchQuery,
  suppliers,
}: PurchaseOrdersViewProps) {
  const [orders, setOrders] = useState<DashboardPurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterPendingOnly, setFilterPendingOnly] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const activeSearchQuery = externalSearchQuery !== undefined ? externalSearchQuery : localSearchQuery;
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Selected bill for view modal
  const [selectedBillForDetails, setSelectedBillForDetails] = useState<DashboardPurchaseOrder | null>(null);

  // "Pay Now" settlement dialog state
  const [selectedPOForPayment, setSelectedPOForPayment] = useState<DashboardPurchaseOrder | null>(null);

  // Sync orders whenever suppliers prop is updated
  useEffect(() => {
    if (!suppliers || suppliers.length === 0) return;
    const supMap = new Map(suppliers.map((s) => [s.id, s]));
    setOrders((prev) =>
      prev.map((o) => {
        const s = supMap.get(o.supplierId);
        if (!s) return o;
        if (
          s.phone !== o.supplierPhone ||
          s.name !== o.supplierName ||
          s.companyName !== o.supplierCompany
        ) {
          return {
            ...o,
            supplierName: s.name || o.supplierName,
            supplierPhone: s.phone ? formatPhoneNumber(s.phone) : o.supplierPhone,
            supplierCompany: s.companyName !== undefined ? s.companyName : o.supplierCompany,
          };
        }
        return o;
      })
    );
  }, [suppliers]);

  useEffect(() => {
    let ignore = false;
    getPurchaseOrdersAction()
      .then((res) => {
        if (!ignore) {
          if (res.success && res.purchaseOrders) {
            setOrders(res.purchaseOrders);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Stats calculations
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o) => o.paymentStatus !== "paid");
    const totalPending = orders.reduce((sum, o) => sum + (o.amountPending || 0), 0);
    const totalPaid = orders.reduce((sum, o) => sum + (o.amountPaid || 0), 0);
    return { totalOrders, pendingCount: pendingOrders.length, totalPending, totalPaid };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((po) => {
      const matchesPending = !filterPendingOnly || po.paymentStatus !== "paid";
      const q = activeSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        po.purchaseOrderNumber.toLowerCase().includes(q) ||
        po.supplierName.toLowerCase().includes(q) ||
        (po.dealerInvoiceNumber && po.dealerInvoiceNumber.toLowerCase().includes(q));
      return matchesPending && matchesSearch;
    });
  }, [orders, filterPendingOnly, activeSearchQuery]);

  const totalCount = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const handleOpenPayNow = (po: DashboardPurchaseOrder) => {
    setSelectedPOForPayment(po);
  };

  const handlePaymentSuccess = (updatedPO: DashboardPurchaseOrder) => {
    setOrders((prev) => prev.map((o) => (o.id === updatedPO.id ? updatedPO : o)));
    if (selectedBillForDetails?.id === updatedPO.id) {
      setSelectedBillForDetails(updatedPO);
    }
    onPaymentRecorded?.(updatedPO);
    setSelectedPOForPayment(null);
  };

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-150">
      {/* Top Header with Back Button */}
      {showHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-heading font-semibold text-[21px] tracking-[-0.015em] text-galla-ink">
              Purchase Orders &amp; Bills
            </h2>
            <p className="font-sans text-[13px] text-galla-ink-soft mt-0.5">
              Track dealer stock-in orders, credit balances &bull; record later settlements
            </p>
            {onBack && (
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center mt-3 gap-1 text-[12px] font-sans font-medium text-galla-teal hover:text-galla-teal/80 hover:underline cursor-pointer transition-colors group bg-transparent border-0 p-0"
                  title="Return to products and stock list"
                >
                  <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                  <span>Back to Inventory</span>
                </button>
              </div>
            )}
          </div>

          {onOpenStockIn && (
            <button
              type="button"
              onClick={onOpenStockIn}
              className="inline-flex items-center gap-1.5 bg-galla-teal hover:opacity-95 text-white font-sans text-[13px] font-medium px-[13px] py-[8px] rounded-[5px] shadow-sm transition-all cursor-pointer self-start sm:self-auto shrink-0"
            >
              <PackagePlus className="h-4 w-4" />
              <span>Stock In (PO)</span>
            </button>
          )}
        </div>
      )}

      {/* Main Ledger Card Container */}
      <div className="bg-galla-surface border border-galla-line rounded-[6px] shadow-2xs overflow-hidden">
        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-[21px] py-3 border-b border-galla-line bg-galla-paper/30">
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setFilterPendingOnly(false);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-[4px] font-sans text-[12.5px] font-medium transition-all cursor-pointer border ${
                !filterPendingOnly
                  ? "bg-galla-teal text-white border-galla-teal shadow-2xs"
                  : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink"
              }`}
            >
              All Orders ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterPendingOnly(true);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-[4px] font-sans text-[12.5px] font-medium transition-all cursor-pointer border ${
                filterPendingOnly
                  ? "bg-galla-teal text-white border-galla-teal shadow-2xs"
                  : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink"
              }`}
            >
              Pending / Credit Only ({stats.pendingCount})
            </button>

            {/* Small Pending / Credit Balance Badge */}
            {stats.totalPending > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-amber-50/90 border border-amber-200 text-amber-900 font-sans text-[12px] font-medium shadow-2xs">
                <Clock className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                <span>
                  Pending Balance: <strong className="tabular-nums font-semibold text-amber-950">{formatRupee(stats.totalPending)}</strong>
                </span>
              </span>
            )}
          </div>

          {externalSearchQuery === undefined && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-[5px] bg-galla-surface border border-galla-line w-full sm:w-72 text-[12.5px]">
              <Search className="h-3.5 w-3.5 text-galla-ink-soft shrink-0" />
              <input
                type="text"
                value={localSearchQuery}
                onChange={(e) => {
                  setLocalSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search PO#, supplier, invoice..."
                className="w-full bg-transparent outline-none text-galla-ink placeholder:text-galla-ink-soft/60"
              />
              {localSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalSearchQuery("");
                    setPage(1);
                  }}
                  className="text-galla-ink-soft hover:text-galla-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Ledger Rows */}
        <div className="divide-y divide-galla-line">
          {/* Desktop Table Header */}
          <div className="hidden lg:grid grid-cols-[170px_1fr_180px_130px_160px_110px] gap-4 px-[21px] py-2.5 bg-galla-paper/50 font-sans text-[11px] font-medium text-galla-ink-soft uppercase tracking-wider">
            <span>PO &amp; Status</span>
            <span>Supplier</span>
            <span>Dealer Inv &amp; Date</span>
            <span className="text-right">Total Bill</span>
            <span className="text-right">Paid / Due</span>
            <span className="text-right">Action</span>
          </div>

          {isLoading ? (
            <div className="py-20 text-center text-galla-ink-soft font-sans text-[13px] flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-galla-teal" />
              <span>Loading purchase bills...</span>
            </div>
          ) : paginatedOrders.length === 0 ? (
            <div className="py-20 text-center text-galla-ink-soft font-sans text-[13px]">
              No purchase orders found matching your filter.
            </div>
          ) : (
            paginatedOrders.map((po) => {
              const isCredit = po.paymentMode === "credit";
              const isPaid = po.paymentStatus === "paid";
              const isPartial = po.paymentStatus === "partial";

              return (
                <div
                  key={po.id}
                  onClick={() => setSelectedBillForDetails(po)}
                  className="p-[18px] sm:px-[21px] hover:bg-galla-paper/40 transition-colors flex flex-col lg:grid lg:grid-cols-[170px_1fr_180px_130px_160px_110px] gap-3 lg:gap-4 lg:items-center cursor-pointer group"
                >
                  {/* PO Number & Badge */}
                  <div>
                    <div className="font-heading font-semibold text-[14.5px] text-galla-ink group-hover:text-galla-teal transition-colors">
                      {po.purchaseOrderNumber}
                    </div>
                    <div className="mt-1">
                      {isPaid && (
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-sans font-medium">
                          Paid
                        </span>
                      )}
                      {isPartial && (
                        <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-sans font-medium">
                          Partial
                        </span>
                      )}
                      {!isPaid && !isPartial && (
                        <span className="bg-red-50 text-red-800 border border-red-200 px-2 py-0.5 rounded text-[11px] font-sans font-medium">
                          {isCredit ? "Credit" : "Unpaid"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Supplier Info */}
                  <div className="space-y-0.5">
                    <div className="inline-flex items-center gap-1.5 font-medium text-galla-ink text-[13.5px]">
                      <Building2 className="h-3.5 w-3.5 text-galla-ink-soft/70 shrink-0" />
                      <span>{po.supplierName}</span>
                    </div>
                    {po.supplierPhone && (
                      <div className="flex items-center gap-1 text-[12px] text-galla-ink-soft">
                        <Phone className="h-3 w-3" />
                        <span>{formatPhoneNumber(po.supplierPhone)}</span>
                      </div>
                    )}
                  </div>

                  {/* Dealer Invoice & Date */}
                  <div className="font-sans text-[12.5px] text-galla-ink-soft space-y-0.5">
                    {po.dealerInvoiceNumber ? (
                      <div className="text-galla-ink font-medium">
                        Inv: #{po.dealerInvoiceNumber}
                      </div>
                    ) : (
                      <div className="text-galla-ink-soft/70">No invoice #</div>
                    )}
                    <div>{formatInvoiceDate(po.invoiceDate)}</div>
                  </div>

                  {/* Total Amount */}
                  <div className="lg:text-right font-sans">
                    <span className="lg:hidden text-[11px] text-galla-ink-soft uppercase mr-2">
                      Total:
                    </span>
                    <span className="font-heading font-semibold text-[15px] text-galla-ink tabular-nums">
                      {formatRupee(po.totalAmount)}
                    </span>
                  </div>

                  {/* Paid & Pending Breakdown */}
                  <div className="lg:text-right font-sans text-[12px] tabular-nums">
                    <div>
                      <span className="lg:hidden text-galla-ink-soft mr-1">Paid:</span>
                      <span className="text-emerald-700 font-medium">
                        {formatRupee(po.amountPaid)}
                      </span>
                    </div>
                    {po.amountPending > 0 ? (
                      <div className="text-amber-800 font-medium mt-0.5">
                        <span className="lg:hidden mr-1">Due:</span>
                        <span>{formatRupee(po.amountPending)} due</span>
                      </div>
                    ) : (
                      <div className="text-galla-ink-soft/60 text-[11px] mt-0.5">Fully Settled</div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="lg:text-right flex items-center lg:justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-galla-line/60">
                    {po.amountPending > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPayNow(po);
                        }}
                        className="w-full lg:w-auto px-3.5 py-1.5 rounded-[4px] bg-galla-teal hover:opacity-95 text-white font-sans text-[12px] font-medium shadow-xs transition-all cursor-pointer text-center"
                      >
                        Pay Now
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-sans text-[12px] text-emerald-700 font-medium px-2 py-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Settled</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Footer (20 per page, matching Orders & Inventory tabs) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 bg-galla-paper/50 border-t border-galla-line">
          <div className="font-sans text-[12.5px] text-galla-ink-soft">
            {totalCount > 0 ? (
              <>
                Showing <span className="font-medium text-galla-ink">{(currentPage - 1) * pageSize + 1}</span> to{" "}
                <span className="font-medium text-galla-ink">{Math.min(currentPage * pageSize, totalCount)}</span> of{" "}
                <span className="font-medium text-galla-ink">{totalCount}</span> purchase orders
              </>
            ) : (
              "0 purchase orders to display"
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-sans font-medium rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink hover:bg-galla-paper transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              title="Load previous 20 purchase orders"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>

            <div className="flex items-center px-2 font-sans text-[12px] text-galla-ink font-medium">
              Page {currentPage} of {totalPages}
            </div>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-sans font-medium rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink hover:bg-galla-paper transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              title="Load next 20 purchase orders"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Settle Purchase Bill Modal (Enriched to mirror SettleOrderModal) */}
      <SettlePurchaseBillModal
        bill={
          selectedPOForPayment
            ? (() => {
                const livePO = orders.find((o) => o.id === selectedPOForPayment.id);
                const base = livePO || selectedPOForPayment;
                const sup = suppliers?.find((s) => s.id === base.supplierId);
                return sup
                  ? {
                      ...base,
                      supplierName: sup.name || base.supplierName,
                      supplierPhone: sup.phone ? formatPhoneNumber(sup.phone) : base.supplierPhone,
                      supplierCompany: sup.companyName !== undefined ? sup.companyName : base.supplierCompany,
                    }
                  : base;
              })()
            : null
        }
        isOpen={Boolean(selectedPOForPayment)}
        onClose={() => setSelectedPOForPayment(null)}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Purchase Bill Details Modal */}
      <PurchaseBillDetailsModal
        bill={
          selectedBillForDetails
            ? (() => {
                const livePO = orders.find((o) => o.id === selectedBillForDetails.id);
                const base = livePO || selectedBillForDetails;
                const sup = suppliers?.find((s) => s.id === base.supplierId);
                return sup
                  ? {
                      ...base,
                      supplierName: sup.name || base.supplierName,
                      supplierPhone: sup.phone ? formatPhoneNumber(sup.phone) : base.supplierPhone,
                      supplierCompany: sup.companyName !== undefined ? sup.companyName : base.supplierCompany,
                    }
                  : base;
              })()
            : null
        }
        isOpen={Boolean(selectedBillForDetails)}
        onClose={() => setSelectedBillForDetails(null)}
        onOpenPayNow={(bill) => {
          setSelectedBillForDetails(null);
          handleOpenPayNow(bill);
        }}
      />
    </div>
  );
}
