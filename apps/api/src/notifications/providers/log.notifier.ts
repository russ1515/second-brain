import { Logger } from '@nestjs/common';
import type { NotificationMessage, Notifier } from '../notifier.interface';

/**
 * Development transport: logs the nudge to the API console instead of sending
 * it, so the journey can be exercised with no mail secret and no device.
 */
export class LogNotifier implements Notifier {
  readonly name = 'log';
  private readonly logger = new Logger(LogNotifier.name);

  send(message: NotificationMessage): Promise<void> {
    this.logger.log(
      `[notify:log] to=${message.email} title="${message.title}"\n${message.body}`,
    );
    return Promise.resolve();
  }
}
