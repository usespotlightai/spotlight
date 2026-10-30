import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ResolveInboxItemCommand } from '@work/application/commands/resolve-inbox-item.command';
import type { ConversationLoader } from '@work/application/services/conversation-loader.service';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

const RESOLVED = 'Resolved without an answer.';

export class ResolveInboxItemHandler
  implements CommandHandlerPort<ResolveInboxItemCommand, void>
{
  constructor(
    private readonly conversations: ConversationLoader,
    private readonly tasks: TaskRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ResolveInboxItemCommand): Promise<void> {
    try {
      const { item, task, station } = await this.conversations.putTo(
        command.itemId,
        command.resolvedBy,
      );

      await this.tasks.save(
        task.resolveAt(item.from, {
          station,
          body: TaskNoteBody.of(RESOLVED),
          at: this.clock.now(),
          voice: Voice.person(UserId.of(command.resolvedBy)),
        }),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
