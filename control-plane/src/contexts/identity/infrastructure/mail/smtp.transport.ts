import type {
  MailMessage,
  MailTransport,
} from '@identity/infrastructure/mail/mail.transport';
import type { Env } from '@platform/config/env.schema';
import { createTransport, type Transporter } from 'nodemailer';

export class SmtpMail implements MailTransport {
  private readonly transport: Transporter;

  constructor(
    url: string,
    private readonly from: string,
  ) {
    this.transport = createTransport(url);
  }

  static configured(env: Env): SmtpMail | null {
    return env.SMTP_URL ? new SmtpMail(env.SMTP_URL, env.MAIL_FROM) : null;
  }

  async deliver(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
