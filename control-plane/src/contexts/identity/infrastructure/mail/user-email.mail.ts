import type {
  UserEmailMailPort,
  VerificationToSend,
} from '@identity/application/ports/user-email-mail.port';
import { appUrl, escaped } from '@identity/infrastructure/mail/mail.format';
import { mailLayout } from '@identity/infrastructure/mail/mail.layout';
import type { MailTransport } from '@identity/infrastructure/mail/mail.transport';
import type { Env } from '@platform/config/env.schema';

const SUBJECT = 'Verify your email for Spotlight';

export class UserEmailVerificationByMail implements UserEmailMailPort {
  constructor(
    private readonly mail: MailTransport,
    private readonly env: Env,
  ) {}

  linkTo(token: string): string {
    return `${appUrl(this.env)}/verify-email/${token}`;
  }

  async send(verification: VerificationToSend): Promise<void> {
    const link = this.linkTo(verification.token);

    await this.mail.deliver({
      to: verification.to,
      subject: SUBJECT,
      text: [
        `The Spotlight account ${verification.signInEmail} added this email address.`,
        'Once verified, Spotlight can recognize you by this email across connected services.',
        '',
        'Verify the email:',
        link,
        '',
        'The link stops working in 24 hours.',
        'If you did not add this address, you can ignore this message.',
      ].join('\n'),
      html: this.body(verification, link),
    });
  }

  private body(verification: VerificationToSend, link: string): string {
    return mailLayout({
      appUrl: appUrl(this.env),
      heading: 'Verify your email',
      lead: `The Spotlight account ${escaped(verification.signInEmail)} added this email address.`,
      detail:
        'Once verified, Spotlight can recognize you by this email across connected services.',
      action: { label: 'Verify the email', href: link },
      footnote:
        'The link stops working in 24 hours. If you did not add this address, you can ignore this message.',
    });
  }
}
