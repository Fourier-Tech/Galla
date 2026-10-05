import nodemailer from "nodemailer";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Tenant } from "@/lib/db/models/tenant.model";
import { User } from "@/lib/db/models/user.model";
import { Product } from "@/lib/db/models/product.model";

export interface ExpiryDigestResult {
  success: boolean;
  shopId: string;
  shopName: string;
  recipientEmail?: string;
  itemsFound: number;
  emailSent: boolean;
  message?: string;
  error?: string;
}

export interface ExpiryCronSummary {
  success: boolean;
  timestamp: string;
  shopsProcessed: number;
  emailsSent: number;
  totalItemsNotified: number;
  failures: Array<{ shopId: string; shopName?: string; error: string }>;
}

function createTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  const isGmail = user.includes("@gmail.com");
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || (isGmail ? "465" : "587"), 10);
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Finds a single shop's items expiring within the reminder window,
 * formats and sends ONE consolidated digest email, and marks the items as notified.
 */
export async function sendExpiryDigest(
  shopId: string | Types.ObjectId,
  options?: { force?: boolean; windowDays?: number }
): Promise<ExpiryDigestResult> {
  await connectToDatabase();

  const tenantObjectId =
    typeof shopId === "string" ? new Types.ObjectId(shopId) : shopId;

  const tenant = await Tenant.findById(tenantObjectId).lean();
  if (!tenant) {
    return {
      success: false,
      shopId: tenantObjectId.toString(),
      shopName: "Unknown",
      itemsFound: 0,
      emailSent: false,
      error: "Shop not found in database",
    };
  }

  // Skip inactive or suspended shops
  if (tenant.status === "suspended") {
    return {
      success: true,
      shopId: tenant._id.toString(),
      shopName: tenant.name,
      itemsFound: 0,
      emailSent: false,
      message: `Shop is suspended. Skipped expiry reminder.`,
    };
  }

  // Skip if plan is past grace period (if subscription is tracked)
  if (tenant.planExpiresAt && tenant.planType !== "lifetime") {
    const GRACE_PERIOD_MS = 5 * 60 * 60 * 1000;
    const msPastExpiry = Date.now() - new Date(tenant.planExpiresAt).getTime();
    if (msPastExpiry > GRACE_PERIOD_MS) {
      return {
        success: true,
        shopId: tenant._id.toString(),
        shopName: tenant.name,
        itemsFound: 0,
        emailSent: false,
        message: "Shop subscription has expired past grace period. Skipped.",
      };
    }
  }

  // Fetch registered shop owner email
  const user = await User.findOne({ tenantId: tenant._id }).lean();
  const recipientEmail = user?.ownerEmail;
  if (!recipientEmail) {
    return {
      success: false,
      shopId: tenant._id.toString(),
      shopName: tenant.name,
      itemsFound: 0,
      emailSent: false,
      error: `No registered owner email found for shop ${tenant.name}`,
    };
  }

  const windowDays = options?.windowDays ?? 30;
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  // Query expiring items
  const itemQuery: any = {
    tenantId: tenant._id,
    isActive: true,
    expiryDate: { $ne: null, $lte: windowEnd },
  };

  // Duplicate prevention: only find items not yet notified (unless force is requested)
  if (!options?.force) {
    itemQuery.$or = [
      { expiryNotifiedAt: null },
      { expiryNotifiedAt: { $exists: false } },
    ];
  }

  const expiringItems = await Product.find(itemQuery)
    .sort({ expiryDate: 1 })
    .lean();

  if (expiringItems.length === 0) {
    return {
      success: true,
      shopId: tenant._id.toString(),
      shopName: tenant.name,
      recipientEmail,
      itemsFound: 0,
      emailSent: false,
      message: "No expiring items pending notification",
    };
  }

  const transporter = createTransporter();
  if (!transporter) {
    console.warn(
      `[ExpiryDigest] SMTP not configured. Unable to send digest email for ${tenant.name}.`
    );
    return {
      success: false,
      shopId: tenant._id.toString(),
      shopName: tenant.name,
      recipientEmail,
      itemsFound: expiringItems.length,
      emailSent: false,
      error: "SMTP credentials missing on server",
    };
  }

  // Build compact HTML email (90% mobile width, low margin/padding)
  const itemsRows = expiringItems
    .map((item) => {
      const expiry = new Date(item.expiryDate!);
      const msLeft = expiry.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

      let badgeBg = "#fef3c7";
      let badgeColor = "#92400e";
      let badgeLabel = `${daysLeft}d left`;

      if (daysLeft <= 0) {
        badgeBg = "#fee2e2";
        badgeColor = "#b91c1c";
        badgeLabel = "Expired";
      } else if (daysLeft <= 7) {
        badgeBg = "#ffedd5";
        badgeColor = "#c2410c";
        badgeLabel = `⚠️ ${daysLeft}d left`;
      }

      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 6px 4px; vertical-align: middle;">
            <div style="font-weight: 600; color: #0f172a; font-size: 13px;">${item.name}</div>
            <div style="font-size: 11px; color: #64748b;">${item.category || "General"}</div>
          </td>
          <td style="padding: 6px 4px; text-align: center; vertical-align: middle; font-size: 12px; color: #334155;">
            <div>Sell: <strong>${item.sellStock}</strong></div>
            <div style="font-size: 10.5px; color: #64748b;">Use: ${item.useStock}</div>
          </td>
          <td style="padding: 6px 4px; text-align: right; vertical-align: middle;">
            <div style="font-size: 12px; font-weight: 500; color: #0f172a;">${formatDate(expiry)}</div>
            <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-top: 2px;">
              ${badgeLabel}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Stock Expiry Digest — ${tenant.name}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 12px 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="width: 90%; max-width: 480px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; color: #1e293b; box-sizing: border-box;">
    
    <!-- Header -->
    <table style="width: 100%; border-collapse: collapse; border-bottom: 1px solid #f1f5f9; margin-bottom: 10px;">
      <tr>
        <td style="vertical-align: middle; padding: 0 0 8px 0;">
          <span style="font-size: 17px; font-weight: 800; color: #0d9488; letter-spacing: -0.5px;">Galla</span>
          <span style="font-size: 11px; color: #94a3b8; margin-left: 6px;">Salon Management</span>
        </td>
        <td style="text-align: right; vertical-align: middle; padding: 0 0 8px 0;">
          <span style="display: inline-block; background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 2px 7px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase;">
            ${expiringItems.length} Item${expiringItems.length > 1 ? "s" : ""} Expiring
          </span>
        </td>
      </tr>
    </table>

    <!-- Heading -->
    <h2 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #0f172a; line-height: 1.3;">
      Stock Expiry Digest
    </h2>

    <!-- Body text -->
    <p style="margin: 0 0 10px 0; font-size: 13px; line-height: 1.45; color: #334155;">
      The following products at <strong>${tenant.name}</strong> are reaching expiration within the next <strong>${windowDays} days</strong>. Please review your shelf inventory to prioritize usage or arrange supplier returns.
    </p>

    <!-- Expiring Items Table -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase;">
            <th style="padding: 4px; font-weight: 600;">Product</th>
            <th style="padding: 4px; text-align: center; font-weight: 600;">Stock</th>
            <th style="padding: 4px; text-align: right; font-weight: 600;">Expiry</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
    </div>

    <!-- Tip callout -->
    <div style="background-color: #f0fdf4; border-left: 3px solid #16a34a; padding: 7px 10px; border-radius: 4px; margin-bottom: 10px;">
      <p style="margin: 0; font-size: 12px; line-height: 1.4; color: #166534; font-weight: 500;">
        💡 <strong>Tip:</strong> In your Galla Inventory tab, you can transfer retail stock to <em>Use Stock</em> for internal treatments before items expire.
      </p>
    </div>

    <!-- Footer -->
    <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #f1f5f9; font-size: 10.5px; color: #94a3b8;">
      <tr>
        <td style="padding: 6px 0 0 0;">&copy; ${new Date().getFullYear()} Galla Platform Inc.</td>
        <td style="text-align: right; padding: 6px 0 0 0;">Salon Inventory</td>
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

    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject: `Stock Expiry Alert: ${expiringItems.length} item${expiringItems.length > 1 ? "s" : ""} nearing expiry — ${tenant.name}`,
      html: htmlContent,
      text: `Stock Expiry Digest for ${tenant.name}\n\n${expiringItems.length} item(s) are nearing expiration:\n` +
        expiringItems
          .map(
            (item) =>
              `- ${item.name} (${item.category}): Sell ${item.sellStock}, Use ${item.useStock} | Expires: ${formatDate(new Date(item.expiryDate!))}`
          )
          .join("\n"),
    });

    console.log(
      `[ExpiryDigest] Digest email sent for ${tenant.name} to ${recipientEmail} (${expiringItems.length} items) [Message-ID: ${info.messageId}]`
    );

    // Duplicate prevention: Mark notified items in DB
    const itemIds = expiringItems.map((item) => item._id);
    await Product.updateMany(
      { _id: { $in: itemIds } },
      { $set: { expiryNotifiedAt: new Date() } }
    );

    return {
      success: true,
      shopId: tenant._id.toString(),
      shopName: tenant.name,
      recipientEmail,
      itemsFound: expiringItems.length,
      emailSent: true,
    };
  } catch (err: any) {
    console.error(
      `[ExpiryDigest] Failed to dispatch digest email for ${tenant.name}:`,
      err
    );
    return {
      success: false,
      shopId: tenant._id.toString(),
      shopName: tenant.name,
      recipientEmail,
      itemsFound: expiringItems.length,
      emailSent: false,
      error: err.message || "Failed to dispatch email",
    };
  }
}

/**
 * Runs across all active shops sequentially.
 * A single shop failure will NOT halt processing for others.
 */
export async function processAllShopsExpiryReminders(): Promise<ExpiryCronSummary> {
  await connectToDatabase();

  const activeTenants = await Tenant.find({
    status: { $in: ["active", "trial"] },
  })
    .sort({ name: 1 })
    .lean();

  const summary: ExpiryCronSummary = {
    success: true,
    timestamp: new Date().toISOString(),
    shopsProcessed: 0,
    emailsSent: 0,
    totalItemsNotified: 0,
    failures: [],
  };

  for (const tenant of activeTenants) {
    summary.shopsProcessed++;
    try {
      const res = await sendExpiryDigest(tenant._id);
      if (res.emailSent) {
        summary.emailsSent++;
        summary.totalItemsNotified += res.itemsFound;
      }
      if (!res.success && res.error) {
        summary.failures.push({
          shopId: tenant._id.toString(),
          shopName: tenant.name,
          error: res.error,
        });
      }
    } catch (err: any) {
      console.error(
        `[ExpiryCron] Unhandled error processing shop ${tenant.name} (${tenant._id}):`,
        err
      );
      summary.failures.push({
        shopId: tenant._id.toString(),
        shopName: tenant.name,
        error: err.message || "Unknown error",
      });
    }
  }

  return summary;
}
