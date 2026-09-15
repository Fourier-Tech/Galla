export type OrderStatus =
  | "completed"
  | "paid_full"
  | "fulfilled"
  | "advance_paid"
  | "cancelled_refunded"
  | "cancelled_converted"
  | "created";

export type OrderType = "Product sale" | "Service booking" | "Package sale";

export type DashboardPaymentMode = "cash" | "upi" | "card" | "split";
export type DashboardRefundMode = "cash" | "upi" | "card";

export interface DashboardOrder {
  id: string;
  customer: string;
  type: OrderType;
  amount: number;
  paid: number;
  status: OrderStatus;
  time: string;
  isToday?: boolean;
  isLast24Hours?: boolean;
  createdAt?: string;
  refundAmount?: number;
  refundReason?: string;
  paymentMode?: DashboardPaymentMode;
  refundMode?: DashboardRefundMode;
  advanceAmount?: number;
  scheduledFor?: string;
  scheduledTime?: string;
  customerPhone?: string;
}

export interface DashboardProduct {
  id: number | string;
  name: string;
  sell: number;
  use: number;
  price: number;
}

export interface DashboardCustomer {
  phone: string;
  name: string;
  visits: number;
  lastVisit: string;
}

export interface DashboardExpense {
  id?: string;
  desc: string;
  amount: number;
  category: "Inventory purchase" | "Day-to-day" | "Salary" | "Rent" | "Refund";
  time: string;
  isToday?: boolean;
  createdAt?: string;
}

export interface DashboardSalonProfile {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  address: string;
  profileImageUrl?: string;
  profileImagePublicId?: string;
  status: string;
  currency: string;
  ownerName: string;
}

export interface DashboardService {
  id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  isActive: boolean;
}

export interface DashboardPackageServiceItem {
  serviceId: string;
  name: string;
  componentPrice: number;
}

export interface DashboardPackageProductItem {
  productId: string;
  name: string;
  quantity: number;
  componentPrice: number;
}

export interface DashboardPackage {
  id: string;
  name: string;
  description?: string;
  pricingType: "fixed" | "sum_of_items";
  packagePrice: number;
  services: DashboardPackageServiceItem[];
  products: DashboardPackageProductItem[];
  isActive: boolean;
}

export type TabId =
  | "overview"
  | "orders"
  | "services"
  | "inventory"
  | "customers"
  | "expenses"
  | "analytics"
  | "profile";

export type UserRole = "owner" | "staff";
