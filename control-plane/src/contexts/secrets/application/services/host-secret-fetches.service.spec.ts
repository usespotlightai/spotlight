import { InvalidRecipientError } from '@secrets/application/errors/invalid-recipient.error';
import type {
  SealedFor,
  SealingRecipient,
  SecretSealingPort,
} from '@secrets/application/ports/secret-sealing.port';
import { HostSecretFetches } from '@secrets/application/services/host-secret-fetches.service';
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
  recipient: 'recipient-key',
};

const setUp = async () => {
  const store = new InMemoryStore();
  const secrets = new InMemorySecrets(store);
  const aws = readingFrom({ 'openai-key': 'sk-openai-1' });
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

  await saved('secret_anthropic', {
    name: 'ANTHROPIC_API_KEY',
    value: 'sk-ant-1',
    bindings: [{ host: 'api.anthropic.com', name: 'x-api-key' }],
  });
  await saved('secret_openai', {
    name: 'OPENAI_API_KEY',
    source: SecretSource.awsSecretsManager({
      secretId: 'openai-key',
      field: null,
    }),
    value: null,
    bindings: [{ host: 'api.openai.com', prefix: 'Bearer ' }],
  });
  await saved('secret_loose', { name: 'CURSOR_API_KEY', bindings: [] });

  return {
    fetches: new HostSecretFetches(
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

describe('HostSecretFetches', () => {
  it('seals a value Spotlight stores to the host’s recipient, bound to no run', async () => {
    const { fetches } = await setUp();

    await expect(
      fetches.sealedForHost({ ...FETCHING, secrets: ['ANTHROPIC_API_KEY'] }),
    ).resolves.toEqual({
      secrets: [
        {
          secret: 'ANTHROPIC_API_KEY',
          host: 'api.anthropic.com',
          location: 'header',
          name: 'x-api-key',
          prefix: '',
          sealed: 'sealed(sk-ant-1|recipient-key||ANTHROPIC_API_KEY)',
          externalRef: null,
        },
      ],
      denied: [],
    });
  });

  it('says where egress reads a value an external store holds, and never reads it itself', async () => {
    const { fetches, aws } = await setUp();

    const fetched = await fetches.sealedForHost({
      ...FETCHING,
      secrets: ['OPENAI_API_KEY'],
    });

    expect(fetched.secrets).toEqual([
      expect.objectContaining({
        secret: 'OPENAI_API_KEY',
        sealed: null,
        externalRef: {
          kind: 'aws-secrets-manager',
          secretId: 'openai-key',
          field: null,
        },
      }),
    ]);
    expect(aws.read).not.toHaveBeenCalled();
  });

  it('says why it seals no secret that is missing or bound nowhere', async () => {
    const { fetches } = await setUp();

    const fetched = await fetches.sealedForHost({
      ...FETCHING,
      secrets: ['CODEX_API_KEY', 'CURSOR_API_KEY'],
    });

    expect(fetched.secrets).toEqual([]);
    expect(fetched.denied.map((each) => each.secret)).toEqual([
      'CODEX_API_KEY',
      'CURSOR_API_KEY',
    ]);
  });

  it('seals nothing to what is not a key, even with nothing to seal', async () => {
    const { fetches } = await setUp();

    await expect(
      fetches.sealedForHost({
        ...FETCHING,
        recipient: 'not-a-key',
        secrets: [],
      }),
    ).rejects.toThrow(InvalidRecipientError);
  });

  it('logs which secrets it sealed for the host, and no value', async () => {
    const { fetches, logger } = await setUp();

    await fetches.sealedForHost({
      ...FETCHING,
      secrets: ['ANTHROPIC_API_KEY', 'CODEX_API_KEY'],
    });

    expect(logger.info).toHaveBeenCalledWith(
      {
        workspaceId: WORKSPACE.value,
        fetched: ['ANTHROPIC_API_KEY'],
        denied: ['CODEX_API_KEY'],
      },
      expect.any(String),
    );
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('sk-ant-1');
  });
});
