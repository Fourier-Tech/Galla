// Force IST timezone on Vercel serverless functions
// This runs on every server startup / cold start
export function register() {
  process.env.TZ = "Asia/Kolkata";
}
