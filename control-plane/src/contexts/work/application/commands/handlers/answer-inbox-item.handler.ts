import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { AnswerInboxItemCommand } from '@work/application/commands/answer-inbox-item.command';
import { ApprovalAnswered } from '@work/application/rendering/approval-answered';
import type { ConversationLoader } from '@work/application/services/conversation-loader.service';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

const ATTEMPTS = 3;

export class AnswerInboxItemHandler
  implements CommandHandlerPort<AnswerInboxItemCommand, void>
{
  constructor(
    private readonly conversations: ConversationLoader,
    private readonly tasks: TaskRepository,
    private readonly dispatch: TaskDispatching,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly files: FilesLoader,
  ) {}

  async execute(command: AnswerInboxItemCommand): Promise<void> {
    try {
      for (let attempt = 1; ; attempt++) {
        try {
          await this.transaction.inTransaction(() => this.answer(command));
          return;
        } catch (error) {
          if (
            !(error instanceof TaskVersionConflictError) ||
            attempt >= ATTEMPTS
          ) {
            throw error;
          }
        }
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async answer(command: AnswerInboxItemCommand): Promise<void> {
    const { item, task, line, station } = await this.conversations.putTo(
      command.itemId,
      command.answeredBy,
    );

    const answeredBy = UserId.of(command.answeredBy);
    const attachments = await this.files.handedOver(
      task.workspaceId,
      command.attachments,
    );

    const changed = task.changesAt(item.from, command.decision, command.edits);
    const answered = task.answer(
      item.from,
      {
        station,
        body: TaskNoteBody.given(
          ApprovalAnswered.words(command.body, command.decision, changed),
          attachments,
        ),
        at: this.clock.now(),
        voice: Voice.person(answeredBy),
        attachments,
      },
      command.decision,
      command.edits,
    );

    const runId =
      line && answered.wantsRun(line)
        ? await this.dispatch.runIdFor({ task: answered, line })
        : null;

    await this.tasks.save(
      runId && line ? answered.handedTo(runId, line) : answered,
    );
    await this.files.takenIn(task.workspaceId, attachments);
  }
}
