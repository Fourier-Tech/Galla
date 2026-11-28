import { renderBaseLayout } from "./base-layout";
import { OrderReceiptItem } from "../types";

export interface OrderReceiptTemplateOptions {
  customerName: string;
  salonName: string;
  orderNumber: string;
  items: OrderReceiptItem[];
  subtotal: number;
  discountAmount?: number;
  totalAmount: number;
  advancePaid?: number;
  dueAmount?: number;
  paymentMode?: string;
  date?: Date | string;
}

export function renderOrderReceiptEmail(options: OrderReceiptTemplateOptions): { html: string; text: string } {
  const {
    customerName,
    salonName,
    orderNumber,
    items,
    subtotal,
    discountAmount = 0,
    totalAmount,
    advancePaid = 0,
    dueAmount = 0,
    paymentMode = "Cash",
    date = new Date(),
  } = options;

  const formattedDate = new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemRowsHtml = items
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #f0efe9;">
        <td style="padding: 10px 0; vertical-align: top;">
          <div style="font-weight: 600; color: #1c1917; font-size: 13.5px;">${item.name}</div>
          ${
            item.type
              ? `<div style="font-size: 11px; color: #78716c; text-transform: capitalize;">${item.type}</div>`
              : ""
          }
        </td>
        <td style="padding: 10px 8px; text-align: center; vertical-align: top; color: #78716c; font-size: 13px;">
          ${item.qty ?? 1}
        </td>
        <td style="padding: 10px 0; text-align: right; vertical-align: top; font-weight: 600; color: #1c1917; font-size: 13.5px; font-family: monospace;">
          ₹${(item.price * (item.qty ?? 1)).toLocaleString("en-IN")}
        </td>
      </tr>`
    )
    .join("");

  const contentHtml = `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td>
          <span style="display: inline-block; padding: 3px 8px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">
            Order Receipt
          </span>
          <h2 style="margin: 8px 0 4px 0; font-size: 18px; font-weight: 700; color: #1c1917;">
            ${orderNumber}
          </h2>
          <p style="margin: 0 0 16px 0; font-size: 12.5px; color: #78716c;">
            ${formattedDate} &bull; ${salonName}
          </p>
        </td>
      </tr>
    </table>

    <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.5; color: #44403c;">
      Hello <strong>${customerName}</strong>, thank you for visiting <strong>${salonName}</strong>. Here is the receipt for your order:
    </p>

    <!-- Itemized List -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
      <thead>
        <tr style="border-bottom: 1.5px solid #e5e4de; font-size: 11px; font-weight: 700; color: #78716c; text-transform: uppercase; letter-spacing: 0.5px;">
          <th align="left" style="padding-bottom: 8px;">Item</th>
          <th align="center" style="padding-bottom: 8px; width: 50px;">Qty</th>
          <th align="right" style="padding-bottom: 8px; width: 90px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRowsHtml}
      </tbody>
    </table>

    <!-- Totals Table -->
    <div style="background-color: #fafaf7; border: 1px solid #e5e4de; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 1.7; color: #44403c;">
        <tr>
          <td>Subtotal:</td>
          <td align="right" style="font-family: monospace;">₹${subtotal.toLocaleString("en-IN")}</td>
        </tr>
        ${
          discountAmount > 0
            ? `<tr>
                <td style="color: #166534;">Discount Applied:</td>
                <td align="right" style="color: #166534; font-family: monospace;">-₹${discountAmount.toLocaleString("en-IN")}</td>
              </tr>`
            : ""
        }
        <tr style="font-size: 15px; font-weight: 700; color: #1c1917; border-top: 1px solid #e5e4de; padding-top: 6px;">
          <td style="padding-top: 6px;">Total Bill:</td>
          <td align="right" style="padding-top: 6px; font-family: monospace; color: #8B4A5E;">
            ₹${totalAmount.toLocaleString("en-IN")}
          </td>
        </tr>
        ${
          advancePaid > 0
            ? `<tr>
                <td style="font-size: 12.5px; color: #78716c;">Amount Paid (${paymentMode}):</td>
                <td align="right" style="font-family: monospace; font-size: 12.5px; color: #166534;">
                  ₹${advancePaid.toLocaleString("en-IN")}
                </td>
              </tr>`
            : ""
        }
        ${
          dueAmount > 0
            ? `<tr>
                <td style="font-size: 12.5px; font-weight: 600; color: #991b1b;">Balance Due:</td>
                <td align="right" style="font-family: monospace; font-size: 12.5px; font-weight: 700; color: #991b1b;">
                  ₹${dueAmount.toLocaleString("en-IN")}
                </td>
              </tr>`
            : ""
        }
      </table>
    </div>

    <p style="margin: 0; font-size: 12.5px; line-height: 1.5; color: #78716c; text-align: center;">
      Thank you for choosing <strong>${salonName}</strong>! We look forward to serving you again.
    </p>
  `;

  const html = renderBaseLayout({
    title: `Receipt for ${orderNumber} — ${salonName}`,
    previewText: `Receipt for order ${orderNumber} at ${salonName}. Total: ₹${totalAmount.toLocaleString("en-IN")}.`,
    salonName,
    contentHtml,
  });

  const text = `Order Receipt: ${orderNumber}\n${salonName} — ${formattedDate}\n\nCustomer: ${customerName}\n\nItems:\n${items
    .map((i) => `- ${i.name} (x${i.qty ?? 1}): ₹${i.price * (i.qty ?? 1)}`)
    .join("\n")}\n\nSubtotal: ₹${subtotal}\n${discountAmount > 0 ? `Discount: -₹${discountAmount}\n` : ""}Total: ₹${totalAmount}\n${
    advancePaid > 0 ? `Paid: ₹${advancePaid} (${paymentMode})\n` : ""
  }${dueAmount > 0 ? `Due: ₹${dueAmount}\n` : ""}\nThank you for choosing ${salonName}!\n— Galla Platform | FourierTech`;

  return { html, text };
}
