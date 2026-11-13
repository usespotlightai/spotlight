import { InvalidRecipientError } from '@secrets/application/errors/invalid-recipient.error';
import type {
  SealedFor,
  SealingRecipient,
  SecretSealingPort,
} from '@secrets/application/ports/secret-sealing.port';
import { CallSecretFetches } from '@secrets/application/services/call-secret-fetches.service';
import { SealedSecrets } from '@secrets/application/services/sealed-secrets';
import { SecretSources } from '@secrets/application/services/secret-sources.service';
import { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import {
  BY,
  definition,
  InMemorySecrets,
  InMemoryStore,
  NOW,
  readingFrom,
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
  const aws = readingFrom({ 'sentry-token': 'sntrys_1' });
  vi.spyOn(aws, 'read');
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const saved = async (id: string, secret: Parameters<typeof definition>[0]) =>
    secrets.save(
      Secret.create(definition(secret), {
        id: SecretId.of(id),
        workspaceId: WORKSPACE,
        by: BY,
        at: NOW,
      }),
    );

  await saved('secret_slack', {
    name: 'SLACK_BOT_TOKEN',
    value: 'xoxb-1',
    bindings: [
      { host: 'slack.com', prefix: 'Bearer ' },
      { host: 'files.slack.com', name: 'x-slack-token' },
    ],
  });
  await saved('secret_sentry', {
    name: 'SENTRY_TOKEN',
    source: SecretSource.awsSecretsManager({
      secretId: 'sentry-token',
      field: 'token',
    }),
    value: null,
    bindings: [{ host: 'sentry.io', name: 'x-sentry-token' }],
  });
  await saved('secret_loose', { name: 'LOOSE', bindings: [] });
  await saved('secret_slack_user', {
    name: 'SLACK_USER_TOKEN',
    value: 'xoxp-1',
    bindings: [{ host: 'slack.com', prefix: 'Bearer ' }],
  });
  await saved('secret_lines', {
    name: 'MULTI_LINE',
    value: 'one\ntwo',
    bindings: [{ host: 'pem.example.com' }],
  });

  return {
    fetches: new CallSecretFetches(
      new SealedSecrets(
        secrets,
        new SecretSources(store, aws),
        new SealedInTheOpen(),
      ),
      logger,
    ),
    aws,
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

  it('seals a value Spotlight stores for each host it is bound to, bound to the call', async () => {
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
          externalRef: null,
        },
        {
          secret: 'SLACK_BOT_TOKEN',
          host: 'files.slack.com',
          location: 'header',
          name: 'x-slack-token',
          prefix: '',
          sealed: 'sealed(xoxb-1|recipient-key|call_1|SLACK_BOT_TOKEN)',
          externalRef: null,
        },
      ],
      denied: [],
    });
  });

  it('says where egress reads a value an external store holds, and never reads it itself', async () => {
    const { fetches, aws } = await setUp();

    const fetched = await fetches.sealedForCall({
      ...FETCHING,
      secrets: ['SENTRY_TOKEN'],
    });

    expect(fetched.secrets).toEqual([
      {
        secret: 'SENTRY_TOKEN',
        host: 'sentry.io',
        location: 'header',
        name: 'x-sentry-token',
        prefix: '',
        sealed: null,
        externalRef: {
          kind: 'aws-secrets-manager',
          secretId: 'sentry-token',
          field: 'token',
        },
      },
    ]);
    expect(aws.read).not.toHaveBeenCalled();
  });

  it('says why it seals no secret that is missing, bound nowhere, or more than one line', async () => {
    const { fetches } = await setUp();

    const fetched = await fetches.sealedForCall({
      ...FETCHING,
      secrets: ['NOWHERE', 'LOOSE', 'MULTI_LINE'],
    });

    expect(fetched.secrets).toEqual([]);
    expect(fetched.denied.map((each) => each.secret)).toEqual([
      'NOWHERE',
      'LOOSE',
      'MULTI_LINE',
    ]);
    expect(fetched.denied[0]?.reason).toContain('Secret NOWHERE not found');
    expect(fetched.denied[1]?.reason).toContain('not bound to any host');
    expect(fetched.denied[2]?.reason).toContain('more than one line');
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
