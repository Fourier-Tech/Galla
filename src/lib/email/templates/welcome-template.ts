import { renderBaseLayout } from "./base-layout";

export interface WelcomeTemplateOptions {
  salonName: string;
  ownerName?: string;
  loginUrl?: string;
  tempPassword?: string;
}

export function renderWelcomeEmail(options: WelcomeTemplateOptions): { html: string; text: string } {
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://galla.fouriertech.in";
  const {
    salonName,
    ownerName,
    loginUrl = `${appBaseUrl}/login`,
    tempPassword,
  } = options;

  const greeting = ownerName ? `Hello ${ownerName},` : "Hello,";

  const contentHtml = `
    <h2 style="margin: 0 0 12px 0; font-size: 19px; font-weight: 700; color: #1c1917; line-height: 1.3;">
      Welcome to Galla Platform
    </h2>

    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.55; color: #44403c;">
      ${greeting} your account for <strong>${salonName}</strong> has been provisioned and is ready for use.
    </p>

    <!-- Account Details Card -->
    <div style="margin: 20px 0; padding: 18px 22px; background-color: #fafaf7; border: 1px solid #e5e4de; border-radius: 6px;">
      <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #1c1917;">
        Salon Workspace Details:
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 1.6; color: #44403c;">
        <tr>
          <td style="width: 120px; color: #78716c;">Salon Name:</td>
          <td><strong>${salonName}</strong></td>
        </tr>
        <tr>
          <td style="color: #78716c;">Access Portal:</td>
          <td><a href="${loginUrl}" style="color: #8B4A5E; text-decoration: underline;">${loginUrl}</a></td>
        </tr>
        ${
          tempPassword
            ? `<tr>
                <td style="color: #78716c;">Initial Password:</td>
                <td><code style="font-family: monospace; background: #f0efe9; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${tempPassword}</code></td>
              </tr>`
            : ""
        }
      </table>
    </div>

    <!-- Call to action button -->
    <div style="margin: 26px 0; text-align: left;">
      <a href="${loginUrl}" style="display: inline-block; padding: 11px 24px; background-color: #8B4A5E; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 13.5px; box-shadow: 0 1px 2px rgba(0,0,0,0.06);">
        Log in to Dashboard &rarr;
      </a>
    </div>

    <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #1c1917;">
      What you can do right away:
    </p>
    <ul style="margin: 0 0 18px 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #57534e;">
      <li>Manage counter orders, packages, and advance payments.</li>
      <li>Organize your catalog of treatments and retail inventory.</li>
      <li>Set up your staff counter PINs for fast, secure daily operations.</li>
    </ul>

    <p style="margin: 20px 0 0 0; padding-top: 16px; border-top: 1px solid #f0efe9; font-size: 12px; color: #78716c; line-height: 1.4;">
      Need assistance onboarding your staff? Contact our support team at <a href="mailto:contact@fouriertech.in" style="color: #8B4A5E; text-decoration: underline;">contact@fouriertech.in</a>.
    </p>
  `;

  const html = renderBaseLayout({
    title: `Welcome to Galla — ${salonName}`,
    previewText: `Your Galla workspace for ${salonName} is live and ready for use.`,
    salonName,
    contentHtml,
  });

  const text = `Welcome to Galla Platform\n\n${greeting} Your account for ${salonName} has been provisioned.\n\nAccess Portal: ${loginUrl}\n${tempPassword ? `Initial Password: ${tempPassword}\n` : ""}\nLog in to begin managing your salon counter, catalog, and inventory.\n\nSupport: contact@fouriertech.in\n— Galla Platform | FourierTech`;

  return { html, text };
}
