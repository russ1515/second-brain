import { Logger } from '@nestjs/common';
import type { NotificationMessage, Notifier } from '../notifier.interface';

/**
 * Development transport: records a simulated nudge without exposing its
 * recipient or contents, so the journey can be exercised with no mail secret
 * and no device.
 */
export class LogNotifier implements Notifier {
  readonly name = 'log';
  private readonly logger = new Logger(LogNotifier.name);

  send(_message: NotificationMessage): Promise<void> {
    this.logger.log('Development notification delivery simulated.');
    return Promise.resolve();
  }
}
