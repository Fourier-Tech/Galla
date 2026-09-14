export type OrderStatus =
  | "completed"
  | "paid_full"
  | "fulfilled"
  | "advance_paid"
  | "cancelled_refunded"
  | "cancelled_converted"
  | "created";

export type OrderType = "Product sale" | "Service booking" | "Package sale";

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
  category: "Inventory purchase" | "Day-to-day" | "Salary" | "Rent";
  time: string;
  isToday?: boolean;
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

export type TabId =
  | "overview"
  | "orders"
  | "inventory"
  | "customers"
  | "expenses"
  | "analytics"
  | "profile";

export type UserRole = "owner" | "staff";
