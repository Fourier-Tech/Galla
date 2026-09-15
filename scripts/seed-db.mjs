import mongoose from "mongoose";
import crypto from "crypto";
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

if (!uri.includes(".mongodb.net/galla")) {
  uri = uri.replace(".mongodb.net/?", ".mongodb.net/galla?");
}

console.log("Connecting to MongoDB Atlas at:", uri.replace(/:[^:@]+@/, ":****@"));

function todayAt(hours, minutes) {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function daysAgoAt(days, hours, minutes) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

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

    // 3. Create Tenant (Deterministic ID so browser sessions survive re-seeding)
    const tenantId = new mongoose.Types.ObjectId("65f000000000000000000001");
    const tenant = {
      _id: tenantId,
      name: "ShreeHari",
      slug: "shreehari",
      status: "active",
      phone: "+91 98250 12345",
      address: "Shop 4, Ground Floor, Shivam Complex, Surat, Gujarat",
      profileImageUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=400&q=80",
      profileImagePublicId: null,
      settings: {
        allowBackorders: true,
        lowStockNotification: true,
        currency: "INR",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("tenants").insertOne(tenant);
    console.log("✅ Created Tenant: ShreeHari (slug: shreehari, ID: 65f000000000000000000001)");

    // 4. Create Single Salon User Record with 8-Digit Access Codes
    let authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!authSecret && fs.existsSync(envLocalPath)) {
      const content = fs.readFileSync(envLocalPath, "utf8");
      const match = content.match(/AUTH_SECRET=["']?([^"'\r\n]+)/);
      if (match) authSecret = match[1];
    }
    if (!authSecret) authSecret = "galla-secret-access-code-salt-2026";
    const hashAccessCode = (code) =>
      crypto.createHmac("sha256", authSecret).update(code.trim()).digest("hex");

    const ownerCode = "88888888";
    const staffCode = "12345678";

    const now = new Date();
    const target = new Date(now);
    if (now.getHours() < 13) {
      target.setDate(target.getDate() + 6);
    } else {
      target.setDate(target.getDate() + 7);
    }
    target.setHours(7, 0, 0, 0);

    const user = {
      _id: new mongoose.Types.ObjectId("65f000000000000000000002"),
      tenantId: tenantId,
      ownerEmail: "shreehari@gmail.com",
      ownerCodeHash: hashAccessCode(ownerCode),
      staffCodeHash: hashAccessCode(staffCode),
      previousOwnerCodeHash: null,
      previousStaffCodeHash: null,
      codeExpiresAt: target,
      graceExpiresAt: null,
      ownerActiveSessionId: null,
      staffActiveSessionId: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection("users").insertOne(user);
    console.log("✅ Created Single Salon User Record for ShreeHari:");
    console.log(`   👑 Owner 8-Digit Code: ${ownerCode}`);
    console.log(`   🏷️  Staff 8-Digit Code: ${staffCode}`);
    console.log(`   📅 Next 7 AM Rotation: ${target.toLocaleString("en-IN")}`);

    // 5. Create Initial Products
    const products = [
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        name: "Shampoo 200ml",
        category: "Shampoos & Conditioners",
        unit: "pieces",
        sellStock: 12,
        useStock: 3,
        expectedSellPrice: 180,
        purchaseCost: 110,
        lowStockThreshold: 2,
        isActive: true,
        createdAt: daysAgoAt(7, 10, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        name: "Hair colour kit",
        category: "Hair Color & Developers",
        unit: "pieces",
        sellStock: 5,
        useStock: 0,
        expectedSellPrice: 350,
        purchaseCost: 210,
        lowStockThreshold: 2,
        isActive: true,
        createdAt: daysAgoAt(6, 11, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        name: "Face cream",
        category: "Skin Creams & Lotions",
        unit: "pieces",
        sellStock: 0,
        useStock: 2,
        expectedSellPrice: 220,
        purchaseCost: 130,
        lowStockThreshold: 2,
        isActive: true,
        createdAt: daysAgoAt(5, 12, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        name: "Nail polish",
        category: "Nail Polish & Care",
        unit: "pieces",
        sellStock: 20,
        useStock: 0,
        expectedSellPrice: 90,
        purchaseCost: 50,
        lowStockThreshold: 2,
        isActive: true,
        createdAt: daysAgoAt(4, 14, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        name: "Hair Serum 100ml",
        category: "Hair Serums & Oils",
        unit: "pieces",
        sellStock: 2,
        useStock: 1,
        expectedSellPrice: 420,
        purchaseCost: 250,
        lowStockThreshold: 2,
        isActive: true,
        createdAt: daysAgoAt(3, 15, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        name: "Facial Kit Gold",
        category: "Facial Kits & Scrubs",
        unit: "pieces",
        sellStock: 7,
        useStock: 2,
        expectedSellPrice: 850,
        purchaseCost: 500,
        lowStockThreshold: 2,
        isActive: true,
        createdAt: daysAgoAt(2, 16, 0),
        updatedAt: new Date(),
      },
    ];
    await db.collection("products").insertMany(products);
    console.log("✅ Created 6 Products with split stock");

    // 6. Create Customers
    const customers = [
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        name: "Priya Shah",
        phone: "98250 12345",
        stats: {
          totalVisits: 15,
          totalSpend: 18000,
          outstandingBalance: 0,
          lastVisitAt: todayAt(10, 30),
        },
        isActive: true,
        createdAt: daysAgoAt(30, 10, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        name: "Rahul Mehta",
        phone: "99040 67890",
        stats: {
          totalVisits: 4,
          totalSpend: 2160,
          outstandingBalance: 340,
          lastVisitAt: todayAt(11, 15),
        },
        isActive: true,
        createdAt: daysAgoAt(20, 11, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        name: "Neha Patel",
        phone: "97230 45678",
        stats: {
          totalVisits: 23,
          totalSpend: 57500,
          outstandingBalance: 0,
          lastVisitAt: todayAt(12, 0),
        },
        isActive: true,
        createdAt: daysAgoAt(60, 12, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        name: "Amit Joshi",
        phone: "90210 98765",
        stats: {
          totalVisits: 1,
          totalSpend: 350,
          outstandingBalance: 350,
          lastVisitAt: todayAt(13, 20),
        },
        isActive: true,
        createdAt: daysAgoAt(5, 13, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        name: "Ananya Desai",
        phone: "98790 11223",
        stats: {
          totalVisits: 7,
          totalSpend: 5050,
          outstandingBalance: 0,
          lastVisitAt: todayAt(14, 15),
        },
        isActive: true,
        createdAt: daysAgoAt(15, 14, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        name: "Kavita Mehta",
        phone: "98240 55667",
        stats: {
          totalVisits: 2,
          totalSpend: 1500,
          outstandingBalance: 3000,
          lastVisitAt: todayAt(15, 10),
        },
        isActive: true,
        createdAt: daysAgoAt(10, 15, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        name: "Rohit Verma",
        phone: "97120 33445",
        stats: {
          totalVisits: 3,
          totalSpend: 1350,
          outstandingBalance: 0,
          lastVisitAt: todayAt(15, 45),
        },
        isActive: true,
        createdAt: daysAgoAt(12, 16, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        name: "Sneha Gupta",
        phone: "99780 22114",
        stats: {
          totalVisits: 5,
          totalSpend: 4100,
          outstandingBalance: 0,
          lastVisitAt: todayAt(16, 10),
        },
        isActive: true,
        createdAt: daysAgoAt(18, 17, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        name: "Pooja Sharma",
        phone: "99123 44556",
        stats: {
          totalVisits: 9,
          totalSpend: 8900,
          outstandingBalance: 0,
          lastVisitAt: daysAgoAt(1, 16, 30),
        },
        isActive: true,
        createdAt: daysAgoAt(40, 10, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        name: "Meera Joshi",
        phone: "98980 77889",
        stats: {
          totalVisits: 4,
          totalSpend: 3200,
          outstandingBalance: 0,
          lastVisitAt: daysAgoAt(1, 18, 0),
        },
        isActive: true,
        createdAt: daysAgoAt(25, 11, 0),
        updatedAt: new Date(),
      },
    ];
    await db.collection("customers").insertMany(customers);
    console.log("✅ Created 10 Customers with today and historical visit histories");

    // 7. Create Expenses (Today + Previous)
    const expenses = [
      // Today's Expenses
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        title: "Shampoo stock — Sharma Dealers",
        category: "inventory_purchase",
        amount: 4200,
        paymentMode: "upi",
        expenseDate: todayAt(9, 0),
        recordedBy: "owner",
        createdAt: todayAt(9, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        title: "Morning tea & snacks for clients",
        category: "refreshments",
        amount: 180,
        paymentMode: "cash",
        expenseDate: todayAt(10, 15),
        recordedBy: "staff",
        createdAt: todayAt(10, 15),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        title: "Mineral water bottles & cleaning spray",
        category: "utilities",
        amount: 320,
        paymentMode: "cash",
        expenseDate: todayAt(11, 30),
        recordedBy: "staff",
        createdAt: todayAt(11, 30),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        title: "Staff lunch advance — Rina",
        category: "salary",
        amount: 500,
        paymentMode: "cash",
        expenseDate: todayAt(13, 15),
        recordedBy: "owner",
        createdAt: todayAt(13, 15),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        title: "Laundry service — fresh salon towels",
        category: "maintenance",
        amount: 250,
        paymentMode: "cash",
        expenseDate: todayAt(14, 45),
        recordedBy: "staff",
        createdAt: todayAt(14, 45),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        title: "Staff salary advance — Jignesh",
        category: "salary",
        amount: 2000,
        paymentMode: "cash",
        expenseDate: todayAt(15, 30),
        recordedBy: "owner",
        createdAt: todayAt(15, 30),
        updatedAt: new Date(),
      },

      // Previous Expenses
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        title: "Electricity bill — parlour meter",
        category: "utilities",
        amount: 1850,
        paymentMode: "upi",
        expenseDate: daysAgoAt(1, 14, 0),
        recordedBy: "owner",
        createdAt: daysAgoAt(1, 14, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        title: "Hair dryer & steamer machine repair",
        category: "maintenance",
        amount: 750,
        paymentMode: "cash",
        expenseDate: daysAgoAt(2, 11, 0),
        recordedBy: "owner",
        createdAt: daysAgoAt(2, 11, 0),
        updatedAt: new Date(),
      },
    ];
    await db.collection("expenses").insertMany(expenses);
    console.log("✅ Created 8 Expenses (6 Today, 2 Historical)");

    // 8. Create Orders (Today + Previous)
    const orders = [
      // Today's Orders
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        orderNumber: "#1042",
        orderType: "service_booking",
        customerId: customers[0]._id,
        customerSnapshot: {
          name: "Priya Shah",
          phone: "98250 12345",
        },
        lineItems: [
          {
            itemType: "service",
            itemId: new mongoose.Types.ObjectId(),
            name: "Hair Spa & Styling",
            unitPrice: 1200,
            quantity: 1,
            discount: 0,
            finalPrice: 1200,
            fulfilled: true,
          },
        ],
        subtotal: 1200,
        discountType: "flat",
        discountValue: 0,
        discountAmount: 0,
        totalAmount: 1200,
        amountPaid: 1200,
        amountPending: 0,
        paymentMode: "upi",
        payments: [
          {
            amount: 1200,
            mode: "upi",
            recordedAt: todayAt(10, 30),
            recordedBy: "owner",
          },
        ],
        status: "completed",
        recordedBy: "owner",
        createdAt: todayAt(10, 30),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        orderNumber: "#1043",
        orderType: "product_sale",
        customerId: customers[1]._id,
        customerSnapshot: {
          name: "Rahul Mehta",
          phone: "99040 67890",
        },
        lineItems: [
          {
            itemType: "product",
            itemId: products[0]._id,
            name: "Shampoo 200ml + Serum",
            unitPrice: 540,
            quantity: 1,
            discount: 0,
            finalPrice: 540,
            fulfilled: true,
          },
        ],
        subtotal: 540,
        discountType: "flat",
        discountValue: 0,
        discountAmount: 0,
        totalAmount: 540,
        amountPaid: 200,
        amountPending: 340,
        paymentMode: "cash",
        payments: [
          {
            amount: 200,
            mode: "cash",
            recordedAt: todayAt(11, 15),
            recordedBy: "staff",
          },
        ],
        status: "advance_paid",
        recordedBy: "staff",
        createdAt: todayAt(11, 15),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        orderNumber: "#1044",
        orderType: "package_sale",
        customerId: customers[2]._id,
        customerSnapshot: {
          name: "Neha Patel",
          phone: "97230 45678",
        },
        lineItems: [
          {
            itemType: "package",
            itemId: new mongoose.Types.ObjectId(),
            name: "Bridal Glow Package",
            unitPrice: 2500,
            quantity: 1,
            discount: 0,
            finalPrice: 2500,
            fulfilled: true,
          },
        ],
        subtotal: 2500,
        discountType: "flat",
        discountValue: 0,
        discountAmount: 0,
        totalAmount: 2500,
        amountPaid: 2500,
        amountPending: 0,
        paymentMode: "upi",
        payments: [
          {
            amount: 2500,
            mode: "upi",
            recordedAt: todayAt(12, 0),
            recordedBy: "owner",
          },
        ],
        status: "paid_full",
        recordedBy: "owner",
        createdAt: todayAt(12, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        orderNumber: "#1045",
        orderType: "product_sale",
        customerId: customers[3]._id,
        customerSnapshot: {
          name: "Amit Joshi",
          phone: "90210 98765",
        },
        lineItems: [
          {
            itemType: "product",
            itemId: products[1]._id,
            name: "Hair colour kit",
            unitPrice: 350,
            quantity: 1,
            discount: 0,
            finalPrice: 350,
            fulfilled: false,
          },
        ],
        subtotal: 350,
        discountType: "flat",
        discountValue: 0,
        discountAmount: 0,
        totalAmount: 350,
        amountPaid: 0,
        amountPending: 350,
        paymentMode: "cash",
        status: "cancelled_refunded",
        recordedBy: "staff",
        createdAt: todayAt(13, 20),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        orderNumber: "#1046",
        orderType: "service_booking",
        customerId: customers[4]._id,
        customerSnapshot: {
          name: "Ananya Desai",
          phone: "98790 11223",
        },
        lineItems: [
          {
            itemType: "service",
            itemId: new mongoose.Types.ObjectId(),
            name: "Fruit Facial & Cleanse",
            unitPrice: 850,
            quantity: 1,
            discount: 0,
            finalPrice: 850,
            fulfilled: true,
          },
        ],
        subtotal: 850,
        discountType: "flat",
        discountValue: 0,
        discountAmount: 0,
        totalAmount: 850,
        amountPaid: 850,
        amountPending: 0,
        paymentMode: "upi",
        payments: [
          {
            amount: 850,
            mode: "upi",
            recordedAt: todayAt(14, 15),
            recordedBy: "staff",
          },
        ],
        status: "completed",
        recordedBy: "staff",
        createdAt: todayAt(14, 15),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        orderNumber: "#1047",
        orderType: "package_sale",
        customerId: customers[5]._id,
        customerSnapshot: {
          name: "Kavita Mehta",
          phone: "98240 55667",
        },
        lineItems: [
          {
            itemType: "package",
            itemId: new mongoose.Types.ObjectId(),
            name: "Pre-Bridal Package Advance",
            unitPrice: 4500,
            quantity: 1,
            discount: 0,
            finalPrice: 4500,
            fulfilled: false,
          },
        ],
        subtotal: 4500,
        discountType: "flat",
        discountValue: 0,
        discountAmount: 0,
        totalAmount: 4500,
        amountPaid: 1500,
        amountPending: 3000,
        paymentMode: "upi",
        payments: [
          {
            amount: 1500,
            mode: "upi",
            recordedAt: todayAt(15, 10),
            recordedBy: "owner",
          },
        ],
        status: "advance_paid",
        recordedBy: "owner",
        createdAt: todayAt(15, 10),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        orderNumber: "#1048",
        orderType: "service_booking",
        customerId: customers[6]._id,
        customerSnapshot: {
          name: "Rohit Verma",
          phone: "97120 33445",
        },
        lineItems: [
          {
            itemType: "service",
            itemId: new mongoose.Types.ObjectId(),
            name: "Beard Trim & Hair Cut",
            unitPrice: 450,
            quantity: 1,
            discount: 0,
            finalPrice: 450,
            fulfilled: true,
          },
        ],
        subtotal: 450,
        discountType: "flat",
        discountValue: 0,
        discountAmount: 0,
        totalAmount: 450,
        amountPaid: 450,
        amountPending: 0,
        paymentMode: "cash",
        payments: [
          {
            amount: 450,
            mode: "cash",
            recordedAt: todayAt(15, 45),
            recordedBy: "staff",
          },
        ],
        status: "completed",
        recordedBy: "staff",
        createdAt: todayAt(15, 45),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        orderNumber: "#1049",
        orderType: "product_sale",
        customerId: customers[7]._id,
        customerSnapshot: {
          name: "Sneha Gupta",
          phone: "99780 22114",
        },
        lineItems: [
          {
            itemType: "product",
            itemId: products[5]._id,
            name: "Facial Kit Gold + Nail Polish",
            unitPrice: 940,
            quantity: 1,
            discount: 0,
            finalPrice: 940,
            fulfilled: true,
          },
        ],
        subtotal: 940,
        discountType: "flat",
        discountValue: 0,
        discountAmount: 0,
        totalAmount: 940,
        amountPaid: 940,
        amountPending: 0,
        paymentMode: "upi",
        payments: [
          {
            amount: 940,
            mode: "upi",
            recordedAt: todayAt(16, 10),
            recordedBy: "staff",
          },
        ],
        status: "paid_full",
        recordedBy: "staff",
        createdAt: todayAt(16, 10),
        updatedAt: new Date(),
      },

      // Previous Orders (Yesterday)
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        orderNumber: "#1039",
        orderType: "service_booking",
        customerId: customers[8]._id,
        customerSnapshot: {
          name: "Pooja Sharma",
          phone: "99123 44556",
        },
        lineItems: [
          {
            itemType: "service",
            itemId: new mongoose.Types.ObjectId(),
            name: "Deep Conditioning & Blow Dry",
            unitPrice: 650,
            quantity: 1,
            discount: 0,
            finalPrice: 650,
            fulfilled: true,
          },
        ],
        subtotal: 650,
        discountType: "flat",
        discountValue: 0,
        discountAmount: 0,
        totalAmount: 650,
        amountPaid: 650,
        amountPending: 0,
        paymentMode: "cash",
        payments: [
          {
            amount: 650,
            mode: "cash",
            recordedAt: daysAgoAt(1, 16, 30),
            recordedBy: "staff",
          },
        ],
        status: "completed",
        recordedBy: "staff",
        createdAt: daysAgoAt(1, 16, 30),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        orderNumber: "#1040",
        orderType: "product_sale",
        customerId: customers[9]._id,
        customerSnapshot: {
          name: "Meera Joshi",
          phone: "98980 77889",
        },
        lineItems: [
          {
            itemType: "product",
            itemId: products[4]._id,
            name: "Hair Serum 100ml",
            unitPrice: 420,
            quantity: 1,
            discount: 0,
            finalPrice: 420,
            fulfilled: true,
          },
        ],
        subtotal: 420,
        discountType: "flat",
        discountValue: 0,
        discountAmount: 0,
        totalAmount: 420,
        amountPaid: 420,
        amountPending: 0,
        paymentMode: "cash",
        payments: [
          {
            amount: 420,
            mode: "cash",
            recordedAt: daysAgoAt(1, 18, 0),
            recordedBy: "owner",
          },
        ],
        status: "paid_full",
        recordedBy: "owner",
        createdAt: daysAgoAt(1, 18, 0),
        updatedAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        orderNumber: "#1041",
        orderType: "service_booking",
        customerId: customers[0]._id,
        customerSnapshot: {
          name: "Priya Shah",
          phone: "98250 12345",
        },
        lineItems: [
          {
            itemType: "service",
            itemId: new mongoose.Types.ObjectId(),
            name: "Full Arms & Legs Waxing",
            unitPrice: 1100,
            quantity: 1,
            discount: 0,
            finalPrice: 1100,
            fulfilled: true,
          },
        ],
        subtotal: 1100,
        discountType: "flat",
        discountValue: 0,
        discountAmount: 0,
        totalAmount: 1100,
        amountPaid: 1100,
        amountPending: 0,
        paymentMode: "upi",
        payments: [
          {
            amount: 1100,
            mode: "upi",
            recordedAt: daysAgoAt(1, 19, 15),
            recordedBy: "staff",
          },
        ],
        status: "completed",
        recordedBy: "staff",
        createdAt: daysAgoAt(1, 19, 15),
        updatedAt: new Date(),
      },
    ];
    await db.collection("orders").insertMany(orders);
    console.log("✅ Created 11 Orders (8 Today, 3 Historical)");

    console.log("\n=======================================================");
    console.log("🎉 Database cluster cleaned and freshly seeded for ShreeHari!");
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
