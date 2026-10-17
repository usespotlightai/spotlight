import type {
  RunTokensPort,
  RunTokenWanted,
} from '@identity/application/ports/run-tokens.port';
import type {
  EgressFor,
  RunnerEgressPort,
  SharedEgressFor,
} from '@runners/application/ports/runner-egress.port';
import type { RunSecretFetch } from '@secrets/application/contracts/run-secret-fetch.contract';
import type { RunSecretFetchesPort } from '@secrets/application/ports/run-secret-fetches.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  FetchRunSecretsCommand,
  FetchSharedRunSecretsCommand,
} from '@work/application/commands/egress.commands';
import { FetchRunSecretsHandler } from '@work/application/commands/handlers/fetch-run-secrets.handler';
import { FetchSharedRunSecretsHandler } from '@work/application/commands/handlers/fetch-shared-run-secrets.handler';
import { EgressSecretFetches } from '@work/application/services/egress-secret-fetches.service';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-25T12:00:00.000Z');

const RUNNER = 'runner_1';

const FETCHED = {
  secrets: [
    {
      secret: 'LINEAR_API_KEY',
      host: 'mcp.linear.app',
      location: 'header',
      name: 'authorization',
      prefix: 'Bearer ',
      sealed: 'v1.sealed',
      externalRef: null,
    },
  ],
  denied: [{ secret: 'GONE', reason: 'no such secret' }],
};

const leasedRun = (
  workspace = 'ws_1',
  by = RUNNER,
  over: { spotlightApi?: boolean; injectedSecrets?: string[] } = {},
) =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of(workspace),
    harness: HarnessId.of('dev'),
    subject: over.spotlightApi ? RunSubject.chat(ChatId.of('chat_1')) : null,
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task:station' },
      injectedSecrets: over.injectedSecrets ?? ['LINEAR_API_KEY', 'GONE'],
      ...(over.spotlightApi ? { spotlightApi: true } : {}),
    }),
  }).claim(RunnerId.of(by), NOW);

const CHAT = { startedBy: UserId.of('user_1') } as unknown as Chat;

const leaseExpiredRun = () => {
  const leased = leasedRun();

  return leased.expireLease(leased.leaseExpiresAt as Date);
};

const fetching = (
  admitted: EgressFor | null,
  run: Run | null = leasedRun(),
  after: Run | null = run,
  shared: SharedEgressFor | null = null,
) => {
  const asked: RunSecretFetch[] = [];
  const lost: string[] = [];
  const minted: RunTokenWanted[] = [];
  const revoked: string[] = [];
  const found = [run, after];
  const egress: RunnerEgressPort = {
    admit: async (token) => (token === 'egress-token' ? admitted : null),
    sharedWith: async (token) =>
      token === 'shared-token' ? { egressId: 'egress_1' } : null,
    admitThrough: async (through, credential) =>
      through.egressId === 'egress_1' && credential === 'proxy-credential'
        ? shared
        : null,
    recordsThrough: async () => null,
  };
  const fetches = new EgressSecretFetches(
    {
      findById: async () =>
        (found.length > 1 ? found.shift() : found[0]) ?? null,
    } as unknown as RunRepository,
    {
      fetchSecrets: async (wanted) => {
        asked.push(wanted);
        return FETCHED;
      },
      sealedFor: (sealed) => `sealed(${sealed.name}=${sealed.value})`,
    } as RunSecretFetchesPort,
    {
      leaseLost: async (lease) => {
        lost.push(`${lease.workspaceId}/${lease.runId}#${lease.attempt}`);
      },
      endedFor: async () => undefined,
    },
    { hosts: () => ['storage.example.com'] },
    { find: async () => CHAT } as unknown as ChatRepository,
    {
      mintFor: async (wanted) => {
        minted.push(wanted);
        return { id: 'token_1', token: 'run-token' };
      },
      revoke: async (workspaceId, tokenId) => {
        revoked.push(`${workspaceId}/${tokenId}`);
      },
      revokeFor: async (workspaceId, runId, attempt) => {
        revoked.push(`${workspaceId}/${runId}#${attempt}`);
      },
    } as RunTokensPort,
    { now: () => NOW } as ClockPort,
    'app.example.com',
  );
  const clock = { now: () => NOW } as ClockPort;
  const handler = new FetchRunSecretsHandler(egress, fetches, clock);
  const through = new FetchSharedRunSecretsHandler(egress, fetches, clock);

  return { handler, through, asked, lost, minted, revoked };
};

const LEASED_RUN: EgressFor = {
  runnerId: RUNNER,
  workspaceId: 'ws_1',
  work: { kind: 'run', id: 'run_1' },
};

describe('FetchRunSecretsHandler', () => {
  it('fetches the secrets of the leased run, for the recipient that egress names', async () => {
    const { handler, asked } = fetching(LEASED_RUN);

    await expect(
      handler.execute(
        new FetchRunSecretsCommand('egress-token', 'recipient-key'),
      ),
    ).resolves.toEqual({
      outcome: 'fetched',
      runId: 'run_1',
      reaches: ['storage.example.com'],
      bound: ['mcp.linear.app'],
      ...FETCHED,
      spotlightApi: null,
    });
    expect(asked).toEqual([
      {
        workspaceId: 'ws_1',
        runId: 'run_1',
        attempt: 1,
        injectedSecrets: ['LINEAR_API_KEY', 'GONE'],
        recipient: 'recipient-key',
        sharedEgress: null,
      },
    ]);
  });

  it('rejects a token that admits no egress', async () => {
    const { handler, asked } = fetching(LEASED_RUN);

    await expect(
      handler.execute(new FetchRunSecretsCommand('other', 'recipient-key')),
    ).resolves.toEqual({ outcome: 'unauthorized' });
    expect(asked).toEqual([]);
  });

  it('gives a check only what every sandbox reaches', async () => {
    const { handler, asked } = fetching({
      ...LEASED_RUN,
      work: { kind: 'check', id: 'stack_1' },
    });

    await expect(
      handler.execute(
        new FetchRunSecretsCommand('egress-token', 'recipient-key'),
      ),
    ).resolves.toEqual({
      outcome: 'fetched',
      runId: null,
      reaches: ['storage.example.com'],
      bound: [],
      secrets: [],
      denied: [],
      spotlightApi: null,
    });
    expect(asked).toEqual([]);
  });

  it('fetches nothing for a run another runner leases, or one in another workspace', async () => {
    for (const run of [
      leasedRun('ws_1', 'runner_2'),
      leasedRun('ws_2'),
      null,
    ]) {
      const { handler, asked } = fetching(LEASED_RUN, run);

      await expect(
        handler.execute(
          new FetchRunSecretsCommand('egress-token', 'recipient-key'),
        ),
      ).resolves.toMatchObject({ outcome: 'fetched', secrets: [] });
      expect(asked).toEqual([]);
    }
  });

  it('fetches for the attempt that leases the run, once it is leased again', async () => {
    const again = leaseExpiredRun().claim(RunnerId.of(RUNNER), NOW);
    const { handler, asked } = fetching(LEASED_RUN, again);

    await expect(
      handler.execute(
        new FetchRunSecretsCommand('egress-token', 'recipient-key'),
      ),
    ).resolves.toMatchObject({ outcome: 'fetched', runId: 'run_1' });
    expect(asked.map((each) => each.attempt)).toEqual([2]);
  });

  it('ends the lease’s grants when the run ends or is cancelled while it fetches', async () => {
    const ended = leasedRun().complete(
      RunnerId.of(RUNNER),
      RunOutcome.of({ exitCode: 0, failed: false }),
    );
    const expired = leaseExpiredRun();
    const reclaimed = leaseExpiredRun().claim(RunnerId.of(RUNNER), NOW);

    for (const after of [ended, expired, reclaimed]) {
      const { handler, asked, lost } = fetching(LEASED_RUN, leasedRun(), after);

      await expect(
        handler.execute(
          new FetchRunSecretsCommand('egress-token', 'recipient-key'),
        ),
      ).resolves.toMatchObject({
        outcome: 'fetched',
        runId: null,
        secrets: [],
      });
      expect(asked).toHaveLength(1);
      expect(lost).toEqual(['ws_1/run_1#1']);
    }
  });

  it('mints a plan token for a run that reaches Spotlight’s API, as whoever started its chat, sealed to egress', async () => {
    const { handler, minted } = fetching(
      LEASED_RUN,
      leasedRun('ws_1', RUNNER, { spotlightApi: true, injectedSecrets: [] }),
    );

    await expect(
      handler.execute(
        new FetchRunSecretsCommand('egress-token', 'recipient-key'),
      ),
    ).resolves.toMatchObject({
      outcome: 'fetched',
      runId: 'run_1',
      spotlightApi: { sealed: 'sealed(spotlight-api=run-token)' },
    });
    expect(minted).toEqual([
      {
        workspaceId: 'ws_1',
        runId: 'run_1',
        attempt: 1,
        issuedBy: 'user_1',
        scopes: ['plan'],
        expiresAt: new Date('2026-09-25T13:00:00.000Z'),
      },
    ]);
  });

  it('revokes the earlier token of the lease before it mints another', async () => {
    const reaching = leasedRun('ws_1', RUNNER, {
      spotlightApi: true,
      injectedSecrets: [],
    });
    const { handler, revoked, minted } = fetching(
      LEASED_RUN,
      reaching,
      reaching,
    );

    await handler.execute(
      new FetchRunSecretsCommand('egress-token', 'recipient-key'),
    );

    expect(revoked).toEqual(['ws_1/run_1#1']);
    expect(minted).toHaveLength(1);
  });

  it('mints no token for a run that does not reach Spotlight’s API', async () => {
    const { handler, minted } = fetching(LEASED_RUN);

    await expect(
      handler.execute(
        new FetchRunSecretsCommand('egress-token', 'recipient-key'),
      ),
    ).resolves.toMatchObject({ spotlightApi: null });
    expect(minted).toEqual([]);
  });

  it('revokes the token it minted when the run is cancelled while it fetches', async () => {
    const reaching = () =>
      leasedRun('ws_1', RUNNER, { spotlightApi: true, injectedSecrets: [] });
    const expired = reaching().expireLease(reaching().leaseExpiresAt as Date);
    const { handler, revoked } = fetching(LEASED_RUN, reaching(), expired);

    await expect(
      handler.execute(
        new FetchRunSecretsCommand('egress-token', 'recipient-key'),
      ),
    ).resolves.toMatchObject({ runId: null, spotlightApi: null });
    expect(revoked).toEqual(['ws_1/run_1#1', 'ws_1/token_1']);
  });
});

describe('FetchSharedRunSecretsHandler', () => {
  const SHARED: SharedEgressFor = { ...LEASED_RUN, egressId: 'egress_1' };

  it('fetches for the run of the proxy credential, pinned to the shared egress', async () => {
    const { through, asked } = fetching(null, leasedRun(), leasedRun(), SHARED);

    await expect(
      through.execute(
        new FetchSharedRunSecretsCommand(
          'shared-token',
          'proxy-credential',
          'node-key',
        ),
      ),
    ).resolves.toMatchObject({
      outcome: 'fetched',
      runId: 'run_1',
      bound: ['mcp.linear.app'],
    });
    expect(asked).toMatchObject([
      { recipient: 'node-key', sharedEgress: 'egress_1' },
    ]);
  });

  it('rejects an unknown egress token, or a proxy credential that admits no runner', async () => {
    for (const [token, credential] of [
      ['other', 'proxy-credential'],
      ['shared-token', 'another-credential'],
    ]) {
      const { through, asked } = fetching(
        null,
        leasedRun(),
        leasedRun(),
        SHARED,
      );

      await expect(
        through.execute(
          new FetchSharedRunSecretsCommand(token, credential, 'node-key'),
        ),
      ).resolves.toEqual({ outcome: 'unauthorized' });
      expect(asked).toEqual([]);
    }
  });

  it('tells egress to wait while the runner has no run, or has lost it', async () => {
    for (const [admitted, run] of [
      [{ ...SHARED, work: null }, leasedRun()],
      [SHARED, leasedRun('ws_1', 'runner_2')],
    ] as const) {
      const { through, asked } = fetching(null, run, run, admitted);

      await expect(
        through.execute(
          new FetchSharedRunSecretsCommand(
            'shared-token',
            'proxy-credential',
            'node-key',
          ),
        ),
      ).resolves.toEqual({ outcome: 'waiting' });
      expect(asked).toEqual([]);
    }
  });

  it('answers a leased run that injects no secrets, so egress stops asking', async () => {
    const plain = leasedRun('ws_1', RUNNER, { injectedSecrets: [] });
    const { through } = fetching(null, plain, plain, SHARED);

    await expect(
      through.execute(
        new FetchSharedRunSecretsCommand(
          'shared-token',
          'proxy-credential',
          'node-key',
        ),
      ),
    ).resolves.toMatchObject({
      outcome: 'fetched',
      runId: 'run_1',
      bound: [],
    });
  });

  it('binds the control plane host when the run reaches Spotlight’s API', async () => {
    const reaching = leasedRun('ws_1', RUNNER, {
      spotlightApi: true,
      injectedSecrets: [],
    });
    const { through } = fetching(null, reaching, reaching, SHARED);

    await expect(
      through.execute(
        new FetchSharedRunSecretsCommand(
          'shared-token',
          'proxy-credential',
          'node-key',
        ),
      ),
    ).resolves.toMatchObject({
      bound: ['app.example.com', 'mcp.linear.app'],
      spotlightApi: { sealed: 'sealed(spotlight-api=run-token)' },
    });
  });

  it('never takes the egress token of the egress beside a sandbox', async () => {
    const { through } = fetching(LEASED_RUN, leasedRun(), leasedRun(), SHARED);

    await expect(
      through.execute(
        new FetchSharedRunSecretsCommand(
          'egress-token',
          'proxy-credential',
          'node-key',
        ),
      ),
    ).resolves.toEqual({ outcome: 'unauthorized' });
  });
});
