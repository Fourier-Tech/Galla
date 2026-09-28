import { config } from "dotenv";
config({ path: ".env.local" });

import { connectToDatabase } from "../src/lib/db/mongodb";
import { Tenant } from "../src/lib/db/models/tenant.model";
import { Order } from "../src/lib/db/models/order.model";
import { AnalyticsRollup } from "../src/lib/db/models/analytics-rollup.model";
import { syncRollupForPeriod } from "../src/lib/analytics/rollup-service";

async function main() {
  console.log("Connecting to database...");
  await connectToDatabase();

  const tenants = await Tenant.find().lean();
  console.log(`Found ${tenants.length} tenant(s).`);

  for (const tenant of tenants) {
    const tenantId: any = tenant._id;
    console.log(`\nSyncing analytics rollups for tenant: "${tenant.name}" (${tenantId})...`);

    // 1. Sync Current periods: Daily, Weekly, Monthly, Yearly
    const now = new Date();
    console.log("Syncing current period rollups (daily, weekly, monthly, yearly)...");
    await syncRollupForPeriod(tenantId, "daily", now);
    await syncRollupForPeriod(tenantId, "weekly", now);
    await syncRollupForPeriod(tenantId, "monthly", now);
    await syncRollupForPeriod(tenantId, "yearly", now);

    // 2. Find all distinct order dates to backfill daily rollups for past orders
    const orders = await Order.find({ tenantId }).select("createdAt").lean();
    console.log(`Found ${orders.length} order(s). Backfilling historical dates...`);

    const processedDailyKeys = new Set<string>();
    for (const ord of orders) {
      if (!ord.createdAt) continue;
      const orderDate = new Date(ord.createdAt);
      const dateKey = orderDate.toISOString().split("T")[0];
      if (!processedDailyKeys.has(dateKey)) {
        processedDailyKeys.add(dateKey);
        await syncRollupForPeriod(tenantId, "daily", orderDate);
        await syncRollupForPeriod(tenantId, "weekly", orderDate);
        await syncRollupForPeriod(tenantId, "monthly", orderDate);
      }
    }
  }

  // Count total created rollups
  const totalRollups = await AnalyticsRollup.countDocuments();
  console.log(`\n✅ Finished! Total documents in 'analyticsrollups' collection: ${totalRollups}`);

  const sampleDocs = await AnalyticsRollup.find().limit(3).lean();
  console.log("\nSample rollups created in MongoDB:");
  sampleDocs.forEach((doc) => {
    console.log(`- [${doc.periodType}] ${doc.periodKey} | Revenue: ₹${doc.metrics.revenue.total} | ExpiresAt: ${doc.expiresAt ? doc.expiresAt.toISOString() : "Never (Permanent)"}`);
  });

  process.exit(0);
}

main().catch((err) => {
  console.error("Error syncing rollups:", err);
  process.exit(1);
});
