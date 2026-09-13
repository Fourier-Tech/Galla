import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const rootDir = process.cwd();
const envExamplePath = path.join(rootDir, ".env.example");
const envLocalPath = path.join(rootDir, ".env.local");

console.log("\n🚀 Setting up Galla workspace for local development...\n");

// 1. Check if .env.example exists
if (!fs.existsSync(envExamplePath)) {
  console.error("❌ Error: .env.example file not found!");
  process.exit(1);
}

// 2. Handle .env.local creation
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
