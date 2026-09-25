import type { PoolRunnersPort } from '@runners/application/ports/pool-runners.port';
import type {
  RunnerClaims,
  SeenRunner,
} from '@runners/application/ports/runner-presence.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ClaimRunHandler } from '@work/application/commands/handlers/claim-run.handler';
import { ClaimRunCommand } from '@work/application/commands/runner.commands';
import type { ClaimedWorkDto } from '@work/application/dto/run.dto';
import type { ClaimedCheck } from '@work/application/ports/check-work.port';
import type { ProvisionFailures } from '@work/application/services/provision-failures.service';
import type { RunLeases } from '@work/application/services/run-leases.service';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-31T09:00:00.000Z');

const spec = RunSpec.of({
  command: { executable: 'claude-agent-acp', args: ['--acp'] },
  briefing: 'work out what is being asked for',
  handover: { options: ['Spec'], noteLimit: 4_000 },
  continuity: { key: 'task_1-station_1', keep: true },
});

const waiting = (harness = 'claude-code') =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of(harness),
    spec,
  });

const queued = () => waiting().claim(RunnerId.of('runner_1'), NOW);

const reservedForPooled = (harness = 'claude-code') =>
  waiting(harness).reservedFor(RunnerId.of('runner_1'), 'pool_1', NOW);

const aCheck: ClaimedCheck = {
  stackId: 'stack_1',
  runId: 'run_1',
  repository: 'widgets',
  base: '0123456789abcdef0123456789abcdef01234567',
  setup: 'npm ci',
  command: 'npm test',
  steps: [
    { id: 'whole', patch: 'diff', stopsOnFailure: true, runsSetup: true },
  ],
};

const seenAs = (
  claims: RunnerClaims = 'any',
  harnesses = [HarnessId.of('claude-code')],
): SeenRunner => ({
  workspaceId: WorkspaceId.of('ws_1'),
  harnesses,
  terms: RunnerTerms.of(['runner-1']),
  claims,
});

const claiming = (
  claimNext = vi.fn(async (): Promise<Run | null> => queued()),
  claimCheck = vi.fn(async (): Promise<ClaimedCheck | null> => null),
  over: {
    seen?: SeenRunner;
    reservedFor?: Run | null;
    reservedCheck?: ClaimedCheck | null;
  } = {},
) => {
  const claimReserved = vi.fn(
    async (): Promise<ClaimedCheck | null> => over.reservedCheck ?? null,
  );
  const pooled = {
    took: vi.fn(async () => {}),
    letGo: vi.fn(async () => {}),
  };
  const failed = vi.fn(async () => null);
  const requeueLapsed = vi.fn(async () => []);
  let now = NOW;
  const clock = {
    now: () => now,
    sleep: async (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  } as ClockPort;
  const handler = new ClaimRunHandler(
    {
      claimNext,
      waitingFor: vi.fn(async () => over.reservedFor ?? null),
    } as unknown as RunRepository,
    { requeueLapsed } as unknown as RunLeases,
    {
      seen: vi.fn(async () => over.seen ?? seenAs()),
      pinnableTerms: vi.fn(async () => RunnerTerms.none()),
    },
    clock,
    {
      claimNext: claimCheck,
      claimReserved,
      waitingPlacements: vi.fn(async () => []),
    },
    pooled as unknown as PoolRunnersPort,
    { failed } as unknown as ProvisionFailures,
  );

  return {
    execute: (command: ClaimRunCommand) => handler.execute(command),
    pooled,
    failed,
    requeueLapsed,
    claimReserved,
  };
};

const runOf = (claimed: ClaimedWorkDto | null) =>
  claimed?.kind === 'run' ? claimed.run : null;

describe('ClaimRunHandler', () => {
  it('hands the runner the spec itself, not the wrapper around it', async () => {
    const claimed = await claiming().execute(new ClaimRunCommand('runner_1'));

    expect(runOf(claimed)?.spec).toEqual({
      command: { executable: 'claude-agent-acp', args: ['--acp'] },
      briefing: 'work out what is being asked for',
      handover: { options: ['Spec'], noteLimit: 4_000 },
      continuity: { key: 'task_1-station_1', keep: true },
    });
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
      expect.objectContaining({ terms: RunnerTerms.of(['runner-1']) }),
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

  it('offers a check only once no run wants the runner', async () => {
    const claimCheck = vi.fn(async () => aCheck);
    const claimed = await claiming(
      vi.fn(async () => null),
      claimCheck,
    ).execute(new ClaimRunCommand('runner_1'));

    expect(claimed).toEqual({ kind: 'check', check: aCheck });
    expect(claimCheck).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      RunnerId.of('runner_1'),
      RunnerTerms.of(['runner-1']),
      NOW,
    );
  });

  it('leaves a check waiting while a run wants the runner', async () => {
    const claimCheck = vi.fn(async () => aCheck);

    const claimed = await claiming(
      vi.fn(async () => queued()),
      claimCheck,
    ).execute(new ClaimRunCommand('runner_1'));

    expect(claimed?.kind).toBe('run');
    expect(claimCheck).not.toHaveBeenCalled();
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
    expect(handler.requeueLapsed).not.toHaveBeenCalled();
  });

  it('tells no pool about a run taken by a runner it did not start', async () => {
    const handler = claiming();

    await handler.execute(new ClaimRunCommand('runner_1'));

    expect(handler.pooled.took).not.toHaveBeenCalled();
  });

  describe('for a runner started for one reserved run', () => {
    it('claims the run reserved for it and tells its pool it took it', async () => {
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
      expect(handler.pooled.took).toHaveBeenCalledWith(
        RunnerId.of('runner_1'),
        { kind: 'run', id: 'run_1' },
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
        NOW,
      );
      expect(handler.pooled.took).not.toHaveBeenCalled();
    });

    it('takes the check reserved for it where no run is, and tells its pool it took it', async () => {
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
      expect(handler.pooled.took).toHaveBeenCalledWith(
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

    it('fails the provisioning and lets the runner go when it lacks the run’s harness', async () => {
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
      expect(handler.pooled.letGo).toHaveBeenCalledWith(
        RunnerId.of('runner_1'),
        NOW,
      );
    });
  });
});
