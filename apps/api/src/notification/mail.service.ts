import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Recipient } from './domain/audience';

/** The only class that knows how mail leaves the app (Nodemailer → Mailpit in dev). */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from = config.getOrThrow<string>('MAIL_FROM');
    this.transport =
      config.get('MAIL_TRANSPORT') === 'json'
        ? createTransport({ jsonTransport: true })
        : createTransport({
            host: config.getOrThrow<string>('SMTP_HOST'),
            port: config.getOrThrow<number>('SMTP_PORT'),
            secure: false,
          });
  }

  /**
   * A failed send is logged, never thrown: the request that caused the email has already succeeded, and a
   * mail server being down must not turn it into an error.
   */
  async send(to: Recipient, mail: { subject: string; html: string }): Promise<void> {
    try {
      await this.transport.sendMail({
        from: this.from,
        to: { name: to.name, address: to.email },
        ...mail,
      });
    } catch (e) {
      this.logger.error(`Could not email user ${to.userId}: ${(e as Error).message}`);
    }
  }
}
