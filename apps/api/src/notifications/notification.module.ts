import { Global, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NOTIFIER } from './notification.constants';
import type { Notifier } from './notifier.interface';
import { LogNotifier } from './providers/log.notifier';
import { MailNotifier } from './providers/mail.notifier';
import { NotificationService } from './notification.service';
import { MailService } from '../mail/mail.service';

/**
 * Binds the notification transport selected by NOTIFY_TRANSPORT. This factory is
 * the ONLY place that knows about concrete channels. `log` prints to the console;
 * `mail` composes the existing mail seam (so it inherits MAIL_TRANSPORT).
 *
 * A future `expo-push` case would need device tokens, which the app does not
 * store yet — that is a model change, not a seam change, and nothing outside
 * this file would move.
 */
const notifierFactory: Provider = {
  provide: NOTIFIER,
  inject: [ConfigService, MailService],
  useFactory: (config: ConfigService, mail: MailService): Notifier => {
    const transport = config.getOrThrow<string>('notify.transport');
    switch (transport) {
      case 'log':
        return new LogNotifier();
      case 'mail':
        return new MailNotifier(mail);
      default:
        throw new Error(
          `Notification transport "${transport}" is not wired yet. ` +
            `Implement Notifier and add a case in notification.module.ts.`,
        );
    }
  },
};

@Global()
@Module({
  providers: [notifierFactory, NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
