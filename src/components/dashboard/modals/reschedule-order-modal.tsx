"use client";

import React from "react";
import { DashboardOrder } from "@/types/dashboard";
import { rescheduleOrderAction } from "@/app/dashboard/actions";
import { formatDisplayNumber } from "@/lib/utils";
import { BaseRescheduleModal } from "./base-reschedule-modal";

interface RescheduleOrderModalProps {
  order: DashboardOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onRescheduleSuccess: (updatedOrder: DashboardOrder) => void;
}

export function RescheduleOrderModal({
  order,
  isOpen,
  onClose,
  onRescheduleSuccess,
}: RescheduleOrderModalProps) {
  if (!isOpen || !order) return null;

  const isDueOrder =
    order.status === "created" ||
    (order.paid < order.amount &&
      order.status !== "advance_paid" &&
      order.status !== "paid_full" &&
      order.status !== "cancelled_refunded" &&
      order.status !== "cancelled_converted");

  const isReplacementOrder =
    order.status === "replacement_pending" || order.status === "replacement";

  const title = isReplacementOrder
    ? order.scheduledFor
      ? "Reschedule Replacement Delivery Date"
      : "Set Replacement Delivery Date"
    : isDueOrder
    ? order.scheduledFor
      ? "Reschedule Due Date"
      : "Set Payment Due Date"
    : "Reschedule & Set Time";

  const currentSlotLabel = isReplacementOrder
    ? "Current Expected Delivery:"
    : isDueOrder
    ? "Current Due Date:"
    : "Current Booking:";

  const dateLabel = isReplacementOrder
    ? "Expected Delivery Date"
    : isDueOrder
    ? "Payment Due Date"
    : "Booking Date";

  const submitButtonLabel = isReplacementOrder
    ? "Confirm Delivery Date"
    : isDueOrder
    ? "Confirm Due Date"
    : "Confirm Booking Slot";

  return (
    <BaseRescheduleModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      referenceText={`Order #${formatDisplayNumber(order.id)}`}
      entityName={order.customer}
      dueAmount={order.amount > order.paid ? order.amount - order.paid : undefined}
      dueAmountLabel="Due"
      currentSlotLabel={currentSlotLabel}
      currentDate={order.scheduledFor}
      currentTime={order.scheduledTime}
      dateLabel={dateLabel}
      initialDate={order.scheduledFor}
      initialTime={order.scheduledTime}
      showTimePicker={true}
      submitButtonLabel={submitButtonLabel}
      onSave={async ({ newDate, newTime }) => {
        const res = await rescheduleOrderAction({
          orderId: order.id,
          newDate,
          newTime,
        });
        if (res.success && res.order) {
          onRescheduleSuccess(res.order);
          return { success: true };
        }
        return { success: false, error: res.error || "Failed to reschedule booking" };
      }}
    />
  );
}
