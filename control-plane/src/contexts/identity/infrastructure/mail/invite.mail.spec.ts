import { InviteByMail } from '@identity/infrastructure/mail/invite.mail';
import type {
  MailMessage,
  MailTransport,
} from '@identity/infrastructure/mail/mail.transport';
import type { Env } from '@platform/config/env.schema';
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
  workspaceName: 'Acme',
  teamNames: ['Platform'],
  invitedBy: 'Leon Liang',
};

describe('InviteByMail', () => {
  it('points the link at the app, at the invite it is for', async () => {
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

  it('says who asked and which workspace they were asked into', async () => {
    const { mail, delivered } = sending();

    await mail.send(invite);

    expect(delivered[0]?.to).toBe('ada@example.com');
    expect(delivered[0]?.subject).toBe(
      'Leon Liang invited you to join Acme on Spotlight',
    );
  });

  it('names the teams they will be on', async () => {
    const { mail, delivered } = sending();

    await mail.send({
      ...invite,
      teamNames: ['Platform', 'Mobile', 'Data'],
    });

    expect(delivered[0]?.text).toContain(
      'You will be on the Platform, Mobile and Data teams.',
    );
    expect(delivered[0]?.html).toContain('Platform, Mobile and Data teams');
  });

  it('names one team as one team', async () => {
    const { mail, delivered } = sending();

    await mail.send(invite);

    expect(delivered[0]?.text).toContain('You will be on the Platform team.');
  });

  it('names no team where they join none', async () => {
    const { mail, delivered } = sending();

    await mail.send({ ...invite, teamNames: [] });

    expect(delivered[0]?.text).not.toContain('You will be on');
    expect(delivered[0]?.text).toContain(
      'Leon Liang invited you to join Acme on Spotlight.',
    );
  });

  it('leaves nothing in a name to be read as markup', async () => {
    const { mail, delivered } = sending();

    await mail.send({ ...invite, teamNames: ['<script>alert(1)</script>'] });

    expect(delivered[0]?.html).not.toContain('<script>');
    expect(delivered[0]?.html).toContain('&lt;script&gt;');
  });

  it('reads plainly where the styling is stripped', async () => {
    const { mail, delivered } = sending();

    await mail.send(invite);

    expect(delivered[0]?.text).not.toContain('<');
  });
});
