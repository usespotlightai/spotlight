import type { Env } from '@infrastructure/config/env.schema';
import { InviteByMail } from '@infrastructure/mail/invite.mail';
import type {
  MailMessage,
  MailTransport,
} from '@infrastructure/mail/mail.transport';
import { describe, expect, it, vi } from 'vitest';

const sending = (over: Partial<Env> = {}) => {
  const delivered: MailMessage[] = [];
  const transport: MailTransport = {
    deliver: vi.fn(async (message) => {
      delivered.push(message);
    }),
  };

  const mail = new InviteByMail(transport, {
    BETTER_AUTH_URL: 'https://app.example.com',
    ...over,
  } as Env);

  return { mail, delivered };
};

const invite = {
  to: 'ada@example.com',
  token: 'tok-123',
  teamName: 'Platform',
  workspaceName: 'Acme',
  invitedBy: 'Leon Liang',
};

describe('InviteByMail', () => {
  it('points the link at the app, at the invite it stands for', async () => {
    const { mail, delivered } = sending();

    await mail.send(invite);

    expect(delivered[0]?.text).toContain(
      'https://app.example.com/invites/tok-123',
    );
    expect(delivered[0]?.html).toContain(
      'https://app.example.com/invites/tok-123',
    );
  });

  it('points at where the deployment is published, where that differs', async () => {
    const { mail, delivered } = sending({
      SPOTLIGHT_PUBLIC_URL: 'https://spotlight.acme.com/',
    });

    await mail.send(invite);

    expect(delivered[0]?.text).toContain(
      'https://spotlight.acme.com/invites/tok-123',
    );
  });

  it('says who asked and what they were asked onto', async () => {
    const { mail, delivered } = sending();

    await mail.send(invite);

    expect(delivered[0]?.to).toBe('ada@example.com');
    expect(delivered[0]?.subject).toBe(
      'Leon Liang invited you to Platform on Spotlight',
    );
    expect(delivered[0]?.text).toContain('Acme');
  });

  it('leaves nothing in a name to be read as markup', async () => {
    const { mail, delivered } = sending();

    await mail.send({ ...invite, teamName: '<script>alert(1)</script>' });

    expect(delivered[0]?.html).not.toContain('<script>');
    expect(delivered[0]?.html).toContain('&lt;script&gt;');
  });

  it('reads plainly where the styling is stripped', async () => {
    const { mail, delivered } = sending();

    await mail.send(invite);

    expect(delivered[0]?.text).not.toContain('<');
  });
});
