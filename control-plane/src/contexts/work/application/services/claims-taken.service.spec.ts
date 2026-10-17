import type { RunnersPort } from '@runners/application/ports/runners.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { CheckWorkPort } from '@work/application/ports/check-work.port';
import { ClaimsTaken } from '@work/application/services/claims-taken.service';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@work/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-27T09:00:00.000Z');
const RUNNER = RunnerId.of('pooled_1');

const claimed = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('claude-code'),
    spec: RunSpec.of({
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'work out what is being asked for',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task-task_1' },
    }),
  }).claim(RUNNER, NOW);

const taking = (
  over: {
    tookFails?: boolean;
    stored?: Run | null;
    clashes?: number;
    saveFails?: boolean;
  } = {},
) => {
  const saved: Run[] = [];
  let clashes = over.clashes ?? 0;
  const warn = vi.fn();
  const runs = {
    findById: vi.fn(async () =>
      over.stored === undefined ? claimed() : over.stored,
    ),
    save: vi.fn(async (run: Run) => {
      if (over.saveFails) {
        throw new Error('the database is down');
      }
      if (clashes > 0) {
        clashes -= 1;
        throw new RunVersionConflictError(run.id.value);
      }
      saved.push(run);
    }),
  } as unknown as RunRepository;
  const checks = { unclaim: vi.fn(async () => {}) };
  const runners = {
    took: vi.fn(async () => {
      if (over.tookFails) {
        throw new Error('pooled_1 is spent');
      }
    }),
  };

  return {
    saved,
    warn,
    checks,
    runners,
    taken: new ClaimsTaken(
      runs,
      checks as unknown as CheckWorkPort,
      runners as unknown as RunnersPort,
      { now: () => NOW } as ClockPort,
      { warn } as unknown as LoggerPort,
    ),
  };
};

describe('ClaimsTaken', () => {
  it('records that the runner took the run, and leaves the claim in place', async () => {
    const { taken, runners, saved } = taking();

    await taken.run(claimed(), RUNNER);

    expect(runners.took).toHaveBeenCalledWith(
      RUNNER,
      { kind: 'run', id: 'run_1' },
      NOW,
    );
    expect(saved).toEqual([]);
  });

  it('unclaims the run its runner could not take, and still says why', async () => {
    const { taken, saved } = taking({ tookFails: true });

    await expect(taken.run(claimed(), RUNNER)).rejects.toThrow(
      'pooled_1 is spent',
    );
    expect(saved.map((each) => each.state)).toEqual(['queued']);
  });

  it('tries again when the run changed while it was unclaimed', async () => {
    const { taken, saved } = taking({ tookFails: true, clashes: 1 });

    await expect(taken.run(claimed(), RUNNER)).rejects.toThrow(
      'pooled_1 is spent',
    );
    expect(saved).toHaveLength(1);
  });

  it('leaves a run its runner no longer leases as it is', async () => {
    const { taken, saved } = taking({ tookFails: true, stored: null });

    await expect(taken.run(claimed(), RUNNER)).rejects.toThrow(
      'pooled_1 is spent',
    );
    expect(saved).toEqual([]);
  });

  it('leaves the run to its lease, saying why, where it cannot be unclaimed', async () => {
    const { taken, warn } = taking({ tookFails: true, saveFails: true });

    await expect(taken.run(claimed(), RUNNER)).rejects.toThrow(
      'pooled_1 is spent',
    );
    expect(warn).toHaveBeenCalledOnce();
  });

  it('unclaims the check its runner could not take', async () => {
    const { taken, checks } = taking({ tookFails: true });

    await expect(
      taken.check(
        {
          stackId: 'stack_1',
          recheck: false,
          runId: 'run_1',
          repository: null,
          base: null,
          setup: null,
          command: 'npm test',
          steps: [],
        },
        RUNNER,
      ),
    ).rejects.toThrow('pooled_1 is spent');
    expect(checks.unclaim).toHaveBeenCalledWith('stack_1', false, RUNNER, NOW);
  });
});
