import React, { useState, useEffect } from "react";
import { X, AlertCircle, Check, Loader2, CreditCard, PackageCheck } from "lucide-react";
import { DashboardPurchaseOrder, DashboardSupplier, DashboardExpense, DashboardProduct } from "@/types/dashboard";
import { recordPurchaseOrderPaymentAction } from "@/app/dashboard/actions";
import { formatRupee, formatDisplayNumber } from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";

interface SettlePurchaseBillModalProps {
  bill: DashboardPurchaseOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (
    updatedPO: DashboardPurchaseOrder,
    supplier?: DashboardSupplier,
    expense?: DashboardExpense,
    updatedProducts?: DashboardProduct[]
  ) => void;
}

export function SettlePurchaseBillModal({
  bill,
  isOpen,
  onClose,
  onPaymentSuccess,
}: SettlePurchaseBillModalProps) {
  if (!isOpen || !bill) return null;

  return (
    <SettlePurchaseBillModalContent
      key={bill.id}
      bill={bill}
      onClose={onClose}
      onPaymentSuccess={onPaymentSuccess}
    />
  );
}

function SettlePurchaseBillModalContent({
  bill,
  onClose,
  onPaymentSuccess,
}: {
  bill: DashboardPurchaseOrder;
  onClose: () => void;
  onPaymentSuccess: (
    updatedPO: DashboardPurchaseOrder,
    supplier?: DashboardSupplier,
    expense?: DashboardExpense,
    updatedProducts?: DashboardProduct[]
  ) => void;
}) {
  const defaultDue = Math.max(0, bill.amountPending);
  const isZeroDue = defaultDue === 0;

  const [payAmount, setPayAmount] = useState(String(defaultDue));
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card" | "bank_transfer">(
    bill.paymentMode && ["cash", "upi", "card", "bank_transfer"].includes(bill.paymentMode)
      ? (bill.paymentMode as any)
      : "cash"
  );
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose]);

  // Lock body scroll
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const enteredNum = isZeroDue ? 0 : payAmount === "" ? 0 : Number(payAmount);
  const remainingAfterPayment = Math.max(0, defaultDue - enteredNum);
  const totalPaidAfterThis = bill.amountPaid + enteredNum;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isZeroDue) {
      executeSettlePayment();
      return;
    }

    if (payAmount === "" || isNaN(enteredNum) || enteredNum <= 0) {
      setErrorMsg("Please enter a valid payment amount greater than ₹0");
      return;
    }

    if (enteredNum > defaultDue) {
      setErrorMsg(`Payment amount (${formatRupee(enteredNum)}) cannot exceed current pending balance (${formatRupee(defaultDue)})`);
      return;
    }

    setShowConfirm(true);
  };

  const executeSettlePayment = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await recordPurchaseOrderPaymentAction({
        purchaseOrderId: bill.id,
        amount: isZeroDue ? 0 : enteredNum,
        paymentMode,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.purchaseOrder) {
        onPaymentSuccess(res.purchaseOrder, res.supplier, res.newExpense, res.updatedProducts);
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to record settlement payment");
      }
    } catch {
      setErrorMsg("A network error occurred while recording payment");
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] overscroll-contain"
    >
      <div className="w-full max-w-[460px] bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-[6px] bg-galla-teal/10 text-galla-teal border border-galla-teal/20">
              {isZeroDue ? <PackageCheck className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="font-heading font-semibold text-[17px] text-galla-ink">
                {isZeroDue ? "Settle Purchase Order" : "Settle Purchase Bill"}
              </h3>
              <p className="font-sans text-[12px] text-galla-ink-soft">
                Bill {formatDisplayNumber(bill.purchaseOrderNumber)} &bull; <strong className="text-galla-ink font-medium">{bill.supplierName}</strong>
                {bill.dealerInvoiceNumber ? ` • Inv #${bill.dealerInvoiceNumber}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            disabled={isSubmitting}
            className="text-galla-ink-soft hover:text-galla-ink p-1 rounded transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Bill Payment Summary Card */}
        <div className="mb-4 p-3.5 bg-galla-paper/70 border border-galla-line rounded-[6px] space-y-1.5 text-[12.5px] font-sans">
          <div className="flex justify-between text-galla-ink-soft">
            <span>Original Total Bill:</span>
            <span className="font-medium text-galla-ink tabular-nums">{formatRupee(bill.totalAmount)}</span>
          </div>

          <div className={`flex justify-between ${bill.amountPaid > 0 ? "text-galla-teal font-medium" : "text-galla-ink-soft"}`}>
            <span>Paid Previously:</span>
            <span className="tabular-nums font-medium">
              {formatRupee(bill.amountPaid)}
              {bill.amountPaid > 0 && bill.paymentMode ? (
                <span className="uppercase text-[10px] font-semibold tracking-wider px-1.5 py-0.2 rounded bg-galla-paper text-galla-ink-soft border border-galla-line/60 ml-1.5">
                  {bill.paymentMode}
                </span>
              ) : null}
            </span>
          </div>

          <div className="flex justify-between pt-1 border-t border-galla-line/50">
            <span className={isZeroDue ? "text-emerald-700 font-semibold" : "text-rose-700 font-semibold"}>
              Current Outstanding Due:
            </span>
            <span className={`tabular-nums font-semibold ${isZeroDue ? "text-emerald-700" : "text-rose-700"}`}>
              {isZeroDue ? "₹0 (Fully Paid Upfront)" : formatRupee(defaultDue)}
            </span>
          </div>
        </div>



        {errorMsg && (
          <div className="mb-4 p-2.5 bg-red-50 border border-red-200 text-red-700 text-[12px] rounded-[4px] flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* Editable Payment Amount Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-sans text-[12px] font-medium text-galla-ink-soft">
                    Payment to Record Now (₹)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPayAmount(String(defaultDue))}
                      className="text-[11px] font-sans text-galla-teal hover:underline cursor-pointer font-medium"
                    >
                      Reset ({formatRupee(defaultDue)})
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  autoFocus
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter amount to pay"
                  className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] font-medium text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors tabular-nums"
                />

                {/* Live Financial Breakdown */}
                <div className="mt-2.5 p-2.5 bg-galla-paper border border-galla-line rounded-[5px] text-[11.5px] font-sans space-y-1">
                  <div className="flex justify-between text-emerald-800 font-medium">
                    <span>Paying to Vendor Now:</span>
                    <span className="tabular-nums">+{formatRupee(enteredNum)}</span>
                  </div>

                  <div className="flex justify-between text-galla-ink-soft">
                    <span>Remaining Balance After Payment:</span>
                    <span className={`tabular-nums font-medium ${remainingAfterPayment > 0 ? "text-amber-800" : "text-emerald-700 font-semibold"}`}>
                      {remainingAfterPayment > 0 ? formatRupee(remainingAfterPayment) : "Fully Settled (₹0 Due)"}
                    </span>
                  </div>

                  <div className="flex justify-between text-galla-ink font-semibold pt-1 border-t border-galla-line/60">
                    <span>Total Paid to Vendor:</span>
                    <span className="tabular-nums">
                      {formatRupee(totalPaidAfterThis)} / {formatRupee(bill.totalAmount)}
                    </span>
                  </div>
                </div>


              </div>

              {/* Payment Mode Selection */}
              <div>
                <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1.5">
                  Payment Mode for Settlement
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: "cash", label: "Cash" },
                      { id: "upi", label: "UPI" },
                      { id: "card", label: "Card" },
                      { id: "bank_transfer", label: "Bank" },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setPaymentMode(mode.id)}
                      className={`py-1.5 text-[12px] font-sans font-medium rounded-[4px] border uppercase tracking-wider transition-all cursor-pointer ${
                        paymentMode === mode.id
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs font-semibold"
                          : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink"
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

          {/* Notes / Reference */}
          <div>
            <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
              Settlement Notes / Remarks (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isZeroDue ? "e.g. Received goods in good condition, batch inspected" : "e.g. Cleared balance, IMPS UTR or Cheque #"}
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[13px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="w-1/3 bg-galla-surface hover:bg-galla-paper border border-galla-line text-galla-ink font-sans text-[13px] font-medium py-[9px] rounded-[5px] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!isZeroDue && (payAmount === "" || enteredNum <= 0))}
              className="w-2/3 bg-emerald-700 hover:bg-emerald-800 text-white font-sans text-[13px] font-medium py-[9px] rounded-[5px] shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Settling Order...</span>
                </>
              ) : (
                <>
                  <span>
                    {remainingAfterPayment === 0 && !bill.stockAllocated
                      ? `Settle & Add Stock (${formatRupee(enteredNum)})`
                      : `Pay (${formatRupee(enteredNum)}) & Settle`}
                  </span>
                  <Check className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>

        <ConfirmModal
          isOpen={showConfirm}
          title="Confirm Bill Settlement Payment"
          description={
            <span>
              Record settlement payment of <strong className="font-semibold text-galla-ink">{formatRupee(enteredNum)}</strong> via{" "}
              <strong className="font-semibold text-galla-ink">{paymentMode.toUpperCase()}</strong> for PO{" "}
              <strong className="font-semibold text-galla-ink">{formatDisplayNumber(bill.purchaseOrderNumber)}</strong> to{" "}
              <strong className="font-semibold text-galla-ink">&ldquo;{bill.supplierName}&rdquo;</strong>?
              This will update the supplier pending balance and log a corresponding business expense.
            </span>
          }
          confirmLabel="Yes, Record Payment"
          cancelLabel="Cancel"
          isLoading={isSubmitting}
          onConfirm={executeSettlePayment}
          onClose={() => setShowConfirm(false)}
        />
      </div>
    </div>
  );
}
