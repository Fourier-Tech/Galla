import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const envLocalPath = path.resolve(process.cwd(), ".env.local");
let uri = process.env.MONGODB_URI;

if (!uri && fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf8");
  const match = content.match(/MONGODB_URI=["']?([^"'\r\n]+)/);
  if (match) uri = match[1];
}

if (!uri) {
  console.error("❌ MONGODB_URI not found in environment or .env.local");
  process.exit(1);
}

// Ensure uri points to galla database
if (!uri.includes(".mongodb.net/galla")) {
  uri = uri.replace(".mongodb.net/?", ".mongodb.net/galla?");
}

console.log("Connecting to MongoDB Atlas at:", uri.replace(/:[^:@]+@/, ":****@"));

async function seed() {
  try {
    await mongoose.connect(uri);
    console.log("✅ Connected to MongoDB Atlas!");

    const db = mongoose.connection.db;
    console.log("Active Database:", db.databaseName);

    // 1. Clean old test database if present
    try {
      const testDb = mongoose.connection.client.db("test");
      await testDb.dropDatabase();
      console.log("🧹 Cleaned old 'test' database.");
    } catch {
      // Ignore if not permitted
    }

    // 2. Drop all collections in current database
    const existingCollections = await db.listCollections().toArray();
    for (const coll of existingCollections) {
      await db.collection(coll.name).drop();
      console.log(`🧹 Dropped collection: ${coll.name}`);
    }

    // 3. Create Tenant
    const tenantId = new mongoose.Types.ObjectId();
    const tenant = {
      _id: tenantId,
      name: "ShreeHari",
      slug: "shreehari",
      status: "active",
      settings: {
        allowBackorders: true,
        lowStockNotification: true,
        currency: "INR",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("tenants").insertOne(tenant);
    console.log("✅ Created Tenant: ShreeHari (slug: shreehari)");

    // 4. Create Owner User
    const passwordHash = await bcrypt.hash("123456", 10);
    const user = {
      _id: new mongoose.Types.ObjectId(),
      tenantId: tenantId,
      name: "Jignesh Patel",
      email: "shreehari@gmail.com",
      passwordHash: passwordHash,
      role: "owner",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("users").insertOne(user);
    console.log("✅ Created Owner User: shreehari@gmail.com (Password: 123456)");

    // 5. Create Initial Products
    const products = [
      {
        tenantId,
        name: "Shampoo 200ml",
        sku: "SHP-200",
        sellStock: 12,
        useStock: 3,
        expectedSellPrice: 180,
        purchaseCost: 110,
        lowStockThreshold: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        tenantId,
        name: "Hair colour kit",
        sku: "HCK-01",
        sellStock: 5,
        useStock: 0,
        expectedSellPrice: 350,
        purchaseCost: 210,
        lowStockThreshold: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        tenantId,
        name: "Face cream",
        sku: "FC-01",
        sellStock: 0,
        useStock: 2,
        expectedSellPrice: 220,
        purchaseCost: 130,
        lowStockThreshold: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        tenantId,
        name: "Nail polish",
        sku: "NP-01",
        sellStock: 20,
        useStock: 0,
        expectedSellPrice: 90,
        purchaseCost: 50,
        lowStockThreshold: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    await db.collection("products").insertMany(products);
    console.log("✅ Created 4 Initial Products with split stock");

    // 6. Create Initial Customers
    const customers = [
      {
        tenantId,
        name: "Priya Shah",
        phone: "98250 12345",
        totalVisits: 14,
        totalSpend: 16800,
        lastVisitAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        tenantId,
        name: "Rahul Mehta",
        phone: "99040 67890",
        totalVisits: 3,
        totalSpend: 1620,
        lastVisitAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        tenantId,
        name: "Neha Patel",
        phone: "97230 45678",
        totalVisits: 22,
        totalSpend: 55000,
        lastVisitAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        tenantId,
        name: "Amit Joshi",
        phone: "90210 98765",
        totalVisits: 1,
        totalSpend: 350,
        lastVisitAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    await db.collection("customers").insertMany(customers);
    console.log("✅ Created 4 Initial Customers");

    // 7. Create Initial Expenses
    const expenses = [
      {
        tenantId,
        description: "Shampoo stock — Sharma Dealers",
        amount: 4200,
        category: "inventory",
        paymentMode: "cash",
        incurredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        tenantId,
        description: "Tea & snacks",
        amount: 150,
        category: "day_to_day",
        paymentMode: "cash",
        incurredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        tenantId,
        description: "Staff salary — advance",
        amount: 2000,
        category: "salary",
        paymentMode: "cash",
        incurredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    await db.collection("expenses").insertMany(expenses);
    console.log("✅ Created 3 Initial Expenses");

    console.log("\n=======================================================");
    console.log("🎉 Database cluster cleaned and freshly seeded!");
    console.log("👉 Login Credentials:");
    console.log("   Account ID / Email: shreehari (or shreehari@gmail.com)");
    console.log("   Password:           123456");
    console.log("=======================================================\n");

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Seed error:", error);
    process.exit(1);
  }
}

seed();
