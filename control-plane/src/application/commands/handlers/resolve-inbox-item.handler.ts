import type { ResolveInboxItemCommand } from '@application/commands/resolve-inbox-item.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { ConversationAtHand } from '@application/services/conversation-at-hand.service';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

/**
 * The person it was put to has seen all they need to. Nothing is dispatched
 * after: closing is how they say the work stops here.
 */
export class ResolveInboxItemHandler
  implements CommandHandlerPort<ResolveInboxItemCommand, void>
{
  constructor(
    private readonly conversations: ConversationAtHand,
    private readonly tasks: TaskRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ResolveInboxItemCommand): Promise<void> {
    try {
      await this.transaction.run(async () => {
        const { item, task, station } = await this.conversations.putTo(
          command.itemId,
          command.resolvedBy,
        );

        await this.tasks.save(
          task.resolved(item.from, {
            station,
            body: TaskNoteBody.resolved(),
            at: this.clock.now(),
            author: UserId.of(command.resolvedBy),
          }),
        );
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
