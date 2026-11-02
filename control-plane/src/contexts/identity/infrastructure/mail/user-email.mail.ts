import type {
  UserEmailMailPort,
  VerificationToSend,
} from '@identity/application/ports/user-email-mail.port';
import { appUrl, escaped } from '@identity/infrastructure/mail/mail.format';
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
    const account = escaped(verification.signInEmail);

    return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#18181b;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;">
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:24px;">
            The Spotlight account <strong>${account}</strong> added this email address.
          </p>
          <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#52525b;">
            Once verified, Spotlight can recognize you by this email across connected services.
          </p>
          <a href="${escaped(link)}"
             style="display:inline-block;padding:10px 20px;border-radius:999px;background:#18181b;color:#ffffff;font-size:14px;font-weight:500;text-decoration:none;">
            Verify the email
          </a>
          <p style="margin:24px 0 0;font-size:12px;line-height:20px;color:#71717a;">
            The link stops working in 24 hours. If you did not add this address,
            you can ignore this message.
          </p>
          <p style="margin:16px 0 0;font-size:12px;line-height:20px;color:#a1a1aa;word-break:break-all;">
            ${escaped(link)}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }
}
