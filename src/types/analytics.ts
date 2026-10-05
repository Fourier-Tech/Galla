export type AnalyticsRangePreset =
  | "today"
  | "7d"
  | "this_month"
  | "30d"
  | "custom";

export interface MetricDelta {
  current: number;
  previous: number;
  deltaPercent: number; // e.g. +12.5 or -5.2
  trend: "up" | "down" | "neutral";
}

export interface ExecutiveMetricsData {
  netRevenue: MetricDelta;
  totalExpenses: MetricDelta;
  netProfit: MetricDelta;
  profitMarginPercent: MetricDelta;
  averageTicketValue: MetricDelta;
  totalFootfall: MetricDelta;
  uncollectedDues: number;
}

export interface CashflowTimelinePoint {
  date: string; // YYYY-MM-DD
  label: string; // "Sep 28" or "Mon" or "10 AM"
  revenue: number;
  expense: number;
  net: number;
}

export interface RevenueCategoryBreakdown {
  amount: number;
  percent: number;
  count: number;
}

export interface RevenueMixData {
  services: RevenueCategoryBreakdown;
  products: RevenueCategoryBreakdown;
  packages: RevenueCategoryBreakdown;
  total: number;
}

export interface TenderSplitItem {
  mode: "upi" | "cash" | "card" | "split";
  label: string;
  amount: number;
  percent: number;
  count: number;
}

export interface TopServiceItem {
  id: string;
  name: string;
  category: string;
  revenue: number;
  bookingsCount: number;
  avgPrice: number;
}

export interface ServiceCategoryContribution {
  category: string;
  revenue: number;
  percent: number;
  bookingsCount: number;
}

export interface HourlyDistributionItem {
  hour: number;
  label: string; // "10 AM", "11 AM", etc.
  count: number;
  revenue: number;
}

export interface WeekdayDistributionItem {
  day: string; // "Mon", "Tue", etc.
  dayIndex: number; // 0 = Sun, 1 = Mon ...
  count: number;
  revenue: number;
}

export interface TopRetailProductItem {
  id: string;
  name: string;
  category: string;
  unitsSold: number;
  grossRevenue: number;
  currentStock: number;
}

export interface SlowMovingStockItem {
  id: string;
  name: string;
  category: string;
  sellStock: number;
  purchaseCost: number;
  lockedCapital: number;
}

export interface InternalConsumptionData {
  totalCost: number;
  transfersCount: number;
}

export interface InternalConsumptionMovementItem {
  id: string;
  productName: string;
  productId?: string;
  dateTime: string; // ISO string
  quantity: number;
  unitPrice: number;
  totalCost: number;
  notes?: string;
  recordedBy: "owner" | "staff";
  reason?: string;
}

export interface ClientRetentionData {
  newClientsCount: number;
  returningClientsCount: number;
  totalClientsServed: number;
  repeatRatePercent: number;
  dormantClientsCount: number; // Regulars not visited in 45+ days
}

export interface TopVipClientItem {
  id: string;
  name: string;
  phone: string;
  periodSpend: number;
  lifetimeSpend: number;
  totalVisits: number;
  lastVisitAt?: string;
}

export interface ProcurementHealthData {
  totalPOSpend: number;
  purchaseOrdersCount: number;
  totalPendingDealerDues: number;
  totalSupplierCredits: number;
  netDealerBalance: number;
}

export type MonthlyRangePreset =
  | "this_month"
  | "30d"
  | "custom_month"
  | "yearly"
  | "all_time";

export type TrafficRangePreset = "today" | "yesterday";
export type WeekdayRangePreset = "this_week" | "last_week";

export interface MainAnalyticsData {
  range: AnalyticsRangePreset;
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  executive: ExecutiveMetricsData;
  procurement: ProcurementHealthData;
  cashflow: {
    timeline: CashflowTimelinePoint[];
    revenueMix: RevenueMixData;
    tenderSplit: TenderSplitItem[];
  };
  internalConsumption: InternalConsumptionData;
  clients?: {
    retention: ClientRetentionData;
    vipClients: TopVipClientItem[];
  };
}

export interface PerformanceAnalyticsData {
  monthlyRange: MonthlyRangePreset;
  startDate?: string;
  endDate?: string;
  label: string;
  services: {
    topServices: TopServiceItem[];
    categoryContribution: ServiceCategoryContribution[];
  };
  inventory: {
    topRetailProducts: TopRetailProductItem[];
    slowMovingStock: SlowMovingStockItem[];
  };
}

export interface TrafficAnalyticsData {
  preset: TrafficRangePreset;
  date: string;
  label: string;
  hourly: HourlyDistributionItem[];
}

export interface WeekdayAnalyticsData {
  preset: WeekdayRangePreset;
  startDate: string;
  endDate: string;
  label: string;
  weekday: WeekdayDistributionItem[];
}

export interface ConsumptionDetailsData {
  startDate: string;
  endDate: string;
  totalCost: number;
  totalItems: number;
  items: InternalConsumptionMovementItem[];
}

export interface AnalyticsResponseData {
  range: AnalyticsRangePreset;
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  executive: ExecutiveMetricsData;
  cashflow: {
    timeline: CashflowTimelinePoint[];
    revenueMix: RevenueMixData;
    tenderSplit: TenderSplitItem[];
  };
  services: {
    topServices: TopServiceItem[];
    categoryContribution: ServiceCategoryContribution[];
    hourlyDistribution: HourlyDistributionItem[];
    weekdayDistribution: WeekdayDistributionItem[];
  };
  inventory: {
    topRetailProducts: TopRetailProductItem[];
    internalConsumption: InternalConsumptionData;
    slowMovingStock: SlowMovingStockItem[];
  };
  clients: {
    retention: ClientRetentionData;
    vipClients: TopVipClientItem[];
  };
  procurement: ProcurementHealthData;
}

