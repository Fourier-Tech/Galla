import { EmailRecipient, SendEmailOptions, SendEmailResult, GALLA_EMAIL_IDENTITIES } from "./types";

const BREVO_API_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const BREVO_ACCOUNT_ENDPOINT = "https://api.brevo.com/v3/account";

/**
 * Normalizes one or more recipients into Brevo's expected format: [{ email, name }]
 */
function normalizeRecipients(
  recipients: EmailRecipient | string | (EmailRecipient | string)[]
): Array<{ email: string; name?: string }> {
  const list = Array.isArray(recipients) ? recipients : [recipients];
  return list.map((item) => {
    if (typeof item === "string") {
      const match = item.match(/^(?:"?([^"]*)"?\s)?(?:<)?([^>]+)(?:>)?$/);
      if (match && match[1]) {
        return { name: match[1].trim(), email: match[2].trim() };
      }
      return { email: item.trim() };
    }
    return {
      email: item.email.trim(),
      ...(item.name ? { name: item.name.trim() } : {}),
    };
  });
}

/**
 * Core Brevo Transactional Email Client
 * Dispatches transactional emails via Brevo REST API v3 using native fetch.
 * In development, provides a clean terminal mock when BREVO_API_KEY is not configured.
 */
export async function sendViaBrevo(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const recipients = normalizeRecipients(options.to);

  if (recipients.length === 0) {
    return { success: false, error: "No recipient specified." };
  }

  // 1. Primary Path: Brevo REST API v3
  if (apiKey) {
    const sender = GALLA_EMAIL_IDENTITIES.SENDER;

    // Context-aware Reply-To resolution:
    // Uses provided options.replyTo if specified; otherwise defaults to Galla Support
    let replyToObj: { email: string; name?: string } = GALLA_EMAIL_IDENTITIES.SUPPORT;
    if (options.replyTo) {
      const parsed = normalizeRecipients(options.replyTo)[0];
      if (parsed) replyToObj = parsed;
    }

    const payload: Record<string, any> = {
      sender,
      to: recipients,
      replyTo: replyToObj,
      subject: options.subject,
      htmlContent: options.html,
    };

    if (options.text) {
      payload.textContent = options.text;
    }

    if (options.tags && options.tags.length > 0) {
      payload.tags = options.tags;
    }

    if (options.headers) {
      payload.headers = options.headers;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(BREVO_API_ENDPOINT, {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data?.message || `Brevo API HTTP ${response.status}: ${response.statusText}`;
        console.error(`[Email/Brevo] API Error (${response.status}):`, errorMsg, data);
        return {
          success: false,
          error: errorMsg,
          provider: "brevo",
        };
      }

      console.log(
        `[Email/Brevo] Successfully sent "${options.subject}" to ${recipients
          .map((r) => r.email)
          .join(", ")} | Reply-To: ${replyToObj.name} <${replyToObj.email}> (Message-ID: ${data.messageId})`
      );

      return {
        success: true,
        messageId: data.messageId,
        provider: "brevo",
      };
    } catch (err: any) {
      const errorMsg = err.name === "AbortError" ? "Brevo API request timed out (15s)" : err.message;
      console.error("[Email/Brevo] Network/dispatch error:", errorMsg);
      return {
        success: false,
        error: errorMsg,
        provider: "brevo",
      };
    }
  }

  // 2. Development Mock Dispatch
  if (process.env.NODE_ENV !== "production") {
    const replyToObj = options.replyTo
      ? normalizeRecipients(options.replyTo)[0]
      : GALLA_EMAIL_IDENTITIES.SUPPORT;

    console.log("\n================ [EMAIL DEV MOCK DISPATCH] ================");
    console.log(`To: ${recipients.map((r) => `${r.name ? `${r.name} ` : ""}<${r.email}>`).join(", ")}`);
    console.log(`From: ${GALLA_EMAIL_IDENTITIES.SENDER.name} <${GALLA_EMAIL_IDENTITIES.SENDER.email}>`);
    console.log(`Reply-To: ${replyToObj.name} <${replyToObj.email}>`);
    console.log(`Subject: ${options.subject}`);
    console.log("-----------------------------------------------------------");
    console.log(options.text || "(No text content, HTML preview available in payload)");
    console.log("===========================================================\n");

    return {
      success: true,
      messageId: `mock-dev-${Date.now()}`,
      provider: "mock",
    };
  }

  return {
    success: false,
    error: "Brevo email delivery is unconfigured (missing BREVO_API_KEY).",
  };
}

/**
 * Verifies Brevo API key and connection health.
 * Supports both full account keys and restricted transactional-only keys.
 */
export async function verifyBrevoConnection(): Promise<{
  configured: boolean;
  valid: boolean;
  scope?: string;
  email?: string;
  plan?: string;
  credits?: number;
  error?: string;
}> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    return {
      configured: false,
      valid: false,
      error: "BREVO_API_KEY is not configured in environment.",
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Try transactional templates endpoint first (succeeds with transactional-scoped keys)
    const txResponse = await fetch("https://api.brevo.com/v3/smtp/templates", {
      method: "GET",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (txResponse.ok) {
      return {
        configured: true,
        valid: true,
        scope: "transactional-authorized",
      };
    }

    const data = await txResponse.json().catch(() => ({}));
    return {
      configured: true,
      valid: false,
      error: data.message || `Brevo API HTTP ${txResponse.status}: ${txResponse.statusText}`,
    };
  } catch (err: any) {
    return {
      configured: true,
      valid: false,
      error: err.name === "AbortError" ? "Brevo connection verification timed out" : err.message,
    };
  }
}
