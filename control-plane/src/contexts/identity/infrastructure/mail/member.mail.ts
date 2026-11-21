import type {
  MemberMailKind,
  MemberMailPort,
  MemberMailToSend,
} from '@identity/application/ports/member-mail.port';
import { appUrl, escaped } from '@identity/infrastructure/mail/mail.format';
import { mailLayout } from '@identity/infrastructure/mail/mail.layout';
import type { MailTransport } from '@identity/infrastructure/mail/mail.transport';
import type { Env } from '@platform/config/env.schema';

const FOOTNOTE =
  'If you think this is a mistake, ask an admin of the workspace.';

const subjectOf = (kind: MemberMailKind, workspaceName: string): string => {
  switch (kind) {
    case 'suspended':
      return `Your access to ${workspaceName} on Spotlight is suspended`;
    case 'unsuspended':
      return `Your access to ${workspaceName} on Spotlight is back`;
    case 'left':
      return `You left ${workspaceName} on Spotlight`;
  }
};

const detailOf = (mail: MemberMailToSend): string => {
  switch (mail.kind) {
    case 'suspended':
      return `${mail.by ?? 'An admin'} suspended your access. Your work stays in the workspace, and an admin can restore your access.`;
    case 'unsuspended':
      return `${mail.by ?? 'An admin'} restored your access. You can sign in to the workspace again.`;
    case 'left':
      return 'You left the workspace. Your work stays in the workspace, and an admin can restore your access.';
  }
};

export class MemberByMail implements MemberMailPort {
  constructor(
    private readonly mail: MailTransport,
    private readonly env: Env,
  ) {}

  async send(mail: MemberMailToSend): Promise<void> {
    const subject = subjectOf(mail.kind, mail.workspaceName);
    const detail = detailOf(mail);

    await this.mail.deliver({
      to: mail.to,
      subject,
      text: [`${subject}.`, '', detail, '', FOOTNOTE].join('\n'),
      html: mailLayout({
        appUrl: appUrl(this.env),
        heading: escaped(subject),
        lead: escaped(detail),
        detail: escaped(`Workspace: ${mail.workspaceName}`),
        action: { label: 'Open Spotlight', href: appUrl(this.env) },
        footnote: escaped(FOOTNOTE),
      }),
    });
  }
}
