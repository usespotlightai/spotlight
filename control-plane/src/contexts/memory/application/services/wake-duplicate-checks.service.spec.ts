import type { ProposalComparerPort } from '@memory/application/ports/proposal-comparer.port';
import { WakeDuplicateChecks } from '@memory/application/services/wake-duplicate-checks.service';
import type { DuplicateCheck } from '@memory/domain/aggregates/duplicate-check.aggregate';
import { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import { DuplicateCheckVersionConflictError } from '@memory/domain/exceptions/duplicate-check-version-conflict.error';
import type { DuplicateCheckRepository } from '@memory/domain/repositories/duplicate-check.repository';
import { checkFor } from '@memory/domain/services/duplicate-comparison';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { present } from '@shared-kernel/domain/present.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-27T10:00:00.000Z');
const SOON = new Date(NOW.getTime() + 5_000);
const RUN = RunId.of('run_7');
const SESSION = { purpose: 'memory.compare-proposals', key: 'run_7' };

const SET = MemoryProposalSet.rehydrate({
  id: MemoryProposalSetId.of('set_1'),
  taskId: TaskId.of('task_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  proposals: [
    MemoryProposal.of({
      id: MemoryId.of('proposal_1'),
      kind: 'environment',
      body: MemoryBody.of('Use npm ci --ignore-scripts in the sandbox.'),
      scope: MemoryScope.of({ teamId: TeamId.of('team_1') }),
      provenance: MemoryProvenance.of({
        taskId: TaskId.of('task_1'),
        runId: RUN,
        steps: [1],
        notes: [],
      }),
      source: 'run',
      supersedes: null,
      recordedAt: NOW,
    }),
  ],
  version: 1,
});

const waiting = present(checkFor({ set: SET, runId: RUN, now: NOW }))
  .leaseJob(NOW)
  .waitJob(NOW);

const waking = (
  runId: RunId | null,
  save: (check: DuplicateCheck) => Promise<void> = async () => {},
) => {
  const saved: DuplicateCheck[] = [];
  const comparer = partial<ProposalComparerPort>({ runOf: () => runId });
  const checks = partial<DuplicateCheckRepository>({
    of: async () => waiting,
    save: async (check: DuplicateCheck) => {
      saved.push(check);
      await save(check);
    },
  });

  return {
    saved,
    wake: new WakeDuplicateChecks(
      comparer,
      checks,
      { inTransaction: <T>(work: () => Promise<T>) => work() },
      { now: () => SOON, sleep: async () => undefined },
    ),
  };
};

describe('waking a duplicate check once its session settles', () => {
  it('makes the check that waits for the session due now', async () => {
    const { wake, saved } = waking(RUN);

    await wake.settled(SESSION);

    expect(waiting.isDue(SOON)).toBe(false);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.isDue(SOON)).toBe(true);
  });

  it('wakes nothing for a session it did not order', async () => {
    const { wake, saved } = waking(null);

    await wake.settled({ purpose: 'memory.consolidate', key: 'team_1:0:1' });

    expect(saved).toEqual([]);
  });

  it('wakes nothing when someone saved the check meanwhile', async () => {
    const { wake } = waking(RUN, async () => {
      throw new DuplicateCheckVersionConflictError('run_7');
    });

    await expect(wake.settled(SESSION)).resolves.toBeUndefined();
  });
});
