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
<body style="margin: 0; padding: 12px 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="width: 90%; max-width: 420px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; color: #1e293b; box-sizing: border-box;">
    <!-- Header -->
    <table style="width: 100%; border-collapse: collapse; border-bottom: 1px solid #f1f5f9; margin-bottom: 10px;">
      <tr>
        <td style="vertical-align: middle; padding: 0 0 8px 0;">
          <span style="font-size: 17px; font-weight: 800; color: #0d9488; letter-spacing: -0.5px;">Galla</span>
          <span style="font-size: 11px; color: #94a3b8; margin-left: 6px;">Salon Management</span>
        </td>
      </tr>
    </table>

    <h2 style="margin: 0 0 8px 0; font-size: 16.5px; font-weight: 700; color: #0f172a; line-height: 1.3;">
      OTP Verification
    </h2>

    <p style="margin: 0 0 10px 0; font-size: 13.5px; line-height: 1.45; color: #475569;">
      Your One-Time Password (OTP) for <strong>${salonName}</strong> is:
    </p>

    <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 28px; font-weight: 800; letter-spacing: 5px; color: #0d9488; background-color: #f0fdfa; border: 1px dashed #99f6e4; border-radius: 6px; padding: 10px 0; margin: 10px 0; text-align: center;">
      ${otp}
    </div>

    <p style="margin: 0 0 6px 0; font-size: 12px; line-height: 1.4; color: #64748b;">
      This OTP is valid for ${expiresInMinutes} minutes. Please do not share this code with anyone.
    </p>

    <p style="margin: 0 0 10px 0; font-size: 11.5px; line-height: 1.3; color: #94a3b8;">
      If you did not request this OTP, you can safely ignore this email.
    </p>

    <div style="border-top: 1px solid #f1f5f9; padding-top: 8px; font-size: 10.5px; color: #94a3b8;">
      &copy; ${new Date().getFullYear()} Galla Platform
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



