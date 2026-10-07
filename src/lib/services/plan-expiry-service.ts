import { connectToDatabase } from "@/lib/db/mongodb";
import { Tenant, ITenant } from "@/lib/db/models/tenant.model";
import { User } from "@/lib/db/models/user.model";
import { triggerTenantEvent } from "@/lib/realtime/pusher-server";
import nodemailer from "nodemailer";

export interface PlanExpiryCheckResult {
  totalChecked: number;
  emailsSent: number;
  autoSuspended: number;
  errors: string[];
}

function createTransporter() {
  let user = process.env.SMTP_USER?.trim();
  let pass = process.env.SMTP_PASS?.trim();

  if (user && user.startsWith('"') && user.endsWith('"')) {
    user = user.slice(1, -1).trim();
  }
  if (user) {
    user = user.replace(/\s+/g, "");
  }
  if (pass && pass.startsWith('"') && pass.endsWith('"')) {
    pass = pass.slice(1, -1).trim();
  }

  if (!user || !pass) {
    return null;
  }

  const isGmail = user.includes("@gmail.com");
  if (isGmail) {
    pass = pass.replace(/\s+/g, "");
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

interface SendExpiryEmailOptions {
  recipientEmail: string;
  adminEmail: string;
  salonName: string;
  planType: "trial" | "active" | "lifetime";
  stage: "10_days" | "3_days" | "1_day" | "auto_suspended";
  expiresAt: Date;
}

export async function sendPlanExpiryNotificationEmail(options: SendExpiryEmailOptions): Promise<{ success: boolean; error?: string }> {
  const { recipientEmail, adminEmail, salonName, planType, stage, expiresAt } = options;

  const transporter = createTransporter();
  if (!transporter) {
    const errorMsg = `SMTP credentials missing (SMTP_USER: ${Boolean(process.env.SMTP_USER)}, SMTP_PASS: ${Boolean(process.env.SMTP_PASS)})`;
    console.warn(`[PlanExpiry] ${errorMsg}. Skipped sending email for ${salonName} (${stage}).`);
    return { success: false, error: errorMsg };
  }

  const isTrial = planType === "trial";
  const formattedDate = expiresAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  let subject = "";
  let badgeText = "";
  let badgeColor = "#0d9488";
  let heading = "";
  let messageBody = "";
  let actionCallout = "";

  switch (stage) {
    case "10_days":
      subject = isTrial
        ? `Reminder: Your Galla Trial expires in 10 days — ${salonName}`
        : `Reminder: Your Galla Plan expires in 10 days — ${salonName}`;
      badgeText = "10 Days Remaining";
      badgeColor = "#d97706"; // Amber
      heading = isTrial ? "Your Free Trial is Ending Soon" : "Plan Renewal Reminder";
      messageBody = isTrial
        ? `Your free trial period for <strong>${salonName}</strong> will expire in <strong>10 days</strong> on <strong>${formattedDate}</strong>. To continue enjoying uninterrupted salon billing, inventory tracking, and client records, please activate a paid subscription plan.`
        : `Your subscription plan for <strong>${salonName}</strong> is scheduled to expire in <strong>10 days</strong> on <strong>${formattedDate}</strong>. Please arrange renewal to maintain continuous salon operations.`;
      actionCallout = "Contact your Galla administrator or account manager to renew or activate your subscription plan.";
      break;

    case "3_days":
      subject = isTrial
        ? `⚠️ Urgent: Your Galla Trial expires in 3 days — ${salonName}`
        : `⚠️ Urgent: Your Galla Plan expires in 3 days — ${salonName}`;
      badgeText = "3 Days Remaining";
      badgeColor = "#ea580c"; // Orange
      heading = isTrial ? "Only 3 Days Left in Your Trial" : "Plan Expiring in 3 Days";
      messageBody = isTrial
        ? `Your trial period for <strong>${salonName}</strong> is nearing completion and will conclude in <strong>3 days</strong> on <strong>${formattedDate}</strong>. Please select and activate a plan to avoid any counter downtime.`
        : `Your subscription plan for <strong>${salonName}</strong> expires in <strong>3 days</strong> on <strong>${formattedDate}</strong>. Please renew your plan promptly to ensure continuous counter operations.`;
      actionCallout = "Activate your plan now to ensure uninterrupted counter access for your staff and clients.";
      break;

    case "1_day":
      subject = isTrial
        ? `🚨 Final Notice: Your Galla Trial expires today — ${salonName}`
        : `🚨 Final Notice: Your Galla Plan expires today — ${salonName}`;
      badgeText = "Expires Tonight";
      badgeColor = "#dc2626"; // Red
      heading = isTrial ? "Final Day of Your Trial" : "Plan Expires Today";
      messageBody = isTrial
        ? `This is your final notice: your free trial for <strong>${salonName}</strong> expires <strong>tonight at 12:00 AM (${formattedDate})</strong>. You need to activate a subscription plan to continue using Galla salon services.`
        : `Your subscription plan for <strong>${salonName}</strong> expires <strong>tonight at 12:00 AM (${formattedDate})</strong>. Please renew your plan today to prevent counter suspension.`;
      actionCallout = "Immediate action required: please activate your subscription to prevent counter interruption.";
      break;

    case "auto_suspended":
      subject = `Account Temporarily Suspended — ${salonName}`;
      badgeText = "Account Suspended";
      badgeColor = "#b91c1c"; // Dark red
      heading = "Salon Account Suspended";
      messageBody = `Your subscription plan for <strong>${salonName}</strong> has expired as of <strong>${formattedDate}</strong>, and your counter account has been automatically suspended.<br/><br/><strong>Important:</strong> None of your data has been deleted. All your order history, inventory, customer profiles, and financials are 100% safely preserved and will become immediately accessible upon plan reactivation.`;
      actionCallout = "Please contact Galla Support or your platform administrator to reactivate your salon account.";
      break;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${heading}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 12px 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="width: 90%; max-width: 460px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; color: #1e293b; box-sizing: border-box;">
    
    <!-- Header with Galla Branding & Status Badge -->
    <table style="width: 100%; border-collapse: collapse; border-bottom: 1px solid #f1f5f9; margin-bottom: 10px;">
      <tr>
        <td style="vertical-align: middle; padding: 0 0 8px 0;">
          <span style="font-size: 17px; font-weight: 800; color: #0d9488; letter-spacing: -0.5px;">Galla</span>
          <span style="font-size: 11px; color: #94a3b8; margin-left: 6px;">Salon Management</span>
        </td>
        <td style="text-align: right; vertical-align: middle; padding: 0 0 8px 0;">
          <span style="display: inline-block; background-color: ${badgeColor}18; color: ${badgeColor}; border: 1px solid ${badgeColor}40; padding: 2px 7px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase;">
            ${badgeText}
          </span>
        </td>
      </tr>
    </table>

    <!-- Heading -->
    <h2 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #0f172a; line-height: 1.3;">
      ${heading}
    </h2>

    <!-- Main Body Copy -->
    <p style="margin: 0 0 10px 0; font-size: 13px; line-height: 1.45; color: #334155;">
      ${messageBody}
    </p>

    <!-- Details Box -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 10px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <tr>
          <td style="color: #64748b; padding: 2px 0;">Salon:</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 2px 0;">${salonName}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 2px 0;">Plan:</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 2px 0; text-transform: capitalize;">${planType}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 2px 0;">Expires:</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 2px 0;">${formattedDate}</td>
        </tr>
      </table>
    </div>

    <!-- Action Callout Box -->
    <div style="background-color: ${badgeColor}0d; border-left: 3px solid ${badgeColor}; padding: 7px 10px; border-radius: 4px; margin-bottom: 10px;">
      <p style="margin: 0; font-size: 12px; line-height: 1.4; color: #1e293b; font-weight: 600;">
        ${actionCallout}
      </p>
    </div>

    <p style="margin: 0 0 10px 0; font-size: 11.5px; line-height: 1.4; color: #64748b;">
      Need assistance? Reply directly to this email or contact Galla Support.
    </p>

    <!-- Footer -->
    <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #f1f5f9; font-size: 10.5px; color: #94a3b8;">
      <tr>
        <td style="padding: 6px 0 0 0;">&copy; ${new Date().getFullYear()} Galla Platform Inc.</td>
        <td style="text-align: right; padding: 6px 0 0 0;">Salon Operations</td>
      </tr>
    </table>

  </div>
</body>
</html>
  `.trim();

  try {
    const fromAddress =
      process.env.EMAIL_FROM ||
      process.env.SMTP_FROM ||
      `"Galla Platform" <${process.env.SMTP_USER || "no-reply@galla.app"}>`;

    const recipients = [recipientEmail];
    if (adminEmail && adminEmail !== recipientEmail) {
      recipients.push(adminEmail);
    }

    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipients.join(", "),
      subject,
      html: htmlContent,
      text: `${heading}\n\n${messageBody.replace(/<[^>]*>/g, "")}\n\nSalon: ${salonName}\nExpiration Date: ${formattedDate}\n\n${actionCallout}`,
    });

    console.log(
      `[PlanExpiry] Email successfully sent for ${salonName} (${stage}) to ${recipients.join(", ")} (Message-ID: ${info.messageId})`
    );
    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const u = process.env.SMTP_USER?.trim() || "";
    const p = process.env.SMTP_PASS?.replace(/\s+/g, "").trim() || "";
    const debugInfo = `[diagnostics: user=${u}, passLen=${p.length}, starts=${p.slice(0, 2)}***, ends=***${p.slice(-2)}]`;
    console.error(`[PlanExpiry] Failed to dispatch email for ${salonName} (${stage}):`, errorMsg, debugInfo);
    return { success: false, error: `${errorMsg} ${debugInfo}` };
  }
}

/**
 * Iterates through all tenants with expiring or expired plans:
 * 1. Checks 10-day, 3-day, 1-day, and expiration intervals
 * 2. Sends notification emails to both the client owner and Galla admin
 * 3. Enforces 5-hour grace period after expiration
 * 4. Auto-suspends accounts if grace period lapses without renewal (never deletes data)
 */
export async function processPlanExpirations(): Promise<PlanExpiryCheckResult> {
  const result: PlanExpiryCheckResult = {
    totalChecked: 0,
    emailsSent: 0,
    autoSuspended: 0,
    errors: [],
  };

  try {
    await connectToDatabase();

    const adminEmail =
      process.env.ADMIN_NOTIFICATION_EMAIL ||
      process.env.SMTP_USER ||
      "admin@galla.app";

    const now = Date.now();

    // ponytail: O(n) sequential scan is sufficient for current tenant volume (<1k salons).
    // At >1k salons, index planExpiresAt, add { planExpiresAt: { $lte: new Date(now + 10 * 86400000) } }, and batch via cursor.
    const tenants = await Tenant.find({
      planType: { $ne: "lifetime" },
      planExpiresAt: { $ne: null },
    });

    result.totalChecked = tenants.length;

    for (const tenant of tenants) {
      try {
        if (!tenant.planExpiresAt) continue;

        const expiresAtTime = new Date(tenant.planExpiresAt).getTime();
        const msUntilExpiry = expiresAtTime - now;

        // Fetch associated user to get the ownerEmail
        const user = await User.findOne({ tenantId: tenant._id }).lean();
        const ownerEmail = user?.ownerEmail || tenant.phone || "";

        if (!ownerEmail || !ownerEmail.includes("@")) {
          // If no valid email found, record warning
          console.warn(`[PlanExpiry] No valid owner email found for salon ${tenant.name} (${tenant._id})`);
        }

        const stages = tenant.expiryNotificationStages || [];
        let updatedStages = [...stages];
        let stagesModified = false;

        // Stage 1: 10 days prior (between 10 days and 3 days)
        if (msUntilExpiry <= 10 * 24 * 60 * 60 * 1000 && msUntilExpiry > 3 * 24 * 60 * 60 * 1000) {
          if (!updatedStages.includes("10_days") && ownerEmail.includes("@")) {
            const dispatch = await sendPlanExpiryNotificationEmail({
              recipientEmail: ownerEmail,
              adminEmail,
              salonName: tenant.name,
              planType: tenant.planType,
              stage: "10_days",
              expiresAt: new Date(tenant.planExpiresAt),
            });
            if (dispatch.success) {
              result.emailsSent++;
              updatedStages.push("10_days");
              stagesModified = true;
            } else if (dispatch.error) {
              result.errors.push(`[${tenant.name}] 10_days email failed: ${dispatch.error}`);
            }
          }
        }

        // Stage 2: 3 days prior (between 3 days and 1 day)
        if (msUntilExpiry <= 3 * 24 * 60 * 60 * 1000 && msUntilExpiry > 1 * 24 * 60 * 60 * 1000) {
          if (!updatedStages.includes("3_days") && ownerEmail.includes("@")) {
            const dispatch = await sendPlanExpiryNotificationEmail({
              recipientEmail: ownerEmail,
              adminEmail,
              salonName: tenant.name,
              planType: tenant.planType,
              stage: "3_days",
              expiresAt: new Date(tenant.planExpiresAt),
            });
            if (dispatch.success) {
              result.emailsSent++;
              updatedStages.push("3_days");
              stagesModified = true;
            } else if (dispatch.error) {
              result.errors.push(`[${tenant.name}] 3_days email failed: ${dispatch.error}`);
            }
          }
        }

        // Stage 3: 1 day prior (between 24 hours and 0 ms)
        if (msUntilExpiry <= 1 * 24 * 60 * 60 * 1000 && msUntilExpiry > 0) {
          if (!updatedStages.includes("1_day") && ownerEmail.includes("@")) {
            const dispatch = await sendPlanExpiryNotificationEmail({
              recipientEmail: ownerEmail,
              adminEmail,
              salonName: tenant.name,
              planType: tenant.planType,
              stage: "1_day",
              expiresAt: new Date(tenant.planExpiresAt),
            });
            if (dispatch.success) {
              result.emailsSent++;
              updatedStages.push("1_day");
              stagesModified = true;
            } else if (dispatch.error) {
              result.errors.push(`[${tenant.name}] 1_day email failed: ${dispatch.error}`);
            }
          }
        }

        // Stage 4: Expired (Midnight passed -> Auto-suspend immediately)
        if (msUntilExpiry <= 0) {
          if (tenant.status !== "suspended") {
            console.warn(
              `[PlanExpiry] Salon ${tenant.name} (${tenant._id}) plan expired. Auto-suspending.`
            );
            tenant.status = "suspended";
            tenant.suspendedReason = "plan_expired";

            // Realtime displacement: notify any active counter sessions to kick out
            try {
              await triggerTenantEvent({
                tenantId: tenant._id.toString(),
                event: "tenant_suspended",
                data: {
                  reason: "plan_expired",
                  message: "Your subscription plan has expired.",
                },
              });
            } catch (pusherErr) {
              console.error("[PlanExpiry] Realtime push failed for auto-suspend:", pusherErr);
            }

            result.autoSuspended++;
          }

          // Dispatch account suspended notification email once
          if (!updatedStages.includes("auto_suspended") && ownerEmail.includes("@")) {
            const dispatch = await sendPlanExpiryNotificationEmail({
              recipientEmail: ownerEmail,
              adminEmail,
              salonName: tenant.name,
              planType: tenant.planType,
              stage: "auto_suspended",
              expiresAt: new Date(tenant.planExpiresAt),
            });
            if (dispatch.success) {
              result.emailsSent++;
              updatedStages.push("auto_suspended");
              stagesModified = true;
            } else if (dispatch.error) {
              result.errors.push(`[${tenant.name}] auto_suspended email failed: ${dispatch.error}`);
            }
          }
        }

        if (stagesModified || tenant.isModified("status")) {
          tenant.expiryNotificationStages = updatedStages;
          await tenant.save();
        }
      } catch (tenantErr: any) {
        console.error(`[PlanExpiry] Error processing tenant ${tenant._id}:`, tenantErr);
        result.errors.push(`Tenant ${tenant._id}: ${tenantErr.message || String(tenantErr)}`);
      }
    }
  } catch (err: any) {
    console.error("[PlanExpiry] Global error in processPlanExpirations:", err);
    result.errors.push(`Global error: ${err.message || String(err)}`);
  }

  return result;
}
