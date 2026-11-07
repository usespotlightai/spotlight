import type {
  InviteMailPort,
  InviteToSend,
} from '@identity/application/ports/invite-mail.port';
import { INVITE_LASTS_FOR_DAYS } from '@identity/domain/aggregates/workspace-invite.aggregate';
import { appUrl, escaped } from '@identity/infrastructure/mail/mail.format';
import { mailLayout } from '@identity/infrastructure/mail/mail.layout';
import type { MailTransport } from '@identity/infrastructure/mail/mail.transport';
import type { Env } from '@platform/config/env.schema';

const listed = (names: readonly string[]): string =>
  names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

const LASTS = `The link is yours alone and stops working in ${INVITE_LASTS_FOR_DAYS} days.`;

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
        LASTS,
        'If you were not expecting this, you can ignore this message.',
      ].join('\n'),
      html: this.body(invite, link),
    });
  }

  private body(invite: InviteToSend, link: string): string {
    return mailLayout({
      appUrl: appUrl(this.env),
      heading: `Join ${escaped(invite.workspaceName)} on Spotlight`,
      lead: `${escaped(invite.invitedBy)} invited you to join ${escaped(invite.workspaceName)} on Spotlight.${escaped(onTeams(invite.teamNames))}`,
      detail:
        'Spotlight is where this workspace runs its work with coding agents.',
      action: { label: 'Accept the invitation', href: link },
      footnote: `${LASTS} If you were not expecting this, you can ignore this message.`,
    });
  }
}
