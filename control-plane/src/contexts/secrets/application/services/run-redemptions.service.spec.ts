import { UnsealableRecipientError } from '@secrets/application/errors/unsealable-recipient.error';
import type {
  RunSealingPort,
  SealedFor,
  SealingRecipient,
} from '@secrets/application/ports/run-sealing.port';
import { RunGrantEndings } from '@secrets/application/services/run-grant-endings.service';
import { RunGrantsKept } from '@secrets/application/services/run-grants-kept';
import { RunRedemptions } from '@secrets/application/services/run-redemptions.service';
import { SecretSources } from '@secrets/application/services/secret-sources.service';
import { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { RedemptionRecipientPinnedError } from '@secrets/domain/exceptions/redemption-recipient-pinned.error';
import { RunGrantsEndedError } from '@secrets/domain/exceptions/run-grants-ended.error';
import { RunHoldOverError } from '@secrets/domain/exceptions/run-hold-over.error';
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
      throw new UnsealableRecipientError();
    }

    return { key: written };
  }

  seal(value: SecretValue, to: SealingRecipient, sealedFor: SealedFor): string {
    return `sealed(${value.revealed()}|${to.key}|${sealedFor.runId}|${sealedFor.secretName})`;
  }
}

const REDEEMING = {
  workspaceId: WORKSPACE.value,
  runId: 'run_1',
  attempt: 1,
  recipient: 'recipient-key',
};

const holding = async () => {
  const store = new InMemoryStore();
  const secrets = new InMemorySecrets(store);
  const grants = new InMemoryGrants();
  const aws = readingFrom({ 'sentry-token': 'sntrys_1' });
  vi.spyOn(aws, 'read');

  const kept = async (id: string, secret: Parameters<typeof definition>[0]) =>
    secrets.save(
      Secret.set(definition(secret), {
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
    redemptions: new RunRedemptions(
      secrets,
      new RunGrantsKept(grants),
      new SecretSources(store, aws),
      new SealedInTheOpen(),
    ),
    grants,
    aws,
  };
};

describe('RunRedemptions', () => {
  it('seals a value Spotlight keeps to the run’s recipient, with how it is worn', async () => {
    const { redemptions } = await holding();

    await expect(
      redemptions.redeem({ ...REDEEMING, wears: ['LINEAR_API_KEY'] }),
    ).resolves.toEqual({
      secrets: [
        {
          secret: 'LINEAR_API_KEY',
          host: 'mcp.linear.app',
          carrier: 'header',
          name: 'authorization',
          prefix: 'Bearer ',
          sealed: 'sealed(lin_api_1|recipient-key|run_1|LINEAR_API_KEY)',
          readInNetwork: null,
        },
      ],
      withheld: [],
    });
  });

  it('says where egress reads a value an external store holds, and never reads it itself', async () => {
    const { redemptions, aws } = await holding();

    const redeemed = await redemptions.redeem({
      ...REDEEMING,
      wears: ['SENTRY_TOKEN'],
    });

    expect(redeemed.secrets).toEqual([
      {
        secret: 'SENTRY_TOKEN',
        host: 'sentry.io',
        carrier: 'header',
        name: 'x-sentry-token',
        prefix: '',
        sealed: null,
        readInNetwork: {
          kind: 'aws-secrets-manager',
          secretId: 'sentry-token',
          field: 'token',
        },
      },
    ]);
    expect(aws.read).not.toHaveBeenCalled();
  });

  it('grants the run each secret it wears toward every host it is bound to', async () => {
    const { redemptions, grants } = await holding();

    await redemptions.redeem({
      ...REDEEMING,
      wears: ['LINEAR_API_KEY', 'SENTRY_TOKEN', 'LINEAR_API_KEY'],
    });

    expect(
      grants.all.map((each) => [each.runId.value, each.host]).sort(),
    ).toEqual([
      ['run_1', 'mcp.linear.app'],
      ['run_1', 'sentry.io'],
    ]);
  });

  it('withholds what it cannot give, saying why, and gives the rest', async () => {
    const { redemptions } = await holding();

    const redeemed = await redemptions.redeem({
      ...REDEEMING,
      wears: ['NOWHERE', 'LOOSE', 'MULTI_LINE', 'LINEAR_API_KEY'],
    });

    expect(redeemed.secrets.map((each) => each.secret)).toEqual([
      'LINEAR_API_KEY',
    ]);
    expect(redeemed.withheld).toEqual([
      {
        secret: 'NOWHERE',
        reason:
          'The workspace holds no secret named NOWHERE; define it before anything uses it',
      },
      {
        secret: 'LOOSE',
        reason:
          'The LOOSE secret is not bound to any host, so it is never sent there',
      },
      {
        secret: 'MULTI_LINE',
        reason:
          'The MULTI_LINE secret holds more than one line, so it cannot be worn in a request',
      },
    ]);
  });

  it('refuses a recipient it cannot seal to before granting anything, whatever the run wears', async () => {
    const { redemptions, grants } = await holding();

    await expect(
      redemptions.redeem({
        ...REDEEMING,
        recipient: 'not-a-key',
        wears: ['SENTRY_TOKEN'],
      }),
    ).rejects.toThrow(UnsealableRecipientError);
    expect(grants.all).toEqual([]);
  });

  it('pins the recipient it first sealed to, answering the same recipient again and refusing any other', async () => {
    const { redemptions, grants } = await holding();
    const redeeming = { ...REDEEMING, wears: ['LINEAR_API_KEY'] };

    const first = await redemptions.redeem(redeeming);

    await expect(redemptions.redeem(redeeming)).resolves.toEqual(first);
    await expect(
      redemptions.redeem({ ...redeeming, recipient: 'another-key' }),
    ).rejects.toThrow(RedemptionRecipientPinnedError);
    expect(grants.of('run_1')?.recipient?.key).toBe('recipient-key');
  });

  it('redeems afresh for a later attempt of the run, sealed to that attempt’s own recipient', async () => {
    const { redemptions, grants } = await holding();
    const redeeming = { ...REDEEMING, wears: ['LINEAR_API_KEY'] };

    await redemptions.redeem(redeeming);

    const again = await redemptions.redeem({
      ...redeeming,
      attempt: 2,
      recipient: 'another-key',
    });

    expect(again.secrets.map((each) => each.sealed)).toEqual([
      'sealed(lin_api_1|another-key|run_1|LINEAR_API_KEY)',
    ]);
    expect(grants.of('run_1')?.hold.attempt).toBe(2);
    await expect(redemptions.redeem(redeeming)).rejects.toThrow(
      RunHoldOverError,
    );
  });

  it('lets a lost hold’s grants go, refusing that attempt but redeeming the next', async () => {
    const { redemptions, grants } = await holding();
    const redeeming = { ...REDEEMING, wears: ['LINEAR_API_KEY'] };
    const endings = new RunGrantEndings(new RunGrantsKept(grants), clockAt());

    await redemptions.redeem(redeeming);
    await endings.holdLost({
      workspaceId: WORKSPACE.value,
      runId: 'run_1',
      attempt: 1,
    });

    expect(grants.all).toEqual([]);
    await expect(redemptions.redeem(redeeming)).rejects.toThrow(
      RunHoldOverError,
    );
    await expect(
      redemptions.redeem({
        ...redeeming,
        attempt: 2,
        recipient: 'another-key',
      }),
    ).resolves.toMatchObject({ withheld: [] });
    expect(grants.all.map((each) => each.host)).toEqual(['mcp.linear.app']);
  });

  it('redeems nothing once the run’s grants have ended', async () => {
    const { redemptions, grants } = await holding();
    const redeeming = { ...REDEEMING, wears: ['LINEAR_API_KEY'] };

    await redemptions.redeem(redeeming);
    await new RunGrantEndings(new RunGrantsKept(grants), clockAt()).endedFor({
      workspaceId: WORKSPACE.value,
      runId: 'run_1',
      attempt: 1,
    });

    await expect(
      redemptions.redeem({ ...redeeming, attempt: 2 }),
    ).rejects.toThrow(RunGrantsEndedError);
    expect(grants.all).toEqual([]);
  });
});
