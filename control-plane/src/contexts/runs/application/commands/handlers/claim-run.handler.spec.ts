import type {
  RunnerClaimant,
  RunnerClaims,
} from '@runners/application/ports/runner-claimants.port';
import type { RunnersPort } from '@runners/application/ports/runners.port';
import type { SandboxesPort } from '@runners/application/ports/sandboxes.port';
import { ClaimRunHandler } from '@runs/application/commands/handlers/claim-run.handler';
import { ClaimRunCommand } from '@runs/application/commands/runner.commands';
import type { ClaimedWorkDto } from '@runs/application/dto/run.dto';
import type { ClaimedCheck } from '@runs/application/ports/check-work.port';
import type {
  ClaimGate,
  RunStart,
} from '@runs/application/services/claim-gate.service';
import { ClaimsTaken } from '@runs/application/services/claims-taken.service';
import { LongPoll } from '@runs/application/services/long-poll';
import type { ProvisionFailures } from '@runs/application/services/provision-failures.service';
import type { RunClaims } from '@runs/application/services/run-claims.service';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import { claimer, orderedFor } from '@runs/domain/aggregates/run.fake-spec';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { CheckWorkId } from '@shared-kernel/domain/value-objects/check-work-id.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-31T09:00:00.000Z');

const spec = RunSpec.of({
  command: { executable: 'claude-agent-acp', args: ['--acp'] },
  briefing: 'work out what the request wants',
  handover: { options: ['Spec'], noteLimit: 4_000 },
  resume: {},
});

const waiting = (harness = 'claude-code') =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of(harness),
    ...orderedFor.holdingTurn('task_1', 0),
    spec,
  });

const queued = () => waiting().claim(claimer(RunnerId.of('runner_1')), NOW);

const reservedForPooled = (harness = 'claude-code') =>
  waiting(harness).reservedFor(
    RunnerId.of('runner_1'),
    PoolId.of('pool_1'),
    NOW,
  );

const aCheck: ClaimedCheck = {
  checkId: CheckWorkId.of('stack_1'),
  repeat: false,
  runId: RunId.of('run_1'),
  repository: 'widgets',
  base: '0123456789abcdef0123456789abcdef01234567',
  setup: 'npm ci',
  command: 'npm test',
  steps: [
    { id: 'whole', patch: 'diff', stopsOnFailure: true, runsSetup: true },
  ],
};

const seenAs = (
  claims: RunnerClaims = 'reserved',
  harnesses = [HarnessId.of('claude-code')],
): RunnerClaimant => ({
  workspaceId: WorkspaceId.of('ws_1'),
  harnesses,
  offer: RunnerOffer.of(['runner-1']),
  claims,
});

const claiming = (
  claimNext = vi.fn(async (): Promise<Run | null> => queued()),
  claimCheck = vi.fn(async (): Promise<ClaimedCheck | null> => null),
  over: {
    seen?: RunnerClaimant | null;
    reservedFor?: Run | null;
    reservedCheck?: ClaimedCheck | null;
    starts?: RunStart;
    tookFails?: boolean;
    liveKeys?: readonly string[];
  } = {},
) => {
  const mayStart = vi.fn(
    async (): Promise<RunStart> => over.starts ?? 'starts',
  );
  const claimReserved = vi.fn(
    async (): Promise<ClaimedCheck | null> => over.reservedCheck ?? null,
  );
  const pooled = {
    claim: vi.fn(async () => {
      if (over.tookFails) {
        throw new Error('runner_1 is spent');
      }
    }),
  };
  const saved: Run[] = [];
  const unclaim = vi.fn(async () => {});
  const failed = vi.fn(async () => null);
  let now = NOW;
  const clock = {
    now: () => now,
    sleep: async (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  } as ClockPort;
  const runs = {
    reservedFor: vi.fn(async () => over.reservedFor ?? null),
    findById: vi.fn(async () => queued()),
    save: vi.fn(async (run: Run) => {
      saved.push(run);
    }),
  } as unknown as RunRepository;
  const checks = {
    claimNext: claimCheck,
    claimReserved,
    unclaim,
    renewLease: vi.fn(async () => 'renewed' as const),
    isLeasedBy: vi.fn(async () => false),
    waitingPlacements: vi.fn(async () => []),
  };
  const handler = new ClaimRunHandler(
    runs,
    { next: claimNext } as unknown as RunClaims,
    {
      claimantOf: vi.fn(async () =>
        over.seen === undefined ? seenAs() : over.seen,
      ),
    },
    clock,
    checks,
    new ClaimsTaken(runs, checks, pooled as unknown as RunnersPort, clock, {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }),
    { failed } as unknown as ProvisionFailures,
    { mayStart } as unknown as ClaimGate,
    new LongPoll(clock),
    {
      liveKeysIn: vi.fn(async () => over.liveKeys ?? []),
    } as unknown as SandboxesPort,
  );

  return {
    mayStart,
    execute: (command: ClaimRunCommand) => handler.execute(command),
    pooled,
    failed,
    claimReserved,
    saved,
    unclaim,
  };
};

const runOf = (claimed: ClaimedWorkDto | null) =>
  claimed?.kind === 'run' ? claimed.run : null;

describe('ClaimRunHandler', () => {
  it('hands the runner the spec itself, not the wrapper around it', async () => {
    const claimed = await claiming().execute(new ClaimRunCommand('runner_1'));

    expect(runOf(claimed)?.spec).toEqual({
      command: { executable: 'claude-agent-acp', args: ['--acp'] },
      briefing: 'work out what the request wants',
      handover: { options: ['Spec'], noteLimit: 4_000 },
      resume: {},
    });
    expect(runOf(claimed)?.workingCopyKey).toBe('requester/subject-task_1');
  });

  it('only looks for work in the runner’s own workspace', async () => {
    const claimNext = vi.fn(async () => queued());

    await claiming(claimNext).execute(new ClaimRunCommand('runner_1'));

    expect(claimNext).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: WorkspaceId.of('ws_1') }),
      NOW,
    );
  });

  it('looks only for work placed where the runner answers', async () => {
    const claimNext = vi.fn(async () => queued());

    await claiming(claimNext).execute(new ClaimRunCommand('runner_1'));

    expect(claimNext).toHaveBeenCalledWith(
      expect.objectContaining({ offer: RunnerOffer.of(['runner-1']) }),
      NOW,
    );
  });

  it('survives the round trip a runner actually makes', async () => {
    const claimed = await claiming().execute(new ClaimRunCommand('runner_1'));

    const overTheWire = JSON.parse(JSON.stringify(claimed)) as {
      run: { spec: { command: { executable: string } } };
    };

    expect(overTheWire.run.spec.command.executable).toBe('claude-agent-acp');
  });

  it('leaves the runs of keys that ready host sandboxes keep to those sandboxes', async () => {
    const claimNext = vi.fn(async () => queued());

    await claiming(claimNext, undefined, {
      liveKeys: ['requester/subject-task_1'],
    }).execute(new ClaimRunCommand('runner_1'));

    expect(claimNext).toHaveBeenCalledWith(
      expect.objectContaining({
        sandbox: {
          avoiding: [WorkingCopyKey.parse('requester/subject-task_1')],
        },
      }),
      NOW,
    );
  });

  it('rejects a runner that is not alive', async () => {
    await expect(
      claiming(undefined, undefined, { seen: null }).execute(
        new ClaimRunCommand('runner_1'),
      ),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('hands a runner that may claim nothing no work at all', async () => {
    const claimNext = vi.fn(async () => queued());
    const claimCheck = vi.fn(async () => aCheck);
    const handler = claiming(claimNext, claimCheck, {
      seen: seenAs('nothing'),
    });

    expect(await handler.execute(new ClaimRunCommand('runner_1'))).toBeNull();
    expect(claimNext).not.toHaveBeenCalled();
    expect(claimCheck).not.toHaveBeenCalled();
  });

  describe('for a runner started for one reserved run', () => {
    it('claims the run reserved for it, and records that its runner claimed it', async () => {
      const claimNext = vi.fn(async () => queued());
      const handler = claiming(claimNext, undefined, {
        seen: seenAs('reserved'),
        reservedFor: reservedForPooled(),
      });

      const claimed = await handler.execute(new ClaimRunCommand('runner_1'));

      expect(runOf(claimed)?.id).toBe('run_1');
      expect(claimNext).toHaveBeenCalledWith(
        expect.objectContaining({ claims: 'reserved' }),
        NOW,
      );
      expect(handler.pooled.claim).toHaveBeenCalledWith(
        RunnerId.of('runner_1'),
        { kind: 'run', id: 'run_1' },
        NOW,
      );
    });

    it('puts the run back on the queue, uncounted, when its runner cannot take it', async () => {
      const handler = claiming(
        vi.fn(async () => queued()),
        undefined,
        {
          seen: seenAs('reserved'),
          reservedFor: reservedForPooled(),
          tookFails: true,
        },
      );

      await expect(
        handler.execute(new ClaimRunCommand('runner_1')),
      ).rejects.toThrow('runner_1 is spent');
      expect(handler.saved).toHaveLength(1);
      expect(handler.saved[0]?.state).toBe('queued');
      expect(handler.saved[0]?.claimedBy).toBeNull();
      expect(handler.saved[0]?.requeueCount.count).toBe(0);
    });

    it('puts the check back, uncounted, when its runner cannot take it', async () => {
      const handler = claiming(
        vi.fn(async () => null),
        undefined,
        {
          seen: seenAs('reserved'),
          reservedCheck: aCheck,
          tookFails: true,
        },
      );

      await expect(
        handler.execute(new ClaimRunCommand('runner_1')),
      ).rejects.toThrow('runner_1 is spent');
      expect(handler.unclaim).toHaveBeenCalledWith(
        CheckWorkId.of('stack_1'),
        false,
        RunnerId.of('runner_1'),
        NOW,
      );
    });

    it('never offers it a check that was not reserved for it', async () => {
      const claimCheck = vi.fn(async () => aCheck);
      const handler = claiming(
        vi.fn(async () => null),
        claimCheck,
        { seen: seenAs('reserved') },
      );

      expect(await handler.execute(new ClaimRunCommand('runner_1'))).toBeNull();
      expect(claimCheck).not.toHaveBeenCalled();
      expect(handler.claimReserved).toHaveBeenCalledWith(
        RunnerId.of('runner_1'),
        RunnerOffer.of(['runner-1']),
        NOW,
      );
    });

    it('claims the check reserved for it where no run is, and records that it claimed it', async () => {
      const claimCheck = vi.fn(async () => null);
      const handler = claiming(
        vi.fn(async () => null),
        claimCheck,
        {
          seen: seenAs('reserved'),
          reservedCheck: aCheck,
        },
      );

      const claimed = await handler.execute(new ClaimRunCommand('runner_1'));

      expect(claimed).toEqual({ kind: 'check', check: aCheck });
      expect(claimCheck).not.toHaveBeenCalled();
      expect(handler.pooled.claim).toHaveBeenCalledWith(
        RunnerId.of('runner_1'),
        { kind: 'check', id: 'stack_1' },
        NOW,
      );
    });

    it('looks for no reserved check once it has taken its reserved run', async () => {
      const handler = claiming(
        vi.fn(async () => queued()),
        undefined,
        {
          seen: seenAs('reserved'),
          reservedFor: reservedForPooled(),
          reservedCheck: aCheck,
        },
      );

      const claimed = await handler.execute(new ClaimRunCommand('runner_1'));

      expect(claimed?.kind).toBe('run');
      expect(handler.claimReserved).not.toHaveBeenCalled();
    });

    it('fails the provisioning when it lacks the run’s harness', async () => {
      const claimNext = vi.fn(async () => queued());
      const handler = claiming(claimNext, undefined, {
        seen: seenAs('reserved', [HarnessId.of('codex')]),
        reservedFor: reservedForPooled(),
      });

      expect(await handler.execute(new ClaimRunCommand('runner_1'))).toBeNull();
      expect(claimNext).not.toHaveBeenCalled();
      expect(handler.failed).toHaveBeenCalledWith(
        RunId.of('run_1'),
        RunnerId.of('runner_1'),
        ProvisionFailure.harnessMissing('claude-code'),
        NOW,
      );
    });
  });

  it('hands over no run whose start a hook denied', async () => {
    const handler = claiming(undefined, undefined, { starts: 'denied' });

    expect(await handler.execute(new ClaimRunCommand('runner_1'))).toBeNull();
    expect(handler.mayStart).toHaveBeenCalledWith(
      expect.objectContaining({ id: RunId.of('run_1') }),
      RunnerId.of('runner_1'),
      new Date(NOW.getTime() + 10_000),
    );
  });

  it('stops polling at once, taking up no check, when a run had to be requeued', async () => {
    const claimNext = vi.fn(async (): Promise<Run | null> => queued());
    const handler = claiming(claimNext, undefined, {
      starts: 'requeued',
      reservedCheck: aCheck,
    });

    expect(await handler.execute(new ClaimRunCommand('runner_1'))).toBeNull();
    expect(claimNext).toHaveBeenCalledTimes(1);
    expect(handler.claimReserved).not.toHaveBeenCalled();
  });
});
