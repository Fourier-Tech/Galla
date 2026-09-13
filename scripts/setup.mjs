import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const rootDir = process.cwd();
const envExamplePath = path.join(rootDir, ".env.example");
const envLocalPath = path.join(rootDir, ".env.local");
const nodeModulesPath = path.join(rootDir, "node_modules");

console.log("\n=============================================================");
console.log("🚀 Galla — Automated Teammate Setup");
console.log("=============================================================\n");

// 1. Ensure all npm dependencies are installed
if (!fs.existsSync(nodeModulesPath)) {
  console.log("📦 Installing all project dependencies (Mongoose, NextAuth, Pusher, Tailwind, shadcn)...");
  try {
    execSync("npm install", { stdio: "inherit", cwd: rootDir });
    console.log("✅ Dependencies installed successfully.\n");
  } catch (error) {
    console.error("❌ Failed to install dependencies:", error.message);
    process.exit(1);
  }
} else {
  console.log("✅ Dependencies already installed (node_modules present).");
}

// 2. Check if .env.example exists
if (!fs.existsSync(envExamplePath)) {
  console.error("❌ Error: .env.example file not found!");
  process.exit(1);
}

// 3. Handle .env.local creation and secret generation
if (fs.existsSync(envLocalPath)) {
  console.log("ℹ️  .env.local already exists. Preserving your existing configuration.");
} else {
  let envContent = fs.readFileSync(envExamplePath, "utf8");

  // Generate secure random secrets for Auth.js
  const randomSecret = crypto.randomBytes(32).toString("base64");
  envContent = envContent
    .replace('AUTH_SECRET="replace-with-a-secure-random-secret-key-at-least-32-chars"', `AUTH_SECRET="${randomSecret}"`)
    .replace('NEXTAUTH_SECRET="replace-with-a-secure-random-secret-key-at-least-32-chars"', `NEXTAUTH_SECRET="${randomSecret}"`);

  fs.writeFileSync(envLocalPath, envContent, "utf8");
  console.log("✅ Created .env.local from .env.example with auto-generated secure AUTH_SECRET.");
}

console.log("\n-------------------------------------------------------------");
console.log("📋 Teammate Next Steps:");
console.log("  1. Open .env.local and fill in your MONGODB_URI and Pusher keys.");
console.log("  2. Start the development server:");
console.log("     npm run dev");
console.log("-------------------------------------------------------------\n");
