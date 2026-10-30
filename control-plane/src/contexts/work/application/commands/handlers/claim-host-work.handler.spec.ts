import type {
  HostCredentials,
  RunnerAuthenticatorPort,
} from '@runners/application/ports/runner-authenticator.port';
import type { RunnerHeartbeatsPort } from '@runners/application/ports/runner-heartbeats.port';
import type {
  RunnersPort,
  StartedRunner,
} from '@runners/application/ports/runners.port';
import type {
  SandboxesPort,
  SandboxTakingRuns,
} from '@runners/application/ports/sandboxes.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ClaimHostWorkHandler } from '@work/application/commands/handlers/claim-host-work.handler';
import { ClaimHostWorkCommand } from '@work/application/commands/runner.commands';
import type { ClaimedCheck } from '@work/application/ports/check-work.port';
import { ClaimsTaken } from '@work/application/services/claims-taken.service';
import { LongPoll } from '@work/application/services/long-poll';
import type { RunLeases } from '@work/application/services/run-leases.service';
import type {
  RunStart,
  RunStartHooks,
} from '@work/application/services/run-start-hooks.service';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
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
      briefing: 'work out what the request wants',
      handover: { options: [], noteLimit: 4_000 },
      resume: { key: 'task-task_1' },
    }),
  }).claim(POOLED, NOW);

const aCheck: ClaimedCheck = {
  stackId: 'stack_1',
  recheck: false,
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
    starts?: RunStart;
    tookFails?: boolean;
    taking?: SandboxTakingRuns | null;
    holds?: boolean;
    liveKeys?: readonly string[];
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
    claim: vi.fn(async () => {
      if (over.tookFails) {
        throw new Error('pooled_1 is spent');
      }
    }),
    release: vi.fn(async () => {}),
  };
  const claimNext = vi.fn(async () =>
    over.run === undefined ? null : over.run,
  );
  const claimCheck = vi.fn(async () => over.check ?? null);
  const mayStart = vi.fn(
    async (): Promise<RunStart> => over.starts ?? 'starts',
  );
  const authenticator = {
    authenticate: vi.fn(async (credential: HostCredentials) =>
      credential.bearer !== 'pool-token'
        ? null
        : {
            source: { kind: 'pool' as const, id: 'pool_1' },
            workspaceId: WorkspaceId.of('ws_1'),
          },
    ),
  };
  const heartbeats = {
    heartbeat: vi.fn(async () => ({
      workspaceId: WorkspaceId.of('ws_1'),
      harnesses: [HarnessId.of('claude-code')],
      offer: RunnerOffer.of(['linux']),
      claims: 'reserved' as const,
    })),
  };
  const saved: Run[] = [];
  const runs = {
    claimNext,
    findById: vi.fn(async () => over.run ?? null),
    save: vi.fn(async (run: Run) => {
      saved.push(run);
    }),
  } as unknown as RunRepository;
  const unclaim = vi.fn(async () => {});
  const checks = {
    claimNext: claimCheck,
    claimReserved: vi.fn(async () => null),
    unclaim,
    renewLease: vi.fn(async () => 'renewed' as const),
    waitingPlacements: vi.fn(async () => []),
  };
  const sandboxes = {
    holdForRun: vi.fn(async () => 'sandbox_1'),
    takingRuns: vi.fn(async () => over.taking ?? null),
    holdInSandbox: vi.fn(async () => over.holds ?? true),
    liveKeysIn: vi.fn(async () => over.liveKeys ?? []),
    releaseRun: vi.fn(async () => {}),
  } satisfies SandboxesPort;
  const handler = new ClaimHostWorkHandler(
    authenticator as RunnerAuthenticatorPort,
    runners as unknown as RunnersPort,
    heartbeats as RunnerHeartbeatsPort,
    runs,
    { expireLeases: vi.fn(async () => []) } as unknown as RunLeases,
    checks,
    clock,
    { mayStart: mayStart } as unknown as RunStartHooks,
    new ClaimsTaken(runs, checks, runners as unknown as RunnersPort, clock, {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }),
    new LongPoll(clock),
    sandboxes,
  );

  return {
    handler,
    sandboxes,
    authenticator,
    runners,
    claimNext,
    claimCheck,
    mayStart,
    saved,
    unclaim,
  };
};

const HOST = '01J8ZQ4Y7N3K5V2W9X6RTBHCDE';

const pull = (bearer = 'pool-token', trust?: string) =>
  new ClaimHostWorkCommand({ bearer, trust }, HOST, IMAGE);

describe('ClaimHostWorkHandler', () => {
  it('rejects a host that no pool or trust accepts', async () => {
    const { handler, authenticator, runners } = pulling();

    expect(await handler.execute(pull('stolen', 'trust_1'))).toEqual({
      outcome: 'unauthorized',
    });
    expect(authenticator.authenticate).toHaveBeenCalledWith({
      bearer: 'stolen',
      trust: 'trust_1',
    });
    expect(runners.start).not.toHaveBeenCalled();
  });

  it('rejects once the pool or trust it pulls through is gone', async () => {
    const { handler } = pulling({ started: { outcome: 'gone' } });

    expect(await handler.execute(pull())).toEqual({ outcome: 'unauthorized' });
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
      null,
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
      null,
    );
  });

  it('answers a host that never reported through this pool or trust as host-unreported, without waiting', async () => {
    const { handler, runners, claimNext } = pulling({
      started: { outcome: 'host-unreported' },
    });

    expect(await handler.execute(pull())).toEqual({
      outcome: 'host-unreported',
    });
    expect(runners.start).toHaveBeenCalledTimes(1);
    expect(claimNext).not.toHaveBeenCalled();
  });

  it('answers a host older than the host minimum as host-outdated with both releases, without waiting', async () => {
    const outdated = {
      outcome: 'host-outdated',
      release: 'v0.4.3',
      minimum: 'v0.5.1',
    } as const;
    const { handler, runners, claimNext } = pulling({ started: outdated });

    expect(await handler.execute(pull())).toEqual(outdated);
    expect(runners.start).toHaveBeenCalledTimes(1);
    expect(claimNext).not.toHaveBeenCalled();
  });

  it('answers a claim for an image the host did not report supporting as image-unreported', async () => {
    const { handler, claimNext } = pulling({
      started: { outcome: 'image-unreported' },
    });

    expect(await handler.execute(pull())).toEqual({
      outcome: 'image-unreported',
    });
    expect(claimNext).not.toHaveBeenCalled();
  });

  it('starts a runner, on the host that requested it, through the way it was authenticated, naming the image it claims for, claimable for a minute', async () => {
    const { handler, runners } = pulling({ run: taken() });

    await handler.execute(pull());

    expect(runners.start).toHaveBeenCalledWith(
      { kind: 'pool', id: 'pool_1' },
      HOST,
      IMAGE,
      NOW,
      new Date(NOW.getTime() + 60_000),
      null,
    );
  });

  it('hands over a run with the runner it started and its one-run token, leaving the runner’s record to the run it claimed', async () => {
    const { handler, runners, claimNext } = pulling({ run: taken() });

    const claimed = await handler.execute(pull());

    expect(claimed).toMatchObject({
      outcome: 'claimed',
      runnerId: 'pooled_1',
      token: 'one-run-token',
      egressToken: 'egress-token',
      sandboxId: 'sandbox_1',
      work: { kind: 'run', run: { id: 'run_1', harness: 'claude-code' } },
    });
    expect(claimNext).toHaveBeenCalledWith(
      expect.objectContaining({ runner: POOLED, claims: 'any' }),
      NOW,
    );
    expect(runners.claim).toHaveBeenCalledWith(
      POOLED,
      { kind: 'run', id: 'run_1' },
      NOW,
    );
  });

  it('starts a sandbox for a claimed run, on the claiming host, under the run’s resume key and held by the run', async () => {
    const { handler, sandboxes } = pulling({ run: taken() });

    await handler.execute(pull());

    expect(sandboxes.holdForRun).toHaveBeenCalledWith(
      { workspaceId: 'ws_1', key: 'task-task_1', hostId: HOST, runId: 'run_1' },
      NOW,
    );
  });

  it('leaves the runs of keys that ready sandboxes keep to those sandboxes', async () => {
    const { handler, claimNext } = pulling({
      run: taken(),
      liveKeys: ['task-task_2', 'chat-chat_1'],
    });

    await handler.execute(pull());

    expect(claimNext).toHaveBeenCalledWith(
      expect.objectContaining({
        sandbox: {
          avoiding: [ResumeKey.of('task-task_2'), ResumeKey.of('chat-chat_1')],
        },
      }),
      NOW,
    );
  });

  describe('a claim for a live sandbox', () => {
    const live: SandboxTakingRuns = {
      id: 'sandbox_7',
      workspaceId: 'ws_1',
      key: 'task-task_1',
    };
    const into = () =>
      new ClaimHostWorkCommand(
        { bearer: 'pool-token', trust: undefined },
        HOST,
        IMAGE,
        'sandbox_7',
      );

    it('takes only a run of the key it keeps, and reuses the sandbox', async () => {
      const { handler, runners, claimNext, sandboxes } = pulling({
        run: taken(),
        taking: live,
      });

      expect(await handler.execute(into())).toMatchObject({
        outcome: 'claimed',
        sandboxId: 'sandbox_7',
        reused: true,
        work: { kind: 'run', run: { id: 'run_1' } },
      });
      expect(sandboxes.takingRuns).toHaveBeenCalledWith('sandbox_7', HOST);
      expect(runners.start).toHaveBeenCalledWith(
        { kind: 'pool', id: 'pool_1' },
        HOST,
        IMAGE,
        NOW,
        new Date(NOW.getTime() + 60_000),
        'sandbox_7',
      );
      expect(claimNext).toHaveBeenCalledWith(
        expect.objectContaining({
          sandbox: { into: ResumeKey.of('task-task_1') },
        }),
        NOW,
      );
      expect(sandboxes.holdInSandbox).toHaveBeenCalledWith(
        'sandbox_7',
        {
          workspaceId: 'ws_1',
          key: 'task-task_1',
          hostId: HOST,
          runId: 'run_1',
        },
        NOW,
      );
      expect(sandboxes.holdForRun).not.toHaveBeenCalled();
    });

    it('takes no check', async () => {
      const { handler, claimCheck } = pulling({ check: aCheck, taking: live });

      expect(await handler.execute(into())).toEqual({ outcome: 'nothing' });
      expect(claimCheck).not.toHaveBeenCalled();
    });

    it('starts no runner for a sandbox that takes no run', async () => {
      const { handler, runners } = pulling({ run: taken(), taking: null });

      expect(await handler.execute(into())).toEqual({ outcome: 'nothing' });
      expect(runners.start).not.toHaveBeenCalled();
    });

    it('puts the run back and releases the runner when the sandbox took another run or drained meanwhile', async () => {
      const { handler, runners, saved } = pulling({
        run: taken(),
        taking: live,
        holds: false,
      });

      expect(await handler.execute(into())).toEqual({ outcome: 'nothing' });
      expect(saved[saved.length - 1]?.state).toBe('queued');
      expect(saved[saved.length - 1]?.attempt).toBe(taken().attempt);
      expect(runners.release).toHaveBeenCalledWith(POOLED, NOW);
    });
  });

  it('hands over a check once no run wants the runner, with no sandbox', async () => {
    const { handler, runners, sandboxes } = pulling({ check: aCheck });

    const claimed = await handler.execute(pull());

    expect(claimed).toMatchObject({
      outcome: 'claimed',
      runnerId: 'pooled_1',
      sandboxId: null,
      work: { kind: 'check', check: aCheck },
    });
    expect(sandboxes.holdForRun).not.toHaveBeenCalled();
    expect(runners.claim).toHaveBeenCalledWith(
      POOLED,
      { kind: 'check', id: 'stack_1' },
      NOW,
    );
  });

  it('puts the run back on the queue, uncounted, and releases the runner, when the runner cannot take it', async () => {
    const { handler, runners, saved } = pulling({
      run: taken(),
      tookFails: true,
    });

    await expect(handler.execute(pull())).rejects.toThrow('pooled_1 is spent');
    expect(saved).toHaveLength(1);
    expect(saved[0]?.state).toBe('queued');
    expect(saved[0]?.claimedBy).toBeNull();
    expect(saved[0]?.attempt).toBe(taken().attempt);
    expect(runners.release).toHaveBeenCalledWith(POOLED, NOW);
  });

  it('puts the check back, uncounted, when the runner cannot take it', async () => {
    const { handler, unclaim } = pulling({
      check: aCheck,
      tookFails: true,
    });

    await expect(handler.execute(pull())).rejects.toThrow('pooled_1 is spent');
    expect(unclaim).toHaveBeenCalledWith('stack_1', false, POOLED, NOW);
  });

  it('releases the runner when nothing turned up while it waited', async () => {
    const { handler, runners, claimNext } = pulling();

    expect(await handler.execute(pull())).toEqual({ outcome: 'nothing' });
    expect(claimNext.mock.calls.length).toBeGreaterThan(1);
    expect(runners.claim).not.toHaveBeenCalled();
    expect(runners.release).toHaveBeenCalledWith(
      POOLED,
      new Date(NOW.getTime() + 10_000),
    );
  });

  it('assigns no run whose start a hook denied, and takes up a check instead', async () => {
    const { handler, runners, mayStart } = pulling({
      run: taken(),
      check: aCheck,
      starts: 'denied',
    });

    const claimed = await handler.execute(pull());

    expect(mayStart).toHaveBeenCalledWith(
      expect.objectContaining({ id: RunId.of('run_1') }),
      POOLED,
      new Date(NOW.getTime() + 10_000),
    );
    expect(claimed).toMatchObject({
      outcome: 'claimed',
      work: { kind: 'check', check: aCheck },
    });
    expect(runners.claim).not.toHaveBeenCalledWith(
      POOLED,
      { kind: 'run', id: 'run_1' },
      expect.anything(),
    );
  });

  it('keeps polling after a hook denied the start of a run', async () => {
    const { handler, claimNext } = pulling({ run: taken(), starts: 'denied' });

    expect(await handler.execute(pull())).toEqual({ outcome: 'nothing' });
    expect(claimNext.mock.calls.length).toBeGreaterThan(1);
  });

  it('stops polling at once, taking up no check, when a run had to be requeued', async () => {
    const { handler, claimNext, claimCheck, runners } = pulling({
      run: taken(),
      check: aCheck,
      starts: 'requeued',
    });

    expect(await handler.execute(pull())).toEqual({ outcome: 'nothing' });
    expect(claimNext).toHaveBeenCalledTimes(1);
    expect(claimCheck).not.toHaveBeenCalled();
    expect(runners.release).toHaveBeenCalledWith(POOLED, NOW);
  });
});
