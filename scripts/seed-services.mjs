import mongoose from "mongoose";
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
  console.error("❌ MONGODB_URI not found");
  process.exit(1);
}

if (!uri.includes(".mongodb.net/galla")) {
  uri = uri.replace(".mongodb.net/?", ".mongodb.net/galla?");
}

async function seedServicesOnly() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const tenantId = new mongoose.Types.ObjectId("65f000000000000000000001");

    // Only populate services if none exist for this tenant
    const existingServices = await db.collection("services").countDocuments({ tenantId });
    if (existingServices === 0) {
      const services = [
        {
          _id: new mongoose.Types.ObjectId(),
          tenantId,
          name: "Hair Spa & Conditioning",
          category: "Hair Care",
          price: 1200,
          durationMinutes: 60,
          description: "Intense moisture infusion with argan oil steam therapy",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          tenantId,
          name: "Fruit Facial & Cleanse",
          category: "Skin Care",
          price: 850,
          durationMinutes: 45,
          description: "Organic fruit extract exfoliation and hydrating glow mask",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          tenantId,
          name: "Gold Radiant Facial",
          category: "Skin Care",
          price: 1500,
          durationMinutes: 60,
          description: "24K gold foil therapy for instant bridal luminance",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          tenantId,
          name: "Beard Trim & Styling",
          category: "Hair Care",
          price: 450,
          durationMinutes: 30,
          description: "Precision razor line-up, hot towel and conditioning oil",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          tenantId,
          name: "Full Arms & Legs Waxing",
          category: "Waxing & Threading",
          price: 1100,
          durationMinutes: 45,
          description: "Rica liposoluble wax with soothing aloe vera massage",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          tenantId,
          name: "Bridal Makeover Special",
          category: "Bridal & Groom",
          price: 2500,
          durationMinutes: 90,
          description: "HD makeover with hair styling and drape setting",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      await db.collection("services").insertMany(services);
      console.log(`✅ Seeded ${services.length} initial services (no existing data touched).`);
    } else {
      console.log(`ℹ️ ${existingServices} services already exist for tenant. Skipping insertion.`);
    }

    const existingPackages = await db.collection("packagetemplates").countDocuments({ tenantId });
    if (existingPackages === 0) {
      const services = await db.collection("services").find({ tenantId }).toArray();
      const products = await db.collection("products").find({ tenantId }).toArray();

      const packageTemplates = [
        {
          _id: new mongoose.Types.ObjectId(),
          tenantId,
          name: "Bridal Glow Deluxe",
          description: "Complete bridal package including HD makeover and facial treatment",
          pricingType: "fixed",
          packagePrice: 4200,
          services: services.slice(0, 2).map((s) => ({
            serviceId: s._id,
            name: s.name,
            componentPrice: s.price,
          })),
          products: products.slice(0, 1).map((p) => ({
            productId: p._id,
            name: p.name,
            quantity: 1,
            componentPrice: p.price,
          })),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      await db.collection("packagetemplates").insertMany(packageTemplates);
      console.log(`✅ Seeded initial package template (no other collections modified).`);
    } else {
      console.log(`ℹ️ ${existingPackages} package templates already exist for tenant. Skipping insertion.`);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ Seed error:", err);
    process.exit(1);
  }
}

seedServicesOnly();
