import type {
  PoolRunnersPort,
  StartedPoolRunner,
} from '@runners/application/ports/pool-runners.port';
import type { RunnerPoolsPort } from '@runners/application/ports/runner-pools.port';
import type { RunnerPresencePort } from '@runners/application/ports/runner-presence.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ClaimPoolWorkHandler } from '@work/application/commands/handlers/claim-pool-work.handler';
import { ClaimPoolWorkCommand } from '@work/application/commands/runner.commands';
import type { ClaimedCheck } from '@work/application/ports/check-work.port';
import type { RunLeases } from '@work/application/services/run-leases.service';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-24T09:00:00.000Z');
const POOLED = RunnerId.of('pooled_1');
const HARNESSES = [{ id: 'claude-code', models: ['sonnet'] }];

const taken = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('claude-code'),
    spec: RunSpec.of({
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'work out what is being asked for',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task_1-station_1', keep: true },
    }),
  }).claim(POOLED, NOW);

const aCheck: ClaimedCheck = {
  stackId: 'stack_1',
  runId: 'run_1',
  repository: 'widgets',
  base: null,
  setup: null,
  command: 'npm test',
  steps: [],
};

const pulling = (
  over: {
    started?: StartedPoolRunner;
    run?: Run | null;
    check?: ClaimedCheck | null;
  } = {},
) => {
  let now = NOW;
  const clock = {
    now: () => now,
    sleep: async (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  } as ClockPort;
  const pooled = {
    start: vi.fn(
      async (): Promise<StartedPoolRunner> =>
        over.started ?? {
          outcome: 'started',
          runnerId: POOLED,
          token: 'one-run-token',
        },
    ),
    took: vi.fn(async () => {}),
    letGo: vi.fn(async () => {}),
  };
  const claimNext = vi.fn(async () =>
    over.run === undefined ? null : over.run,
  );
  const claimCheck = vi.fn(async () => over.check ?? null);
  const pools = {
    pulledWith: vi.fn(async (token: string | undefined) =>
      token !== 'pool-token'
        ? null
        : {
            poolId: 'pool_1',
            workspaceId: WorkspaceId.of('ws_1'),
            key: 'burst',
            labels: RunnerTerms.of(['linux']),
            maxRuns: 4,
          },
    ),
  };
  const presence = {
    seen: vi.fn(async () => ({
      workspaceId: WorkspaceId.of('ws_1'),
      harnesses: [HarnessId.of('claude-code')],
      terms: RunnerTerms.of(['linux']),
      claims: 'any' as const,
    })),
    pinnableTerms: vi.fn(async () => null),
  };
  const handler = new ClaimPoolWorkHandler(
    pools as unknown as RunnerPoolsPort,
    pooled as unknown as PoolRunnersPort,
    presence as RunnerPresencePort,
    { claimNext } as unknown as RunRepository,
    { requeueLapsed: vi.fn(async () => []) } as unknown as RunLeases,
    {
      claimNext: claimCheck,
      claimReserved: vi.fn(async () => null),
      waitingPlacements: vi.fn(async () => []),
    },
    clock,
  );

  return { handler, pooled, claimNext, claimCheck };
};

const pull = (token = 'pool-token') =>
  new ClaimPoolWorkCommand(token, HARNESSES);

describe('ClaimPoolWorkHandler', () => {
  it('refuses a token no pool pulls with', async () => {
    const { handler, pooled } = pulling();

    expect(await handler.execute(pull('stolen'))).toEqual({
      outcome: 'refused',
    });
    expect(pooled.start).not.toHaveBeenCalled();
  });

  it('refuses once the pool it pulls for is gone', async () => {
    const { handler } = pulling({ started: { outcome: 'gone' } });

    expect(await handler.execute(pull())).toEqual({ outcome: 'refused' });
  });

  it('has nothing to hand out while the pool is full', async () => {
    const { handler, claimNext } = pulling({ started: { outcome: 'full' } });

    expect(await handler.execute(pull())).toEqual({ outcome: 'nothing' });
    expect(claimNext).not.toHaveBeenCalled();
  });

  it('starts a runner with what the pool reported installed, claimable for a minute', async () => {
    const { handler, pooled } = pulling({ run: taken() });

    await handler.execute(pull());

    expect(pooled.start).toHaveBeenCalledWith(
      'pool_1',
      HARNESSES,
      NOW,
      new Date(NOW.getTime() + 60_000),
    );
  });

  it('hands over a run with the runner it started and its one-run token', async () => {
    const { handler, pooled, claimNext } = pulling({ run: taken() });

    const claimed = await handler.execute(pull());

    expect(claimed).toMatchObject({
      outcome: 'claimed',
      runnerId: 'pooled_1',
      token: 'one-run-token',
      work: { kind: 'run', run: { id: 'run_1' } },
    });
    expect(claimNext).toHaveBeenCalledWith(
      expect.objectContaining({ runner: POOLED, claims: 'any' }),
      NOW,
    );
    expect(pooled.took).toHaveBeenCalledWith(
      POOLED,
      { kind: 'run', id: 'run_1' },
      NOW,
    );
  });

  it('hands over a check once no run wants the runner', async () => {
    const { handler, pooled } = pulling({ check: aCheck });

    const claimed = await handler.execute(pull());

    expect(claimed).toMatchObject({
      outcome: 'claimed',
      runnerId: 'pooled_1',
      work: { kind: 'check', check: aCheck },
    });
    expect(pooled.took).toHaveBeenCalledWith(
      POOLED,
      { kind: 'check', id: 'stack_1' },
      NOW,
    );
  });

  it('lets the runner go when nothing turned up while it waited', async () => {
    const { handler, pooled, claimNext } = pulling();

    expect(await handler.execute(pull())).toEqual({ outcome: 'nothing' });
    expect(claimNext.mock.calls.length).toBeGreaterThan(1);
    expect(pooled.took).not.toHaveBeenCalled();
    expect(pooled.letGo).toHaveBeenCalledWith(
      POOLED,
      new Date(NOW.getTime() + 10_000),
    );
  });
});
