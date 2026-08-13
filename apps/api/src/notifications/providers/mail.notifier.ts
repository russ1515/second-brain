import type { MailService } from '../../mail/mail.service';
import type { NotificationMessage, Notifier } from '../notifier.interface';

/**
 * Delivers nudges as email by COMPOSING the existing mail seam rather than
 * duplicating it: whatever MAIL_TRANSPORT is configured (log today, SMTP/SES
 * later) is what carries the notification. Nothing here knows about SMTP.
 */
export class MailNotifier implements Notifier {
  readonly name = 'mail';

  constructor(private readonly mail: MailService) {}

  send(message: NotificationMessage): Promise<void> {
    return this.mail.send({
      to: message.email,
      subject: message.title,
      text: message.body,
    });
  }
}
