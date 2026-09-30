import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/db/mongodb";
import { Tenant } from "../src/lib/db/models/tenant.model";
import { User } from "../src/lib/db/models/user.model";
import { Supplier } from "../src/lib/db/models/supplier.model";
import { Product } from "../src/lib/db/models/product.model";
import { PurchaseOrder } from "../src/lib/db/models/purchase-order.model";
import { Customer } from "../src/lib/db/models/customer.model";
import { Order } from "../src/lib/db/models/order.model";
import { Expense } from "../src/lib/db/models/expense.model";
import { CustomerReplacement } from "../src/lib/db/models/customer-replacement.model";
import { PackageTemplate } from "../src/lib/db/models/package-template.model";
import { AnalyticsRollup } from "../src/lib/db/models/analytics-rollup.model";
import { Counter } from "../src/lib/db/models/counter.model";

async function cleanAndSeed() {
  console.log("Connecting to MongoDB Atlas...");
  await connectToDatabase();
  console.log("Connected successfully!");

  // 1. Identify ShreeHari Tenant
  let tenant = await Tenant.findOne({ name: /ShreeHari/i }).lean();
  if (!tenant) {
    tenant = await Tenant.findOne().lean();
  }

  if (!tenant) {
    console.error("❌ No tenant found in the database. Please ensure a tenant exists.");
    process.exit(1);
  }

  const tenantId = tenant._id as mongoose.Types.ObjectId;
  console.log(`\nPreserving profile for Tenant: "${tenant.name}" (${tenantId.toString()})`);

  // 2. Clean transactional and domain collections (Orders, Expenses, Products, Customers, etc.)
  console.log("\n🧹 Cleaning existing data collections...");
  const deleteOrders = await Order.deleteMany({ tenantId });
  console.log(`- Deleted ${deleteOrders.deletedCount} orders`);

  const deleteExpenses = await Expense.deleteMany({ tenantId });
  console.log(`- Deleted ${deleteExpenses.deletedCount} expenses`);

  const deleteReplacements = await CustomerReplacement.deleteMany({ tenantId });
  console.log(`- Deleted ${deleteReplacements.deletedCount} customer replacements`);

  const deletePackages = await PackageTemplate.deleteMany({ tenantId });
  console.log(`- Deleted ${deletePackages.deletedCount} package templates`);

  const deleteRollups = await AnalyticsRollup.deleteMany({ tenantId });
  console.log(`- Deleted ${deleteRollups.deletedCount} analytics rollups`);

  const deleteCustomers = await Customer.deleteMany({ tenantId });
  console.log(`- Deleted ${deleteCustomers.deletedCount} customers`);

  const deletePOs = await PurchaseOrder.deleteMany({ tenantId });
  console.log(`- Deleted ${deletePOs.deletedCount} purchase orders`);

  const deleteProducts = await Product.deleteMany({ tenantId });
  console.log(`- Deleted ${deleteProducts.deletedCount} products`);

  const deleteSuppliers = await Supplier.deleteMany({ tenantId });
  console.log(`- Deleted ${deleteSuppliers.deletedCount} suppliers`);

  // 3. Reset Counters for clean numbering
  await Counter.deleteMany({ tenantId });
  console.log("- Reset sequence counters");

  // 4. Create Structured Suppliers
  console.log("\n🏢 Adding structured salon suppliers/dealers...");
  const supplier1Id = new mongoose.Types.ObjectId();
  const supplier2Id = new mongoose.Types.ObjectId();
  const supplier3Id = new mongoose.Types.ObjectId();

  const suppliersData = [
    {
      _id: supplier1Id,
      tenantId,
      name: "Ramesh Sharma",
      companyName: "Sharma Beauty & Hair Care Distributors",
      phone: "9825111223",
      email: "sharmabeauty.dist@gmail.com",
      address: "B-12, Royal Plaza, Ring Road, Surat, Gujarat",
      gstin: "24AAACS1234D1Z5",
      notes: "Authorized distributor for L'Oréal Professional and Streax Professional",
      totalPurchases: 0,
      totalPaid: 0,
      totalPending: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: supplier2Id,
      tenantId,
      name: "Vikram Patel",
      companyName: "Gujarat Skin & Aesthetic Supplies",
      phone: "9904233445",
      email: "gujaratskinsupplies@gmail.com",
      address: "Shop 14, Galaxy Arcade, Pal, Surat, Gujarat",
      gstin: "24AABCG5678E1Z9",
      notes: "Specialized in facial kits, d-tan packs, and organic scrubs",
      totalPurchases: 0,
      totalPaid: 0,
      totalPending: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: supplier3Id,
      tenantId,
      name: "Jayesh Shah",
      companyName: "Zenith Parlour Essentials & Equipment",
      phone: "9712355667",
      email: "zenithparlour@gmail.com",
      address: "Plot 45, GIDC Industrial Estate, Katargam, Surat, Gujarat",
      gstin: "24AACZ9012F1Z3",
      notes: "Salon wax cartridges, disposable sheets, foils, and styling accessories",
      totalPurchases: 0,
      totalPaid: 0,
      totalPending: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await Supplier.insertMany(suppliersData);
  console.log(`✅ Created ${suppliersData.length} Suppliers`);

  // 5. Create Structured Completed Purchase Orders & Fill Inventory
  console.log("\n📦 Adding completed Purchase Orders to structurally fill inventory...");

  // Products for Bill 1 (Hair Care & Color from Sharma Beauty)
  const prod1Id = new mongoose.Types.ObjectId();
  const prod2Id = new mongoose.Types.ObjectId();
  const prod3Id = new mongoose.Types.ObjectId();

  const bill1Items = [
    {
      productId: prod1Id,
      productName: "L'Oréal Serie Expert Shampoo 300ml",
      quantityForSell: 8,
      quantityForUse: 4,
      purchaseCost: 450,
      expectedSellPrice: 750,
      itemTotalCost: 12 * 450, // 5,400
    },
    {
      productId: prod2Id,
      productName: "L'Oréal Mythic Hair Oil 100ml",
      quantityForSell: 6,
      quantityForUse: 2,
      purchaseCost: 650,
      expectedSellPrice: 1100,
      itemTotalCost: 8 * 650, // 5,200
    },
    {
      productId: prod3Id,
      productName: "Majirel Hair Color Shade 4.0",
      quantityForSell: 5,
      quantityForUse: 5,
      purchaseCost: 220,
      expectedSellPrice: 380,
      itemTotalCost: 10 * 220, // 2,200
    },
  ];
  const bill1Total = bill1Items.reduce((acc, it) => acc + it.itemTotalCost, 0); // 12,800

  // Products for Bill 2 (Skin Care from Gujarat Skin Supplies)
  const prod4Id = new mongoose.Types.ObjectId();
  const prod5Id = new mongoose.Types.ObjectId();

  const bill2Items = [
    {
      productId: prod4Id,
      productName: "O3+ Radiant Bridal Glow Facial Kit",
      quantityForSell: 4,
      quantityForUse: 4,
      purchaseCost: 1400,
      expectedSellPrice: 2400,
      itemTotalCost: 8 * 1400, // 11,200
    },
    {
      productId: prod5Id,
      productName: "Raaga Professional De-Tan Cream 500g",
      quantityForSell: 3,
      quantityForUse: 5,
      purchaseCost: 680,
      expectedSellPrice: 1150,
      itemTotalCost: 8 * 680, // 5,440
    },
  ];
  const bill2Total = bill2Items.reduce((acc, it) => acc + it.itemTotalCost, 0); // 16,640

  // Products for Bill 3 (Waxing & Essentials from Zenith Parlour)
  const prod6Id = new mongoose.Types.ObjectId();
  const prod7Id = new mongoose.Types.ObjectId();

  const bill3Items = [
    {
      productId: prod6Id,
      productName: "Rica White Chocolate Liposoluble Wax 800ml",
      quantityForSell: 2,
      quantityForUse: 6,
      purchaseCost: 780,
      expectedSellPrice: 1350,
      itemTotalCost: 8 * 780, // 6,240
    },
    {
      productId: prod7Id,
      productName: "Streax Professional Argan Hair Mask 500g",
      quantityForSell: 5,
      quantityForUse: 3,
      purchaseCost: 520,
      expectedSellPrice: 890,
      itemTotalCost: 8 * 520, // 4,160
    },
  ];
  const bill3Total = bill3Items.reduce((acc, it) => acc + it.itemTotalCost, 0); // 10,400

  // Insert the corresponding Products into Inventory
  const productsToInsert = [
    {
      _id: prod1Id,
      tenantId,
      name: "L'Oréal Serie Expert Shampoo 300ml",
      category: "Hair Care & Shampoos",
      unit: "pieces",
      purchaseCost: 450,
      expectedSellPrice: 750,
      sellStock: 8,
      useStock: 4,
      defectiveStock: 0,
      lowStockThreshold: 2,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: prod2Id,
      tenantId,
      name: "L'Oréal Mythic Hair Oil 100ml",
      category: "Hair Serums & Oils",
      unit: "pieces",
      purchaseCost: 650,
      expectedSellPrice: 1100,
      sellStock: 6,
      useStock: 2,
      defectiveStock: 0,
      lowStockThreshold: 2,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: prod3Id,
      tenantId,
      name: "Majirel Hair Color Shade 4.0",
      category: "Hair Color & Developers",
      unit: "pieces",
      purchaseCost: 220,
      expectedSellPrice: 380,
      sellStock: 5,
      useStock: 5,
      defectiveStock: 0,
      lowStockThreshold: 2,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: prod4Id,
      tenantId,
      name: "O3+ Radiant Bridal Glow Facial Kit",
      category: "Facial Kits & Treatments",
      unit: "pieces",
      purchaseCost: 1400,
      expectedSellPrice: 2400,
      sellStock: 4,
      useStock: 4,
      defectiveStock: 0,
      lowStockThreshold: 2,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: prod5Id,
      tenantId,
      name: "Raaga Professional De-Tan Cream 500g",
      category: "Skin Care & De-Tan",
      unit: "pieces",
      purchaseCost: 680,
      expectedSellPrice: 1150,
      sellStock: 3,
      useStock: 5,
      defectiveStock: 0,
      lowStockThreshold: 2,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: prod6Id,
      tenantId,
      name: "Rica White Chocolate Liposoluble Wax 800ml",
      category: "Waxing & Hair Removal",
      unit: "pieces",
      purchaseCost: 780,
      expectedSellPrice: 1350,
      sellStock: 2,
      useStock: 6,
      defectiveStock: 0,
      lowStockThreshold: 2,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: prod7Id,
      tenantId,
      name: "Streax Professional Argan Hair Mask 500g",
      category: "Hair Masks & Spas",
      unit: "pieces",
      purchaseCost: 520,
      expectedSellPrice: 890,
      sellStock: 5,
      useStock: 3,
      defectiveStock: 0,
      lowStockThreshold: 2,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await Product.insertMany(productsToInsert);
  console.log(`✅ Filled inventory with ${productsToInsert.length} active Products with retail & in-use stock!`);

  // Insert the 3 Completed Purchase Orders
  const purchaseOrders = [
    {
      _id: new mongoose.Types.ObjectId(),
      tenantId,
      purchaseOrderNumber: "PO-0001",
      supplierId: supplier1Id,
      supplierSnapshot: {
        name: "Ramesh Sharma",
        phone: "9825111223",
        companyName: "Sharma Beauty & Hair Care Distributors",
      },
      items: bill1Items,
      totalAmount: bill1Total,
      amountPaid: bill1Total,
      amountPending: 0,
      paymentMode: "bank_transfer",
      paymentStatus: "paid",
      settlementMode: "completed",
      stockAllocated: true,
      invoiceDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      dealerInvoiceNumber: "INV-SB-2026-104",
      notes: "Full consignment delivered and verified at parlour counter.",
      recordedBy: "owner",
      payments: [
        {
          amount: bill1Total,
          paymentMode: "bank_transfer",
          notes: "RTGS settlement on delivery",
          recordedBy: "owner",
          type: "full_payment",
          recordedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
      ],
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      tenantId,
      purchaseOrderNumber: "PO-0002",
      supplierId: supplier2Id,
      supplierSnapshot: {
        name: "Vikram Patel",
        phone: "9904233445",
        companyName: "Gujarat Skin & Aesthetic Supplies",
      },
      items: bill2Items,
      totalAmount: bill2Total,
      amountPaid: bill2Total,
      amountPending: 0,
      paymentMode: "upi",
      paymentStatus: "paid",
      settlementMode: "completed",
      stockAllocated: true,
      invoiceDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      dealerInvoiceNumber: "GS-4089",
      notes: "Skin kits and de-tan supplies received in good condition.",
      recordedBy: "owner",
      payments: [
        {
          amount: bill2Total,
          paymentMode: "upi",
          notes: "GPay instant payment on delivery",
          recordedBy: "owner",
          type: "full_payment",
          recordedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
      ],
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      tenantId,
      purchaseOrderNumber: "PO-0003",
      supplierId: supplier3Id,
      supplierSnapshot: {
        name: "Jayesh Shah",
        phone: "9712355667",
        companyName: "Zenith Parlour Essentials & Equipment",
      },
      items: bill3Items,
      totalAmount: bill3Total,
      amountPaid: bill3Total,
      amountPending: 0,
      paymentMode: "bank_transfer",
      paymentStatus: "paid",
      settlementMode: "completed",
      stockAllocated: true,
      invoiceDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      dealerInvoiceNumber: "ZE-2026-788",
      notes: "Wax tins and mask containers inspected and stocked into shelf and service trays.",
      recordedBy: "owner",
      payments: [
        {
          amount: bill3Total,
          paymentMode: "bank_transfer",
          notes: "IMPS online transfer",
          recordedBy: "owner",
          type: "full_payment",
          recordedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ],
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    },
  ];

  await PurchaseOrder.insertMany(purchaseOrders);
  console.log(`✅ Created ${purchaseOrders.length} completed Purchase Orders linked to suppliers!`);

  // Update Suppliers' financial balances
  await Supplier.updateOne(
    { _id: supplier1Id },
    { $set: { totalPurchases: bill1Total, totalPaid: bill1Total, totalPending: 0 } }
  );
  await Supplier.updateOne(
    { _id: supplier2Id },
    { $set: { totalPurchases: bill2Total, totalPaid: bill2Total, totalPending: 0 } }
  );
  await Supplier.updateOne(
    { _id: supplier3Id },
    { $set: { totalPurchases: bill3Total, totalPaid: bill3Total, totalPending: 0 } }
  );

  // Set sequence counter for PO to 3
  await Counter.create({
    tenantId,
    name: "purchase_order",
    seq: 3,
  });

  // 6. Create Customer Profiles (Clean, Zero Orders Placed)
  console.log("\n👥 Creating fresh customer profiles (zero orders placed yet)...");
  const customersData = [
    {
      _id: new mongoose.Types.ObjectId(),
      tenantId,
      name: "Priya Shah",
      phone: "9825012345",
      email: "priyashah@gmail.com",
      gender: "female",
      notes: "Prefers herbal shampoo and mild scalp treatments",
      stats: {
        totalVisits: 0,
        totalSpend: 0,
        outstandingBalance: 0,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      tenantId,
      name: "Ananya Desai",
      phone: "9879011223",
      email: "ananya.desai@gmail.com",
      gender: "female",
      notes: "Regular skin care and waxing client",
      stats: {
        totalVisits: 0,
        totalSpend: 0,
        outstandingBalance: 0,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      tenantId,
      name: "Neha Patel",
      phone: "9723045678",
      email: "neha.patel92@gmail.com",
      gender: "female",
      notes: "Interested in bridal glow packages and hair coloring",
      stats: {
        totalVisits: 0,
        totalSpend: 0,
        outstandingBalance: 0,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      tenantId,
      name: "Rahul Mehta",
      phone: "9904067890",
      email: "rahul.mehta@yahoo.com",
      gender: "male",
      notes: "Haircut and beard trim client",
      stats: {
        totalVisits: 0,
        totalSpend: 0,
        outstandingBalance: 0,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      tenantId,
      name: "Pooja Sharma",
      phone: "9912344556",
      email: "poojasharma@gmail.com",
      gender: "female",
      notes: "Hair spa and styling",
      stats: {
        totalVisits: 0,
        totalSpend: 0,
        outstandingBalance: 0,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      tenantId,
      name: "Kavita Joshi",
      phone: "9824055667",
      email: "kavita.joshi@gmail.com",
      gender: "female",
      notes: "Facial treatments and manicure",
      stats: {
        totalVisits: 0,
        totalSpend: 0,
        outstandingBalance: 0,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await Customer.insertMany(customersData);
  console.log(`✅ Created ${customersData.length} clean Customer Profiles with 0 visits and 0 orders!`);

  console.log("\n==================================================================");
  console.log("🎉 DATABASE RE-SEEDED SUCCESSFULLY ACCORDING TO SPECIFICATION!");
  console.log("------------------------------------------------------------------");
  console.log(`1. Tenant Profile: "${tenant.name}" (${tenantId}) PRESERVED`);
  console.log("2. Orders: 0 (No customer orders placed yet)");
  console.log("3. Expenses: 0 (Fresh financial slate)");
  console.log(`4. Suppliers: ${suppliersData.length} structured dealers created`);
  console.log(`5. Purchase Orders: ${purchaseOrders.length} completed bills stocked in (PO-0001, PO-0002, PO-0003)`);
  console.log(`6. Products Inventory: ${productsToInsert.length} products stocked directly from POs`);
  console.log(`7. Customers: ${customersData.length} customer profiles created (0 visits, 0 spend)`);
  console.log("==================================================================\n");

  process.exit(0);
}

cleanAndSeed().catch((err) => {
  console.error("❌ Error during clean and seed:", err);
  process.exit(1);
});
