/** A single outbound nudge. Transport-agnostic. */
export interface NotificationMessage {
  /** Recipient's email — the only address the app currently holds. A future
   *  push transport would use a device token instead; see notification.module. */
  email: string;
  title: string;
  body: string;
}

/**
 * Contract every notification transport must satisfy. Business code depends on
 * this interface only — never on a concrete channel. Adding Expo push means
 * writing a new class and wiring it in notification.module.ts (mirrors the
 * Mailer / LLM / Speech seams).
 */
export interface Notifier {
  readonly name: string;
  send(message: NotificationMessage): Promise<void>;
}
