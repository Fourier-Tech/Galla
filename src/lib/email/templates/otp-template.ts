import { renderBaseLayout } from "./base-layout";

export interface OtpTemplateOptions {
  salonName: string;
  otp: string;
  expiresInMinutes?: number;
  purpose?: string;
}

export function renderOtpEmail(options: OtpTemplateOptions): { html: string; text: string } {
  const {
    salonName,
    otp,
    expiresInMinutes = 15,
    purpose = "Role PIN Reset & Verification",
  } = options;

  const contentHtml = `
    <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #1c1917; line-height: 1.3;">
      Verification Code
    </h2>

    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #44403c;">
      A verification code was requested for <strong>${salonName}</strong> (${purpose}). Use the 6-digit code below to complete your request:
    </p>

    <!-- OTP Display Box -->
    <div style="margin: 20px 0; text-align: center;">
      <div style="display: inline-block; padding: 14px 28px; background-color: #faf5f7; border: 1.5px dashed #d8b4be; border-radius: 8px;">
        <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #8B4A5E;">
          ${otp}
        </span>
      </div>
    </div>

    <p style="margin: 0 0 10px 0; font-size: 13px; line-height: 1.5; color: #78716c;">
      &bull; This code is valid for <strong>${expiresInMinutes} minutes</strong>.<br>
      &bull; Do not share this OTP with anyone. FourierTech or Galla support will never ask for your code.
    </p>

    <p style="margin: 20px 0 0 0; padding-top: 16px; border-top: 1px solid #f0efe9; font-size: 12px; color: #a8a29e; line-height: 1.4;">
      If you did not initiate this request, you can safely ignore this email or review your salon account security settings.
    </p>
  `;

  const html = renderBaseLayout({
    title: `Your OTP is ${otp} — Galla`,
    previewText: `Your verification code is ${otp}. Valid for ${expiresInMinutes} minutes.`,
    salonName,
    contentHtml,
  });

  const text = `Galla Verification Code\n\nYour One-Time Password for ${salonName} (${purpose}) is:\n\n${otp}\n\nThis code is valid for ${expiresInMinutes} minutes.\nPlease do not share this code with anyone.\n\nIf you did not request this, you can safely ignore this email.\n\n— Galla Platform | FourierTech`;

  return { html, text };
}
