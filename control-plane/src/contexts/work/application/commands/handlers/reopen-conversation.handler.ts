import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ReopenConversationCommand } from '@work/application/commands/reopen-conversation.command';
import type { ConversationLoader } from '@work/application/services/conversation-loader.service';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

const REOPENED = 'Reopened.';

export class ReopenConversationHandler implements CommandHandlerPort<
  ReopenConversationCommand,
  void
> {
  constructor(
    private readonly conversations: ConversationLoader,
    private readonly tasks: TaskRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ReopenConversationCommand): Promise<void> {
    try {
      const { item, task, line } = await this.conversations.putTo(
        command.conversationId,
        command.reopenedBy,
      );

      await this.tasks.save(
        task.reopenAt(item.from, {
          line,
          body: TaskNoteBody.of(REOPENED),
          at: this.clock.now(),
          voice: Voice.person(UserId.of(command.reopenedBy)),
        }),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
