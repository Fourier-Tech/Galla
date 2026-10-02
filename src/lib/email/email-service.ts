import nodemailer from "nodemailer";

export interface SendForgotPinOtpOptions {
  to: string;
  salonName: string;
  otp: string;
  expiresInMinutes?: number;
}

/**
 * Creates Nodemailer transporter using environment SMTP settings.
 * Returns null if SMTP is not configured.
 */
function createTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  const isGmail = user.includes("@gmail.com");
  const host = process.env.SMTP_HOST || (isGmail ? "smtp.gmail.com" : "smtp.gmail.com");
  const port = parseInt(process.env.SMTP_PORT || (host === "smtp.gmail.com" ? "465" : "587"), 10);
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

/**
 * Sends a clean, modern, professional verification email with the 6-digit OTP
 * to the salon owner for resetting forgotten Role PINs.
 */
export async function sendForgotPinOtpEmail(options: SendForgotPinOtpOptions): Promise<boolean> {
  const { to, salonName, otp, expiresInMinutes = 15 } = options;

  console.log(`[Email] Dispatching role PIN reset OTP to ${to} (${salonName})...`);

  const transporter = createTransporter();
  if (!transporter) {
    console.error("[Email] SMTP credentials missing (SMTP_USER / SMTP_PASS).");
    return false;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>OTP Verification</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 440px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 28px 24px; color: #1e293b;">
    <h2 style="margin: 0 0 14px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
      OTP Verification
    </h2>

    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #475569;">
      Your One-Time Password (OTP) for <strong>${salonName}</strong> is:
    </p>

    <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #0d9488; margin: 20px 0; text-align: center;">
      ${otp}
    </div>

    <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
      This OTP is valid for ${expiresInMinutes} minutes. Please do not share this code with anyone.
    </p>

    <p style="margin: 0 0 20px 0; font-size: 12px; line-height: 1.4; color: #94a3b8;">
      If you did not request this OTP, you can safely ignore this email.
    </p>

    <div style="border-top: 1px solid #f1f5f9; padding-top: 14px; font-size: 11.5px; color: #94a3b8;">
      Galla &bull; Salon Management
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const fromAddress =
      process.env.EMAIL_FROM ||
      process.env.SMTP_FROM ||
      `"Galla" <${process.env.SMTP_USER || "no-reply@galla.app"}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject: `Your OTP is ${otp} — Galla`,
      html: htmlContent,
      text: `Your OTP for ${salonName} is: ${otp}\n\nThis OTP is valid for ${expiresInMinutes} minutes. Please do not share this code with anyone.`,
    });

    console.log(`[Email] OTP email successfully sent to ${to} (Message-ID: ${info.messageId})`);
    return true;
  } catch (err) {
    console.error("[Email] Failed to send PIN reset OTP email:", err);
    return false;
  }
}

/**
 * Legacy stub for access codes dispatch
 */
export async function sendAccessCodesEmail(options: {
  to: string;
  ownerCode: string;
  staffCode: string;
  rotationDate: Date;
  graceExpiresAt: Date;
}): Promise<boolean> {
  console.log(`[Email] Legacy access codes dispatch to ${options.to}`);
  return true;
}

