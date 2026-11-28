import { NextRequest, NextResponse } from "next/server";
import { verifyEmailConfig, sendEmail, GALLA_EMAIL_IDENTITIES } from "@/lib/email/email-service";
import { renderOtpEmail } from "@/lib/email/templates/otp-template";
import { renderWelcomeEmail } from "@/lib/email/templates/welcome-template";
import { renderOrderReceiptEmail } from "@/lib/email/templates/order-receipt-template";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

/**
 * Checks authorization for the diagnostic test endpoint.
 */
async function isAuthorized(request: NextRequest): Promise<boolean> {
  // Always allowed in local development
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  // Check shared secret header or query param
  const expectedSecret = process.env.CRON_SECRET || process.env.AUTH_SECRET;
  const providedSecret =
    request.headers.get("x-admin-secret") ||
    request.nextUrl.searchParams.get("secret");

  if (expectedSecret && providedSecret === expectedSecret) {
    return true;
  }

  // Check admin session
  try {
    const session = await auth();
    if (session?.user && (session.user as any).role === "owner") {
      return true;
    }
  } catch {
    // Ignore auth session error
  }

  return false;
}

/**
 * GET /api/admin/test-email
 * Checks Brevo connection status or sends a test email if ?to=recipient@example.com is provided.
 */
export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const to = request.nextUrl.searchParams.get("to");
  const type = request.nextUrl.searchParams.get("type") || "otp"; // "otp" | "welcome" | "receipt"

  // If no recipient is provided, return connection status
  if (!to) {
    const status = await verifyEmailConfig();
    return NextResponse.json({
      service: "Brevo Transactional Email",
      domain: "fouriertech.in",
      identities: {
        sender: `${process.env.EMAIL_FROM_NAME || "Galla"} <${process.env.EMAIL_FROM_ADDRESS || "noreply@fouriertech.in"}>`,
        supportReplyTo: `${process.env.EMAIL_SUPPORT_ADDRESS || "galla.support@fouriertech.in"}`,
        billingReplyTo: `${process.env.EMAIL_BILLING_ADDRESS || "galla.billing@fouriertech.in"}`,
        contactReplyTo: `${process.env.EMAIL_CONTACT_ADDRESS || "galla.contact@fouriertech.in"}`,
      },
      status,
      help: "Provide ?to=your-email@example.com&type=otp|receipt|welcome to dispatch a live test email.",
    });
  }

  // Dispatch live test email
  let html = "";
  let text = "";
  let subject = "";

  if (type === "welcome") {
    const res = renderWelcomeEmail({
      salonName: "Aashika Beauty Care (Test)",
      ownerName: "Salon Owner",
      loginUrl: "https://galla.fouriertech.in/login",
      tempPassword: "demo-password-123",
    });
    html = res.html;
    text = res.text;
    subject = "[Test] Welcome to Galla Platform — FourierTech";
  } else if (type === "receipt") {
    const res = renderOrderReceiptEmail({
      customerName: "Priya Sharma",
      salonName: "Aashika Beauty Care",
      orderNumber: "ORD-9901",
      items: [
        { name: "Diamond Facial Treatment", type: "service", price: 1200, qty: 1 },
        { name: "Hair Spa & Conditioning", type: "service", price: 850, qty: 1 },
        { name: "Moroccan Argan Hair Serum", type: "product", price: 650, qty: 1 },
      ],
      subtotal: 2700,
      discountAmount: 200,
      totalAmount: 2500,
      advancePaid: 2500,
      dueAmount: 0,
      paymentMode: "UPI",
    });
    html = res.html;
    text = res.text;
    subject = "[Test] Receipt for ORD-9901 — Aashika Beauty Care";
  } else {
    // Default: OTP
    const res = renderOtpEmail({
      salonName: "Aashika Beauty Care",
      otp: "849201",
      expiresInMinutes: 15,
      purpose: "System Diagnostic Test",
    });
    html = res.html;
    text = res.text;
    subject = "[Test] Your verification code is 849201 — Galla";
  }

  const replyTo =
    type === "receipt"
      ? GALLA_EMAIL_IDENTITIES.BILLING
      : type === "welcome"
      ? GALLA_EMAIL_IDENTITIES.CONTACT
      : GALLA_EMAIL_IDENTITIES.SUPPORT;

  const result = await sendEmail({
    to,
    subject,
    html,
    text,
    replyTo,
    tags: ["test", type],
  });

  return NextResponse.json({
    recipient: to,
    type,
    result,
  });
}

/**
 * POST /api/admin/test-email
 * Accepts JSON: { to: string, type?: "otp" | "welcome" | "receipt" }
 */
export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const to = body.to;
    const type = body.type || "otp";

    if (!to) {
      return NextResponse.json({ error: "Recipient email ('to') is required." }, { status: 400 });
    }

    const fakeUrl = new URL(request.url);
    fakeUrl.searchParams.set("to", to);
    fakeUrl.searchParams.set("type", type);

    const fakeReq = new NextRequest(fakeUrl, { headers: request.headers });
    return GET(fakeReq);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Invalid JSON body" }, { status: 400 });
  }
}
