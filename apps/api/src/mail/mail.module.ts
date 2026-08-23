import { Global, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAILER } from './mail.constants';
import type { Mailer } from './mailer.interface';
import { LogMailer } from './providers/log.mailer';
import { SmtpMailer } from './providers/smtp.mailer';
import { MailService } from './mail.service';

/**
 * Binds the concrete mail transport selected by MAIL_TRANSPORT. This factory is
 * the ONLY place that knows about concrete transports. To add SMTP/SES/Postmark:
 * implement Mailer and add a case below — no business code changes.
 */
const mailerFactory: Provider = {
  provide: MAILER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Mailer => {
    const transport = config.getOrThrow<string>('mail.transport');
    switch (transport) {
      case 'log':
        return new LogMailer();
      case 'smtp':
        return new SmtpMailer({
          host: config.getOrThrow<string>('mail.smtp.host'),
          port: config.getOrThrow<number>('mail.smtp.port'),
          secure: config.getOrThrow<boolean>('mail.smtp.secure'),
          user: config.getOrThrow<string>('mail.smtp.user'),
          pass: config.getOrThrow<string>('mail.smtp.pass'),
          from: config.getOrThrow<string>('mail.from'),
        });
      default:
        throw new Error(
          `Mail transport "${transport}" is not wired yet. ` +
            `Implement Mailer and add a case in mail.module.ts.`,
        );
    }
  },
};

@Global()
@Module({
  providers: [mailerFactory, MailService],
  exports: [MailService],
})
export class MailModule {}
