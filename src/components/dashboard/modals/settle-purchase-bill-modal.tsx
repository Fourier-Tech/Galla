import React, { useState, useEffect } from "react";
import { X, AlertCircle, Check, Loader2, CreditCard, PackageCheck } from "lucide-react";
import { DashboardPurchaseOrder, DashboardSupplier, DashboardExpense, DashboardProduct } from "@/types/dashboard";
import { recordPurchaseOrderPaymentAction } from "@/app/dashboard/actions";
import { formatRupee, formatDisplayNumber } from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";
import { PaymentModeSelect } from "../payment-mode-select";

interface SettlePurchaseBillModalProps {
  bill: DashboardPurchaseOrder | null;
  supplier?: DashboardSupplier | null;
  suppliers?: DashboardSupplier[];
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
  supplier,
  suppliers,
  isOpen,
  onClose,
  onPaymentSuccess,
}: SettlePurchaseBillModalProps) {
  if (!isOpen || !bill) return null;

  const matchedSupplier =
    supplier ||
    suppliers?.find(
      (s) =>
        (bill.supplierId && s.id === bill.supplierId) ||
        s.name.toLowerCase() === bill.supplierName.toLowerCase()
    );

  return (
    <SettlePurchaseBillModalContent
      key={bill.id}
      bill={bill}
      supplier={matchedSupplier}
      onClose={onClose}
      onPaymentSuccess={onPaymentSuccess}
    />
  );
}

function SettlePurchaseBillModalContent({
  bill,
  supplier,
  onClose,
  onPaymentSuccess,
}: {
  bill: DashboardPurchaseOrder;
  supplier?: DashboardSupplier | null;
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
  const availableCredit = Math.max(0, supplier?.totalCredit || 0);
  const canUseCredit = availableCredit > 0 && !isZeroDue;

  const [useCredit, setUseCredit] = useState(false);
  const [payAmount, setPayAmount] = useState(String(defaultDue));
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card" | "bank_transfer">(
    bill.paymentMode && ["cash", "upi", "card", "bank_transfer"].includes(bill.paymentMode)
      ? (bill.paymentMode as any)
      : "cash"
  );
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);
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

  const creditToUse = useCredit ? Math.min(availableCredit, defaultDue) : 0;
  const enteredNum = isZeroDue ? 0 : payAmount === "" ? 0 : Number(payAmount);
  const totalSettling = enteredNum + creditToUse;
  const remainingAfterPayment = Math.max(0, defaultDue - totalSettling);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isZeroDue) {
      executeSettlePayment();
      return;
    }

    if (totalSettling <= 0) {
      setErrorMsg("Please enter a payment amount or apply available credit");
      return;
    }

    if (enteredNum < 0 || isNaN(enteredNum)) {
      setErrorMsg("Payment amount cannot be negative");
      return;
    }

    if (totalSettling > defaultDue) {
      setErrorMsg(`Total settlement (${formatRupee(totalSettling)}) cannot exceed current pending balance (${formatRupee(defaultDue)})`);
      return;
    }

    setShowConfirm(true);
  };

  const executeSettlePayment = async () => {
    setShowConfirm(false);
    if (isSubmittingRef.current) return; isSubmittingRef.current = true; setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await recordPurchaseOrderPaymentAction({
        purchaseOrderId: bill.id,
        amount: isZeroDue ? 0 : enteredNum,
        creditUsed: creditToUse > 0 ? creditToUse : undefined,
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
      isSubmittingRef.current = false; setIsSubmitting(false);
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
              <h3 className="text-[15px] font-bold text-galla-ink">
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

        {/* Bill Payment Snapshot */}
        <div className="mb-4 p-3 bg-galla-paper/50 border border-galla-line/70 rounded-[5px] text-[12px] font-sans">
          {isZeroDue ? (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-galla-ink-soft">Bill Total: </span>
                <span className="font-medium text-galla-ink tabular-nums">{formatRupee(bill.totalAmount)}</span>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Fully Paid Upfront (₹0 Due)
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center divide-x divide-galla-line/60">
              <div>
                <div className="text-[10.5px] text-galla-ink-soft uppercase tracking-wider">Total Bill</div>
                <div className="text-[13px] font-semibold text-galla-ink tabular-nums mt-0.5">{formatRupee(bill.totalAmount)}</div>
              </div>
              <div className="pl-2">
                <div className="text-[10.5px] text-galla-ink-soft uppercase tracking-wider">Paid Previously</div>
                <div className="text-[13px] font-semibold text-galla-teal tabular-nums mt-0.5">{formatRupee(bill.amountPaid)}</div>
              </div>
              <div className="pl-2">
                <div className="text-[10.5px] text-galla-ink-soft uppercase tracking-wider">Balance Due</div>
                <div className="text-[13px] font-semibold text-rose-700 tabular-nums mt-0.5">{formatRupee(defaultDue)}</div>
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 bg-red-50 border border-red-200 text-red-700 text-[12px] rounded-[4px] flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* Supplier Credit Option */}
          {canUseCredit && (
            <div className="p-3 rounded-[6px] bg-emerald-500/5 border border-emerald-500/20 flex items-start gap-2.5">
              <input
                id="use-supplier-credit-settle"
                type="checkbox"
                checked={useCredit}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setUseCredit(checked);
                  if (checked) {
                    const creditAmt = Math.min(availableCredit, defaultDue);
                    setPayAmount(String(Math.max(0, defaultDue - creditAmt)));
                  } else {
                    setPayAmount(String(defaultDue));
                  }
                }}
                className="mt-0.5 h-4 w-4 rounded border-galla-line text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="use-supplier-credit-settle" className="text-[12px] font-sans text-galla-ink cursor-pointer select-none">
                <span className="font-semibold text-emerald-800">
                  Use Supplier Credit ({formatRupee(availableCredit)} available)
                </span>
                <p className="text-[11px] text-galla-ink-soft mt-0.5">
                  Applies {formatRupee(Math.min(availableCredit, defaultDue))} from supplier credit towards this bill.
                </p>
              </label>
            </div>
          )}

          {/* Payment Amount Input */}
          {!isZeroDue && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                  {useCredit ? "Out-of-Pocket Payment (₹)" : "Payment to Record Now (₹)"}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (useCredit) {
                      const creditAmt = Math.min(availableCredit, defaultDue);
                      setPayAmount(String(Math.max(0, defaultDue - creditAmt)));
                    } else {
                      setPayAmount(String(defaultDue));
                    }
                  }}
                  className="text-[11px] font-sans text-galla-teal hover:underline cursor-pointer font-medium"
                >
                  Reset ({formatRupee(useCredit ? Math.max(0, defaultDue - Math.min(availableCredit, defaultDue)) : defaultDue)})
                </button>
              </div>
              <input
                type="text"
                autoFocus
                required={!useCredit || creditToUse < defaultDue}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter amount to pay"
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] font-medium text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors tabular-nums"
              />

              {/* Inline Financial Status */}
              <div className="mt-1.5 text-[11px] font-sans flex items-center justify-between text-galla-ink-soft">
                <span>
                  Paying <strong className="font-semibold text-galla-ink tabular-nums">{formatRupee(enteredNum)}</strong>
                  {creditToUse > 0 && (
                    <span className="text-emerald-700 ml-1">
                      + {formatRupee(creditToUse)} credit
                    </span>
                  )}
                  {remainingAfterPayment > 0 ? (
                    <span className="text-amber-800 ml-1">
                      ({formatRupee(remainingAfterPayment)} will remain)
                    </span>
                  ) : (
                    <span className="text-emerald-700 ml-1">(Fully settled)</span>
                  )}
                </span>
                <span>
                  Total Settled: <strong className="font-semibold text-galla-ink tabular-nums">{formatRupee(totalSettling)}</strong>
                </span>
              </div>
            </div>
          )}

          {/* Payment Mode Selection */}
          {(!useCredit || enteredNum > 0) && (
            <PaymentModeSelect
              label="Payment Mode for Settlement"
              value={paymentMode}
              onChange={setPaymentMode}
              allowedModes={["cash", "upi", "card", "bank_transfer"]}
            />
          )}

          {/* Notes / Reference */}
          <div>
            <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
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
              disabled={isSubmitting || (!isZeroDue && totalSettling <= 0)}
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
                    {creditToUse > 0 && enteredNum === 0
                      ? `Settle with Credit (${formatRupee(creditToUse)})`
                      : remainingAfterPayment === 0 && !bill.stockAllocated
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
              {creditToUse > 0 && enteredNum > 0 ? (
                <>
                  Record settlement using <strong className="font-semibold text-emerald-700">{formatRupee(creditToUse)}</strong> supplier credit and{" "}
                  <strong className="font-semibold text-galla-ink">{formatRupee(enteredNum)}</strong> via{" "}
                  <strong className="font-semibold text-galla-ink">{paymentMode.toUpperCase()}</strong>
                </>
              ) : creditToUse > 0 ? (
                <>
                  Record settlement using <strong className="font-semibold text-emerald-700">{formatRupee(creditToUse)}</strong> from supplier credit balance
                </>
              ) : (
                <>
                  Record settlement payment of <strong className="font-semibold text-galla-ink">{formatRupee(enteredNum)}</strong> via{" "}
                  <strong className="font-semibold text-galla-ink">{paymentMode.toUpperCase()}</strong>
                </>
              )}{" "}
              for PO <strong className="font-semibold text-galla-ink">{formatDisplayNumber(bill.purchaseOrderNumber)}</strong> to{" "}
              <strong className="font-semibold text-galla-ink">&ldquo;{bill.supplierName}&rdquo;</strong>?
              This will update the supplier pending &amp; credit balance{enteredNum > 0 ? " and log a corresponding business expense" : ""}.
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
