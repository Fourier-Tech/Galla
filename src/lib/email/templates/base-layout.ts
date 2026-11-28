/**
 * Luxury Editorial Email Base Layout — Galla Platform / FourierTech
 * Responsive, table-based HTML email shell adhering to Galla luxury design tokens.
 */

export interface BaseEmailLayoutOptions {
  title: string;
  previewText?: string;
  salonName?: string;
  contentHtml: string;
  supportEmail?: string;
  year?: number;
}

export function renderBaseLayout(options: BaseEmailLayoutOptions): string {
  const {
    title,
    previewText,
    salonName,
    contentHtml,
    supportEmail = process.env.EMAIL_REPLY_TO_ADDRESS || "contact@fouriertech.in",
    year = new Date().getFullYear(),
  } = options;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #fafaf7; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; border-left: none !important; border-right: none !important; }
      .content-padding { padding: 24px 20px !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #fafaf7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  ${
    previewText
      ? `<div style="display: none; font-size: 1px; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
          ${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
        </div>`
      : ""
  }

  <!-- Main Container -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding: 0 12px;">
        <table role="presentation" class="email-container" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border: 1px solid #e5e4de; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 20px 28px; background-color: #ffffff; border-bottom: 1px solid #f0efe9;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 20px; font-weight: 800; color: #8B4A5E; letter-spacing: -0.5px;">Galla</span>
                    <span style="font-size: 11px; color: #78716c; margin-left: 8px; font-weight: 500;">
                      ${salonName ? `&bull;&nbsp; ${salonName}` : "Salon Management Platform"}
                    </span>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <a href="https://galla.fouriertech.in" style="font-size: 11px; color: #a8a29e; text-decoration: none; font-weight: 500;">
                      galla.fouriertech.in
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td class="content-padding" style="padding: 32px 28px; color: #1c1917; font-size: 14px; line-height: 1.55;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 28px; background-color: #fafaf7; border-top: 1px solid #f0efe9; font-size: 11.5px; line-height: 1.5; color: #78716c;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <p style="margin: 0 0 6px 0; font-weight: 600; color: #44403c;">
                      Galla Platform &bull; A Product of FourierTech
                    </p>
                    <p style="margin: 0 0 8px 0; color: #78716c;">
                      This is an automated transactional notification. If you have questions, please reach out to our team at 
                      <a href="mailto:${supportEmail}" style="color: #8B4A5E; text-decoration: underline; font-weight: 500;">
                        ${supportEmail}
                      </a>.
                    </p>
                    <p style="margin: 0; color: #a8a29e; font-size: 10.5px;">
                      &copy; ${year} FourierTech. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
