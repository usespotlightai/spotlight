import type {
  MailMessage,
  MailTransport,
} from '@identity/infrastructure/mail/mail.transport';
import { MemberByMail } from '@identity/infrastructure/mail/member.mail';
import type { Env } from '@platform/config/env.schema';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { describe, expect, it } from 'vitest';

const sending = () => {
  const delivered: MailMessage[] = [];
  const transport: MailTransport = {
    deliver: async (message) => {
      delivered.push(message);
    },
  };

  return {
    mail: new MemberByMail(
      transport,
      partial<Env>({
        BETTER_AUTH_URL: 'https://app.example.com',
      }),
    ),
    delivered,
  };
};

const base = {
  to: 'ada@example.com',
  workspaceName: 'Acme',
  by: 'Leon Liang',
} as const;

describe('MemberByMail', () => {
  it('tells a suspended person who suspended them', async () => {
    const { mail, delivered } = sending();

    await mail.send({ ...base, kind: 'suspended' });

    expect(delivered[0]?.to).toBe('ada@example.com');
    expect(delivered[0]?.subject).toBe(
      'Your access to Acme on Spotlight is suspended',
    );
    expect(delivered[0]?.text).toContain('Leon Liang suspended your access');
  });

  it('tells a person their access is back', async () => {
    const { mail, delivered } = sending();

    await mail.send({ ...base, kind: 'unsuspended' });

    expect(delivered[0]?.subject).toBe(
      'Your access to Acme on Spotlight is back',
    );
  });

  it('confirms to a person that they left', async () => {
    const { mail, delivered } = sending();

    await mail.send({ ...base, kind: 'left', by: null });

    expect(delivered[0]?.subject).toBe('You left Acme on Spotlight');
    expect(delivered[0]?.text).toContain('You left the workspace');
  });

  it('names an admin where it does not know who acted', async () => {
    const { mail, delivered } = sending();

    await mail.send({ ...base, kind: 'suspended', by: null });

    expect(delivered[0]?.text).toContain('An admin suspended your access');
  });

  it('escapes what a person typed in the workspace name', async () => {
    const { mail, delivered } = sending();

    await mail.send({
      ...base,
      kind: 'left',
      workspaceName: '<b>Acme</b>',
    });

    expect(delivered[0]?.html).not.toContain('<b>Acme</b>');
    expect(delivered[0]?.html).toContain('&lt;b&gt;Acme&lt;/b&gt;');
  });
});
