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

export interface DashboardOrderLineItem {
  name: string;
  itemType: "product" | "service" | "package";
  itemId?: string;
  unitPrice: number;
  quantity: number;
  discount?: number;
  finalPrice: number;
  fulfilled?: boolean;
  packageDetails?: {
    isCustomized?: boolean;
    components?: { name: string; componentPrice: number }[];
  };
  returnedQuantity?: number;
  returnCondition?: "restocked" | "defective_dealer_claim";
}

export interface DashboardOrderPayment {
  amount: number;
  mode: DashboardPaymentMode;
  recordedAt: string;
  recordedBy?: string;
  type?: "advance" | "settlement" | "full_payment" | "refund" | string;
  notes?: string;
}

export interface DashboardOrderReturn {
  returnNumber: string;
  lineItemId?: string;
  lineItemIndex: number;
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  refundAmount: number;
  returnCondition: "restocked" | "defective_dealer_claim";
  customerResolution: "refund" | "replacement";
  refundMode?: "cash" | "upi" | "card" | "reduce_due";
  supplierClaim?: {
    poId: string;
    purchaseOrderNumber?: string;
    supplierName?: string;
    refundMode: "reduce_due" | "replacement_pending";
  };
  customerReplacementId?: string;
  expectedPickupDate?: string;
  restockLocation?: "sellStock" | "useStock";
  isSameDayReturn?: boolean;
  notes?: string;
  recordedBy?: "owner" | "staff" | string;
  returnedAt: string;
}

export interface DashboardOrder {
  id: string;
  customer: string;
  type: OrderType;
  itemsSummary?: string;
  amount: number;
  paid: number;
  todayPaid?: number;
  status: OrderStatus;
  time: string;
  lastUpdatedTime?: string;
  isToday?: boolean;
  isLast24Hours?: boolean;
  createdAt?: string;
  completedAt?: string;
  refundedAt?: string;
  latestActivityAt?: string;
  refundAmount?: number;
  refundReason?: string;
  paymentMode?: DashboardPaymentMode;
  refundMode?: DashboardRefundMode;
  advanceAmount?: number;
  advancePaymentMode?: DashboardPaymentMode;
  scheduledFor?: string;
  scheduledTime?: string;
  customerPhone?: string;
  subtotal?: number;
  discountType?: "flat" | "percentage";
  discountValue?: number;
  discountAmount?: number;
  notes?: string;
  lineItems?: DashboardOrderLineItem[];
  payments?: DashboardOrderPayment[];
  returns?: DashboardOrderReturn[];
  recordedBy?: "owner" | "staff";
}

export interface DashboardProduct {
  id: number | string;
  name: string;
  category?: string;
  sell: number;
  use: number;
  defectiveStock: number;
  price: number;
  purchaseCost?: number;
  lowStockThreshold?: number;
  description?: string;
  barcode?: string;
  isActive?: boolean;
}

export interface DashboardCustomer {
  id?: string;
  phone: string;
  name: string;
  email?: string;
  gender?: "female" | "male" | "other";
  notes?: string;
  visits: number;
  lastVisit: string;
  lastVisitRaw?: string;
  totalSpent?: number;
  outstandingDue?: number;
  createdAt?: string;
}

export interface DashboardExpense {
  id?: string;
  expenseNumber?: string;
  desc: string;
  amount: number;
  category: "Inventory purchase" | "Day-to-day" | "Salary" | "Rent" | "Refund";
  time: string;
  isToday?: boolean;
  notes?: string;
  createdAt?: string;
  paymentMode?: string;
  recipient?: string;
  recordedBy?: string;
  linkedPurchaseOrderId?: string;
  linkedOrderId?: string;
}

export interface DashboardSalonProfile {
  id: string;
  tenantCode?: string;
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
  | "suppliers"
  | "customers"
  | "expenses"
  | "analytics"
  | "profile";

export type UserRole = "owner" | "staff";

export interface DashboardPurchaseOrderItem {
  productId: string;
  productName: string;
  quantityForSell: number;
  quantityForUse: number;
  purchaseCost: number;
  expectedSellPrice: number;
  itemTotalCost: number;
  returnedQuantity?: number;
}

export interface DashboardPurchaseOrderPayment {
  amount: number;
  paymentMode: "cash" | "upi" | "card" | "bank_transfer";
  notes?: string;
  recordedBy?: "owner" | "staff";
  type?: "initial" | "settlement" | "full_payment" | string;
  recordedAt?: string;
}

export interface DashboardPurchaseOrderReturn {
  returnNumber: string;
  productId: string;
  productName: string;
  quantity: number;
  stockType: "sell" | "use";
  unitCost: number;
  totalRefundAmount: number;
  refundMode: "reduce_due" | "replacement_pending";
  amountDeductedFromDue: number;
  replacementStatus?: "pending" | "fulfilled";
  notes?: string;
  recordedBy?: "owner" | "staff";
  returnedAt?: string;
}

export interface DashboardCustomerReplacement {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  productId: string;
  productName: string;
  totalQuantity: number;
  handedQuantity: number;
  pendingQuantity: number;
  expectedDate: string;
  status: "pending_dealer" | "arrived_call_client" | "completed" | "cancelled";
  notes?: string;
  recordedBy?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardPurchaseOrder {
  id: string;
  purchaseOrderNumber: string;
  supplierId: string;
  supplierName: string;
  supplierPhone?: string;
  supplierCompany?: string;
  itemsCount: number;
  items?: DashboardPurchaseOrderItem[];
  payments?: DashboardPurchaseOrderPayment[];
  returns?: DashboardPurchaseOrderReturn[];
  totalAmount: number;
  amountPaid: number;
  ledgerAdjustment?: number;
  amountPending: number;
  paymentMode: "cash" | "upi" | "card" | "bank_transfer" | "credit";
  paymentStatus: "paid" | "partial" | "unpaid";
  invoiceDate: string;
  dueDate?: string;
  expectedDeliveryDate?: string;
  deliveryTime?: string;
  settlementMode?: "completed" | "pending" | "advance" | "paid_full";
  stockAllocated?: boolean;
  dealerInvoiceNumber?: string;
  notes?: string;
  recordedBy?: "owner" | "staff" | string;
  createdAt: string;
  updatedAt?: string;
  lastUpdatedTime?: string;
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
