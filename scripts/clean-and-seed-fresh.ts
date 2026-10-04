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
import { Service } from "../src/lib/db/models/service.model";
import { AnalyticsRollup } from "../src/lib/db/models/analytics-rollup.model";
import { Counter } from "../src/lib/db/models/counter.model";

async function cleanAndSeed() {
  console.log("Connecting to MongoDB Atlas...");
  await connectToDatabase();
  console.log("Connected successfully!");

  // 1. Identify Target Tenant (ShreeHari)
  let tenant = await Tenant.findOne({ name: /ShreeHari/i }).lean();
  if (!tenant) {
    tenant = await Tenant.findOne().lean();
  }

  if (!tenant) {
    console.error("❌ No tenant found in the database. Please ensure a tenant exists.");
    process.exit(1);
  }

  const tenantId = tenant._id as mongoose.Types.ObjectId;
  console.log(`\nPreserving user accounts & salon profile for: "${tenant.name}" (${tenantId.toString()})`);

  // 2. Clean transactional and domain collections (Orders, Expenses, Products, Customers, Services, Packages, etc.)
  console.log("\n🧹 Cleaning existing transactional and domain collections (preserving user & tenant accounts)...");
  
  const deleteOrders = await Order.deleteMany({ tenantId });
  console.log(`- Deleted ${deleteOrders.deletedCount} orders`);

  const deleteExpenses = await Expense.deleteMany({ tenantId });
  console.log(`- Deleted ${deleteExpenses.deletedCount} expenses`);

  const deleteReplacements = await CustomerReplacement.deleteMany({ tenantId });
  console.log(`- Deleted ${deleteReplacements.deletedCount} customer replacements`);

  const deletePackages = await PackageTemplate.deleteMany({ tenantId });
  console.log(`- Deleted ${deletePackages.deletedCount} package templates`);

  const deleteServices = await Service.deleteMany({ tenantId });
  console.log(`- Deleted ${deleteServices.deletedCount} services`);

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

  // Clean any old purchase returns collection if present
  try {
    await mongoose.connection.collection("purchasereturns").deleteMany({ tenantId });
  } catch {
    // Ignore if collection does not exist
  }

  // Reset sequence counters
  await Counter.deleteMany({ tenantId });
  console.log("- Reset sequence counters");

  // 3. Create Structured Suppliers (Dealers)
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
      phone: "+91 98251 11223",
      email: "sharmabeauty.dist@gmail.com",
      address: "B-12, Royal Plaza, Ring Road, Surat, Gujarat",
      gstin: "24AAACS1234D1Z5",
      notes: "Authorized distributor for L'Oréal Professional and Streax Professional",
      totalPurchases: 12800,
      totalPaid: 12800,
      totalPending: 0,
      totalCredit: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: supplier2Id,
      tenantId,
      name: "Vikram Patel",
      companyName: "Gujarat Skin & Aesthetic Supplies",
      phone: "+91 99042 33445",
      email: "gujaratskinsupplies@gmail.com",
      address: "Shop 14, Galaxy Arcade, Pal, Surat, Gujarat",
      gstin: "24AABCG5678E1Z9",
      notes: "Specialized in facial kits, d-tan packs, and organic scrubs",
      totalPurchases: 16640,
      totalPaid: 10000,
      totalPending: 6640,
      totalCredit: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: supplier3Id,
      tenantId,
      name: "Jayesh Shah",
      companyName: "Zenith Parlour Essentials & Equipment",
      phone: "+91 97123 55667",
      email: "zenithparlour@gmail.com",
      address: "Plot 45, GIDC Industrial Estate, Katargam, Surat, Gujarat",
      gstin: "24AACZ9012F1Z3",
      notes: "Salon wax cartridges, disposable sheets, foils, and styling accessories",
      totalPurchases: 10400,
      totalPaid: 10400,
      totalPending: 0,
      totalCredit: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await Supplier.insertMany(suppliersData);
  console.log(`✅ Created ${suppliersData.length} Suppliers`);

  // 4. Create Structured Products & Proper Purchase Orders (Bills)
  console.log("\n📦 Adding completed Purchase Orders to structurally fill inventory...");

  const prod1Id = new mongoose.Types.ObjectId();
  const prod2Id = new mongoose.Types.ObjectId();
  const prod3Id = new mongoose.Types.ObjectId();
  const prod4Id = new mongoose.Types.ObjectId();
  const prod5Id = new mongoose.Types.ObjectId();
  const prod6Id = new mongoose.Types.ObjectId();
  const prod7Id = new mongoose.Types.ObjectId();

  // Bill 1: Ramesh Sharma (Hair Care & Color)
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

  // Bill 2: Vikram Patel (Skin Care & De-Tan) - with ₹6,640 pending due for realistic testing
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
  const bill2Paid = 10000;
  const bill2Pending = bill2Total - bill2Paid; // 6,640

  // Bill 3: Jayesh Shah (Waxing & Hair Masks)
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

  // Insert Products into Inventory
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

  // Insert the 3 Purchase Orders
  const po1Id = new mongoose.Types.ObjectId();
  const po2Id = new mongoose.Types.ObjectId();
  const po3Id = new mongoose.Types.ObjectId();

  const purchaseOrders = [
    {
      _id: po1Id,
      tenantId,
      purchaseOrderNumber: "0001-PO-2610-0001",
      supplierId: supplier1Id,
      supplierSnapshot: {
        name: "Ramesh Sharma",
        phone: "+91 98251 11223",
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
      invoiceDate: new Date(),
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
          recordedAt: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: po2Id,
      tenantId,
      purchaseOrderNumber: "0001-PO-2610-0002",
      supplierId: supplier2Id,
      supplierSnapshot: {
        name: "Vikram Patel",
        phone: "+91 99042 33445",
        companyName: "Gujarat Skin & Aesthetic Supplies",
      },
      items: bill2Items,
      totalAmount: bill2Total,
      amountPaid: bill2Paid,
      amountPending: bill2Pending,
      paymentMode: "upi",
      paymentStatus: "partial",
      settlementMode: "pending",
      stockAllocated: true,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invoiceDate: new Date(),
      dealerInvoiceNumber: "GS-4089",
      notes: "Advance paid ₹10,000 via UPI; remaining balance due within 7 days.",
      recordedBy: "owner",
      payments: [
        {
          amount: bill2Paid,
          paymentMode: "upi",
          notes: "GPay partial payment on delivery",
          recordedBy: "owner",
          type: "initial",
          recordedAt: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: po3Id,
      tenantId,
      purchaseOrderNumber: "0001-PO-2610-0003",
      supplierId: supplier3Id,
      supplierSnapshot: {
        name: "Jayesh Shah",
        phone: "+91 97123 55667",
        companyName: "Zenith Parlour Essentials & Equipment",
      },
      items: bill3Items,
      totalAmount: bill3Total,
      amountPaid: bill3Total,
      amountPending: 0,
      paymentMode: "cash",
      paymentStatus: "paid",
      settlementMode: "completed",
      stockAllocated: true,
      invoiceDate: new Date(),
      dealerInvoiceNumber: "ZE-2026-788",
      notes: "Cash payment upon delivery of wax cartridges and hair masks.",
      recordedBy: "owner",
      payments: [
        {
          amount: bill3Total,
          paymentMode: "cash",
          notes: "Cash payment on delivery",
          recordedBy: "owner",
          type: "full_payment",
          recordedAt: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await PurchaseOrder.insertMany(purchaseOrders);
  console.log(`✅ Created ${purchaseOrders.length} Purchase Orders linked to suppliers!`);

  // Record corresponding Expenses for payments made
  const expensesToInsert = [
    {
      tenantId,
      expenseNumber: "0001-EXP-2610-0001",
      title: "Supplier Stock Purchase (Sharma Beauty)",
      category: "inventory_purchase" as const,
      amount: bill1Total,
      paymentMode: "bank_transfer" as const,
      expenseDate: new Date(),
      recipient: "Ramesh Sharma",
      linkedPurchaseOrderId: po1Id,
      recordedBy: "owner" as const,
      notes: "Purchase order 0001-PO-2610-0001",
    },
    {
      tenantId,
      expenseNumber: "0001-EXP-2610-0002",
      title: "Supplier Stock Purchase - Advance (Gujarat Skin)",
      category: "inventory_purchase" as const,
      amount: bill2Paid,
      paymentMode: "upi" as const,
      expenseDate: new Date(),
      recipient: "Vikram Patel",
      linkedPurchaseOrderId: po2Id,
      recordedBy: "owner" as const,
      notes: "Partial payment for purchase order 0001-PO-2610-0002",
    },
    {
      tenantId,
      expenseNumber: "0001-EXP-2610-0003",
      title: "Supplier Stock Purchase (Zenith Parlour)",
      category: "inventory_purchase" as const,
      amount: bill3Total,
      paymentMode: "cash" as const,
      expenseDate: new Date(),
      recipient: "Jayesh Shah",
      linkedPurchaseOrderId: po3Id,
      recordedBy: "owner" as const,
      notes: "Purchase order 0001-PO-2610-0003",
    },
  ];
  await Expense.insertMany(expensesToInsert);
  console.log(`✅ Logged ${expensesToInsert.length} corresponding inventory purchase expenses`);

  // Set sequence counters for fresh next numbers
  await Counter.create({
    tenantId,
    name: "purchase_order",
    seq: 3,
  });
  await Counter.create({
    tenantId,
    name: "expense",
    seq: 3,
  });

  // 5. Create Services
  console.log("\n💇 Adding salon services across categories...");
  const s1Id = new mongoose.Types.ObjectId();
  const s2Id = new mongoose.Types.ObjectId();
  const s3Id = new mongoose.Types.ObjectId();
  const s4Id = new mongoose.Types.ObjectId();
  const s5Id = new mongoose.Types.ObjectId();
  const s6Id = new mongoose.Types.ObjectId();
  const s7Id = new mongoose.Types.ObjectId();
  const s8Id = new mongoose.Types.ObjectId();
  const s9Id = new mongoose.Types.ObjectId();
  const s10Id = new mongoose.Types.ObjectId();
  const s11Id = new mongoose.Types.ObjectId();
  const s12Id = new mongoose.Types.ObjectId();

  const servicesData = [
    // Hair Care
    {
      _id: s1Id,
      tenantId,
      name: "Haircut & Blowdry Styling",
      category: "Hair Care",
      price: 400,
      description: "Custom precision cut with wash and volume blowdry styling",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: s2Id,
      tenantId,
      name: "Hair Spa & Deep Conditioning",
      category: "Hair Care",
      price: 1200,
      description: "Intense moisture infusion with argan hair mask steam therapy",
      products: [
        {
          productId: prod7Id,
          name: "Streax Professional Argan Hair Mask 500g",
          quantity: 1,
          unitCost: 520,
        },
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: s3Id,
      tenantId,
      name: "Majirel Root Touch-up & Color",
      category: "Hair Care",
      price: 1500,
      description: "Professional grey coverage with vibrant shine and nourishment",
      products: [
        {
          productId: prod3Id,
          name: "Majirel Hair Color Shade 4.0",
          quantity: 1,
          unitCost: 220,
        },
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: s4Id,
      tenantId,
      name: "Keratin Smooth Treatment",
      category: "Hair Care",
      price: 3500,
      description: "Frizz-free protein bond reconstruction for mirror-like smooth hair",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: s5Id,
      tenantId,
      name: "Beard Trim & Precision Line-up",
      category: "Hair Care",
      price: 350,
      description: "Precision razor line-up, hot towel and conditioning beard oil",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },

    // Skin Care
    {
      _id: s6Id,
      tenantId,
      name: "Fruit Facial & Hydration Cleanse",
      category: "Skin Care",
      price: 850,
      description: "Organic fruit extract exfoliation, steam, and hydrating glow mask",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: s7Id,
      tenantId,
      name: "O3+ Radiant Bridal Glow Facial",
      category: "Skin Care",
      price: 2200,
      description: "Multi-step oxygenated whitening and brightening facial kit treatment",
      products: [
        {
          productId: prod4Id,
          name: "O3+ Radiant Bridal Glow Facial Kit",
          quantity: 1,
          unitCost: 1400,
        },
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: s8Id,
      tenantId,
      name: "Raaga Professional De-Tan Pack",
      category: "Skin Care",
      price: 650,
      description: "Kojic acid and milk protein de-tanning application with soothing massage",
      products: [
        {
          productId: prod5Id,
          name: "Raaga Professional De-Tan Cream 500g",
          quantity: 1,
          unitCost: 680,
        },
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },

    // Waxing & Threading
    {
      _id: s9Id,
      tenantId,
      name: "Full Arms & Full Legs Waxing",
      category: "Waxing & Threading",
      price: 950,
      description: "Rica white chocolate liposoluble wax with post-wax soothing oil",
      products: [
        {
          productId: prod6Id,
          name: "Rica White Chocolate Liposoluble Wax 800ml",
          quantity: 1,
          unitCost: 780,
        },
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: s10Id,
      tenantId,
      name: "Eyebrow & Upper Lip Threading",
      category: "Waxing & Threading",
      price: 150,
      description: "Organic cotton thread shaping with aloe vera cool compress",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },

    // Hands & Feet
    {
      _id: s11Id,
      tenantId,
      name: "Luxury Aroma Manicure",
      category: "Hands & Feet",
      price: 600,
      description: "Dead skin scrub, cuticle grooming, hand massage and polish",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: s12Id,
      tenantId,
      name: "Spa Pedicure with Scrub & Massage",
      category: "Hands & Feet",
      price: 800,
      description: "Foot soak, heel buffing, walnut scrub, and relaxing calf massage",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await Service.insertMany(servicesData);
  console.log(`✅ Created ${servicesData.length} Services across Hair Care, Skin Care, Waxing, and Hands & Feet!`);

  // 6. Create Structured Package Templates
  console.log("\n🎁 Adding salon packages (combining services and retail products)...");
  const packagesData = [
    {
      _id: new mongoose.Types.ObjectId(),
      tenantId,
      name: "Bridal Glow Deluxe",
      description: "The ultimate pre-bridal radiance session with O3+ facial, manicure, and pedicure",
      pricingType: "fixed" as const,
      packagePrice: 3200,
      services: [
        { serviceId: s7Id, name: "O3+ Radiant Bridal Glow Facial", componentPrice: 2200 },
        { serviceId: s11Id, name: "Luxury Aroma Manicure", componentPrice: 600 },
        { serviceId: s12Id, name: "Spa Pedicure with Scrub & Massage", componentPrice: 800 },
      ],
      products: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      tenantId,
      name: "Complete Hair Revive",
      description: "Intense hair spa combined with custom haircut and L'Oréal Mythic Oil take-home care",
      pricingType: "fixed" as const,
      packagePrice: 2200,
      services: [
        { serviceId: s1Id, name: "Haircut & Blowdry Styling", componentPrice: 400 },
        { serviceId: s2Id, name: "Hair Spa & Deep Conditioning", componentPrice: 1200 },
      ],
      products: [
        {
          productId: prod2Id,
          name: "L'Oréal Mythic Hair Oil 100ml",
          quantity: 1,
          componentPrice: 1100,
        },
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      tenantId,
      name: "Head-to-Toe Refresh",
      description: "All-in-one grooming package with fruit facial, arms & legs waxing, and pedicure",
      pricingType: "fixed" as const,
      packagePrice: 2200,
      services: [
        { serviceId: s6Id, name: "Fruit Facial & Hydration Cleanse", componentPrice: 850 },
        { serviceId: s9Id, name: "Full Arms & Full Legs Waxing", componentPrice: 950 },
        { serviceId: s12Id, name: "Spa Pedicure with Scrub & Massage", componentPrice: 800 },
      ],
      products: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      tenantId,
      name: "Gentlemen's Executive Grooming",
      description: "Precision haircut, beard styling, and Raaga De-Tan facial cleanse",
      pricingType: "fixed" as const,
      packagePrice: 1200,
      services: [
        { serviceId: s1Id, name: "Haircut & Blowdry Styling", componentPrice: 400 },
        { serviceId: s5Id, name: "Beard Trim & Precision Line-up", componentPrice: 350 },
        { serviceId: s8Id, name: "Raaga Professional De-Tan Pack", componentPrice: 650 },
      ],
      products: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await PackageTemplate.insertMany(packagesData);
  console.log(`✅ Created ${packagesData.length} Package Templates!`);

  // 7. Create Customer Profiles (Clean, Zero Orders Placed)
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
  console.log("2. User Accounts: PRESERVED");
  console.log("3. Orders: 0 (No customer orders placed yet)");
  console.log(`4. Suppliers: ${suppliersData.length} structured dealers created`);
  console.log(`5. Purchase Orders: ${purchaseOrders.length} proper bills stocked in:`);
  console.log(`   - 0001-PO-2610-0001: ₹12,800 (Paid in full, Ramesh Sharma)`);
  console.log(`   - 0001-PO-2610-0002: ₹16,640 (₹10,000 paid, ₹6,640 pending due, Vikram Patel)`);
  console.log(`   - 0001-PO-2610-0003: ₹10,400 (Paid in full, Jayesh Shah)`);
  console.log(`6. Products Inventory: ${productsToInsert.length} active products stocked directly from POs`);
  console.log(`7. Services: ${servicesData.length} salon services added`);
  console.log(`8. Packages: ${packagesData.length} combo packages created`);
  console.log(`9. Customers: ${customersData.length} customer profiles created (0 visits, 0 spend)`);
  console.log("==================================================================\n");

  process.exit(0);
}

cleanAndSeed().catch((err) => {
  console.error("❌ Error during clean and seed:", err);
  process.exit(1);
});
