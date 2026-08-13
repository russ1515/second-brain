/** A single outbound email. Transport-agnostic. */
export interface MailMessage {
  to: string;
  subject: string;
  /** Plain-text body (always provided). */
  text: string;
  /** Optional HTML body. */
  html?: string;
}

/**
 * Contract every mail transport must satisfy. Business code depends on this
 * interface only — never on a concrete SMTP/provider SDK. Adding SES/Postmark/
 * SMTP means writing a new class and wiring it in mail.module.ts; nothing else
 * changes (mirrors the LLMProvider seam).
 */
export interface Mailer {
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}
