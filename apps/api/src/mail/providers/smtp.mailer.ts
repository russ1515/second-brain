import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Mailer, MailerHealth, MailMessage } from '../mailer.interface';

/** Config the SMTP transport needs. Built from env in mail.module.ts so this
 *  class never reads process.env directly (stays testable, seam-friendly). */
export interface SmtpMailerConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/**
 * Production transport: sends over SMTP via nodemailer (Gmail, SES, Postmark,
 * any SMTP host). Selected by MAIL_TRANSPORT=smtp. Implements the same Mailer
 * contract as LogMailer, so no business code changes when switching to it.
 */
export class SmtpMailer implements Mailer {
  readonly name = 'smtp';
  private readonly logger = new Logger(SmtpMailer.name);
  private readonly transporter: nodemailer.Transporter;
  private healthState: MailerHealth = { status: 'UNKNOWN', observedAt: null };
  /** A startup handshake is point-in-time evidence, never durable health. */
  private static readonly healthMaxAgeMs = 5 * 60 * 1_000;

  constructor(private readonly config: SmtpMailerConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });

    // Verify the connection once at startup so a bad credential/host surfaces
    // in the logs immediately instead of on the first user registration.
    this.transporter
      .verify()
      .then(() => {
        this.healthState = { status: 'HEALTHY', observedAt: new Date().toISOString() };
        this.logger.log('SMTP ready');
      })
      // SMTP errors can embed a URL or credential-derived detail. Keep logs
      // operationally useful without making them a secret transport.
      .catch(() => {
        this.healthState = { status: 'UNAVAILABLE', observedAt: new Date().toISOString() };
        this.logger.error('SMTP connection verification failed');
      });
  }

  get health(): MailerHealth {
    if (!this.healthState.observedAt) return this.healthState;

    const observedAt = Date.parse(this.healthState.observedAt);
    if (!Number.isFinite(observedAt) || Date.now() - observedAt > SmtpMailer.healthMaxAgeMs) {
      return { status: 'UNKNOWN', observedAt: this.healthState.observedAt };
    }

    return this.healthState;
  }

  async send(message: MailMessage): Promise<void> {
    const info = await this.transporter.sendMail({
      from: this.config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    void info;
    // Recipient, subject and message ID are personal/content data and do not
    // belong in application logs.
    this.logger.log('[email:smtp] sent');
  }
}
