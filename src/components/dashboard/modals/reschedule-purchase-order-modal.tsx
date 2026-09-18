"use client";

import React, { useState } from "react";
import { DashboardPurchaseOrder } from "@/types/dashboard";
import { reschedulePurchaseOrderAction } from "@/app/dashboard/actions";
import { BaseRescheduleModal } from "./base-reschedule-modal";

interface ReschedulePurchaseOrderModalProps {
  po: DashboardPurchaseOrder | null;
  isOpen: boolean;
  mode?: "delivery" | "due_date";
  onClose: () => void;
  onRescheduleSuccess: (updatedPO: DashboardPurchaseOrder) => void;
}

export function ReschedulePurchaseOrderModal({
  po,
  isOpen,
  mode,
  onClose,
  onRescheduleSuccess,
}: ReschedulePurchaseOrderModalProps) {
  if (!isOpen || !po) return null;

  return (
    <ReschedulePurchaseOrderModalContent
      key={`${po.id}-${po.expectedDeliveryDate}-${po.deliveryTime}-${po.dueDate}-${mode}`}
      po={po}
      initialMode={mode}
      isOpen={isOpen}
      onClose={onClose}
      onRescheduleSuccess={onRescheduleSuccess}
    />
  );
}

function ReschedulePurchaseOrderModalContent({
  po,
  initialMode,
  isOpen,
  onClose,
  onRescheduleSuccess,
}: {
  po: DashboardPurchaseOrder;
  initialMode?: "delivery" | "due_date";
  isOpen: boolean;
  onClose: () => void;
  onRescheduleSuccess: (updatedPO: DashboardPurchaseOrder) => void;
}) {
  const canDoDelivery = Boolean(po.expectedDeliveryDate || po.settlementMode === "advance");
  const canDoDueDate = po.amountPending > 0 || Boolean(po.dueDate) || po.paymentMode === "credit";

  const resolvedInitialMode: "delivery" | "due_date" =
    initialMode || (canDoDueDate && !canDoDelivery ? "due_date" : "delivery");

  const [activeMode, setActiveMode] = useState<"delivery" | "due_date">(resolvedInitialMode);
  const isDueMode = activeMode === "due_date";

  const currentScheduledDate = isDueMode
    ? po.dueDate || (po.paymentMode === "credit" ? po.invoiceDate : undefined)
    : po.expectedDeliveryDate;
  const currentTime = isDueMode ? undefined : po.deliveryTime;

  const displayOrderRef = po.dealerInvoiceNumber || po.purchaseOrderNumber;

  const title = isDueMode
    ? currentScheduledDate
      ? "Reschedule Due Date"
      : "Set Payment Due Date"
    : "Reschedule & Set Time";

  const currentSlotLabel = isDueMode ? "Current Due Date:" : "Current Booking:";
  const dateLabel = isDueMode ? "Payment Due Date" : "Booking Date";
  const submitButtonLabel = isDueMode ? "Confirm Due Date" : "Confirm Booking Slot";

  const extraHeaderControl =
    canDoDelivery && canDoDueDate ? (
      <div className="flex items-center p-1 bg-galla-paper/80 border border-galla-line rounded-[6px] text-[12px] font-sans">
        <button
          type="button"
          onClick={() => setActiveMode("delivery")}
          className={`flex-1 py-1 rounded-[4px] font-medium transition-all cursor-pointer ${
            activeMode === "delivery"
              ? "bg-galla-surface text-galla-ink font-semibold shadow-2xs border border-galla-line"
              : "text-galla-ink-soft hover:text-galla-ink"
          }`}
        >
          Delivery Date
        </button>
        <button
          type="button"
          onClick={() => setActiveMode("due_date")}
          className={`flex-1 py-1 rounded-[4px] font-medium transition-all cursor-pointer ${
            activeMode === "due_date"
              ? "bg-galla-surface text-galla-ink font-semibold shadow-2xs border border-galla-line"
              : "text-galla-ink-soft hover:text-galla-ink"
          }`}
        >
          Payment Due Date
        </button>
      </div>
    ) : null;

  return (
    <BaseRescheduleModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      referenceText={`Order #${displayOrderRef}`}
      entityName={po.supplierName}
      dueAmount={po.amountPending > 0 ? po.amountPending : undefined}
      dueAmountLabel="Due"
      currentSlotLabel={currentSlotLabel}
      currentDate={currentScheduledDate}
      currentTime={currentTime}
      dateLabel={dateLabel}
      initialDate={currentScheduledDate}
      initialTime={currentTime}
      showTimePicker={true}
      submitButtonLabel={submitButtonLabel}
      extraHeaderControl={extraHeaderControl}
      onSave={async ({ newDate, newTime }) => {
        let res;
        if (isDueMode) {
          res = await reschedulePurchaseOrderAction({
            purchaseOrderId: po.id,
            dueDate: newDate,
          });
        } else {
          res = await reschedulePurchaseOrderAction({
            purchaseOrderId: po.id,
            expectedDeliveryDate: newDate,
            deliveryTime: newTime?.trim() || undefined,
          });
        }

        if (res.success && res.purchaseOrder) {
          onRescheduleSuccess(res.purchaseOrder);
          return { success: true };
        }
        return {
          success: false,
          error:
            res.error ||
            (isDueMode
              ? "Failed to update payment due date"
              : "Failed to update delivery schedule"),
        };
      }}
    />
  );
}
