import { MemoryReactions } from '@memory/application/events/handlers/memory-reactions.handler';
import type { ReviewsPort } from '@memory/application/ports/reviews.port';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoriesProposed } from '@memory/domain/events/memories-proposed.event';
import { MemoryApproved } from '@memory/domain/events/memory-approved.event';
import { MemoryReviewSettled } from '@memory/domain/events/memory-review-settled.event';
import { MemoryStood } from '@memory/domain/events/memory-stood.event';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import { MemoryGrounds } from '@memory/domain/value-objects/memory-grounds.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const DRAFT = MemoryDraftId.of('draft_1');
const TASK = TaskId.of('task_1');
const RUN = RunId.of('run_1');
const OLD = MemoryId.of('memory_old');
const NEW = MemoryId.of('memory_new');
const SCOPE = MemoryScope.of({ teamId: TeamId.of('team_1') });
const GROUNDS = MemoryGrounds.of({
  taskId: TASK,
  runId: RUN,
  steps: [3],
  notes: [],
});
const ADA = MemoryDecision.of({ by: UserId.of('user_ada'), at: NOW });

const approved = (supersedes: MemoryId | null = null) =>
  new MemoryApproved(
    DRAFT,
    TASK,
    WorkspaceId.of('ws_1'),
    NEW,
    'preference',
    'Name branches after the ticket.',
    SCOPE,
    GROUNDS,
    'run',
    supersedes,
    ADA,
  );

const reacting = (held: Memory[] = []) => {
  const reviews = { raise: vi.fn(), settle: vi.fn() };
  const memories = {
    find: async (id: MemoryId) =>
      held.find((each) => each.id.equals(id)) ?? null,
    add: vi.fn(async (memory: Memory) => {
      held.push(memory);
    }),
    save: vi.fn(async (memory: Memory) => {
      held.splice(
        held.findIndex((each) => each.id.equals(memory.id)),
        1,
        memory,
      );
    }),
  };

  return {
    reactions: new MemoryReactions(
      reviews as unknown as ReviewsPort,
      memories as unknown as MemoryRepository,
      { run: <T>(work: () => Promise<T>) => work() },
      { now: () => NOW, sleep: async () => undefined },
    ),
    reviews,
    memories,
    held,
  };
};

describe('reacting to memories being proposed and decided', () => {
  it('raises a review on the task for a run that proposed memories', async () => {
    const { reactions, reviews } = reacting();

    await reactions.onProposed(new MemoriesProposed(DRAFT, TASK, RUN, 3, 0, 0));

    expect(reviews.raise).toHaveBeenCalledWith(TASK, RUN);
  });

  it('raises nothing for a run that proposed none', async () => {
    const { reactions, reviews } = reacting();

    await reactions.onProposed(new MemoriesProposed(DRAFT, TASK, RUN, 0, 2, 0));

    expect(reviews.raise).not.toHaveBeenCalled();
  });

  it('settles a run’s review once nothing is left to decide', async () => {
    const { reactions, reviews } = reacting();

    await reactions.onReviewSettled(new MemoryReviewSettled(DRAFT, TASK, RUN));

    expect(reviews.settle).toHaveBeenCalledWith(TASK, RUN);
  });

  it('keeps an approved memory standing, once however often it hears so', async () => {
    const { reactions, memories, held } = reacting();

    await reactions.onApproved(approved());
    await reactions.onApproved(approved());

    expect(memories.add).toHaveBeenCalledTimes(1);
    expect(held[0]?.standing).toBe('stands');
    expect(held[0]?.approval.equals(ADA)).toBe(true);
  });

  it('retires the memory a newly standing one supersedes', async () => {
    const old = Memory.stood({
      id: OLD,
      workspaceId: WorkspaceId.of('ws_1'),
      kind: 'preference',
      body: 'Name branches after the author.',
      scope: SCOPE,
      grounds: GROUNDS,
      source: 'run',
      supersedes: null,
      approval: ADA,
    });
    const { reactions, held } = reacting([old]);

    await reactions.onStood(new MemoryStood(NEW, OLD));

    expect(held[0]?.standing).toBe('retired');
    expect(held[0]?.retirement?.supersededBy?.equals(NEW)).toBe(true);
  });
});
