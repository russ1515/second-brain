import { Logger } from '@nestjs/common';
import type { Mailer, MailerHealth, MailMessage } from '../mailer.interface';

/**
 * Development transport: records a simulated message without exposing its
 * recipient, contents, token, or link. Lets the app run with no SMTP secret.
 */
export class LogMailer implements Mailer {
  readonly name = 'log';
  private readonly logger = new Logger(LogMailer.name);

  get health(): MailerHealth {
    return { status: 'NOT_INSTRUMENTED', observedAt: null };
  }

  send(_message: MailMessage): Promise<void> {
    this.logger.log('Development email delivery simulated.');
    return Promise.resolve();
  }
}
