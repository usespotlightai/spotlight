import { InvalidRecipientError } from '@secrets/application/errors/invalid-recipient.error';
import type {
  RunSealingPort,
  SealedFor,
  SealingRecipient,
} from '@secrets/application/ports/run-sealing.port';
import { RunGrantEndings } from '@secrets/application/services/run-grant-endings.service';
import { RunGrantsUnitOfWork } from '@secrets/application/services/run-grants-unit-of-work';
import { RunSecretFetches } from '@secrets/application/services/run-secret-fetches.service';
import { SecretSources } from '@secrets/application/services/secret-sources.service';
import { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { RecipientPinnedError } from '@secrets/domain/exceptions/recipient-pinned.error';
import { RunGrantsEndedError } from '@secrets/domain/exceptions/run-grants-ended.error';
import { RunLeaseOverError } from '@secrets/domain/exceptions/run-lease-over.error';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import {
  BY,
  clockAt,
  definition,
  InMemoryGrants,
  InMemorySecrets,
  InMemoryStore,
  NOW,
  readingFrom,
  WORKSPACE,
} from '@secrets/secrets.fakes.fake-spec';
import { describe, expect, it, vi } from 'vitest';

class SealedInTheOpen implements RunSealingPort {
  recipientOf(written: string): SealingRecipient {
    if (!['recipient-key', 'another-key'].includes(written)) {
      throw new InvalidRecipientError();
    }

    return { key: written };
  }

  seal(value: SecretValue, to: SealingRecipient, sealedFor: SealedFor): string {
    return `sealed(${value.revealed()}|${to.key}|${sealedFor.runId}|${sealedFor.secretName})`;
  }
}

const FETCHING = {
  workspaceId: WORKSPACE.value,
  runId: 'run_1',
  attempt: 1,
  recipient: 'recipient-key',
  sharedEgress: null,
};

const setUp = async () => {
  const store = new InMemoryStore();
  const secrets = new InMemorySecrets(store);
  const grants = new InMemoryGrants();
  const aws = readingFrom({ 'sentry-token': 'sntrys_1' });
  vi.spyOn(aws, 'read');

  const kept = async (id: string, secret: Parameters<typeof definition>[0]) =>
    secrets.save(
      Secret.create(definition(secret), {
        id: SecretId.of(id),
        workspaceId: WORKSPACE,
        by: BY,
        at: NOW,
      }),
    );

  await kept('secret_linear', {
    bindings: [{ host: 'mcp.linear.app', prefix: 'Bearer ' }],
  });
  await kept('secret_sentry', {
    name: 'SENTRY_TOKEN',
    source: SecretSource.awsSecretsManager({
      secretId: 'sentry-token',
      field: 'token',
    }),
    value: null,
    bindings: [{ host: 'sentry.io', name: 'x-sentry-token' }],
  });
  await kept('secret_loose', { name: 'LOOSE', bindings: [] });
  await kept('secret_lines', {
    name: 'MULTI_LINE',
    value: 'one\ntwo',
    bindings: [{ host: 'pem.example.com' }],
  });

  return {
    fetches: new RunSecretFetches(
      secrets,
      new RunGrantsUnitOfWork(grants),
      new SecretSources(store, aws),
      new SealedInTheOpen(),
    ),
    grants,
    aws,
  };
};

describe('RunSecretFetches', () => {
  it('seals a value Spotlight keeps to the run’s recipient, with where egress injects it', async () => {
    const { fetches } = await setUp();

    await expect(
      fetches.fetchSecrets({
        ...FETCHING,
        injectedSecrets: ['LINEAR_API_KEY'],
      }),
    ).resolves.toEqual({
      secrets: [
        {
          secret: 'LINEAR_API_KEY',
          host: 'mcp.linear.app',
          location: 'header',
          name: 'authorization',
          prefix: 'Bearer ',
          sealed: 'sealed(lin_api_1|recipient-key|run_1|LINEAR_API_KEY)',
          externalRef: null,
        },
      ],
      denied: [],
    });
  });

  it('says where egress reads a value an external store keeps, and never reads it itself', async () => {
    const { fetches, aws } = await setUp();

    const fetched = await fetches.fetchSecrets({
      ...FETCHING,
      injectedSecrets: ['SENTRY_TOKEN'],
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

  it('grants the run each secret it injects, for every host the secret is bound to', async () => {
    const { fetches, grants } = await setUp();

    await fetches.fetchSecrets({
      ...FETCHING,
      injectedSecrets: ['LINEAR_API_KEY', 'SENTRY_TOKEN', 'LINEAR_API_KEY'],
    });

    expect(
      grants.all.map((each) => [each.runId.value, each.host]).sort(),
    ).toEqual([
      ['run_1', 'mcp.linear.app'],
      ['run_1', 'sentry.io'],
    ]);
  });

  it('denies what it cannot give, says why, and gives the rest', async () => {
    const { fetches } = await setUp();

    const fetched = await fetches.fetchSecrets({
      ...FETCHING,
      injectedSecrets: ['NOWHERE', 'LOOSE', 'MULTI_LINE', 'LINEAR_API_KEY'],
    });

    expect(fetched.secrets.map((each) => each.secret)).toEqual([
      'LINEAR_API_KEY',
    ]);
    expect(fetched.denied).toEqual([
      {
        secret: 'NOWHERE',
        reason: 'Secret NOWHERE not found. Please create it first.',
      },
      {
        secret: 'LOOSE',
        reason: 'Secret LOOSE is not bound to any host.',
      },
      {
        secret: 'MULTI_LINE',
        reason:
          'Secret MULTI_LINE contains more than one line. It cannot be sent in a request.',
      },
    ]);
  });

  it('rejects a recipient it cannot seal to before granting anything, whatever secrets the run injects', async () => {
    const { fetches, grants } = await setUp();

    await expect(
      fetches.fetchSecrets({
        ...FETCHING,
        recipient: 'not-a-key',
        injectedSecrets: ['SENTRY_TOKEN'],
      }),
    ).rejects.toThrow(InvalidRecipientError);
    expect(grants.all).toEqual([]);
  });

  it('pins the recipient it first sealed to, answering the same recipient again and rejecting any other', async () => {
    const { fetches, grants } = await setUp();
    const fetching = { ...FETCHING, injectedSecrets: ['LINEAR_API_KEY'] };

    const first = await fetches.fetchSecrets(fetching);

    await expect(fetches.fetchSecrets(fetching)).resolves.toEqual(first);
    await expect(
      fetches.fetchSecrets({ ...fetching, recipient: 'another-key' }),
    ).rejects.toThrow(RecipientPinnedError);
    expect(grants.of('run_1')?.recipient?.key).toBe('recipient-key');
  });

  it('fetches again for a later attempt of the run, sealed to that attempt’s own recipient', async () => {
    const { fetches, grants } = await setUp();
    const fetching = { ...FETCHING, injectedSecrets: ['LINEAR_API_KEY'] };

    await fetches.fetchSecrets(fetching);

    const again = await fetches.fetchSecrets({
      ...fetching,
      attempt: 2,
      recipient: 'another-key',
    });

    expect(again.secrets.map((each) => each.sealed)).toEqual([
      'sealed(lin_api_1|another-key|run_1|LINEAR_API_KEY)',
    ]);
    expect(grants.of('run_1')?.lease.attempt).toBe(2);
    await expect(fetches.fetchSecrets(fetching)).rejects.toThrow(
      RunLeaseOverError,
    );
  });

  it('lets the grants of a lost lease go, rejecting that attempt but fetching the next', async () => {
    const { fetches, grants } = await setUp();
    const fetching = { ...FETCHING, injectedSecrets: ['LINEAR_API_KEY'] };
    const endings = new RunGrantEndings(
      new RunGrantsUnitOfWork(grants),
      clockAt(),
    );

    await fetches.fetchSecrets(fetching);
    await endings.leaseLost({
      workspaceId: WORKSPACE.value,
      runId: 'run_1',
      attempt: 1,
    });

    expect(grants.all).toEqual([]);
    await expect(fetches.fetchSecrets(fetching)).rejects.toThrow(
      RunLeaseOverError,
    );
    await expect(
      fetches.fetchSecrets({
        ...fetching,
        attempt: 2,
        recipient: 'another-key',
      }),
    ).resolves.toMatchObject({ denied: [] });
    expect(grants.all.map((each) => each.host)).toEqual(['mcp.linear.app']);
  });

  it('fetches nothing once the run’s grants have ended', async () => {
    const { fetches, grants } = await setUp();
    const fetching = { ...FETCHING, injectedSecrets: ['LINEAR_API_KEY'] };

    await fetches.fetchSecrets(fetching);
    await new RunGrantEndings(
      new RunGrantsUnitOfWork(grants),
      clockAt(),
    ).endedFor({
      workspaceId: WORKSPACE.value,
      runId: 'run_1',
      attempt: 1,
    });

    await expect(
      fetches.fetchSecrets({ ...fetching, attempt: 2 }),
    ).rejects.toThrow(RunGrantsEndedError);
    expect(grants.all).toEqual([]);
  });
});
