import nodemailer from "nodemailer";

export interface SendAccessCodesOptions {
  to: string;
  ownerCode: string;
  staffCode: string;
  rotationDate: Date;
  graceExpiresAt: Date;
}

/**
 * Sends the weekly 8-digit access codes to the salon owner with instructions.
 * If SMTP credentials are configured, sends real email via Nodemailer.
 * Always prints a clear dev-mode summary to console so testing is never blocked.
 */
export async function sendAccessCodesEmail(options: SendAccessCodesOptions): Promise<boolean> {
  const { to, ownerCode, staffCode, graceExpiresAt } = options;

  const formattedOwnerCode = `${ownerCode.slice(0, 4)} ${ownerCode.slice(4)}`;
  const formattedStaffCode = `${staffCode.slice(0, 4)} ${staffCode.slice(4)}`;

  const graceTimeStr = graceExpiresAt.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Galla Access Codes</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f5; margin: 0; padding: 30px 15px; }
    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e5e0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #18181b; padding: 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0 0; font-size: 13px; color: #a1a1aa; }
    .body { padding: 28px 24px; color: #27272a; }
    .code-box { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 6px; padding: 16px; margin-bottom: 16px; }
    .code-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; margin-bottom: 6px; }
    .code-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #09090b; }
    .role-badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
    .owner-badge { background: #e0e7ff; color: #3730a3; }
    .staff-badge { background: #ccfbf1; color: #115e59; }
    .instructions { background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 16px; margin-top: 24px; }
    .instructions h3 { margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #92400e; }
    .instructions ul { margin: 0; padding-left: 18px; font-size: 13px; color: #78350f; line-height: 1.6; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #a1a1aa; border-top: 1px solid #f4f4f5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Galla — Salon Management</h1>
      <p>Your Weekly 8-Digit Shop Access Codes</p>
    </div>
    <div class="body">
      <p style="font-size: 14px; line-height: 1.5; margin-top: 0;">
        Hello, here are your updated access codes for your salon counter and administrative dashboard.
      </p>

      <!-- Owner Code -->
      <div class="code-box">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span class="code-title">Owner Access Code</span>
          <span class="role-badge owner-badge">Owner Only</span>
        </div>
        <div class="code-value">${formattedOwnerCode}</div>
        <p style="font-size: 12px; color: #71717a; margin: 6px 0 0 0;">Use for administrative dashboard, reports, and financial controls.</p>
      </div>

      <!-- Staff Code -->
      <div class="code-box">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span class="code-title">Staff Access Code</span>
          <span class="role-badge staff-badge">Counter POS</span>
        </div>
        <div class="code-value">${formattedStaffCode}</div>
        <p style="font-size: 12px; color: #71717a; margin: 6px 0 0 0;">Share with your staff for counter billing, service completion, and refunds.</p>
      </div>

      <!-- Instructions -->
      <div class="instructions">
        <h3>📌 How to Switch (Seamless Transition)</h3>
        <ul>
          <li><strong>12-Hour Grace Period:</strong> Your previous code remains active until <strong>${graceTimeStr} today</strong>.</li>
          <li><strong>Manual Switch:</strong> Whenever you are free during the day, simply log out and enter your new code.</li>
          <li><strong>Automatic Session Timeout:</strong> At <strong>${graceTimeStr}</strong>, any device still running on the old code will be logged out automatically.</li>
        </ul>
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Galla Platform &bull; Automated Security Dispatch
    </div>
  </div>
</body>
</html>
  `;

  // Always log to terminal so testing works even without SMTP configured
  console.log("\n=======================================================");
  console.log(`📧 [GALLA EMAIL DISPATCH] To: ${to}`);
  console.log(`🔑 Owner 8-Digit Code: ${ownerCode} (${formattedOwnerCode})`);
  console.log(`🔑 Staff 8-Digit Code: ${staffCode} (${formattedStaffCode})`);
  console.log(`⏰ Grace Period Ends:  ${graceTimeStr}`);
  console.log("=======================================================\n");

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.log("[Email] No SMTP credentials (SMTP_USER, SMTP_PASS) in .env.local — logged to console only.");
    return true;
  }

  try {
    const isGmail =
      process.env.SMTP_SERVICE === "gmail" ||
      smtpHost === "smtp.gmail.com" ||
      (smtpUser && smtpUser.endsWith("@gmail.com") && !smtpHost);

    const transporter = isGmail
      ? nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: smtpUser,
            pass: smtpPass.replace(/\s+/g, ""), // removes spaces from Google App Passwords
          },
        })
      : nodemailer.createTransport({
          host: smtpHost || "smtp.gmail.com",
          port: Number(process.env.SMTP_PORT) || 465,
          secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
          auth: {
            user: smtpUser,
            pass: smtpPass.replace(/\s+/g, ""),
          },
        });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"Galla Security" <${smtpUser}>`,
      to,
      subject: `🔑 Your New Weekly Galla Access Codes (${formattedOwnerCode} / ${formattedStaffCode})`,
      html: htmlContent,
    });

    console.log(`[Email] Successfully delivered access codes email to: ${to}`);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send email via SMTP:", error);
    return false;
  }
}
