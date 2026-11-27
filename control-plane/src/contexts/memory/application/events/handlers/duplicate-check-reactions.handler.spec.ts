import { DuplicateCheckReactions } from '@memory/application/events/handlers/duplicate-check-reactions.handler';
import type { DuplicateCheck } from '@memory/domain/aggregates/duplicate-check.aggregate';
import { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import type { DuplicateCheckRepository } from '@memory/domain/repositories/duplicate-check.repository';
import type { MemoryProposalSetRepository } from '@memory/domain/repositories/memory-proposal-set.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-27T10:00:00.000Z');
const RUN = RunId.of('run_7');
const TASK = TaskId.of('task_1');

const proposed = (input: { retires?: boolean } = {}) => {
  const provenance = MemoryProvenance.of({
    taskId: TASK,
    runId: RUN,
    steps: [1],
    notes: [],
  });
  const scope = MemoryScope.of({ teamId: TeamId.of('team_1') });

  return input.retires
    ? MemoryProposal.retiring({
        id: MemoryId.of('proposal_2'),
        retired: {
          id: MemoryId.of('memory_2'),
          kind: 'environment',
          body: MemoryBody.of('Old.'),
          scope,
        },
        reason: 'The image is fixed.',
        provenance,
        source: 'run',
        recordedAt: NOW,
      })
    : MemoryProposal.of({
        id: MemoryId.of('proposal_1'),
        kind: 'environment',
        body: MemoryBody.of('Use npm ci --ignore-scripts in the sandbox.'),
        scope,
        provenance,
        source: 'run',
        supersedes: null,
        recordedAt: NOW,
      });
};

const setOf = (...proposals: MemoryProposal[]) =>
  MemoryProposalSet.rehydrate({
    id: MemoryProposalSetId.of('set_1'),
    taskId: TASK,
    workspaceId: WorkspaceId.of('ws_1'),
    proposals,
    version: 1,
  });

const reacting = (set: MemoryProposalSet | null) => {
  const stored = new Map<string, DuplicateCheck>();
  let transactions = 0;
  const checks = partial<DuplicateCheckRepository>({
    of: async (runId: RunId) => stored.get(runId.value) ?? null,
    ofTask: async () => [...stored.values()],
    add: async (check: DuplicateCheck) => {
      stored.set(check.runId.value, check);
    },
    save: async (check: DuplicateCheck) => {
      if (check.isDeleted) {
        stored.delete(check.runId.value);
      }
    },
  });

  return {
    stored,
    transactions: () => transactions,
    reactions: new DuplicateCheckReactions(
      partial<MemoryProposalSetRepository>({ forTask: async () => set }),
      checks,
      {
        inTransaction: <T>(work: () => Promise<T>) => {
          transactions += 1;
          return work();
        },
      },
      { now: () => NOW, sleep: async () => undefined },
    ),
  };
};

describe('opening a duplicate check once a run ends', () => {
  it('opens one due check for a run that proposed a memory to compare, however often it hears the end', async () => {
    const { reactions, stored } = reacting(setOf(proposed()));

    await reactions.onRunEnded({ id: RUN, taskId: TASK });
    const first = stored.get('run_7');
    await reactions.onRunEnded({ id: RUN, taskId: TASK });

    expect(stored.size).toBe(1);
    expect(stored.get('run_7')).toBe(first);
    expect(first?.isDue(NOW)).toBe(true);
    expect(first?.setId.value).toBe('set_1');
  });

  it('opens none for a run that only proposed to retire a memory, proposed nothing, or ran no task', async () => {
    const retiring = reacting(setOf(proposed({ retires: true })));
    const none = reacting(null);

    await retiring.reactions.onRunEnded({ id: RUN, taskId: TASK });
    await none.reactions.onRunEnded({ id: RUN, taskId: TASK });
    await none.reactions.onRunEnded({ id: RUN, taskId: null });

    expect(retiring.stored.size).toBe(0);
    expect(none.stored.size).toBe(0);
    expect(retiring.transactions() + none.transactions()).toBe(0);
  });

  it('removes the checks of a deleted task, each in its own transaction', async () => {
    const { reactions, stored, transactions } = reacting(setOf(proposed()));
    await reactions.onRunEnded({ id: RUN, taskId: TASK });

    await reactions.onTaskDeleted(TASK);

    expect(stored.size).toBe(0);
    expect(transactions()).toBe(2);
  });
});
