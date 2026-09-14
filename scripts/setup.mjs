import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const rootDir = process.cwd();
const envExamplePath = path.join(rootDir, ".env.example");
const envLocalPath = path.join(rootDir, ".env.local");

console.log("\n=============================================================");
console.log("🚀 Galla — Automated Project & Dependencies Setup");
console.log("=============================================================\n");

// 1. Always install and sync dependencies (handles new packages like Cloudinary, Nodemailer, etc.)
console.log("📦 Installing and verifying project dependencies...");
try {
  execSync("npm install", { stdio: "inherit", cwd: rootDir });
  console.log("✅ Dependencies installed and up to date.\n");
} catch (error) {
  console.error("❌ Failed to install dependencies:", error.message);
  process.exit(1);
}

// 2. Check if .env.example exists
if (!fs.existsSync(envExamplePath)) {
  console.error("❌ Error: .env.example file not found!");
  process.exit(1);
}

// 3. Handle .env.local creation and syncing new variables
if (!fs.existsSync(envLocalPath)) {
  let envContent = fs.readFileSync(envExamplePath, "utf8");
  const randomSecret = crypto.randomBytes(32).toString("base64");
  envContent = envContent
    .replace('AUTH_SECRET="replace-with-a-secure-random-secret-key-at-least-32-chars"', `AUTH_SECRET="${randomSecret}"`)
    .replace('NEXTAUTH_SECRET="replace-with-a-secure-random-secret-key-at-least-32-chars"', `NEXTAUTH_SECRET="${randomSecret}"`);

  fs.writeFileSync(envLocalPath, envContent, "utf8");
  console.log("✅ Created .env.local from .env.example with auto-generated secure AUTH_SECRET.");
} else {
  console.log("ℹ️  .env.local exists. Checking for newly added environment variables...");
  const existingLocal = fs.readFileSync(envLocalPath, "utf8");
  const exampleContent = fs.readFileSync(envExamplePath, "utf8");

  // Find keys in .env.example not in .env.local
  const exampleLines = exampleContent.split("\n");
  const missingKeys = [];
  for (const line of exampleLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const key = trimmed.split("=")[0].trim();
      const regex = new RegExp(`^\\s*${key}\\s*=`, "m");
      if (!regex.test(existingLocal)) {
        missingKeys.push(trimmed);
      }
    }
  }

  if (missingKeys.length > 0) {
    fs.appendFileSync(envLocalPath, `\n# Newly added environment variables\n${missingKeys.join("\n")}\n`);
    console.log(`✅ Appended ${missingKeys.length} new variable(s) to .env.local:`, missingKeys.map(k => k.split("=")[0]).join(", "));
  } else {
    console.log("✅ All environment keys are up to date in .env.local.");
  }
}

// 4. Run safe initial service & package seeding if MONGODB_URI is available
console.log("\n🌱 Checking database services & package catalog...");
try {
  execSync("node scripts/seed-services.mjs", { stdio: "inherit", cwd: rootDir });
} catch {
  console.log("ℹ️  Database seed skipped (check your MONGODB_URI in .env.local).");
}

console.log("\n-------------------------------------------------------------");
console.log("📋 Setup Complete! Next Steps:");
console.log("  1. Verify your MONGODB_URI in .env.local");
console.log("  2. Start the dev server: npm run dev");
console.log("  3. To re-seed services at any time: npm run seed:services");
console.log("-------------------------------------------------------------\n");
