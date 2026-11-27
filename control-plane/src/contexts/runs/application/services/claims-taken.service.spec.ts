import type { RunnersPort } from '@runners/application/ports/runners.port';
import type { ReviewWorkPort } from '@runs/application/ports/review-work.port';
import { ClaimsTaken } from '@runs/application/services/claims-taken.service';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import { claimer, orderedFor } from '@runs/domain/aggregates/run.fake-spec';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { ReviewWorkId } from '@shared-kernel/domain/value-objects/review-work-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-27T09:00:00.000Z');
const RUNNER = RunnerId.of('pooled_1');

const claimed = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('claude-code'),
    ...orderedFor.holdingTurn('task_1', 0),
    spec: RunSpec.of({
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'work out what the request wants',
      handover: { options: [], noteLimit: 4_000 },
      resume: {},
    }),
  }).claim(claimer(RUNNER), NOW);

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
  const runs = partial<RunRepository>({
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
  });
  const checks = { unclaim: vi.fn(async () => {}) };
  const runners = {
    claim: vi.fn(async () => {
      if (over.tookFails) {
        throw new Error('pooled_1 is spent');
      }
    }),
  };

  const info = vi.fn();

  return {
    saved,
    warn,
    checks,
    runners,
    taken: new ClaimsTaken(
      runs,
      partial<ReviewWorkPort>(checks),
      partial<RunnersPort>(runners),
      partial<ClockPort>({ now: () => NOW }),
      partial<LoggerPort>({ warn, info }),
    ),
    info,
  };
};

describe('ClaimsTaken', () => {
  it('records that the runner claimed the run, and leaves the claim in place', async () => {
    const { taken, runners, saved, info } = taking();

    await taken.run(claimed(), RUNNER);

    expect(runners.claim).toHaveBeenCalledWith(
      RUNNER,
      { kind: 'run', id: 'run_1' },
      NOW,
    );
    expect(saved).toEqual([]);
    expect(info).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ runId: 'run_1', runnerId: RUNNER.value }),
      'Claimed a run',
    );
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
      taken.reviewWork(
        {
          kind: 'check',
          checkId: ReviewWorkId.of('stack_1'),
          recheck: false,
          repository: null,
          base: null,
          setup: null,
          command: 'npm test',
          steps: [],
        },
        RUNNER,
      ),
    ).rejects.toThrow('pooled_1 is spent');
    expect(checks.unclaim).toHaveBeenCalledWith(
      { kind: 'check', id: ReviewWorkId.of('stack_1'), recheck: false },
      RUNNER,
      NOW,
    );
  });

  it('leases a push diff to its runner as check work, and unclaims it as a diff', async () => {
    const { taken, checks, runners } = taking({ tookFails: true });
    const diff = {
      kind: 'diff' as const,
      diffId: ReviewWorkId.of('diff_1'),
      repository: 'widgets',
      baseTip: 'a'.repeat(40),
      head: 'b'.repeat(40),
    };

    await expect(taken.reviewWork(diff, RUNNER)).rejects.toThrow(
      'pooled_1 is spent',
    );
    expect(runners.claim).toHaveBeenCalledWith(
      RUNNER,
      { kind: 'diff', id: 'diff_1' },
      NOW,
    );
    expect(checks.unclaim).toHaveBeenCalledWith(
      { kind: 'diff', id: ReviewWorkId.of('diff_1') },
      RUNNER,
      NOW,
    );
  });
});
