import type { RunTokenWanted } from '@identity/application/ports/run-tokens.port';
import type {
  EgressAuthentication,
  RunnerEgressPort,
  SharedEgressAuthentication,
} from '@runners/application/ports/runner-egress.port';
import {
  FetchRunSecretsCommand,
  FetchSharedRunSecretsCommand,
} from '@runs/application/commands/egress.commands';
import { FetchRunSecretsHandler } from '@runs/application/commands/handlers/fetch-run-secrets.handler';
import { FetchSharedRunSecretsHandler } from '@runs/application/commands/handlers/fetch-shared-run-secrets.handler';
import { EgressSecretFetches } from '@runs/application/services/egress-secret-fetches.service';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import { claimer, orderedFor } from '@runs/domain/aggregates/run.fake-spec';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { ExitCode } from '@runs/domain/value-objects/exit-code.vo';
import { HandoverReport } from '@runs/domain/value-objects/handover-report.vo';
import { RunApiGrant } from '@runs/domain/value-objects/run-api-grant.vo';
import { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import type { RunSecretFetch } from '@secrets/application/contracts/run-secret-fetch.contract';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
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
    ...(over.spotlightApi
      ? orderedFor.conversing('chat_1')
      : orderedFor.spec()),
    apiGrant: over.spotlightApi
      ? RunApiGrant.of({
          actingFor: 'user_1',
          scopes: ['plan'],
          lifetimeMs: 60 * 60 * 1_000,
        })
      : null,
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      resume: {},
      injectedSecrets: over.injectedSecrets ?? ['LINEAR_API_KEY', 'GONE'],
      ...(over.spotlightApi ? { spotlightApi: true } : {}),
    }),
  }).claim(claimer(RunnerId.of(by), workspace), NOW);

const leaseExpiredRun = () => {
  const leased = leasedRun();

  return leased.expireLease(leased.leaseExpiresAt as Date);
};

const fetching = (
  egressFor: EgressAuthentication | null,
  run: Run | null = leasedRun(),
  after: Run | null = run,
  shared: SharedEgressAuthentication | null = null,
) => {
  const fetchesMade: RunSecretFetch[] = [];
  const lost: string[] = [];
  const issued: RunTokenWanted[] = [];
  const revoked: string[] = [];
  const found = [run, after];
  const egress: RunnerEgressPort = {
    authenticate: async (token) =>
      token === 'egress-token' ? egressFor : null,
    sharedWith: async (token) =>
      token === 'shared-token' ? { egressId: 'egress_1' } : null,
    authorizeRunner: async (through, credential) =>
      through.egressId === 'egress_1' && credential === 'proxy-credential'
        ? shared
        : null,
    runnerForConnectionRecords: async () => null,
  };
  const fetches = new EgressSecretFetches(
    {
      findById: async () =>
        (found.length > 1 ? found.shift() : found[0]) ?? null,
    } as unknown as RunRepository,
    {
      fetchSecrets: async (wanted) => {
        fetchesMade.push(wanted);
        return FETCHED;
      },
      sealedFor: (sealed) =>
        `sealed(${sealed.name}=${sealed.value.revealed()})`,
    },
    {
      leaseLost: async (lease) => {
        lost.push(`${lease.workspaceId}/${lease.runId}#${lease.attempt}`);
      },
      endedFor: async () => undefined,
    },
    { hosts: () => ['storage.example.com'] },
    {
      issueFor: async (wanted) => {
        issued.push(wanted);
        return { id: 'token_1', token: 'run-token' };
      },
      revoke: async (workspaceId, tokenId) => {
        revoked.push(`${workspaceId.value}/${tokenId}`);
      },
      revokeFor: async (workspaceId, runId, attempt) => {
        revoked.push(`${workspaceId.value}/${runId.value}#${String(attempt)}`);
      },
    },
    { now: () => NOW } as ClockPort,
    'app.example.com',
  );
  const clock = { now: () => NOW } as ClockPort;
  const handler = new FetchRunSecretsHandler(egress, fetches, clock);
  const through = new FetchSharedRunSecretsHandler(egress, fetches, clock);

  return { handler, through, fetches: fetchesMade, lost, issued, revoked };
};

const LEASED_RUN: EgressAuthentication = {
  runnerId: RUNNER,
  workspaceId: 'ws_1',
  work: { kind: 'run', id: 'run_1' },
};

describe('FetchRunSecretsHandler', () => {
  it('fetches the secrets of the leased run, for the recipient that egress names', async () => {
    const { handler, fetches } = fetching(LEASED_RUN);

    await expect(
      handler.execute(
        new FetchRunSecretsCommand('egress-token', 'recipient-key'),
      ),
    ).resolves.toEqual({
      outcome: 'fetched',
      runId: 'run_1',
      extraAllowedHosts: ['storage.example.com'],
      bound: ['mcp.linear.app'],
      ...FETCHED,
      spotlightApi: null,
    });
    expect(fetches).toEqual([
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

  it('rejects a token that matches no egress', async () => {
    const { handler, fetches } = fetching(LEASED_RUN);

    await expect(
      handler.execute(new FetchRunSecretsCommand('other', 'recipient-key')),
    ).resolves.toEqual({ outcome: 'unauthorized' });
    expect(fetches).toEqual([]);
  });

  it('sends a check only the hosts that every sandbox may connect to', async () => {
    const { handler, fetches } = fetching({
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
      extraAllowedHosts: ['storage.example.com'],
      bound: [],
      secrets: [],
      denied: [],
      spotlightApi: null,
    });
    expect(fetches).toEqual([]);
  });

  it('fetches nothing for a run another runner leases, or one in another workspace', async () => {
    for (const run of [
      leasedRun('ws_1', 'runner_2'),
      leasedRun('ws_2'),
      null,
    ]) {
      const { handler, fetches } = fetching(LEASED_RUN, run);

      await expect(
        handler.execute(
          new FetchRunSecretsCommand('egress-token', 'recipient-key'),
        ),
      ).resolves.toMatchObject({ outcome: 'fetched', secrets: [] });
      expect(fetches).toEqual([]);
    }
  });

  it('fetches for the attempt that leases the run, once it is leased again', async () => {
    const again = leaseExpiredRun().claim(claimer(RunnerId.of(RUNNER)), NOW);
    const { handler, fetches } = fetching(LEASED_RUN, again);

    await expect(
      handler.execute(
        new FetchRunSecretsCommand('egress-token', 'recipient-key'),
      ),
    ).resolves.toMatchObject({ outcome: 'fetched', runId: 'run_1' });
    expect(fetches.map((each) => each.attempt)).toEqual([2]);
  });

  it('ends the lease’s grants when the run ends or is cancelled while it fetches', async () => {
    const ended = leasedRun().complete(
      RunnerId.of(RUNNER),
      RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
      HandoverReport.none(),
      NOW,
    );
    const expired = leaseExpiredRun();
    const reclaimed = leaseExpiredRun().claim(
      claimer(RunnerId.of(RUNNER)),
      NOW,
    );

    for (const after of [ended, expired, reclaimed]) {
      const { handler, fetches, lost } = fetching(
        LEASED_RUN,
        leasedRun(),
        after,
      );

      await expect(
        handler.execute(
          new FetchRunSecretsCommand('egress-token', 'recipient-key'),
        ),
      ).resolves.toMatchObject({
        outcome: 'fetched',
        runId: null,
        secrets: [],
      });
      expect(fetches).toHaveLength(1);
      expect(lost).toEqual(['ws_1/run_1#1']);
    }
  });

  it('issues a plan token for a run that uses Spotlight’s API, as whoever started its chat, sealed to egress', async () => {
    const { handler, issued } = fetching(
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
    expect(issued).toEqual([
      {
        workspaceId: WorkspaceId.of('ws_1'),
        runId: RunId.of('run_1'),
        attempt: 1,
        issuedBy: UserId.of('user_1'),
        scopes: ['plan'],
        expiresAt: new Date('2026-09-25T13:00:00.000Z'),
      },
    ]);
  });

  it('revokes the earlier token of the lease before it issues another', async () => {
    const usingApi = leasedRun('ws_1', RUNNER, {
      spotlightApi: true,
      injectedSecrets: [],
    });
    const { handler, revoked, issued } = fetching(
      LEASED_RUN,
      usingApi,
      usingApi,
    );

    await handler.execute(
      new FetchRunSecretsCommand('egress-token', 'recipient-key'),
    );

    expect(revoked).toEqual(['ws_1/run_1#1']);
    expect(issued).toHaveLength(1);
  });

  it('issues no token for a run that does not use Spotlight’s API', async () => {
    const { handler, issued } = fetching(LEASED_RUN);

    await expect(
      handler.execute(
        new FetchRunSecretsCommand('egress-token', 'recipient-key'),
      ),
    ).resolves.toMatchObject({ spotlightApi: null });
    expect(issued).toEqual([]);
  });

  it('revokes the token it issued when the run is cancelled while it fetches', async () => {
    const usingApi = () =>
      leasedRun('ws_1', RUNNER, { spotlightApi: true, injectedSecrets: [] });
    const expired = usingApi().expireLease(usingApi().leaseExpiresAt as Date);
    const { handler, revoked } = fetching(LEASED_RUN, usingApi(), expired);

    await expect(
      handler.execute(
        new FetchRunSecretsCommand('egress-token', 'recipient-key'),
      ),
    ).resolves.toMatchObject({ runId: null, spotlightApi: null });
    expect(revoked).toEqual(['ws_1/run_1#1', 'ws_1/token_1']);
  });
});

describe('FetchSharedRunSecretsHandler', () => {
  const SHARED: SharedEgressAuthentication = {
    ...LEASED_RUN,
    egressId: 'egress_1',
  };

  it('fetches for the run of the proxy credential, pinned to the shared egress', async () => {
    const { through, fetches } = fetching(
      null,
      leasedRun(),
      leasedRun(),
      SHARED,
    );

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
    expect(fetches).toMatchObject([
      { recipient: 'node-key', sharedEgress: 'egress_1' },
    ]);
  });

  it('rejects an unknown egress token, or a proxy credential that matches no runner', async () => {
    for (const [token, credential] of [
      ['other', 'proxy-credential'],
      ['shared-token', 'another-credential'],
    ]) {
      const { through, fetches } = fetching(
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
      expect(fetches).toEqual([]);
    }
  });

  it('tells egress to wait while the runner has no run, or has lost it', async () => {
    for (const [egressFor, run] of [
      [{ ...SHARED, work: null }, leasedRun()],
      [SHARED, leasedRun('ws_1', 'runner_2')],
    ] as const) {
      const { through, fetches } = fetching(null, run, run, egressFor);

      await expect(
        through.execute(
          new FetchSharedRunSecretsCommand(
            'shared-token',
            'proxy-credential',
            'node-key',
          ),
        ),
      ).resolves.toEqual({ outcome: 'waiting' });
      expect(fetches).toEqual([]);
    }
  });

  it('answers a leased run that injects no secrets, so egress stops requesting', async () => {
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

  it('binds the control plane host when the run uses Spotlight’s API', async () => {
    const usingApi = leasedRun('ws_1', RUNNER, {
      spotlightApi: true,
      injectedSecrets: [],
    });
    const { through } = fetching(null, usingApi, usingApi, SHARED);

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

  it('never takes the egress token of an egress sidecar', async () => {
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
