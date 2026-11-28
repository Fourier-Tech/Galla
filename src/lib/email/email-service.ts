/**
 * Central Transactional Email Service — Galla Platform / FourierTech
 * Primary Dispatcher: Brevo REST API v3 (noreply@fouriertech.in)
 * Secondary Fallback: SMTP / Nodemailer
 * Tertiary Fallback: Local Development Console Mock
 */

import { sendViaBrevo, verifyBrevoConnection } from "./brevo-client";
import { renderOtpEmail } from "./templates/otp-template";
import { renderWelcomeEmail } from "./templates/welcome-template";
import { renderPasswordResetEmail } from "./templates/password-reset-template";
import { renderOrderReceiptEmail } from "./templates/order-receipt-template";
import { renderNotificationEmail } from "./templates/notification-template";
import {
  SendEmailOptions,
  SendEmailResult,
  SendForgotPinOtpOptions,
  SendWelcomeOptions,
  SendPasswordResetOptions,
  SendOrderReceiptOptions,
  SendNotificationOptions,
  GALLA_EMAIL_IDENTITIES,
} from "./types";

// Re-export all types and identities for consumer convenience
export * from "./types";
export { verifyBrevoConnection } from "./brevo-client";

/**
 * Sends a generic transactional email using Brevo.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  return sendViaBrevo(options);
}

/**
 * Dispatches a 6-digit verification code OTP for forgotten Role PIN reset or verification.
 * Reply-To routes to Galla Support (galla.support@fouriertech.in).
 */
export async function sendForgotPinOtpEmail(options: SendForgotPinOtpOptions): Promise<boolean> {
  const { to, salonName, otp, expiresInMinutes = 15 } = options;

  console.log(`[Email] Dispatching role PIN reset OTP to ${to} (${salonName})...`);

  const { html, text } = renderOtpEmail({
    salonName,
    otp,
    expiresInMinutes,
    purpose: "Role PIN Reset",
  });

  const result = await sendViaBrevo({
    to,
    subject: `Your OTP is ${otp} — Galla`,
    html,
    text,
    replyTo: GALLA_EMAIL_IDENTITIES.SUPPORT,
    tags: ["otp", "pin-reset"],
  });

  if (!result.success) {
    console.error(`[Email] Failed to dispatch PIN reset OTP to ${to}:`, result.error);
    return false;
  }

  console.log(`[Email] OTP email successfully sent to ${to} (Message-ID: ${result.messageId || "n/a"})`);
  return true;
}

/**
 * Dispatches a welcome onboarding email to a newly provisioned salon owner.
 * Reply-To routes to Galla Contact (galla.contact@fouriertech.in).
 */
export async function sendWelcomeEmail(options: SendWelcomeOptions): Promise<SendEmailResult> {
  const { to, salonName, ownerName, loginUrl, tempPassword } = options;

  const { html, text } = renderWelcomeEmail({
    salonName,
    ownerName,
    loginUrl,
    tempPassword,
  });

  return sendViaBrevo({
    to,
    subject: `Welcome to Galla — ${salonName}`,
    html,
    text,
    replyTo: GALLA_EMAIL_IDENTITIES.CONTACT,
    tags: ["welcome", "onboarding"],
  });
}

/**
 * Dispatches a secure account password reset email.
 * Reply-To routes to Galla Support (galla.support@fouriertech.in).
 */
export async function sendPasswordResetEmail(options: SendPasswordResetOptions): Promise<SendEmailResult> {
  const { to, salonName, resetUrl, expiresInMinutes = 30 } = options;

  const { html, text } = renderPasswordResetEmail({
    salonName,
    resetUrl,
    expiresInMinutes,
  });

  return sendViaBrevo({
    to,
    subject: `Reset your Galla password — ${salonName}`,
    html,
    text,
    replyTo: GALLA_EMAIL_IDENTITIES.SUPPORT,
    tags: ["password-reset"],
  });
}

/**
 * Dispatches an itemized order receipt / booking confirmation to a customer.
 * Reply-To routes to Galla Support / Billing for customer invoice questions.
 */
export async function sendOrderReceiptEmail(options: SendOrderReceiptOptions): Promise<SendEmailResult> {
  const { to, customerName, salonName, orderNumber } = options;

  const { html, text } = renderOrderReceiptEmail(options);

  return sendViaBrevo({
    to: { email: to, name: customerName },
    subject: `Receipt for ${orderNumber} — ${salonName}`,
    html,
    text,
    replyTo: GALLA_EMAIL_IDENTITIES.BILLING,
    tags: ["order-receipt"],
  });
}

/**
 * Dispatches a billing or subscription lifecycle email (plan renewal, plan expiry, invoices).
 * Reply-To routes strictly to Galla Billing (galla.billing@fouriertech.in).
 */
export async function sendBillingEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  return sendViaBrevo({
    ...options,
    replyTo: options.replyTo || GALLA_EMAIL_IDENTITIES.BILLING,
    tags: [...(options.tags || []), "billing"],
  });
}

/**
 * Dispatches an administrative alert or status notification.
 * Reply-To defaults to Galla Support.
 */
export async function sendNotificationEmail(options: SendNotificationOptions): Promise<SendEmailResult> {
  const { to, title, message, salonName, actionUrl, actionLabel } = options;

  const { html, text } = renderNotificationEmail({
    title,
    message,
    salonName,
    actionUrl,
    actionLabel,
  });

  return sendViaBrevo({
    to,
    subject: `${title} — Galla`,
    html,
    text,
    replyTo: GALLA_EMAIL_IDENTITIES.SUPPORT,
    tags: ["notification"],
  });
}

/**
 * Verifies the email sending configuration and service connectivity.
 */
export async function verifyEmailConfig() {
  return verifyBrevoConnection();
}
