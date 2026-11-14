import type { HostCredentials } from '@runners/application/ports/runner-authenticator.port';
import type {
  RunnersPort,
  StartedRunner,
} from '@runners/application/ports/runners.port';
import type {
  ReadyWarmSandbox,
  RequestedSandbox,
  SandboxesPort,
  SandboxTakingRuns,
  StartedSandbox,
  StartedWarmSandbox,
} from '@runners/application/ports/sandboxes.port';
import { ClaimHostWorkHandler } from '@runs/application/commands/handlers/claim-host-work.handler';
import { ClaimHostWorkCommand } from '@runs/application/commands/runner.commands';
import type { ClaimedCheck } from '@runs/application/ports/check-work.port';
import type {
  ClaimGate,
  RunStart,
} from '@runs/application/services/claim-gate.service';
import { ClaimsTaken } from '@runs/application/services/claims-taken.service';
import { LongPoll } from '@runs/application/services/long-poll';
import type { RunClaims } from '@runs/application/services/run-claims.service';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import { claimer, orderedFor } from '@runs/domain/aggregates/run.fake-spec';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import type { WorkingCopyArchiveRepository } from '@runs/domain/repositories/working-copy-archive.repository';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import { WarmFingerprint } from '@runs/domain/value-objects/warm-fingerprint.vo';
import { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import { CheckWorkId } from '@shared-kernel/domain/value-objects/check-work-id.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-24T09:00:00.000Z');
const POOLED = RunnerId.of('pooled_1');
const SETUP_OF_LINE_1 = WarmFingerprint.ofSetup({
  checkouts: [],
  placement: RunnerPlacement.anywhere(),
}).value;
const IMAGE = 'ghcr.io/acme/runner:main';

const queued = (harness = 'claude-code') =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of(harness),
    ...orderedFor.holdingTurn('task_1', 0),
    spec: RunSpec.of({
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'work out what the request wants',
      handover: { options: [], noteLimit: 4_000 },
      resume: {},
    }),
  });

const taken = () => queued().claim(claimer(POOLED), NOW);

const aCheck: ClaimedCheck = {
  checkId: CheckWorkId.of('stack_1'),
  repeat: false,
  runId: RunId.of('run_1'),
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
    requested?: readonly RequestedSandbox[];
    startsRequested?: StartedSandbox | null;
    newest?: Run | null;
    queuedForKey?: readonly Run[];
    requestedWarm?: readonly string[];
    startsWarm?: StartedWarmSandbox | null;
    readyWarm?: readonly ReadyWarmSandbox[];
    firstRuns?: readonly Run[];
    firstRunsPerPage?: number;
    archived?: readonly WorkingCopyKey[];
    adopts?: boolean;
  } = {},
) => {
  let now = NOW;
  const clock = {
    now: () => now,
    sleep: async (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
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
    claimantOf: vi.fn(async () => ({
      workspaceId: WorkspaceId.of('ws_1'),
      harnesses: [HarnessId.of('claude-code')],
      offer: RunnerOffer.of(['linux']),
      claims: 'reserved' as const,
    })),
  };
  const saved: Run[] = [];
  const runs = {
    newestWithKey: vi.fn(async () => over.newest ?? null),
    queuedWithKey: vi.fn(async () => over.queuedForKey ?? []),
    queuedFirstRuns: vi.fn(
      async (
        _in: WorkspaceId,
        page: { readonly avoiding: readonly WorkingCopyKey[] },
      ) => ({
        waiting: (over.firstRuns ?? [])
          .filter(
            (each) =>
              !page.avoiding.some(
                (key) => each.workingCopyKey?.equals(key) ?? false,
              ),
          )
          .slice(0, over.firstRunsPerPage),
        leasedRequesters: [],
      }),
    ),
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
    isLeasedBy: vi.fn(async () => false),
    waitingPlacements: vi.fn(async () => []),
  };
  const sandboxes = {
    holdForRun: vi.fn(async () => ({
      id: 'sandbox_1',
      token: 'sandbox-token',
    })),
    takingRuns: vi.fn(async () => over.taking ?? null),
    holdInSandbox: vi.fn(async () => over.holds ?? true),
    liveKeysIn: vi.fn(async () => over.liveKeys ?? []),
    releaseRun: vi.fn(async () => {}),
    retireRun: vi.fn(async () => {}),
    open: vi.fn(async () => ({ id: 'sandbox_1', state: 'starting' as const })),
    requestedIn: vi.fn(async () => over.requested ?? []),
    startRequested: vi.fn(async (id: string) =>
      over.startsRequested === undefined
        ? { id, token: 'requested-token' }
        : over.startsRequested,
    ),
    drain: vi.fn(async () => {}),
    requestedWarmIn: vi.fn(async () => over.requestedWarm ?? []),
    startWarm: vi.fn(async () => over.startsWarm ?? null),
    readyWarmIn: vi.fn(async () => over.readyWarm ?? []),
    adoptForRun: vi.fn(async () => over.adopts ?? true),
    authenticate: vi.fn(async () => null),
    holdArchive: vi.fn(async () => true),
    releaseArchive: vi.fn(async () => {}),
    heldForArchive: vi.fn(async () => false),
  } satisfies SandboxesPort;
  const archives = {
    completedKeysAmong: vi.fn(
      async (_: WorkspaceId, keys: readonly WorkingCopyKey[]) =>
        keys.filter((key) => over.archived?.some((each) => each.equals(key))),
    ),
  } as unknown as WorkingCopyArchiveRepository;
  const handler = new ClaimHostWorkHandler(
    authenticator,
    runners as unknown as RunnersPort,
    heartbeats,
    runs,
    { next: claimNext } as unknown as RunClaims,
    checks,
    clock,
    { mayStart: mayStart } as unknown as ClaimGate,
    new ClaimsTaken(runs, checks, runners as unknown as RunnersPort, clock, {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }),
    new LongPoll(clock),
    sandboxes,
    { hosts: () => ['archives.example.com'] },
    archives,
  );

  return {
    handler,
    sandboxes,
    runs,
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
      sandboxToken: 'sandbox-token',
      reused: false,
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
      {
        workspaceId: 'ws_1',
        key: 'requester/subject-task_1',
        line: null,
        lineFingerprint: null,
        hostId: HOST,
        runId: 'run_1',
      },
      NOW,
    );
  });

  it('puts the run back and releases the runner when the sandbox for the claimed run cannot be held', async () => {
    const { handler, runners, sandboxes, saved } = pulling({ run: taken() });
    sandboxes.holdForRun.mockRejectedValueOnce(new Error('sandboxes down'));

    await expect(handler.execute(pull())).rejects.toThrow('sandboxes down');
    expect(saved[saved.length - 1]?.state).toBe('queued');
    expect(runners.release).toHaveBeenCalledWith(POOLED, NOW);
  });

  it('leaves the runs of keys that ready sandboxes keep to those sandboxes', async () => {
    const { handler, claimNext } = pulling({
      run: taken(),
      liveKeys: ['requester/subject-task_2', 'requester/conversation-chat_1'],
    });

    await handler.execute(pull());

    expect(claimNext).toHaveBeenCalledWith(
      expect.objectContaining({
        sandbox: {
          avoiding: [
            WorkingCopyKey.parse('requester/subject-task_2'),
            WorkingCopyKey.parse('requester/conversation-chat_1'),
          ],
        },
      }),
      NOW,
    );
  });

  describe('a claim for a live sandbox', () => {
    const live: SandboxTakingRuns = {
      id: 'sandbox_7',
      workspaceId: 'ws_1',
      key: 'requester/subject-task_1',
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
        sandboxToken: null,
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
          sandbox: { into: WorkingCopyKey.parse('requester/subject-task_1') },
        }),
        NOW,
      );
      expect(sandboxes.holdInSandbox).toHaveBeenCalledWith(
        'sandbox_7',
        {
          workspaceId: 'ws_1',
          key: 'requester/subject-task_1',
          line: null,
          lineFingerprint: null,
          hostId: HOST,
          runId: 'run_1',
        },
        NOW,
      );
      expect(sandboxes.holdForRun).not.toHaveBeenCalled();
    });

    it('drains the sandbox and takes nothing when its image cannot run the queued run of its key', async () => {
      const { handler, runners, claimNext, sandboxes } = pulling({
        run: taken(),
        taking: live,
        queuedForKey: [queued('codex')],
      });

      expect(await handler.execute(into())).toEqual({ outcome: 'nothing' });
      expect(sandboxes.drain).toHaveBeenCalledWith('sandbox_7');
      expect(claimNext).not.toHaveBeenCalled();
      expect(runners.release).toHaveBeenCalledWith(POOLED, NOW);
    });

    it('keeps a sandbox whose image can run the queued run of its key', async () => {
      const { handler, sandboxes } = pulling({
        run: taken(),
        taking: live,
        queuedForKey: [queued()],
      });

      expect(await handler.execute(into())).toMatchObject({
        outcome: 'claimed',
      });
      expect(sandboxes.drain).not.toHaveBeenCalled();
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

    it('puts the run back and releases the runner when holding the run in the sandbox fails', async () => {
      const { handler, runners, saved, sandboxes } = pulling({
        run: taken(),
        taking: live,
      });
      sandboxes.holdInSandbox.mockRejectedValueOnce(
        new Error('sandboxes down'),
      );

      await expect(handler.execute(into())).rejects.toThrow('sandboxes down');
      expect(saved[saved.length - 1]?.state).toBe('queued');
      expect(runners.release).toHaveBeenCalledWith(POOLED, NOW);
    });

    it('puts the run back and releases the runner when the sandbox took another run or drained meanwhile', async () => {
      const { handler, runners, saved } = pulling({
        run: taken(),
        taking: live,
        holds: false,
      });

      expect(await handler.execute(into())).toEqual({ outcome: 'nothing' });
      expect(saved[saved.length - 1]?.state).toBe('queued');
      expect(saved[saved.length - 1]?.attempt).toEqual(taken().attempt);
      expect(runners.release).toHaveBeenCalledWith(POOLED, NOW);
    });
  });

  describe('a sandbox requested with no run', () => {
    const requested: RequestedSandbox = {
      id: 'sandbox_r',
      key: 'requester/subject-task_1',
    };

    it('is started when no run waits, with its own token and the hosts it may reach, and the runner is let go', async () => {
      const { handler, runners, sandboxes, claimCheck } = pulling({
        requested: [requested],
        check: aCheck,
      });

      expect(await handler.execute(pull())).toEqual({
        outcome: 'sandbox',
        sandboxId: 'sandbox_r',
        sandboxToken: 'requested-token',
        allowedHosts: ['archives.example.com'],
        warm: null,
      });
      expect(sandboxes.startRequested).toHaveBeenCalledWith(
        'sandbox_r',
        HOST,
        NOW,
      );
      expect(claimCheck).not.toHaveBeenCalled();
      expect(runners.claim).not.toHaveBeenCalled();
      expect(runners.release).toHaveBeenCalledWith(POOLED, NOW);
    });

    it('comes before a run that waits, as a person waits for it', async () => {
      const { handler, claimNext, sandboxes } = pulling({
        run: taken(),
        requested: [requested],
      });

      expect(await handler.execute(pull())).toMatchObject({
        outcome: 'sandbox',
        sandboxId: 'sandbox_r',
      });
      expect(sandboxes.startRequested).toHaveBeenCalled();
      expect(claimNext).not.toHaveBeenCalled();
    });

    it('is started alone when the queued run of its key cannot be taken now', async () => {
      const { handler, claimNext, sandboxes } = pulling({
        requested: [requested],
        newest: queued(),
      });

      expect(await handler.execute(pull())).toMatchObject({
        outcome: 'sandbox',
        sandboxId: 'sandbox_r',
      });
      expect(claimNext).toHaveBeenCalledTimes(1);
      expect(sandboxes.startRequested).toHaveBeenCalled();
    });

    it('stops the claim, starting nothing, when the run of its key had to be requeued', async () => {
      const { handler, sandboxes } = pulling({
        run: taken(),
        requested: [requested],
        newest: queued(),
        starts: 'requeued',
      });

      expect(await handler.execute(pull())).toEqual({ outcome: 'nothing' });
      expect(sandboxes.startRequested).not.toHaveBeenCalled();
    });

    it('takes a queued run of its key before other runs, and the run starts in it', async () => {
      const { handler, claimNext, sandboxes } = pulling({
        run: taken(),
        requested: [requested],
        newest: queued(),
      });

      expect(await handler.execute(pull())).toMatchObject({
        outcome: 'claimed',
        work: { kind: 'run' },
      });
      expect(claimNext).toHaveBeenCalledTimes(1);
      expect(claimNext).toHaveBeenCalledWith(
        expect.objectContaining({
          sandbox: { into: WorkingCopyKey.parse('requester/subject-task_1') },
        }),
        NOW,
      );
      expect(sandboxes.startRequested).not.toHaveBeenCalled();
    });

    it('is placed where the newest run of its key would run', async () => {
      const { handler, sandboxes } = pulling({
        requested: [requested],
        newest: queued('codex'),
        check: aCheck,
      });

      expect(await handler.execute(pull())).toMatchObject({
        outcome: 'claimed',
        work: { kind: 'check' },
      });
      expect(sandboxes.startRequested).not.toHaveBeenCalled();
    });

    it('is started on a host that fits the newest run of its key', async () => {
      const { handler } = pulling({
        requested: [requested],
        newest: queued(),
      });

      expect(await handler.execute(pull())).toMatchObject({
        outcome: 'sandbox',
        sandboxId: 'sandbox_r',
      });
    });

    it('is left to the next claim when another host started it first', async () => {
      const { handler } = pulling({
        requested: [requested],
        startsRequested: null,
      });

      expect(await handler.execute(pull())).toEqual({ outcome: 'nothing' });
    });
  });

  describe('a warm sandbox', () => {
    const warm: StartedWarmSandbox = {
      id: 'sandbox_w',
      token: 'warm-token',
      warm: {
        line: 'line_1',
        checkouts: [{ path: 'widgets', setup: 'npm ci' }],
      },
    };
    const keeping: SandboxTakingRuns = {
      id: 'sandbox_w',
      workspaceId: 'ws_1',
      warmFor: 'line_1',
      fingerprint: SETUP_OF_LINE_1,
    };
    const into = () =>
      new ClaimHostWorkCommand(
        { bearer: 'pool-token', trust: undefined },
        HOST,
        IMAGE,
        'sandbox_w',
      );
    const firstRun = (task = 'task_9') =>
      Run.enqueue({
        id: RunId.of(`run_of_${task}`),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('claude-code'),
        ...orderedFor.holdingTurn(task, 0),
        line: LineId.of('line_1'),
        now: NOW,
        spec: RunSpec.of({
          command: { executable: 'claude-agent-acp', args: [] },
          briefing: 'start the task',
          handover: { options: [], noteLimit: 4_000 },
          resume: {},
        }),
      });

    it('is started after the queued runs, before a check, with the repositories to clone, on the host’s offer', async () => {
      const { handler, sandboxes, claimCheck, runners } = pulling({
        requestedWarm: ['sandbox_w'],
        startsWarm: warm,
        check: aCheck,
      });

      expect(await handler.execute(pull())).toEqual({
        outcome: 'sandbox',
        sandboxId: 'sandbox_w',
        sandboxToken: 'warm-token',
        allowedHosts: ['archives.example.com'],
        warm: warm.warm,
      });
      expect(sandboxes.startWarm).toHaveBeenCalledWith(
        'sandbox_w',
        HOST,
        RunnerOffer.of(['linux']),
        NOW,
      );
      expect(claimCheck).not.toHaveBeenCalled();
      expect(runners.release).toHaveBeenCalledWith(POOLED, NOW);
    });

    it('waits while a queued run can be taken', async () => {
      const { handler, sandboxes } = pulling({
        run: taken(),
        requestedWarm: ['sandbox_w'],
        startsWarm: warm,
      });

      expect(await handler.execute(pull())).toMatchObject({
        outcome: 'claimed',
        work: { kind: 'run' },
      });
      expect(sandboxes.startWarm).not.toHaveBeenCalled();
    });

    it('takes up a check when no host offer fits the requested warm sandbox', async () => {
      const { handler } = pulling({
        requestedWarm: ['sandbox_w'],
        startsWarm: null,
        check: aCheck,
      });

      expect(await handler.execute(pull())).toMatchObject({
        outcome: 'claimed',
        work: { kind: 'check' },
      });
    });

    it('keeps from other hosts the first run of its line that it waits for', async () => {
      const { handler, claimNext, runs } = pulling({
        run: taken(),
        liveKeys: ['requester/subject-task_2'],
        readyWarm: [
          { id: 'sandbox_w', line: 'line_1', fingerprint: SETUP_OF_LINE_1 },
        ],
        firstRuns: [firstRun()],
      });

      await handler.execute(pull());

      expect(runs.queuedFirstRuns).toHaveBeenCalledWith(
        WorkspaceId.of('ws_1'),
        {
          lines: [LineId.of('line_1')],
          avoiding: [WorkingCopyKey.parse('requester/subject-task_2')],
          queuedSince: new Date(NOW.getTime() - 60_000),
        },
      );
      expect(claimNext).toHaveBeenCalledWith(
        expect.objectContaining({
          sandbox: {
            avoiding: [
              WorkingCopyKey.parse('requester/subject-task_2'),
              firstRun().workingCopyKey,
            ],
          },
        }),
        NOW,
      );
    });

    it('keeps from other hosts no first run whose working copy has a completed archive', async () => {
      const { handler, claimNext } = pulling({
        run: taken(),
        readyWarm: [
          { id: 'sandbox_w', line: 'line_1', fingerprint: SETUP_OF_LINE_1 },
        ],
        firstRuns: [firstRun()],
        archived: [firstRun().workingCopyKey as WorkingCopyKey],
      });

      await handler.execute(pull());

      expect(claimNext).toHaveBeenCalledWith(
        expect.objectContaining({ sandbox: { avoiding: [] } }),
        NOW,
      );
    });

    it('keeps from other hosts the first run of its line queued behind a page of runs with completed archives', async () => {
      const archivedRun = firstRun('task_8');
      const { handler, claimNext } = pulling({
        run: taken(),
        readyWarm: [
          { id: 'sandbox_w', line: 'line_1', fingerprint: SETUP_OF_LINE_1 },
        ],
        firstRuns: [archivedRun, firstRun()],
        firstRunsPerPage: 1,
        archived: [archivedRun.workingCopyKey as WorkingCopyKey],
      });

      await handler.execute(pull());

      expect(claimNext).toHaveBeenCalledWith(
        expect.objectContaining({
          sandbox: { avoiding: [firstRun().workingCopyKey] },
        }),
        NOW,
      );
    });

    it('looks past at most three pages of runs with completed archives on a claim', async () => {
      const archivedRuns = ['task_5', 'task_6', 'task_7', 'task_8'].map(
        (each) => firstRun(each),
      );
      const { handler, runs } = pulling({
        run: taken(),
        readyWarm: [
          { id: 'sandbox_w', line: 'line_1', fingerprint: SETUP_OF_LINE_1 },
        ],
        firstRuns: [...archivedRuns, firstRun()],
        firstRunsPerPage: 1,
        archived: archivedRuns.map(
          (each) => each.workingCopyKey as WorkingCopyKey,
        ),
      });

      await handler.execute(pull());

      expect(runs.queuedFirstRuns).toHaveBeenCalledTimes(4);
    });

    it('takes the first run of a task on its line, avoiding keys that have a sandbox, and is adopted by it', async () => {
      const { handler, claimNext, sandboxes } = pulling({
        run: taken(),
        taking: keeping,
        liveKeys: ['requester/subject-task_2'],
        requested: [{ id: 'sandbox_r', key: 'requester/subject-task_3' }],
      });

      expect(await handler.execute(into())).toMatchObject({
        outcome: 'claimed',
        sandboxId: 'sandbox_w',
        sandboxToken: null,
        reused: true,
        work: { kind: 'run', run: { id: 'run_1' } },
      });
      expect(claimNext).toHaveBeenCalledWith(
        expect.objectContaining({
          sandbox: {
            firstOfLine: LineId.of('line_1'),
            fingerprint: WarmFingerprint.of(SETUP_OF_LINE_1),
            avoiding: [
              WorkingCopyKey.parse('requester/subject-task_2'),
              WorkingCopyKey.parse('requester/subject-task_3'),
            ],
          },
        }),
        NOW,
      );
      expect(sandboxes.adoptForRun).toHaveBeenCalledWith(
        'sandbox_w',
        {
          workspaceId: 'ws_1',
          key: taken().workingCopyKey?.value ?? null,
          line: null,
          lineFingerprint: null,
          hostId: HOST,
          runId: 'run_1',
        },
        NOW,
      );
      expect(sandboxes.holdInSandbox).not.toHaveBeenCalled();
      expect(sandboxes.drain).not.toHaveBeenCalled();
    });

    it('offers the warm sandbox the line setup the run was ordered under', async () => {
      const ordered = Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('claude-code'),
        ...orderedFor.holdingTurn('task_1', 0),
        line: LineId.of('line_1'),
        now: NOW,
        spec: RunSpec.of({
          command: { executable: 'claude-agent-acp', args: [] },
          briefing: 'start the task',
          handover: { options: [], noteLimit: 4_000 },
          resume: {},
        }),
      }).claim(claimer(POOLED), NOW);
      const { handler, sandboxes } = pulling({
        run: ordered,
        taking: keeping,
      });

      await handler.execute(into());

      expect(sandboxes.adoptForRun).toHaveBeenCalledWith(
        'sandbox_w',
        expect.objectContaining({
          line: 'line_1',
          lineFingerprint: SETUP_OF_LINE_1,
        }),
        NOW,
      );
    });

    it('puts the run back and releases the runner when adopting the warm sandbox fails', async () => {
      const { handler, runners, saved, sandboxes } = pulling({
        run: taken(),
        taking: keeping,
      });
      sandboxes.adoptForRun.mockRejectedValueOnce(new Error('sandboxes down'));

      await expect(handler.execute(into())).rejects.toThrow('sandboxes down');
      expect(saved[saved.length - 1]?.state).toBe('queued');
      expect(runners.release).toHaveBeenCalledWith(POOLED, NOW);
    });

    it('puts the run back and releases the runner when the warm sandbox could not adopt it', async () => {
      const { handler, runners, saved } = pulling({
        run: taken(),
        taking: keeping,
        adopts: false,
      });

      expect(await handler.execute(into())).toEqual({ outcome: 'nothing' });
      expect(saved[saved.length - 1]?.state).toBe('queued');
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
      sandboxToken: null,
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
    expect(saved[0]?.attempt).toEqual(taken().attempt);
    expect(runners.release).toHaveBeenCalledWith(POOLED, NOW);
  });

  it('puts the check back, uncounted, when the runner cannot take it', async () => {
    const { handler, unclaim } = pulling({
      check: aCheck,
      tookFails: true,
    });

    await expect(handler.execute(pull())).rejects.toThrow('pooled_1 is spent');
    expect(unclaim).toHaveBeenCalledWith(
      CheckWorkId.of('stack_1'),
      false,
      POOLED,
      NOW,
    );
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
