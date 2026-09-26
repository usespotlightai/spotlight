import type {
  HostCredential,
  RunnerAdmissionsPort,
} from '@runners/application/ports/runner-admissions.port';
import type { RunnerPresencePort } from '@runners/application/ports/runner-presence.port';
import type {
  RunnersPort,
  StartedRunner,
} from '@runners/application/ports/runners.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ClaimHostWorkHandler } from '@work/application/commands/handlers/claim-host-work.handler';
import { ClaimHostWorkCommand } from '@work/application/commands/runner.commands';
import type { ClaimedCheck } from '@work/application/ports/check-work.port';
import type { RunLeases } from '@work/application/services/run-leases.service';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-24T09:00:00.000Z');
const POOLED = RunnerId.of('pooled_1');
const IMAGE = 'ghcr.io/acme/runner:main';

const taken = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('claude-code'),
    spec: RunSpec.of({
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'work out what is being asked for',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task_1-station_1' },
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
    started?: StartedRunner | StartedRunner[];
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
  const answers: StartedRunner[] = [
    over.started ?? {
      outcome: 'started',
      runnerId: POOLED,
      token: 'one-run-token',
      egressToken: 'egress-token',
    },
  ].flat();
  const runners = {
    start: vi.fn(
      async (): Promise<StartedRunner> =>
        (answers.length > 1 ? answers.shift() : answers[0]) as StartedRunner,
    ),
    took: vi.fn(async () => {}),
    letGo: vi.fn(async () => {}),
  };
  const claimNext = vi.fn(async () =>
    over.run === undefined ? null : over.run,
  );
  const claimCheck = vi.fn(async () => over.check ?? null);
  const admissions = {
    admit: vi.fn(async (credential: HostCredential) =>
      credential.bearer !== 'pool-token'
        ? null
        : {
            way: { kind: 'pool' as const, id: 'pool_1' },
            workspaceId: WorkspaceId.of('ws_1'),
          },
    ),
  };
  const presence = {
    seen: vi.fn(async () => ({
      workspaceId: WorkspaceId.of('ws_1'),
      harnesses: [HarnessId.of('claude-code')],
      terms: RunnerTerms.of(['linux']),
      claims: 'reserved' as const,
    })),
  };
  const handler = new ClaimHostWorkHandler(
    admissions as RunnerAdmissionsPort,
    runners as unknown as RunnersPort,
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

  return { handler, admissions, runners, claimNext, claimCheck };
};

const HOST = '01J8ZQ4Y7N3K5V2W9X6RTBHCDE';

const pull = (bearer = 'pool-token', trust?: string) =>
  new ClaimHostWorkCommand({ bearer, trust }, HOST, IMAGE);

describe('ClaimHostWorkHandler', () => {
  it('refuses a host no pool or trust admits', async () => {
    const { handler, admissions, runners } = pulling();

    expect(await handler.execute(pull('stolen', 'trust_1'))).toEqual({
      outcome: 'refused',
    });
    expect(admissions.admit).toHaveBeenCalledWith({
      bearer: 'stolen',
      trust: 'trust_1',
    });
    expect(runners.start).not.toHaveBeenCalled();
  });

  it('refuses once the pool or trust it pulls through is gone', async () => {
    const { handler } = pulling({ started: { outcome: 'gone' } });

    expect(await handler.execute(pull())).toEqual({ outcome: 'refused' });
  });

  it('waits out the poll while the pool is full, then has nothing to hand out', async () => {
    const { handler, runners, claimNext } = pulling({
      started: { outcome: 'full' },
    });

    expect(await handler.execute(pull())).toEqual({ outcome: 'nothing' });
    expect(runners.start.mock.calls.length).toBeGreaterThan(1);
    expect(runners.start).toHaveBeenLastCalledWith(
      { kind: 'pool', id: 'pool_1' },
      HOST,
      IMAGE,
      new Date(NOW.getTime() + 10_000),
      new Date(NOW.getTime() + 70_000),
    );
    expect(claimNext).not.toHaveBeenCalled();
  });

  it('starts a runner once the full pool makes room while it waits', async () => {
    const { handler, runners } = pulling({
      started: [
        { outcome: 'full' },
        { outcome: 'full' },
        {
          outcome: 'started',
          runnerId: POOLED,
          token: 'one-run-token',
          egressToken: 'egress-token',
        },
      ],
      run: taken(),
    });

    expect(await handler.execute(pull())).toMatchObject({
      outcome: 'claimed',
      runnerId: 'pooled_1',
    });
    expect(runners.start).toHaveBeenCalledTimes(3);
    expect(runners.start).toHaveBeenLastCalledWith(
      { kind: 'pool', id: 'pool_1' },
      HOST,
      IMAGE,
      new Date(NOW.getTime() + 1_000),
      new Date(NOW.getTime() + 61_000),
    );
  });

  it('answers a host that never reported through this way in as a stranger, without waiting', async () => {
    const { handler, runners, claimNext } = pulling({
      started: { outcome: 'stranger' },
    });

    expect(await handler.execute(pull())).toEqual({ outcome: 'stranger' });
    expect(runners.start).toHaveBeenCalledTimes(1);
    expect(claimNext).not.toHaveBeenCalled();
  });

  it('answers a claim for an image the host did not report serving as unoffered', async () => {
    const { handler, claimNext } = pulling({
      started: { outcome: 'unoffered' },
    });

    expect(await handler.execute(pull())).toEqual({ outcome: 'unoffered' });
    expect(claimNext).not.toHaveBeenCalled();
  });

  it('starts a runner, on the host that asked, through the way it was admitted, naming the image it claims for, claimable for a minute', async () => {
    const { handler, runners } = pulling({ run: taken() });

    await handler.execute(pull());

    expect(runners.start).toHaveBeenCalledWith(
      { kind: 'pool', id: 'pool_1' },
      HOST,
      IMAGE,
      NOW,
      new Date(NOW.getTime() + 60_000),
    );
  });

  it('hands over a run with the runner it started and its one-run token', async () => {
    const { handler, runners, claimNext } = pulling({ run: taken() });

    const claimed = await handler.execute(pull());

    expect(claimed).toMatchObject({
      outcome: 'claimed',
      runnerId: 'pooled_1',
      token: 'one-run-token',
      egressToken: 'egress-token',
      work: { kind: 'run', run: { id: 'run_1', harness: 'claude-code' } },
    });
    expect(claimNext).toHaveBeenCalledWith(
      expect.objectContaining({ runner: POOLED, claims: 'any' }),
      NOW,
    );
    expect(runners.took).toHaveBeenCalledWith(
      POOLED,
      { kind: 'run', id: 'run_1' },
      NOW,
    );
  });

  it('hands over a check once no run wants the runner', async () => {
    const { handler, runners } = pulling({ check: aCheck });

    const claimed = await handler.execute(pull());

    expect(claimed).toMatchObject({
      outcome: 'claimed',
      runnerId: 'pooled_1',
      work: { kind: 'check', check: aCheck },
    });
    expect(runners.took).toHaveBeenCalledWith(
      POOLED,
      { kind: 'check', id: 'stack_1' },
      NOW,
    );
  });

  it('lets the runner go when nothing turned up while it waited', async () => {
    const { handler, runners, claimNext } = pulling();

    expect(await handler.execute(pull())).toEqual({ outcome: 'nothing' });
    expect(claimNext.mock.calls.length).toBeGreaterThan(1);
    expect(runners.took).not.toHaveBeenCalled();
    expect(runners.letGo).toHaveBeenCalledWith(
      POOLED,
      new Date(NOW.getTime() + 10_000),
    );
  });
});
