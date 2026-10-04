import { Inject, Injectable } from '@nestjs/common';
import { MAILER } from './mail.constants';
import type { Mailer, MailerHealth, MailMessage } from './mailer.interface';

/**
 * The single entry point business code uses to send email.
 * Provider-agnostic: whatever is bound to MAILER handles delivery.
 */
@Injectable()
export class MailService {
  constructor(@Inject(MAILER) private readonly mailer: Mailer) {}

  get activeTransport(): string {
    return this.mailer.name;
  }

  get health(): MailerHealth {
    return this.mailer.health;
  }

  send(message: MailMessage): Promise<void> {
    return this.mailer.send(message);
  }
}
