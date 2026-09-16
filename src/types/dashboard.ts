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
  todayPaid?: number;
  status: OrderStatus;
  time: string;
  isToday?: boolean;
  isLast24Hours?: boolean;
  createdAt?: string;
  completedAt?: string;
  refundAmount?: number;
  refundReason?: string;
  paymentMode?: DashboardPaymentMode;
  refundMode?: DashboardRefundMode;
  advanceAmount?: number;
  advancePaymentMode?: DashboardPaymentMode;
  scheduledFor?: string;
  scheduledTime?: string;
  customerPhone?: string;
}

export interface DashboardProduct {
  id: number | string;
  name: string;
  category?: string;
  sell: number;
  use: number;
  price: number;
  purchaseCost?: number;
  lowStockThreshold?: number;
  description?: string;
  barcode?: string;
  isActive?: boolean;
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

export interface DashboardPurchaseOrder {
  id: string;
  purchaseOrderNumber: string;
  supplierId: string;
  supplierName: string;
  supplierPhone?: string;
  supplierCompany?: string;
  itemsCount: number;
  totalAmount: number;
  amountPaid: number;
  amountPending: number;
  paymentMode: "cash" | "upi" | "card" | "bank_transfer" | "credit";
  paymentStatus: "paid" | "partial" | "unpaid";
  invoiceDate: string;
  dealerInvoiceNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface DashboardSupplier {
  id: string;
  name: string;
  companyName?: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  notes?: string;
  totalPurchases: number;
  totalPaid: number;
  totalPending: number;
  isActive: boolean;
}
