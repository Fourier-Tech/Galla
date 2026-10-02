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
  const formattedOtp = `${otp.slice(0, 3)} ${otp.slice(3)}`;

  console.log("\n============================================================");
  console.log("🔐 GALLA SECURITY — ROLE PIN RESET OTP DISPATCH");
  console.log("============================================================");
  console.log(`Salon:       ${salonName}`);
  console.log(`Recipient:   ${to}`);
  console.log(`OTP Code:    ${otp} (${formattedOtp})`);
  console.log(`Expires In:  ${expiresInMinutes} minutes`);
  console.log("============================================================\n");

  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[Email] SMTP credentials missing (SMTP_USER / SMTP_PASS).");
    return false;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Reset Counter PINs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 40px 16px; background-color: #f7f7f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 440px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e5e0; border-radius: 8px; padding: 36px 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
    
    <div style="font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #0d9488; margin-bottom: 18px;">
      GALLA SECURITY
    </div>

    <h1 style="font-size: 21px; font-weight: 600; color: #18181b; margin: 0 0 10px 0; letter-spacing: -0.02em;">
      Reset Counter Role PINs
    </h1>

    <p style="font-size: 14px; line-height: 1.6; color: #52525b; margin: 0 0 24px 0;">
      A request was made to reset the counter PINs for <strong>${salonName}</strong>. Enter the verification code below on your terminal to set new PINs:
    </p>

    <div style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 6px; padding: 18px; text-align: center; margin-bottom: 24px;">
      <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #09090b; display: inline-block;">
        ${otp}
      </span>
      <div style="font-size: 12px; color: #71717a; margin-top: 6px;">
        Expires in ${expiresInMinutes} minutes
      </div>
    </div>

    <p style="font-size: 12.5px; line-height: 1.5; color: #71717a; margin: 0 0 20px 0;">
      If you did not make this request, your account remains completely secure and no changes were made.
    </p>

    <div style="border-top: 1px solid #f4f4f5; padding-top: 16px; font-size: 11.5px; color: #a1a1aa;">
      Galla Counter &bull; Salon Management System
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const fromAddress =
      process.env.EMAIL_FROM ||
      process.env.SMTP_FROM ||
      `"Galla Security" <${process.env.SMTP_USER || "no-reply@galla.app"}>`;
    await transporter.sendMail({
      from: fromAddress,
      to,
      subject: `Reset Counter PINs: ${otp} — ${salonName}`,
      html: htmlContent,
      text: `Reset Counter Role PINs for ${salonName}\n\nYour 6-digit verification code is: ${otp}\n\nThis code expires in ${expiresInMinutes} minutes. If you did not request this, no action is needed.`,
    });
    console.log(`[Email] PIN Reset OTP email sent to ${to}`);
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

