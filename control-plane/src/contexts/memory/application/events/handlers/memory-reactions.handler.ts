import type { ReviewsPort } from '@memory/application/ports/reviews.port';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoriesProposed } from '@memory/domain/events/memories-proposed.event';
import type { MemoryApproved } from '@memory/domain/events/memory-approved.event';
import type { MemoryReviewSettled } from '@memory/domain/events/memory-review-settled.event';
import type { MemoryStood } from '@memory/domain/events/memory-stood.event';
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

  async onProposed(event: MemoriesProposed): Promise<void> {
    if (event.proposed > 0) {
      await this.reviews.raise(event.taskId, event.runId);
    }
  }

  async onReviewSettled(event: MemoryReviewSettled): Promise<void> {
    await this.reviews.settle(event.taskId, event.runId);
  }

  async onApproved(event: MemoryApproved): Promise<void> {
    await this.transaction.run(async () => {
      if (await this.memories.find(event.memoryId)) {
        return;
      }

      await this.memories.add(
        Memory.stood({
          id: event.memoryId,
          workspaceId: event.workspaceId,
          kind: event.memoryKind,
          body: event.body,
          scope: event.scope,
          grounds: event.grounds,
          source: event.source,
          supersedes: event.supersedes,
          approval: event.decision,
        }),
      );
    });
  }

  async onStood(event: MemoryStood): Promise<void> {
    const { supersedes } = event;

    if (!supersedes) {
      return;
    }

    await this.transaction.run(async () => {
      const superseded = await this.memories.find(supersedes);

      if (superseded?.standing === 'stands') {
        await this.memories.save(
          superseded.supersededBy(event.memoryId, this.clock.now()),
        );
      }
    });
  }
}
