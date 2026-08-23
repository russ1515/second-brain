import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Mailer, MailMessage } from '../mailer.interface';

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
      .then(() => this.logger.log(`SMTP ready (${config.host}:${config.port})`))
      .catch((error: Error) =>
        this.logger.error(`SMTP connection failed: ${error.message}`),
      );
  }

  async send(message: MailMessage): Promise<void> {
    const info = await this.transporter.sendMail({
      from: this.config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    this.logger.log(
      `[email:smtp] sent to=${message.to} subject="${message.subject}" id=${info.messageId}`,
    );
  }
}
