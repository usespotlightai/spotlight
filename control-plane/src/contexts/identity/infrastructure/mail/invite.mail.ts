import type {
  InviteMailPort,
  InviteToSend,
} from '@identity/application/ports/invite-mail.port';
import type { MailTransport } from '@identity/infrastructure/mail/mail.transport';
import { publicUrlOf } from '@platform/config/env';
import type { Env } from '@platform/config/env.schema';

const appUrl = (env: Env): string => publicUrlOf(env).replace(/\/+$/, '');

const escaped = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const listed = (names: readonly string[]): string =>
  names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

const onTeams = (names: readonly string[]): string => {
  if (names.length === 0) {
    return '';
  }

  return ` You will be on the ${listed(names)} ${names.length === 1 ? 'team' : 'teams'}.`;
};

export class InviteByMail implements InviteMailPort {
  constructor(
    private readonly mail: MailTransport,
    private readonly env: Env,
  ) {}

  linkTo(token: string): string {
    return `${appUrl(this.env)}/invites/${token}`;
  }

  async send(invite: InviteToSend): Promise<void> {
    const link = this.linkTo(invite.token);
    const subject = `${invite.invitedBy} invited you to join ${invite.workspaceName} on Spotlight`;

    await this.mail.deliver({
      to: invite.to,
      subject,
      text: [
        `${subject}.${onTeams(invite.teamNames)}`,
        '',
        'Accept the invitation:',
        link,
        '',
        'The link is yours alone and stops working in two weeks.',
        'If you were not expecting this, you can ignore this message.',
      ].join('\n'),
      html: this.body(invite, link),
    });
  }

  private body(invite: InviteToSend, link: string): string {
    const who = escaped(invite.invitedBy);
    const workspace = escaped(invite.workspaceName);
    const teams = escaped(onTeams(invite.teamNames));

    return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#18181b;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;">
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:24px;">
            <strong>${who}</strong> invited you to join <strong>${workspace}</strong>
            on Spotlight.${teams}
          </p>
          <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#52525b;">
            Spotlight is where this workspace runs its work with coding agents.
          </p>
          <a href="${escaped(link)}"
             style="display:inline-block;padding:10px 20px;border-radius:999px;background:#18181b;color:#ffffff;font-size:14px;font-weight:500;text-decoration:none;">
            Accept the invitation
          </a>
          <p style="margin:24px 0 0;font-size:12px;line-height:20px;color:#71717a;">
            The link is yours alone and stops working in two weeks. If you were
            not expecting this, you can ignore this message.
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
