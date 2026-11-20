import { InvalidRecipientError } from '@secrets/application/errors/invalid-recipient.error';
import type {
  SealedFor,
  SealingRecipient,
  SecretSealingPort,
} from '@secrets/application/ports/secret-sealing.port';
import { CallSecretFetches } from '@secrets/application/services/call-secret-fetches.service';
import { SealedSecrets } from '@secrets/application/services/sealed-secrets';
import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import {
  bindStored,
  InMemorySecrets,
  InMemoryStore,
  saveSecret,
  WORKSPACE,
} from '@secrets/testing/secrets.fakes.fake-spec';
import { describe, expect, it, vi } from 'vitest';

class SealedInTheOpen implements SecretSealingPort {
  recipientOf(written: string): SealingRecipient {
    if (written !== 'recipient-key') {
      throw new InvalidRecipientError();
    }

    return { key: written };
  }

  seal(value: SecretValue, to: SealingRecipient, sealedFor: SealedFor): string {
    return `sealed(${value.revealed()}|${to.key}|${sealedFor.subject}|${sealedFor.secretName})`;
  }
}

const FETCHING = {
  workspaceId: WORKSPACE.value,
  callId: 'call_1',
  recipient: 'recipient-key',
};

const setUp = async () => {
  const store = new InMemoryStore();
  const secrets = new InMemorySecrets(store);
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  await saveSecret(secrets, 'secret_slack', {
    name: 'SLACK_BOT_TOKEN',
    value: 'xoxb-1',
    bindings: [
      { host: 'slack.com', prefix: 'Bearer ' },
      { host: 'files.slack.com', name: 'x-slack-token' },
    ],
  });
  await saveSecret(secrets, 'secret_sentry', {
    name: 'SENTRY_TOKEN',
    value: 'sntrys_1',
    bindings: [{ host: 'sentry.io', name: 'x-sentry-token' }],
  });
  await saveSecret(secrets, 'secret_loose', { name: 'LOOSE', bindings: [] });
  await saveSecret(secrets, 'secret_staging', {
    name: 'STAGING_LOGIN_PASSWORD',
    value: null,
    valueVersion: null,
    bindings: [{ host: 'staging.example.com' }],
  });
  await saveSecret(secrets, 'secret_slack_user', {
    name: 'SLACK_USER_TOKEN',
    value: 'xoxp-1',
    bindings: [{ host: 'slack.com', prefix: 'Bearer ' }],
  });
  await bindStored(secrets, 'secret_lines', {
    name: 'MULTI_LINE',
    value: 'one\ntwo',
    bindings: [{ host: 'pem.example.com' }],
  });

  return {
    fetches: new CallSecretFetches(
      new SealedSecrets(secrets, store, new SealedInTheOpen()),
      logger,
    ),
    logger,
  };
};

describe('CallSecretFetches', () => {
  it('denies a secret injected in the same header for the same host as one before it', async () => {
    const { fetches } = await setUp();

    const fetched = await fetches.sealedForCall({
      ...FETCHING,
      secrets: ['SLACK_BOT_TOKEN', 'SLACK_USER_TOKEN'],
    });

    expect([...new Set(fetched.secrets.map((each) => each.secret))]).toEqual([
      'SLACK_BOT_TOKEN',
    ]);
    expect(fetched.denied).toEqual([
      {
        secret: 'SLACK_USER_TOKEN',
        reason: expect.stringContaining(
          'Secrets SLACK_USER_TOKEN and SLACK_BOT_TOKEN are both injected in authorization',
        ) as unknown,
      },
    ]);
  });

  it('seals the value for each host it is bound to, bound to the call', async () => {
    const { fetches } = await setUp();

    await expect(
      fetches.sealedForCall({ ...FETCHING, secrets: ['SLACK_BOT_TOKEN'] }),
    ).resolves.toEqual({
      secrets: [
        {
          secret: 'SLACK_BOT_TOKEN',
          host: 'slack.com',
          location: 'header',
          name: 'authorization',
          prefix: 'Bearer ',
          sealed: 'sealed(xoxb-1|recipient-key|call_1|SLACK_BOT_TOKEN)',
        },
        {
          secret: 'SLACK_BOT_TOKEN',
          host: 'files.slack.com',
          location: 'header',
          name: 'x-slack-token',
          prefix: '',
          sealed: 'sealed(xoxb-1|recipient-key|call_1|SLACK_BOT_TOKEN)',
        },
      ],
      denied: [],
    });
  });

  it('says why it seals no secret that is missing, bound nowhere, more than one line, or awaiting a value', async () => {
    const { fetches } = await setUp();

    const fetched = await fetches.sealedForCall({
      ...FETCHING,
      secrets: ['NOWHERE', 'LOOSE', 'MULTI_LINE', 'STAGING_LOGIN_PASSWORD'],
    });

    expect(fetched.secrets).toEqual([]);
    expect(fetched.denied.map((each) => each.secret)).toEqual([
      'NOWHERE',
      'LOOSE',
      'MULTI_LINE',
      'STAGING_LOGIN_PASSWORD',
    ]);
    expect(fetched.denied[0]?.reason).toContain('Secret NOWHERE not found');
    expect(fetched.denied[1]?.reason).toContain('not bound to any host');
    expect(fetched.denied[2]?.reason).toContain('more than one line');
    expect(fetched.denied[3]?.reason).toContain(
      'Secret STAGING_LOGIN_PASSWORD has no value',
    );
  });

  it('seals nothing to what is not a key', async () => {
    const { fetches } = await setUp();

    await expect(
      fetches.sealedForCall({
        ...FETCHING,
        recipient: 'not-a-key',
        secrets: ['SLACK_BOT_TOKEN'],
      }),
    ).rejects.toThrow(InvalidRecipientError);
  });

  it('logs which secrets it sealed for the call, and no value', async () => {
    const { fetches, logger } = await setUp();

    await fetches.sealedForCall({
      ...FETCHING,
      secrets: ['SLACK_BOT_TOKEN', 'NOWHERE'],
    });

    expect(logger.info).toHaveBeenCalledWith(
      {
        workspaceId: WORKSPACE.value,
        callId: 'call_1',
        fetched: ['SLACK_BOT_TOKEN'],
        denied: ['NOWHERE'],
      },
      expect.any(String),
    );
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('xoxb-1');
  });
});
