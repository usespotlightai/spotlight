import type { ChangeStackWorkPort } from '@change-review/application/ports/change-stack-work.port';
import type { DraftChangeStack } from '@change-review/application/services/draft-change-stack.service';
import type { ReorderChangeStack } from '@change-review/application/services/reorder-change-stack.service';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { ChangedSinceReadError } from '@change-review/domain/exceptions/changed-since-read.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export const MOST_STACKS_AT_ONCE = 4;

export class WorkChangeStacks implements ChangeStackWorkPort {
  readonly #working = new Set<Promise<void>>();

  constructor(
    private readonly stacks: ChangeStackRepository,
    private readonly transaction: TransactionPort,
    private readonly drafting: DraftChangeStack,
    private readonly reordering: ReorderChangeStack,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async workDue(): Promise<void> {
    while (this.#working.size < MOST_STACKS_AT_ONCE) {
      const claimed = await this.claim();

      if (!claimed) {
        return;
      }

      const working: Promise<void> = this.workOn(claimed).finally(() =>
        this.#working.delete(working),
      );
      this.#working.add(working);
    }
  }

  async idle(): Promise<void> {
    await Promise.all([...this.#working]);
  }

  private async workOn(id: ChangeStackId): Promise<void> {
    const stack = await this.stacks.find(id).catch(() => null);

    if (stack?.owesWork) {
      await this.work(stack);
    }
  }

  private claim(): Promise<ChangeStackId | null> {
    return this.transaction.run(async () => {
      const now = this.clock.now();
      const due = await this.stacks.dueForWork(now);

      if (!due) {
        return null;
      }

      if (due.work.exhausted) {
        this.logger.warn(
          { changeStackId: due.id.value, attempts: due.work.attempts },
          'Giving up on a change stack whose work kept being interrupted',
        );
        await this.stacks.save(due.gaveUp(now));
        return due.id;
      }

      await this.stacks.save(due.leased(now));
      return due.id;
    });
  }

  private async work(stack: ChangeStack): Promise<void> {
    try {
      await this.stacks.save(
        stack.state === 'drafting'
          ? await this.drafting.drafted(stack)
          : await this.reordering.reordered(stack),
      );
    } catch (error) {
      this.logger.error(
        {
          changeStackId: stack.id.value,
          runId: stack.runId.value,
          attempts: stack.work.attempts,
          err: error,
        },
        stack.state === 'drafting'
          ? 'Drafting a change stack'
          : 'Reordering a change stack after its check',
      );

      if (error instanceof ChangedSinceReadError) {
        return;
      }

      await this.stacks
        .save(stack.triedAgainLater(this.clock.now()))
        .catch((settling: unknown) =>
          this.logger.error(
            { changeStackId: stack.id.value, error: settling },
            'Putting a change stack back to be worked on later',
          ),
        );
    }
  }
}
