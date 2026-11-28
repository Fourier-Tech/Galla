import { renderBaseLayout } from "./base-layout";

export interface PasswordResetTemplateOptions {
  salonName: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

export function renderPasswordResetEmail(options: PasswordResetTemplateOptions): { html: string; text: string } {
  const { salonName, resetUrl, expiresInMinutes = 30 } = options;

  const contentHtml = `
    <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #1c1917; line-height: 1.3;">
      Password Reset Request
    </h2>

    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #44403c;">
      We received a request to reset the password for your <strong>${salonName}</strong> account. Click the button below to set a new password:
    </p>

    <!-- Action Button -->
    <div style="margin: 24px 0; text-align: left;">
      <a href="${resetUrl}" style="display: inline-block; padding: 11px 24px; background-color: #8B4A5E; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 13.5px; box-shadow: 0 1px 2px rgba(0,0,0,0.06);">
        Reset Password &rarr;
      </a>
    </div>

    <p style="margin: 0 0 10px 0; font-size: 13px; line-height: 1.5; color: #78716c;">
      &bull; This link is valid for <strong>${expiresInMinutes} minutes</strong>.<br>
      &bull; If the button above does not work, copy and paste this URL into your browser:<br>
      <a href="${resetUrl}" style="color: #8B4A5E; word-break: break-all; font-size: 12px; text-decoration: underline;">
        ${resetUrl}
      </a>
    </p>

    <p style="margin: 20px 0 0 0; padding-top: 16px; border-top: 1px solid #f0efe9; font-size: 12px; color: #a8a29e; line-height: 1.4;">
      If you did not request a password reset, you can safely ignore this email. Your existing password remains secure.
    </p>
  `;

  const html = renderBaseLayout({
    title: `Reset your Galla password — ${salonName}`,
    previewText: `Password reset link for ${salonName}. Valid for ${expiresInMinutes} minutes.`,
    salonName,
    contentHtml,
  });

  const text = `Password Reset Request — ${salonName}\n\nClick the link below to reset your password (valid for ${expiresInMinutes} minutes):\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.\n\n— Galla Platform | FourierTech`;

  return { html, text };
}
