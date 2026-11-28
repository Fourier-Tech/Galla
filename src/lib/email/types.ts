/**
 * Email Infrastructure Types — Galla / FourierTech
 * Reusable type definitions for Brevo transactional email sending and templates.
 */

export interface EmailRecipient {
  email: string;
  name?: string;
}

/**
 * Standard branded email identities for Galla & FourierTech.
 * Ensures consistent Reply-To routing across billing, support, and contact workflows.
 */
export const GALLA_EMAIL_IDENTITIES = {
  SENDER: {
    name: process.env.EMAIL_FROM_NAME?.trim() || "Galla",
    email: process.env.EMAIL_FROM_ADDRESS?.trim() || "noreply@fouriertech.in",
  },
  SUPPORT: {
    name: "Galla Support",
    email: process.env.EMAIL_SUPPORT_ADDRESS?.trim() || "galla.support@fouriertech.in",
  },
  BILLING: {
    name: "Galla Billing",
    email: process.env.EMAIL_BILLING_ADDRESS?.trim() || "galla.billing@fouriertech.in",
  },
  CONTACT: {
    name: "Galla Contact",
    email: process.env.EMAIL_CONTACT_ADDRESS?.trim() || "galla.contact@fouriertech.in",
  },
} as const;

export interface SendEmailOptions {
  to: EmailRecipient | string | (EmailRecipient | string)[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: EmailRecipient | string;
  tags?: string[];
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: "brevo" | "smtp" | "mock";
}

export interface SendForgotPinOtpOptions {
  to: string;
  salonName: string;
  otp: string;
  expiresInMinutes?: number;
}

export interface SendWelcomeOptions {
  to: string;
  salonName: string;
  ownerName?: string;
  loginUrl?: string;
  tempPassword?: string;
}

export interface SendPasswordResetOptions {
  to: string;
  salonName: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

export interface OrderReceiptItem {
  name: string;
  type?: "service" | "package" | "product";
  price: number;
  qty?: number;
}

export interface SendOrderReceiptOptions {
  to: string;
  customerName: string;
  salonName: string;
  orderNumber: string;
  items: OrderReceiptItem[];
  subtotal: number;
  discountAmount?: number;
  totalAmount: number;
  advancePaid?: number;
  dueAmount?: number;
  paymentMode?: string;
  date?: Date | string;
}

export interface SendNotificationOptions {
  to: string;
  title: string;
  message: string;
  salonName?: string;
  actionUrl?: string;
  actionLabel?: string;
}
