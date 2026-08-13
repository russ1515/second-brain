import { Logger } from '@nestjs/common';
import type { Mailer, MailMessage } from '../mailer.interface';

/**
 * Development transport: instead of sending, it logs the message so the token/
 * link is visible in the API console. Lets the app run with no SMTP secret.
 */
export class LogMailer implements Mailer {
  readonly name = 'log';
  private readonly logger = new Logger(LogMailer.name);

  send(message: MailMessage): Promise<void> {
    this.logger.log(
      `[email:log] to=${message.to} subject="${message.subject}"\n${message.text}`,
    );
    return Promise.resolve();
  }
}
