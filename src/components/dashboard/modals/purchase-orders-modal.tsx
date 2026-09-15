"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  FileText,
  Clock,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Building2,
  Phone,
  Search,
  Loader2,
} from "lucide-react";
import { DashboardPurchaseOrder } from "@/types/dashboard";
import { formatRupee } from "@/lib/utils";
import {
  getPurchaseOrdersAction,
  recordPurchaseOrderPaymentAction,
} from "@/app/dashboard/actions";

function formatInvoiceDate(dateStr?: string | Date): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

interface PurchaseOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentRecorded?: (updatedPO: DashboardPurchaseOrder) => void;
}

export function PurchaseOrdersModal({
  isOpen,
  onClose,
  onPaymentRecorded,
}: PurchaseOrdersModalProps) {
  const [orders, setOrders] = useState<DashboardPurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterPendingOnly, setFilterPendingOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // "Pay Now" state
  const [selectedPOForPayment, setSelectedPOForPayment] = useState<DashboardPurchaseOrder | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState<"cash" | "upi" | "card" | "bank_transfer">("cash");
  const [payNotes, setPayNotes] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await getPurchaseOrdersAction();
      if (res.success && res.purchaseOrders) {
        setOrders(res.purchaseOrders);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen]);

  // Calculations
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
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        po.purchaseOrderNumber.toLowerCase().includes(q) ||
        po.supplierName.toLowerCase().includes(q) ||
        (po.dealerInvoiceNumber && po.dealerInvoiceNumber.toLowerCase().includes(q));
      return matchesPending && matchesSearch;
    });
  }, [orders, filterPendingOnly, searchQuery]);

  const handleOpenPayNow = (po: DashboardPurchaseOrder) => {
    setSelectedPOForPayment(po);
    setPayAmount(String(po.amountPending));
    setPayMode("cash");
    setPayNotes("");
    setPayError(null);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPOForPayment) return;
    setPayError(null);

    const parsed = Number(payAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setPayError("Please enter a valid payment amount greater than ₹0");
      return;
    }

    if (parsed > selectedPOForPayment.amountPending) {
      setPayError(`Payment cannot exceed current pending balance of ${formatRupee(selectedPOForPayment.amountPending)}`);
      return;
    }

    setIsProcessingPayment(true);
    try {
      const res = await recordPurchaseOrderPaymentAction({
        purchaseOrderId: selectedPOForPayment.id,
        amount: parsed,
        paymentMode: payMode,
        notes: payNotes.trim() || undefined,
      });

      if (res.success && res.purchaseOrder) {
        const updated = res.purchaseOrder;
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        onPaymentRecorded?.(updated);
        setSelectedPOForPayment(null);
      } else {
        setPayError(res.error || "Failed to record payment");
      }
    } catch {
      setPayError("Network error occurred while recording payment");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessingPayment) onClose();
      }}
    >
      <div className="w-full max-w-[800px] max-h-[90vh] flex flex-col bg-galla-surface border border-galla-line rounded-[6px] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-[21px] py-[16px] border-b border-galla-line bg-galla-paper/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-[4px] bg-galla-teal-soft text-galla-teal">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-[17px] text-galla-ink">
                Purchase Orders &amp; Dealer Payments
              </h3>
              <p className="font-sans text-[12px] text-galla-ink-soft">
                Track dealer stock-in orders, credit balances &bull; record later settlements
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 p-[18px] bg-galla-paper/20 border-b border-galla-line shrink-0">
          <div className="p-3 bg-galla-surface border border-galla-line rounded-[5px]">
            <div className="font-sans text-[11px] font-medium text-galla-ink-soft uppercase tracking-wider">
              Total Invoices
            </div>
            <div className="font-heading font-semibold text-[18px] text-galla-ink mt-0.5 tabular-nums">
              {stats.totalOrders} <span className="font-sans text-[12px] font-normal text-galla-ink-soft">({stats.pendingCount} pending)</span>
            </div>
          </div>

          <div className="p-3 bg-galla-surface border border-galla-line rounded-[5px]">
            <div className="font-sans text-[11px] font-medium text-galla-ink-soft uppercase tracking-wider">
              Total Paid
            </div>
            <div className="font-heading font-semibold text-[18px] text-emerald-700 mt-0.5 tabular-nums">
              {formatRupee(stats.totalPaid)}
            </div>
          </div>

          <div className="p-3 bg-galla-surface border border-galla-line rounded-[5px]">
            <div className="font-sans text-[11px] font-medium text-galla-ink-soft uppercase tracking-wider">
              Pending / Credit Balance
            </div>
            <div className="font-heading font-semibold text-[18px] text-amber-800 mt-0.5 tabular-nums">
              {formatRupee(stats.totalPending)}
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] py-2.5 bg-galla-surface border-b border-galla-line shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterPendingOnly(false)}
              className={`px-3 py-1 rounded-[4px] font-sans text-[12px] font-medium transition-all cursor-pointer border ${
                !filterPendingOnly
                  ? "bg-galla-teal text-white border-galla-teal shadow-2xs"
                  : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink"
              }`}
            >
              All Orders ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterPendingOnly(true)}
              className={`px-3 py-1 rounded-[4px] font-sans text-[12px] font-medium transition-all cursor-pointer border ${
                filterPendingOnly
                  ? "bg-galla-teal text-white border-galla-teal shadow-2xs"
                  : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink"
              }`}
            >
              Pending / Credit Only ({stats.pendingCount})
            </button>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-galla-paper/40 border border-galla-line w-64 text-[12px]">
            <Search className="h-3.5 w-3.5 text-galla-ink-soft" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search PO#, supplier, invoice..."
              className="w-full bg-transparent outline-none text-galla-ink placeholder:text-galla-ink-soft/60"
            />
          </div>
        </div>

        {/* Orders List Table */}
        <div className="flex-1 overflow-y-auto min-h-[260px]">
          {isLoading ? (
            <div className="py-16 text-center text-galla-ink-soft font-sans text-[13px] flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-galla-teal" />
              <span>Loading purchase orders...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center text-galla-ink-soft font-sans text-[13px]">
              No purchase orders found matching your filter.
            </div>
          ) : (
            <div className="divide-y divide-galla-line">
              {filteredOrders.map((po) => {
                const isCredit = po.paymentMode === "credit";
                const isPaid = po.paymentStatus === "paid";
                const isPartial = po.paymentStatus === "partial";

                return (
                  <div
                    key={po.id}
                    className="p-[16px] hover:bg-galla-paper/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-semibold text-[14.5px] text-galla-ink">
                          {po.purchaseOrderNumber}
                        </span>

                        {/* Badges adhering to spec */}
                        {isPaid && (
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-sans font-medium">
                            Paid
                          </span>
                        )}
                        {isPartial && (
                          <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-sans font-medium">
                            Partial ({formatRupee(po.amountPending)} pending)
                          </span>
                        )}
                        {!isPaid && !isPartial && (
                          <span className="bg-red-50 text-red-800 border border-red-200 px-2 py-0.5 rounded text-[11px] font-sans font-medium">
                            {isCredit ? "Credit" : "Unpaid"}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[12px] text-galla-ink-soft">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-galla-ink-soft/70" />
                          <span className="font-medium text-galla-ink">{po.supplierName}</span>
                        </span>
                        {po.supplierPhone && (
                          <span className="inline-flex items-center gap-1 text-galla-ink-soft/80">
                            <Phone className="h-3 w-3" />
                            <span>{po.supplierPhone}</span>
                          </span>
                        )}
                        {po.dealerInvoiceNumber && (
                          <span className="text-galla-ink-soft/80">
                            Inv: #{po.dealerInvoiceNumber}
                          </span>
                        )}
                        <span className="text-galla-ink-soft/60">&bull;</span>
                        <span>{formatInvoiceDate(po.invoiceDate)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-5">
                      <div className="text-right font-sans">
                        <div className="font-heading font-semibold text-[15px] text-galla-ink tabular-nums">
                          {formatRupee(po.totalAmount)}
                        </div>
                        <div className="text-[11.5px] text-galla-ink-soft tabular-nums">
                          Paid: {formatRupee(po.amountPaid)}
                          {po.amountPending > 0 && (
                            <span className="text-amber-800 ml-1 font-medium">
                              &bull; Pending: {formatRupee(po.amountPending)}
                            </span>
                          )}
                        </div>
                      </div>

                      {po.amountPending > 0 ? (
                        <button
                          type="button"
                          onClick={() => handleOpenPayNow(po)}
                          className="px-3 py-1.5 rounded-[4px] bg-galla-teal hover:opacity-95 text-white font-sans text-[12px] font-medium shadow-xs transition-all cursor-pointer shrink-0"
                        >
                          Pay Now
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-sans text-[12px] text-emerald-700 font-medium px-2 py-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Settled
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-[21px] py-[12px] border-t border-galla-line bg-galla-paper/30 flex items-center justify-between shrink-0">
          <span className="font-sans text-[12px] text-galla-ink-soft">
            Showing {filteredOrders.length} of {orders.length} orders
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-[4px] border border-galla-line font-sans text-[12px] text-galla-ink hover:bg-galla-paper transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* "Pay Now" Nested Settlement Modal */}
      {selectedPOForPayment && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isProcessingPayment) setSelectedPOForPayment(null);
          }}
        >
          <div className="w-full max-w-[420px] bg-galla-surface border border-galla-line rounded-[6px] shadow-2xl p-[20px] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-galla-line">
              <div>
                <h4 className="font-heading font-semibold text-[16px] text-galla-ink">
                  Record Later Settlement
                </h4>
                <p className="font-sans text-[11.5px] text-galla-ink-soft mt-0.5">
                  Order {selectedPOForPayment.purchaseOrderNumber} &bull; {selectedPOForPayment.supplierName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPOForPayment(null)}
                className="text-galla-ink-soft hover:text-galla-ink p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-3.5 pt-3.5">
              {payError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-[4px] text-[12px] font-sans flex items-start gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  <span>{payError}</span>
                </div>
              )}

              <div className="p-3 bg-galla-paper/30 border border-galla-line rounded-[4px] flex items-center justify-between">
                <div>
                  <div className="font-sans text-[11px] text-galla-ink-soft">Total PO Amount</div>
                  <div className="font-heading font-semibold text-[14px] text-galla-ink">
                    {formatRupee(selectedPOForPayment.totalAmount)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-sans text-[11px] text-amber-800 font-medium">Pending Due</div>
                  <div className="font-heading font-semibold text-[16px] text-amber-800 tabular-nums">
                    {formatRupee(selectedPOForPayment.amountPending)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-sans text-[12px] font-medium text-galla-ink mb-1">
                  Amount to Pay Now (₹) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedPOForPayment.amountPending}
                  step="any"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={String(selectedPOForPayment.amountPending)}
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-galla-paper/20 border border-galla-line font-sans text-[13px] text-galla-ink outline-none tabular-nums"
                  required
                />
              </div>

              <div>
                <label className="block font-sans text-[12px] font-medium text-galla-ink mb-1">
                  Payment Mode
                </label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value as "cash" | "upi" | "card" | "bank_transfer")}
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-galla-paper/20 border border-galla-line font-sans text-[12px] text-galla-ink outline-none cursor-pointer"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block font-sans text-[12px] font-medium text-galla-ink mb-1">
                  Payment Notes (optional)
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Cleared 2nd installment"
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-galla-paper/20 border border-galla-line font-sans text-[12px] text-galla-ink outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPOForPayment(null)}
                  disabled={isProcessingPayment}
                  className="px-3 py-1.5 rounded-[4px] border border-galla-line font-sans text-[12px] text-galla-ink hover:bg-galla-paper cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="inline-flex items-center gap-1 px-4 py-1.5 rounded-[4px] bg-galla-teal hover:opacity-95 text-white font-sans text-[12px] font-medium shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {isProcessingPayment && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>{isProcessingPayment ? "Recording..." : "Confirm Payment"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
