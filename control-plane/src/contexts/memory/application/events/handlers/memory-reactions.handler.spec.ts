import { MemoryReactions } from '@memory/application/events/handlers/memory-reactions.handler';
import type { ReviewsPort } from '@memory/application/ports/reviews.port';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoriesProposed } from '@memory/domain/events/memories-proposed.event';
import { MemoryApproved } from '@memory/domain/events/memory-approved.event';
import { MemoryCreated } from '@memory/domain/events/memory-created.event';
import { MemoryReviewResolved } from '@memory/domain/events/memory-review-resolved.event';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
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
const PROVENANCE = MemoryProvenance.of({
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
    MemoryBody.of('Name branches after the ticket.'),
    SCOPE,
    PROVENANCE,
    'run',
    supersedes,
    ADA,
  );

const reacting = (stored: Memory[] = []) => {
  const reviews = { create: vi.fn(), resolve: vi.fn() };
  let handles = 100;
  const memories = {
    nextHandle: async () => {
      handles += 1;
      return MemoryHandle.of(handles);
    },
    find: async (id: MemoryId) =>
      stored.find((each) => each.id.equals(id)) ?? null,
    add: vi.fn(async (memory: Memory) => {
      stored.push(memory);
    }),
    save: vi.fn(async (memory: Memory) => {
      stored.splice(
        stored.findIndex((each) => each.id.equals(memory.id)),
        1,
        memory,
      );
    }),
  };

  return {
    reactions: new MemoryReactions(
      reviews as unknown as ReviewsPort,
      memories as unknown as MemoryRepository,
      { inTransaction: <T>(work: () => Promise<T>) => work() },
      { now: () => NOW, sleep: async () => undefined },
    ),
    reviews,
    memories,
    stored,
  };
};

describe('reacting to memories being proposed and decided', () => {
  it('creates a review on the task for a run that proposed memories', async () => {
    const { reactions, reviews } = reacting();

    await reactions.onProposed(new MemoriesProposed(DRAFT, TASK, RUN, 3, 0, 0));

    expect(reviews.create).toHaveBeenCalledWith(TASK, RUN);
  });

  it('creates nothing for a run that proposed none', async () => {
    const { reactions, reviews } = reacting();

    await reactions.onProposed(new MemoriesProposed(DRAFT, TASK, RUN, 0, 2, 0));

    expect(reviews.create).not.toHaveBeenCalled();
  });

  it('resolves a run’s review once nothing is left to decide', async () => {
    const { reactions, reviews } = reacting();

    await reactions.onReviewResolved(
      new MemoryReviewResolved(DRAFT, TASK, RUN),
    );

    expect(reviews.resolve).toHaveBeenCalledWith(TASK, RUN);
  });

  it('creates an approved memory once, however often the event arrives', async () => {
    const { reactions, memories, stored } = reacting();

    await reactions.onApproved(approved());
    await reactions.onApproved(approved());

    expect(memories.add).toHaveBeenCalledTimes(1);
    expect(stored[0]?.status).toBe('active');
    expect(stored[0]?.approval.equals(ADA)).toBe(true);
  });

  it('creates an approved memory without claiming to replace one that is no longer active', async () => {
    const gone = Memory.create({
      id: OLD,
      handle: MemoryHandle.of(1),
      workspaceId: WorkspaceId.of('ws_1'),
      kind: 'preference',
      body: MemoryBody.of('Name branches after the author.'),
      scope: SCOPE,
      provenance: PROVENANCE,
      source: 'run',
      supersedes: null,
      approval: ADA,
    }).retire({ by: UserId.of('user_bea'), reason: 'Wrong.', at: NOW });
    const { reactions, stored } = reacting([gone]);

    await reactions.onApproved(approved(OLD));

    expect(stored.find((each) => each.id.equals(NEW))?.supersedes).toBeNull();
  });

  it('retires the memory that a newly active one supersedes', async () => {
    const old = Memory.create({
      id: OLD,
      handle: MemoryHandle.of(2),
      workspaceId: WorkspaceId.of('ws_1'),
      kind: 'preference',
      body: MemoryBody.of('Name branches after the author.'),
      scope: SCOPE,
      provenance: PROVENANCE,
      source: 'run',
      supersedes: null,
      approval: ADA,
    });
    const { reactions, stored } = reacting([old]);

    await reactions.onCreated(new MemoryCreated(NEW, OLD));

    expect(stored[0]?.status).toBe('retired');
    expect(stored[0]?.retirement?.supersededBy?.equals(NEW)).toBe(true);
  });

  it('leaves a memory already superseded by another active one as it was', async () => {
    const old = Memory.create({
      id: OLD,
      handle: MemoryHandle.of(3),
      workspaceId: WorkspaceId.of('ws_1'),
      kind: 'preference',
      body: MemoryBody.of('Name branches after the author.'),
      scope: SCOPE,
      provenance: PROVENANCE,
      source: 'run',
      supersedes: null,
      approval: ADA,
    }).supersedeWith(MemoryId.of('memory_first'), NOW);
    const { reactions, memories, stored } = reacting([old]);

    await reactions.onCreated(new MemoryCreated(NEW, OLD));

    expect(memories.save).not.toHaveBeenCalled();
    expect(
      stored[0]?.retirement?.supersededBy?.equals(MemoryId.of('memory_first')),
    ).toBe(true);
  });
});
