import type { ReviewsPort } from '@memory/application/ports/reviews.port';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryApproved } from '@memory/domain/events/memory-approved.event';
import type { MemoryCreated } from '@memory/domain/events/memory-created.event';
import type { MemoryReviewRequested } from '@memory/domain/events/memory-review-requested.event';
import type { MemoryReviewResolved } from '@memory/domain/events/memory-review-resolved.event';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class MemoryReactions {
  constructor(
    private readonly reviews: ReviewsPort,
    private readonly memories: MemoryRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async onReviewRequested(event: MemoryReviewRequested): Promise<void> {
    await this.reviews.create(event.taskId, event.runId);
  }

  async onReviewResolved(event: MemoryReviewResolved): Promise<void> {
    await this.reviews.resolve(event.taskId, event.runId);
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

  async onCreated(event: MemoryCreated): Promise<void> {
    const { supersedes } = event;

    if (!supersedes) {
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
