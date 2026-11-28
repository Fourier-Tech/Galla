import { renderBaseLayout } from "./base-layout";

export interface NotificationTemplateOptions {
  title: string;
  message: string;
  salonName?: string;
  actionUrl?: string;
  actionLabel?: string;
}

export function renderNotificationEmail(options: NotificationTemplateOptions): { html: string; text: string } {
  const { title, message, salonName, actionUrl, actionLabel = "View in Dashboard" } = options;

  const contentHtml = `
    <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #1c1917; line-height: 1.3;">
      ${title}
    </h2>

    <div style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #44403c; white-space: pre-line;">
      ${message}
    </div>

    ${
      actionUrl
        ? `<div style="margin: 24px 0 16px 0; text-align: left;">
            <a href="${actionUrl}" style="display: inline-block; padding: 11px 24px; background-color: #8B4A5E; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 13.5px; box-shadow: 0 1px 2px rgba(0,0,0,0.06);">
              ${actionLabel} &rarr;
            </a>
          </div>`
        : ""
    }

    <p style="margin: 20px 0 0 0; padding-top: 16px; border-top: 1px solid #f0efe9; font-size: 11.5px; color: #a8a29e; line-height: 1.4;">
      This notification was automatically dispatched by the Galla Platform system.
    </p>
  `;

  const html = renderBaseLayout({
    title: `${title} — Galla`,
    previewText: message.slice(0, 100),
    salonName,
    contentHtml,
  });

  const text = `${title}\n\n${message}\n\n${actionUrl ? `${actionLabel}: ${actionUrl}\n\n` : ""}— Galla Platform | FourierTech`;

  return { html, text };
}
