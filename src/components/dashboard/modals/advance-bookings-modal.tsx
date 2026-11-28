"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Scissors,
  Package,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  MessageCircle,
  X,
} from "lucide-react";
import { DashboardOrder } from "@/types/dashboard";
import { getAdvanceBookingsForMonthAction } from "@/app/dashboard/actions";
import { OrderDetailsModal } from "@/components/dashboard/modals/order-details-modal";
import { RescheduleOrderModal } from "@/components/dashboard/modals/reschedule-order-modal";
import {
  formatBookingDate,
  formatAppointmentTime,
  getOrderEffectiveStatus,
  getOrderPendingDue,
  formatDisplayNumber,
  formatRupee,
  getWhatsAppReminderUrl,
} from "@/lib/utils";

/**
 * Heatmap intensity thresholds.
 * 0 orders = none (0)
 * 1-2 orders = lightest (1)
 * 3-4 orders = medium (2)
 * 5+ orders = darkest (3)
 */
export const HEATMAP_THRESHOLDS = {
  LIGHT: 1,
  MEDIUM: 3,
  DARK: 5,
} as const;

/**
 * Checks whether an order is completed.
 */
export function isOrderCompleted(order: DashboardOrder): boolean {
  const status = getOrderEffectiveStatus(order);
  return (
    status === "completed" ||
    status === "replacement_completed" ||
    status === "fulfilled"
  );
}

/**
 * Checks whether an order is a valid advance booking (service, package, product delivery, or replacement).
 * Strictly excludes pending amount collection / debt reminder orders (which belong under Customer Dues).
 */
export function isAdvanceBookingOrder(order: DashboardOrder): boolean {
  const effStatus = getOrderEffectiveStatus(order);
  if (
    effStatus === "cancelled_refunded" ||
    effStatus === "cancelled_converted" ||
    effStatus === "created"
  ) {
    return false;
  }
  const isDueDebt =
    getOrderPendingDue(order) > 0 &&
    effStatus !== "advance_paid" &&
    effStatus !== "paid_full";
  if (isDueDebt) {
    return false;
  }
  return true;
}

/**
 * Format any ISO/Date string into YYYY-MM-DD in IST (Asia/Kolkata).
 */
export function getISTDateString(isoOrDate: string | Date | undefined): string {
  if (!isoOrDate) return "";
  if (typeof isoOrDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
    return isoOrDate;
  }
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
}

/**
 * Convert time string to total minutes from midnight for chronological ordering.
 */
function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const trimmed = timeStr.trim().toUpperCase();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3];

  if (meridiem) {
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
  }
  return hours * 60 + minutes;
}

/**
 * Formats total minutes into readable 12-hour format like "8 AM", "9:30 AM", "2 PM".
 */
function formatMinutesToTime(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const meridiem = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return m === 0
    ? `${h12} ${meridiem}`
    : `${h12}:${String(m).padStart(2, "0")} ${meridiem}`;
}

const DEFAULT_TIMELINE_HOURS = [8, 11, 14, 17, 20]; // 8 AM, 11 AM, 2 PM, 5 PM, 8 PM

interface AdvanceBookingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  salonName?: string;
  onOpenSettle?: (order: DashboardOrder) => void;
  onOpenReschedule?: (order: DashboardOrder) => void;
  onOpenRefund?: (order: DashboardOrder) => void;
  lastSettledOrder?: DashboardOrder | null;
}

export function AdvanceBookingsModal({
  isOpen,
  onClose,
  salonName,
  onOpenSettle,
  onOpenReschedule,
  onOpenRefund,
  lastSettledOrder,
}: AdvanceBookingsModalProps) {
  const todayIST = useMemo(() => getISTDateString(new Date()), []);
  const todayYear = useMemo(() => {
    const parts = todayIST.split("-");
    return parseInt(parts[0], 10) || new Date().getFullYear();
  }, [todayIST]);
  const todayMonth = useMemo(() => {
    const parts = todayIST.split("-");
    return parseInt(parts[1], 10) || new Date().getMonth() + 1;
  }, [todayIST]);

  const [currentYear, setCurrentYear] = useState<number>(todayYear);
  const [currentMonth, setCurrentMonth] = useState<number>(todayMonth);
  const [selectedDate, setSelectedDate] = useState<string>(todayIST);
  const [expandedService, setExpandedService] = useState<string | null>(null);

  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedOrderDetails, setSelectedOrderDetails] =
    useState<DashboardOrder | null>(null);
  const [reschedulingOrder, setReschedulingOrder] =
    useState<DashboardOrder | null>(null);
  const [showOverdueDrawer, setShowOverdueDrawer] = useState<boolean>(false);

  useEffect(() => {
    if (lastSettledOrder) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === lastSettledOrder.id ? { ...o, ...lastSettledOrder } : o
        )
      );
      if (selectedOrderDetails?.id === lastSettledOrder.id) {
        setSelectedOrderDetails((prev) =>
          prev ? { ...prev, ...lastSettledOrder } : null
        );
      }
    }
  }, [lastSettledOrder, selectedOrderDetails?.id]);

  const updateUrlParams = useCallback(
    (newDate: string, newService: string | null) => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      url.searchParams.set("view", "advance_bookings");
      url.searchParams.set("date", newDate);
      if (newService) {
        url.searchParams.set("service", newService);
      } else {
        url.searchParams.delete("service");
      }
      window.history.replaceState({}, "", url.toString());
    },
    [],
  );

  // Fetch month data with automatic date selection:
  // - If the selected month is the current month (today's month): automatically select todayIST (unless a specific date is given).
  // - If changing to another month: automatically select the first advance order date in that month (or the 1st if no orders).
  const fetchMonthData = useCallback(
    async (year: number, month: number, preferredDate?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getAdvanceBookingsForMonthAction(year, month);
        if (res.success) {
          setOrders(res.orders);

          if (preferredDate) {
            setSelectedDate(preferredDate);
            setExpandedService(null);
            updateUrlParams(preferredDate, null);
          } else if (year === todayYear && month === todayMonth) {
            // Current month: automatically select today's date
            setSelectedDate(todayIST);
            setExpandedService(null);
            updateUrlParams(todayIST, null);
          } else {
            // Different month: automatically select the first date that has an advance order
            const orderDates = res.orders
              .filter(isAdvanceBookingOrder)
              .map((o) => getISTDateString(o.scheduledFor))
              .filter((d): d is string =>
                Boolean(
                  d &&
                  d.startsWith(`${year}-${String(month).padStart(2, "0")}`),
                ),
              )
              .sort();

            const targetDate =
              orderDates.length > 0
                ? orderDates[0]
                : `${year}-${String(month).padStart(2, "0")}-01`;

            setSelectedDate(targetDate);
            setExpandedService(null);
            updateUrlParams(targetDate, null);
          }
        } else {
          setError(res.error || "Failed to load advance bookings");
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load advance bookings");
      } finally {
        setIsLoading(false);
      }
    },
    [todayYear, todayMonth, todayIST, updateUrlParams],
  );

  useEffect(() => {
    if (!isOpen) return;

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlDate = params.get("date");
      const urlService = params.get("service");

      if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
        setSelectedDate(urlDate);
        const [y, m] = urlDate.split("-").map(Number);
        setCurrentYear(y);
        setCurrentMonth(m);
        fetchMonthData(y, m, urlDate);
      } else {
        setSelectedDate(todayIST);
        setCurrentYear(todayYear);
        setCurrentMonth(todayMonth);
        fetchMonthData(todayYear, todayMonth, todayIST);
      }

      if (urlService) {
        setExpandedService(urlService);
      }
    }
  }, [isOpen, todayIST, todayYear, todayMonth, fetchMonthData]);

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setExpandedService(null);
    updateUrlParams(dateStr, null);
  };

  const handleToggleService = (serviceName: string) => {
    const nextVal = expandedService === serviceName ? null : serviceName;
    setExpandedService(nextVal);
    updateUrlParams(selectedDate, nextVal);
  };

  const handlePrevMonth = () => {
    let nextM = currentMonth - 1;
    let nextY = currentYear;
    if (nextM < 1) {
      nextM = 12;
      nextY -= 1;
    }
    setCurrentMonth(nextM);
    setCurrentYear(nextY);
    fetchMonthData(nextY, nextM);
  };

  const handleNextMonth = () => {
    let nextM = currentMonth + 1;
    let nextY = currentYear;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    setCurrentMonth(nextM);
    setCurrentYear(nextY);
    fetchMonthData(nextY, nextM);
  };

  const ordersByDate = useMemo(() => {
    const map: Record<string, DashboardOrder[]> = {};
    for (const order of orders) {
      if (!isAdvanceBookingOrder(order)) continue;
      if (!order.scheduledFor) continue;
      const dateKey = getISTDateString(order.scheduledFor);
      if (!dateKey) continue;
      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(order);
    }
    return map;
  }, [orders]);

  const selectedDateOrders = useMemo(() => {
    return ordersByDate[selectedDate] || [];
  }, [ordersByDate, selectedDate]);

  // Active past advance bookings not yet marked completed or rescheduled
  const overdueOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!isAdvanceBookingOrder(o)) return false;
      if (isOrderCompleted(o)) return false;
      const dateKey = getISTDateString(o.scheduledFor);
      return Boolean(dateKey && dateKey < todayIST);
    });
  }, [orders, todayIST]);

  // Selected date booked items split into 3 distinct categories: Services, Packages, and Product sell
  const { selectedDateServices, selectedDatePackages, selectedDateProducts } =
    useMemo(() => {
      type BookingItem = {
        name: string;
        quantity: number;
        bookings: {
          customerName: string;
          appointmentTime: string;
          order: DashboardOrder;
        }[];
      };

      const serviceMap: Record<string, BookingItem> = {};
      const packageMap: Record<string, BookingItem> = {};
      const productMap: Record<string, BookingItem> = {};

      for (const order of selectedDateOrders) {
        const customerName = order.customer || "Walk-in Guest";
        const appointmentTime =
          formatAppointmentTime(order.scheduledTime) || "Anytime";
        const lineItems = order.lineItems || [];

        let hasExplicitItems = false;

        for (const item of lineItems) {
          hasExplicitItems = true;
          const itemName = item.name || "Item";
          const qty = item.quantity || 1;

          if (item.itemType === "product") {
            if (!productMap[itemName]) {
              productMap[itemName] = {
                name: itemName,
                quantity: 0,
                bookings: [],
              };
            }
            productMap[itemName].quantity += qty;
            productMap[itemName].bookings.push({
              customerName,
              appointmentTime,
              order,
            });
          } else if (item.itemType === "package") {
            if (!packageMap[itemName]) {
              packageMap[itemName] = {
                name: itemName,
                quantity: 0,
                bookings: [],
              };
            }
            packageMap[itemName].quantity += qty;
            packageMap[itemName].bookings.push({
              customerName,
              appointmentTime,
              order,
            });
          } else {
            // itemType === "service" or fallback
            if (!serviceMap[itemName]) {
              serviceMap[itemName] = {
                name: itemName,
                quantity: 0,
                bookings: [],
              };
            }
            serviceMap[itemName].quantity += qty;
            serviceMap[itemName].bookings.push({
              customerName,
              appointmentTime,
              order,
            });
          }
        }

        if (!hasExplicitItems) {
          const orderSummary = order.itemsSummary || "Booking";
          const isProductOrder =
            order.type === "Product sale" ||
            (order.type as string) === "product_sale";
          const isPackageOrder =
            order.type === "Package sale" ||
            (order.type as string) === "package_sale";

          const targetMap = isProductOrder
            ? productMap
            : isPackageOrder
              ? packageMap
              : serviceMap;

          if (!targetMap[orderSummary]) {
            targetMap[orderSummary] = {
              name: orderSummary,
              quantity: 0,
              bookings: [],
            };
          }
          targetMap[orderSummary].quantity += 1;
          targetMap[orderSummary].bookings.push({
            customerName,
            appointmentTime,
            order,
          });
        }
      }

      return {
        selectedDateServices: Object.values(serviceMap),
        selectedDatePackages: Object.values(packageMap),
        selectedDateProducts: Object.values(productMap),
      };
    }, [selectedDateOrders]);

  const timelineRows = useMemo(() => {
    const minuteMap = new Map<
      number,
      {
        timeMinutes: number;
        displayTime: string;
        isDefault: boolean;
        customerList: { name: string; order: DashboardOrder }[];
      }
    >();

    for (const h of DEFAULT_TIMELINE_HOURS) {
      const minutes = h * 60;
      minuteMap.set(minutes, {
        timeMinutes: minutes,
        displayTime: formatMinutesToTime(minutes),
        isDefault: true,
        customerList: [],
      });
    }

    for (const order of selectedDateOrders) {
      const parsedMin = parseTimeToMinutes(order.scheduledTime);
      const customerName = order.customer || "Walk-in Guest";

      if (parsedMin !== null) {
        let entry = minuteMap.get(parsedMin);
        if (!entry) {
          entry = {
            timeMinutes: parsedMin,
            displayTime: formatAppointmentTime(order.scheduledTime),
            isDefault: false,
            customerList: [],
          };
          minuteMap.set(parsedMin, entry);
        }
        if (!entry.customerList.some((c) => c.order.id === order.id)) {
          entry.customerList.push({ name: customerName, order });
        }
      } else {
        const defaultMin = 8 * 60;
        const entry = minuteMap.get(defaultMin)!;
        if (!entry.customerList.some((c) => c.order.id === order.id)) {
          entry.customerList.push({
            name: `${customerName} (Unspecified time)`,
            order,
          });
        }
      }
    }

    return Array.from(minuteMap.values()).sort(
      (a, b) => a.timeMinutes - b.timeMinutes,
    );
  }, [selectedDateOrders]);

  const calendarDays = useMemo(() => {
    const days: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      orderCount: number;
      isAllCompleted: boolean;
    }[] = [];

    const getDayCompletionStatus = (dateStr: string) => {
      const dayOrders = ordersByDate[dateStr] || [];
      return dayOrders.length > 0 && dayOrders.every(isOrderCompleted);
    };

    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const startingDayOfWeek = firstDay.getDay();
    const totalDaysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
      const dateStr = `${prevY}-${String(prevM).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        orderCount: ordersByDate[dateStr]?.length || 0,
        isAllCompleted: getDayCompletionStatus(dateStr),
      });
    }

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        orderCount: ordersByDate[dateStr]?.length || 0,
        isAllCompleted: getDayCompletionStatus(dateStr),
      });
    }

    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextM = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextY = currentMonth === 12 ? currentYear + 1 : currentYear;
      const dateStr = `${nextY}-${String(nextM).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        orderCount: ordersByDate[dateStr]?.length || 0,
        isAllCompleted: getDayCompletionStatus(dateStr),
      });
    }

    return days;
  }, [currentYear, currentMonth, ordersByDate]);

  const monthName = useMemo(() => {
    const d = new Date(currentYear, currentMonth - 1, 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [currentYear, currentMonth]);

  const getHeatmapClass = (
    count: number,
    isSelected: boolean,
    isAllCompleted: boolean,
  ) => {
    if (isSelected) {
      if (isAllCompleted) {
        return "bg-galla-sage text-white font-bold border-galla-sage shadow-xs";
      }
      return "bg-galla-teal text-white font-bold border-galla-teal shadow-xs";
    }
    if (count === 0) {
      return "bg-galla-surface text-galla-ink border-galla-line hover:bg-galla-paper hover:border-galla-ink-soft/30";
    }
    if (isAllCompleted) {
      return "bg-galla-sage-soft text-galla-sage font-semibold border-galla-sage/30 hover:bg-[#DDF0E8]";
    }
    if (count < HEATMAP_THRESHOLDS.MEDIUM) {
      return "bg-galla-teal-soft text-galla-teal font-medium border-galla-teal/20 hover:bg-[#FBE4EB]";
    }
    if (count < HEATMAP_THRESHOLDS.DARK) {
      return "bg-[#F7D3DE] text-[#912344] font-semibold border-[#F3BDCE] hover:bg-[#F3BDCE]";
    }
    return "bg-[#EBB4C4] text-[#6E122D] font-bold border-[#E39EB3] hover:bg-[#E39EB3]";
  };

  const handleClose = () => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("view");
      url.searchParams.delete("date");
      url.searchParams.delete("service");
      window.history.replaceState({}, "", url.toString());
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-galla-paper flex flex-col overflow-y-auto">
      {/* ======================================================== */}
      {/* TOP HEADER (Exact match with NewOrderModal & Galla modals) */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-30 bg-galla-surface border-b border-galla-line px-5 sm:px-8 py-3.5 flex items-center justify-between shadow-2xs shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="h-9 w-9 rounded-[6px] bg-galla-surface border border-galla-line hover:bg-galla-paper flex items-center justify-center text-galla-ink shadow-2xs transition-all cursor-pointer shrink-0"
            title="Back to Overview"
            aria-label="Back to Overview"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-[16px] font-bold text-galla-ink">
              Advance Bookings
            </h1>
            {orders.length > 0 && (
              <span className="text-[11.5px] font-medium px-2 py-0.5 rounded-full bg-galla-teal-soft text-galla-teal">
                {orders.length} {orders.length === 1 ? "booking" : "bookings"}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchMonthData(currentYear, currentMonth)}
            disabled={isLoading}
            className="h-9 w-9 rounded-[6px] bg-galla-surface border border-galla-line hover:bg-galla-paper flex items-center justify-center text-galla-ink-soft hover:text-galla-ink shadow-2xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
            title="Refresh bookings"
            aria-label="Refresh bookings"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="h-9 w-9 rounded-[6px] bg-galla-surface border border-galla-line hover:bg-galla-paper flex items-center justify-center text-galla-ink shadow-2xs transition-all cursor-pointer shrink-0"
            title="Close"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Global Error Banner */}
      {error && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4 shrink-0">
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-[12.5px] rounded-[5px] flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 p-0.5 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Overdue Past Advance Bookings Alert Banner */}
      {overdueOrders.length > 0 && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4 shrink-0">
          <div className="bg-amber-50/90 border border-amber-300 rounded-[8px] p-3.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4 text-amber-800" />
                </div>
                <div>
                  <h3 className="text-[13.5px] font-bold text-amber-950">
                    {overdueOrders.length} Past Booking{overdueOrders.length > 1 ? "s" : ""} Need Action
                  </h3>
                  <p className="text-[12px] text-amber-900/80">
                    Past appointments/pickups not yet marked completed or rescheduled.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOverdueDrawer((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] bg-amber-100/90 hover:bg-amber-200/90 border border-amber-300/80 text-[12px] font-semibold text-amber-950 transition-colors cursor-pointer self-start sm:self-center"
              >
                <span>{showOverdueDrawer ? "Hide Past Bookings" : `Review (${overdueOrders.length})`}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    showOverdueDrawer ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>

            {showOverdueDrawer && (
              <div className="mt-3 pt-3 border-t border-amber-200/80 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {overdueOrders.map((order) => {
                  const waUrl = getWhatsAppReminderUrl({
                    phone: order.customerPhone,
                    customerName: order.customer,
                    salonName: salonName || "our salon",
                    bookingDate: order.scheduledFor,
                    bookingTime: order.scheduledTime,
                    orderType: order.type as any,
                    productName: order.itemsSummary,
                    orderId: order.id,
                  });

                  return (
                    <div
                      key={order.id}
                      className="bg-white/95 border border-amber-200 rounded-[6px] p-3 flex flex-col justify-between gap-2.5 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[13px] text-galla-ink truncate">
                              {order.customer}
                            </span>
                            <span className="tabular-nums text-[11px] font-semibold text-galla-ink-soft bg-galla-paper px-1.5 py-0.2 rounded border border-galla-line shrink-0">
                              #{formatDisplayNumber(order.id)}
                            </span>
                          </div>
                          <p className="text-[11.5px] text-amber-900 font-medium mt-0.5">
                            Booked for: {formatBookingDate(order.scheduledFor)}{" "}
                            {order.scheduledTime ? `• ${formatAppointmentTime(order.scheduledTime)}` : ""}
                          </p>
                          <p className="text-[11.5px] text-galla-ink-soft truncate mt-0.5">
                            {order.itemsSummary || order.type}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectDate(getISTDateString(order.scheduledFor))}
                          className="text-[11px] font-semibold text-galla-teal hover:underline shrink-0 cursor-pointer"
                        >
                          View Date &rarr;
                        </button>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-galla-line/50">
                        <button
                          type="button"
                          onClick={() => onOpenSettle?.(order)}
                          className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-2 rounded-[4px] bg-emerald-600 hover:bg-emerald-700 text-white text-[11.5px] font-semibold transition-colors cursor-pointer shadow-2xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Settle &amp; Complete</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setReschedulingOrder(order)}
                          className="inline-flex items-center justify-center gap-1 py-1 px-2.5 rounded-[4px] bg-galla-paper hover:bg-galla-line/60 border border-galla-line text-galla-ink text-[11.5px] font-medium transition-colors cursor-pointer"
                        >
                          <Clock className="h-3.5 w-3.5 text-galla-ink-soft" />
                          <span>Reschedule</span>
                        </button>
                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center p-1.5 rounded-[4px] bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] border border-[#25D366]/30 transition-colors cursor-pointer"
                            title="Send WhatsApp Reminder"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MAIN TWO-COLUMN LAYOUT: Matching Galla card system       */}
      {/* LEFT: Calendar Heatmap + Selected Date Services Summary  */}
      {/* RIGHT: Day Timeline                                      */}
      {/* ======================================================== */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)] gap-6 items-start flex-1">
        {/* LEFT COLUMN: Calendar & Summary */}
        <div className="flex flex-col gap-6 w-full">
          {/* Calendar Heatmap Card */}
          <div className="bg-galla-surface border border-galla-line rounded-[8px] p-4 sm:p-5 shadow-xs space-y-4">
            {/* Month Header Navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-galla-teal" />
                <h2 className="text-[15px] font-bold text-galla-ink">
                  {monthName}
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="h-8 w-8 rounded-[5px] bg-galla-surface border border-galla-line hover:bg-galla-paper flex items-center justify-center text-galla-ink-soft hover:text-galla-ink shadow-2xs transition-all cursor-pointer"
                  title="Previous month"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="h-8 w-8 rounded-[5px] bg-galla-surface border border-galla-line hover:bg-galla-paper flex items-center justify-center text-galla-ink-soft hover:text-galla-ink shadow-2xs transition-all cursor-pointer"
                  title="Next month"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Day of Week Labels */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day, idx) => (
                <span
                  key={idx}
                  className="text-[11px] font-semibold text-galla-ink-soft py-0.5 select-none"
                >
                  {day}
                </span>
              ))}
            </div>

            {/* Month Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {calendarDays.map((cell, idx) => {
                const isSelected = cell.dateStr === selectedDate;
                const isToday = cell.dateStr === todayIST;
                const shadeClass = getHeatmapClass(
                  cell.orderCount,
                  isSelected,
                  cell.isAllCompleted,
                );

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDate(cell.dateStr)}
                    className={`relative flex flex-col items-center justify-center h-10 rounded-[6px] border text-[13px] font-medium transition-all select-none cursor-pointer ${shadeClass} ${
                      !cell.isCurrentMonth ? "opacity-30" : ""
                    }`}
                    aria-label={`${cell.dateStr}: ${cell.orderCount} orders`}
                  >
                    <span className="leading-none">{cell.dayNumber}</span>

                    {/* Overdue past uncompleted indicator dot */}
                    {!cell.isAllCompleted && cell.orderCount > 0 && cell.dateStr < todayIST && !isSelected && (
                      <span
                        className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500 ring-1 ring-white"
                        title="Past uncompleted booking(s)"
                      />
                    )}

                    {/* Today indicator dot */}
                    {isToday && !isSelected && (
                      <span
                        className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                          cell.isAllCompleted
                            ? "bg-galla-sage"
                            : "bg-galla-teal"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Heatmap Legend */}
            <div className="pt-3 border-t border-galla-line flex items-center justify-between text-[11.5px] text-galla-ink-soft flex-wrap gap-2">
              <span className="font-medium text-galla-ink">Heatmap:</span>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-[3px] bg-galla-surface border border-galla-line"></span>
                  <span>0</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-[3px] bg-galla-teal-soft border border-galla-teal/20"></span>
                  <span>1-2</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-[3px] bg-[#F7D3DE] border border-[#F3BDCE]"></span>
                  <span>3-4</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-[3px] bg-[#EBB4C4] border border-[#E39EB3]"></span>
                  <span>5+</span>
                </div>
                <div className="flex items-center gap-1 pl-1 border-l border-galla-line">
                  <span className="w-3 h-3 rounded-[3px] bg-galla-sage-soft border border-galla-sage/30 flex items-center justify-center">
                    <CheckCircle2 className="w-2.5 h-2.5 text-galla-sage" />
                  </span>
                  <span className="text-galla-sage font-medium">Completed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Selected Date Summary Card */}
          <div className="bg-galla-surface border border-galla-line rounded-[8px] p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-galla-line">
              <div>
                <h3 className="text-[14px] font-bold text-galla-ink">
                  {formatBookingDate(selectedDate) || selectedDate}
                </h3>
                <p className="text-[11.5px] text-galla-ink-soft">
                  {selectedDate === todayIST
                    ? "Today's Schedule"
                    : "Scheduled Date"}
                </p>
              </div>
              <span className="text-[11.5px] font-medium px-2.5 py-0.5 rounded-full bg-galla-teal-soft text-galla-teal">
                {selectedDateOrders.length}{" "}
                {selectedDateOrders.length === 1 ? "order" : "orders"}
              </span>
            </div>

            {/* Booked Items (Separated into 3 categories: Services, Packages, and Product sell) */}
            <div>
              {selectedDateOrders.length === 0 ? (
                <div className="py-8 text-center text-galla-ink-soft">
                  <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-30 text-galla-ink-soft" />
                  <p className="text-[13px] font-medium text-galla-ink">
                    No advance bookings for this date
                  </p>
                  <p className="text-[11.5px] text-galla-ink-soft mt-0.5">
                    Select another date from the calendar or take a new order.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Category 1: Services */}
                  {selectedDateServices.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[11.5px] font-semibold text-galla-ink-soft uppercase tracking-wider flex items-center justify-between">
                        <span>Services ({selectedDateServices.length})</span>
                      </h4>
                      {selectedDateServices.map((svc) => {
                        const isExpanded = expandedService === svc.name;
                        return (
                          <div
                            key={svc.name}
                            className="rounded-[6px] border border-galla-line overflow-hidden bg-galla-paper/50"
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleService(svc.name)}
                              className="w-full flex items-center justify-between p-3 text-left hover:bg-galla-paper transition-colors cursor-pointer"
                              aria-expanded={isExpanded}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Scissors className="h-3.5 w-3.5 text-galla-teal shrink-0" />
                                <span className="text-[13px] font-semibold text-galla-ink truncate">
                                  {svc.name}
                                </span>
                                <span className="text-[11px] font-semibold px-1.5 py-0.2 rounded-full bg-galla-teal-soft text-galla-teal shrink-0">
                                  × {svc.quantity}
                                </span>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-galla-ink-soft shrink-0" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-galla-ink-soft shrink-0" />
                              )}
                            </button>

                            {isExpanded && (
                              <div className="p-2.5 pt-0 border-t border-galla-line/60 bg-galla-surface space-y-1.5">
                                {svc.bookings.map((booking, bIdx) => {
                                  const isCompleted = isOrderCompleted(
                                    booking.order,
                                  );
                                  return (
                                    <button
                                      key={bIdx}
                                      type="button"
                                      onClick={() =>
                                        setSelectedOrderDetails(booking.order)
                                      }
                                      className={`w-full flex items-center justify-between p-2 rounded-[5px] text-left transition-colors cursor-pointer ${
                                        isCompleted
                                          ? "bg-galla-sage-soft/70 hover:bg-galla-sage-soft text-galla-sage border border-galla-sage/20"
                                          : "hover:bg-galla-paper text-galla-ink border border-transparent"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        {isCompleted ? (
                                          <CheckCircle2 className="h-3.5 w-3.5 text-galla-sage shrink-0" />
                                        ) : (
                                          <User className="h-3.5 w-3.5 text-galla-ink-soft shrink-0" />
                                        )}
                                        <span
                                          className={`text-[12.5px] truncate ${
                                            isCompleted
                                              ? "text-galla-sage font-semibold"
                                              : "text-galla-ink font-medium"
                                          }`}
                                        >
                                          {booking.customerName}
                                        </span>
                                        <span className="tabular-nums text-[11px] font-semibold text-galla-ink-soft bg-galla-paper px-1.5 py-0.2 rounded border border-galla-line shrink-0">
                                          #
                                          {formatDisplayNumber(
                                            booking.order.id,
                                          )}
                                        </span>
                                      </div>
                                      <span
                                        className={`text-[11.5px] flex items-center gap-1 shrink-0 ${
                                          isCompleted
                                            ? "text-galla-sage/90 font-medium"
                                            : "text-galla-ink-soft"
                                        }`}
                                      >
                                        <Clock className="h-3 w-3" />
                                        {booking.appointmentTime}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Category 2: Packages */}
                  {selectedDatePackages.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[11.5px] font-semibold text-galla-ink-soft uppercase tracking-wider flex items-center justify-between">
                        <span>Packages ({selectedDatePackages.length})</span>
                      </h4>
                      {selectedDatePackages.map((pkg) => {
                        const isExpanded = expandedService === pkg.name;
                        return (
                          <div
                            key={pkg.name}
                            className="rounded-[6px] border border-galla-line overflow-hidden bg-galla-paper/50"
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleService(pkg.name)}
                              className="w-full flex items-center justify-between p-3 text-left hover:bg-galla-paper transition-colors cursor-pointer"
                              aria-expanded={isExpanded}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Package className="h-3.5 w-3.5 text-galla-teal shrink-0" />
                                <span className="text-[13px] font-semibold text-galla-ink truncate">
                                  {pkg.name}
                                </span>
                                <span className="text-[11px] font-semibold px-1.5 py-0.2 rounded-full bg-galla-teal-soft text-galla-teal shrink-0">
                                  × {pkg.quantity}
                                </span>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-galla-ink-soft shrink-0" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-galla-ink-soft shrink-0" />
                              )}
                            </button>

                            {isExpanded && (
                              <div className="p-2.5 pt-0 border-t border-galla-line/60 bg-galla-surface space-y-1.5">
                                {pkg.bookings.map((booking, bIdx) => {
                                  const isCompleted = isOrderCompleted(
                                    booking.order,
                                  );
                                  return (
                                    <button
                                      key={bIdx}
                                      type="button"
                                      onClick={() =>
                                        setSelectedOrderDetails(booking.order)
                                      }
                                      className={`w-full flex items-center justify-between p-2 rounded-[5px] text-left transition-colors cursor-pointer ${
                                        isCompleted
                                          ? "bg-galla-sage-soft/70 hover:bg-galla-sage-soft text-galla-sage border border-galla-sage/20"
                                          : "hover:bg-galla-paper text-galla-ink border border-transparent"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        {isCompleted ? (
                                          <CheckCircle2 className="h-3.5 w-3.5 text-galla-sage shrink-0" />
                                        ) : (
                                          <User className="h-3.5 w-3.5 text-galla-ink-soft shrink-0" />
                                        )}
                                        <span
                                          className={`text-[12.5px] truncate ${
                                            isCompleted
                                              ? "text-galla-sage font-semibold"
                                              : "text-galla-ink font-medium"
                                          }`}
                                        >
                                          {booking.customerName}
                                        </span>
                                        <span className="tabular-nums text-[11px] font-semibold text-galla-ink-soft bg-galla-paper px-1.5 py-0.2 rounded border border-galla-line shrink-0">
                                          #
                                          {formatDisplayNumber(
                                            booking.order.id,
                                          )}
                                        </span>
                                      </div>
                                      <span
                                        className={`text-[11.5px] flex items-center gap-1 shrink-0 ${
                                          isCompleted
                                            ? "text-galla-sage/90 font-medium"
                                            : "text-galla-ink-soft"
                                        }`}
                                      >
                                        <Clock className="h-3 w-3" />
                                        {booking.appointmentTime}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Category 3: Product sell */}
                  {selectedDateProducts.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[11.5px] font-semibold text-galla-ink-soft uppercase tracking-wider flex items-center justify-between">
                        <span>
                          Product sell ({selectedDateProducts.length})
                        </span>
                      </h4>
                      {selectedDateProducts.map((prod) => {
                        const isExpanded = expandedService === prod.name;
                        return (
                          <div
                            key={prod.name}
                            className="rounded-[6px] border border-galla-line overflow-hidden bg-galla-paper/50"
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleService(prod.name)}
                              className="w-full flex items-center justify-between p-3 text-left hover:bg-galla-paper transition-colors cursor-pointer"
                              aria-expanded={isExpanded}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <ShoppingBag className="h-3.5 w-3.5 text-galla-brass shrink-0" />
                                <span className="text-[13px] font-semibold text-galla-ink truncate">
                                  {prod.name}
                                </span>
                                <span className="text-[11px] font-semibold px-1.5 py-0.2 rounded-full bg-galla-brass-soft text-galla-brass shrink-0">
                                  × {prod.quantity}
                                </span>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-galla-ink-soft shrink-0" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-galla-ink-soft shrink-0" />
                              )}
                            </button>

                            {isExpanded && (
                              <div className="p-2.5 pt-0 border-t border-galla-line/60 bg-galla-surface space-y-1.5">
                                {prod.bookings.map((booking, bIdx) => {
                                  const isCompleted = isOrderCompleted(
                                    booking.order,
                                  );
                                  return (
                                    <button
                                      key={bIdx}
                                      type="button"
                                      onClick={() =>
                                        setSelectedOrderDetails(booking.order)
                                      }
                                      className={`w-full flex items-center justify-between p-2 rounded-[5px] text-left transition-colors cursor-pointer ${
                                        isCompleted
                                          ? "bg-galla-sage-soft/70 hover:bg-galla-sage-soft text-galla-sage border border-galla-sage/20"
                                          : "hover:bg-galla-paper text-galla-ink border border-transparent"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        {isCompleted ? (
                                          <CheckCircle2 className="h-3.5 w-3.5 text-galla-sage shrink-0" />
                                        ) : (
                                          <User className="h-3.5 w-3.5 text-galla-ink-soft shrink-0" />
                                        )}
                                        <span
                                          className={`text-[12.5px] truncate ${
                                            isCompleted
                                              ? "text-galla-sage font-semibold"
                                              : "text-galla-ink font-medium"
                                          }`}
                                        >
                                          {booking.customerName}
                                        </span>
                                        <span className="tabular-nums text-[11px] font-semibold text-galla-ink-soft bg-galla-paper px-1.5 py-0.2 rounded border border-galla-line shrink-0">
                                          #
                                          {formatDisplayNumber(
                                            booking.order.id,
                                          )}
                                        </span>
                                      </div>
                                      <span
                                        className={`text-[11.5px] flex items-center gap-1 shrink-0 ${
                                          isCompleted
                                            ? "text-galla-sage/90 font-medium"
                                            : "text-galla-ink-soft"
                                        }`}
                                      >
                                        <Clock className="h-3 w-3" />
                                        {booking.appointmentTime}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Day Timeline */}
        <div className="bg-galla-surface border border-galla-line rounded-[8px] p-4 sm:p-5 shadow-xs space-y-5 w-full">
          <div className="flex items-center justify-between pb-3 border-b border-galla-line">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-galla-teal" />
              <h2 className="text-[15px] font-bold text-galla-ink">
                Day Timeline
              </h2>
            </div>
            <span className="text-[11px] font-medium text-galla-ink-soft bg-galla-paper px-2 py-0.5 rounded border border-galla-line">
              IST (Asia/Kolkata)
            </span>
          </div>

          {/* Timeline Stream */}
          <div className="relative pl-5 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-galla-line">
            <div className="space-y-6">
              {timelineRows.map((row) => {
                const hasAppointments = row.customerList.length > 0;

                return (
                  <div
                    key={row.timeMinutes}
                    className="relative flex items-start gap-3"
                  >
                    {/* Timeline Node Dot */}
                    <div
                      className={`absolute -left-5 mt-1 flex items-center justify-center w-4 h-4 rounded-full ring-3 ring-galla-surface transition-all ${
                        hasAppointments
                          ? "bg-galla-teal text-white shadow-xs"
                          : "bg-galla-line text-transparent"
                      }`}
                    >
                      {hasAppointments && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>

                    {/* Timeline Slot Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[13px] font-semibold tracking-tight ${
                            hasAppointments
                              ? "text-galla-teal"
                              : "text-galla-ink-soft"
                          }`}
                        >
                          {row.displayTime}
                        </span>
                        {!row.isDefault && (
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-galla-teal-soft text-galla-teal">
                            Appointment
                          </span>
                        )}
                      </div>

                      {hasAppointments ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {row.customerList.map(({ name, order }) => {
                            const isCompleted = isOrderCompleted(order);
                            return (
                              <button
                                key={order.id}
                                type="button"
                                onClick={() => setSelectedOrderDetails(order)}
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] border text-[13px] font-medium transition-all text-left max-w-full cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.99] ${
                                  isCompleted
                                    ? "bg-galla-sage-soft border-galla-sage/30 text-galla-sage hover:bg-[#DDF0E8]"
                                    : "bg-galla-surface border-galla-line hover:border-galla-teal/40 hover:bg-galla-paper text-galla-ink"
                                }`}
                              >
                                {isCompleted ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-galla-sage shrink-0" />
                                ) : (
                                  <User className="h-3.5 w-3.5 text-galla-teal shrink-0" />
                                )}
                                <span className="truncate max-w-[200px] sm:max-w-xs">
                                  {name}
                                </span>
                                <span
                                  className={`tabular-nums text-[11px] px-1.5 py-0.2 rounded border ${
                                    isCompleted
                                      ? "bg-white text-galla-sage border-galla-sage/30 font-semibold"
                                      : "bg-galla-paper text-galla-ink-soft border-galla-line"
                                  }`}
                                >
                                  #{formatDisplayNumber(order.id)}
                                </span>
                                {isCompleted && (
                                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-galla-sage">
                                    Done
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-1 text-[11.5px] text-galla-ink-soft/60 italic">
                          No bookings
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Embedded Order Details Modal */}
      {selectedOrderDetails && (
        <OrderDetailsModal
          order={selectedOrderDetails}
          isOpen={!!selectedOrderDetails}
          onClose={() => setSelectedOrderDetails(null)}
          salonName={salonName}
          onOpenSettle={onOpenSettle}
          onOpenReschedule={(order) => {
            setReschedulingOrder(order);
          }}
          onOpenRefund={onOpenRefund}
          zIndex="z-[60]"
        />
      )}

      {/* Reschedule Order Modal with z-[70] to overlay on top */}
      {reschedulingOrder && (
        <RescheduleOrderModal
          order={reschedulingOrder}
          isOpen={Boolean(reschedulingOrder)}
          onClose={() => setReschedulingOrder(null)}
          onRescheduleSuccess={(updated) => {
            // Update local orders list
            setOrders((prev) =>
              prev.map((o) => (o.id === updated.id ? updated : o))
            );
            // Update selected order details view if open
            if (selectedOrderDetails?.id === updated.id) {
              setSelectedOrderDetails(updated);
            }
            // Propagate up to dashboard client
            if (onOpenReschedule) {
              onOpenReschedule(updated);
            }
            setReschedulingOrder(null);
          }}
          salonName={salonName}
          zIndex="z-[70]"
        />
      )}
    </div>
  );
}
