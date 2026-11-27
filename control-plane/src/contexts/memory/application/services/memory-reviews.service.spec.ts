import type { WorkPort } from '@memory/application/ports/work.port';
import { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import { DuplicateCheck } from '@memory/domain/aggregates/duplicate-check.aggregate';
import { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import type { DuplicateCheckRepository } from '@memory/domain/repositories/duplicate-check.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-27T10:00:00.000Z');
const RUN = RunId.of('run_7');
const TEAM = TeamId.of('team_1');
const ADA = UserId.of('user_ada');
const REASON =
  'P-1 gives the same advice as M-2: skip the better-sqlite3 build scripts because the image cannot compile it.';

const M2 = Memory.write({
  id: MemoryId.of('memory_2'),
  handle: MemoryHandle.of(2),
  workspaceId: WorkspaceId.of('ws_1'),
  kind: 'environment',
  body: MemoryBody.of(
    'qa-tidepool: the runner image has no make/g++, so better-sqlite3 cannot build. Use `npm install --ignore-scripts` (better-sqlite3 still loads) until the image is fixed.',
  ),
  scope: MemoryScope.of({ teamId: TEAM }),
  provenance: null,
  by: MemoryDecision.of({ by: ADA, at: NOW }),
});

const PROPOSAL = MemoryProposal.of({
  id: MemoryId.of('proposal_1'),
  kind: 'environment',
  body: MemoryBody.of(
    'npm ci fails in the sandbox on the better-sqlite3 node-gyp build; use npm ci --ignore-scripts.',
  ),
  scope: MemoryScope.of({ teamId: TEAM }),
  provenance: MemoryProvenance.of({
    taskId: TaskId.of('task_1'),
    runId: RUN,
    steps: [2],
    notes: [],
  }),
  source: 'run',
  supersedes: null,
  recordedAt: NOW,
});

const setOf = (proposal: MemoryProposal) =>
  MemoryProposalSet.rehydrate({
    id: MemoryProposalSetId.of('set_1'),
    taskId: TaskId.of('task_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    proposals: [proposal],
    version: 1,
  });

const compared = (() => {
  const set = setOf(PROPOSAL);
  const check = DuplicateCheck.of({ runId: RUN, set, now: NOW })?.leaseJob(NOW);

  return check?.compared(check.comparing(set, [M2]), [
    { proposal: PROPOSAL.id, sameAs: 'M-2', reason: REASON },
  ]);
})();

const reviewing = (input: {
  check: DuplicateCheck | null | undefined;
  memories?: readonly Memory[];
}) => {
  const findAll = vi.fn(async (ids: readonly MemoryId[]) =>
    (input.memories ?? [M2]).filter((each) =>
      ids.some((id) => id.equals(each.id)),
    ),
  );
  const reviews = new MemoryReviews(
    {
      reasoning: async () => [],
      notesOf: async () => [],
      harnessOf: async () => 'claude-code',
    } as unknown as WorkPort,
    {
      find: async () => ({ id: ADA, name: 'Ada', email: 'ada@example.com' }),
    } as never,
    { findAll } as unknown as MemoryRepository,
    {
      of: async () => input.check ?? null,
    } as unknown as DuplicateCheckRepository,
  );

  return {
    findAll,
    similarTo: async (proposal = PROPOSAL) =>
      (await reviews.of(setOf(proposal), RUN)).memories[0]?.similarTo,
  };
};

describe('reviewing a proposal that may repeat a memory', () => {
  it('names the memory the run’s check found it repeats, with the reason', async () => {
    expect(await reviewing({ check: compared }).similarTo()).toEqual({
      memoryId: 'memory_2',
      handle: 'M-2',
      body: M2.body.value,
      reason: REASON,
    });
  });

  it('names none before the check compared, and looks up no memory to compare', async () => {
    const { similarTo, findAll } = reviewing({ check: null });

    expect(await similarTo()).toBeNull();
    expect(findAll.mock.calls.flatMap(([ids]) => ids)).toEqual([]);
  });

  it('names none once the proposal is decided', async () => {
    const approved = PROPOSAL.approve(MemoryDecision.of({ by: ADA, at: NOW }));

    expect(await reviewing({ check: compared }).similarTo(approved)).toBeNull();
  });

  it('names none once the memory is retired', async () => {
    const retired = M2.retire({
      by: ADA,
      reason: 'The image is fixed.',
      at: NOW,
    });

    expect(
      await reviewing({ check: compared, memories: [retired] }).similarTo(),
    ).toBeNull();
  });
});
