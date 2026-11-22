import type { ReviewsPort } from '@memory/application/ports/reviews.port';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryApproved } from '@memory/domain/events/memory-approved.event';
import type { MemoryCreated } from '@memory/domain/events/memory-created.event';
import type { MemoryRetirementApproved } from '@memory/domain/events/memory-retirement-approved.event';
import type { MemoryReviewReopened } from '@memory/domain/events/memory-review-reopened.event';
import type { MemoryReviewRequested } from '@memory/domain/events/memory-review-requested.event';
import type { MemoryReviewResolved } from '@memory/domain/events/memory-review-resolved.event';
import type { MemoryProposalSetRepository } from '@memory/domain/repositories/memory-proposal-set.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { inactiveOf } from '@memory/domain/services/memory-lapse';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class MemoryReactions {
  constructor(
    private readonly reviews: ReviewsPort,
    private readonly sets: MemoryProposalSetRepository,
    private readonly memories: MemoryRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  onReviewRequested(event: MemoryReviewRequested): Promise<void> {
    return this.reviewed(event.taskId, event.runId);
  }

  onReviewResolved(event: MemoryReviewResolved): Promise<void> {
    return this.reviewed(event.taskId, event.runId);
  }

  onReviewReopened(event: MemoryReviewReopened): Promise<void> {
    return this.reviewed(event.taskId, event.runId);
  }

  private reviewed(taskId: TaskId, runId: RunId): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const set = await this.sets.forTaskLocked(taskId);

      await (set?.awaitsReviewIn(runId)
        ? this.reviews.reopen(taskId, runId)
        : this.reviews.resolve(taskId, runId));
    });
  }

  async onApproved(event: MemoryApproved): Promise<void> {
    await this.transaction.inTransaction(async () => {
      if (await this.memories.find(event.memoryId)) {
        return;
      }

      const supersedes = event.supersedes
        ? ((await this.memories.find(event.supersedes))?.asPredecessor ?? null)
        : null;

      await this.memories.add(
        Memory.create({
          id: event.memoryId,
          handle: await this.memories.nextHandle(),
          workspaceId: event.workspaceId,
          kind: event.memoryKind,
          body: event.body,
          scope: event.scope,
          provenance: event.provenance,
          source: event.source,
          supersedes,
          approval: event.decision,
        }),
      );
    });
  }

  async onRetirementApproved(event: MemoryRetirementApproved): Promise<void> {
    const retired = await this.transaction.inTransaction(async () => {
      const found = await this.memories.find(event.memoryId);
      const retiring = {
        by: event.decision.by,
        reason: event.reason,
        at: event.decision.at,
      };

      if (found?.retiredAs(retiring)) {
        return true;
      }

      if (
        !found ||
        inactiveOf([event.memoryId], [found], event.teamId).length > 0
      ) {
        return false;
      }

      await this.memories.save(found.retire(retiring));
      return true;
    });

    if (!retired) {
      await this.transaction.inTransaction(async () => {
        const set = await this.sets.forTask(event.taskId);
        const proposal = set?.proposals.find((each) =>
          each.id.equals(event.proposalId),
        );

        if (set && proposal?.state === 'approved') {
          await this.sets.save(set.lapse(event.proposalId));
        }
      });
    }
  }

  async onCreated(event: MemoryCreated): Promise<void> {
    const { supersedes } = event;

    if (!supersedes || event.creation === 'merged') {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const superseded = await this.memories.find(supersedes);

      if (superseded?.isActive) {
        await this.memories.save(
          superseded.supersedeWith(event.memoryId, this.clock.now()),
        );
        return;
      }

      const successor = await this.memories.find(event.memoryId);
      const alone = successor?.afterPredecessor(superseded) ?? null;

      if (successor && alone && alone !== successor) {
        await this.memories.save(alone);
      }
    });
  }
}
