import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { AnswerConversationCommand } from '@work/application/commands/answer-conversation.command';
import { ApprovalAnswered } from '@work/application/rendering/approval-answered';
import type { ConversationLoader } from '@work/application/services/conversation-loader.service';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import type { DraftSending } from '@work/application/services/draft-sending.service';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

const ATTEMPTS = 3;

export class AnswerConversationHandler
  implements CommandHandlerPort<AnswerConversationCommand, void>
{
  constructor(
    private readonly conversations: ConversationLoader,
    private readonly tasks: TaskRepository,
    private readonly dispatch: TaskDispatching,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly files: FilesLoader,
    private readonly drafts: DraftSending,
  ) {}

  async execute(command: AnswerConversationCommand): Promise<void> {
    try {
      for (let attempt = 1; ; attempt++) {
        try {
          const answered = await this.transaction.inTransaction(() =>
            this.answer(command),
          );
          await this.drafts.announce(
            answered.taskId,
            answered.next,
            command.body,
          );
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

  private async answer(
    command: AnswerConversationCommand,
  ): Promise<{ taskId: TaskId; next: DraftGeneration | null }> {
    const { item, task, line } = await this.conversations.putTo(
      command.conversationId,
      command.answeredBy,
    );

    const answeredBy = UserId.of(command.answeredBy);
    const attachments = await this.files.handedOver(
      task.workspaceId,
      command.attachments,
    );

    const coAuthors = await this.drafts.coAuthors(
      task.id,
      line.teamId,
      command.coAuthors,
    );
    const sent = DraftGeneration.sentAs(command.draftGeneration);
    const drafted = task.sendDraft(sent);

    const changed = task.changesAt(item.from, command.decision, command.edits);
    const answered = drafted.answer(
      item.from,
      {
        line,
        body: TaskNoteBody.fromInput(
          ApprovalAnswered.words(command.body, command.decision, changed),
          attachments,
        ),
        at: this.clock.now(),
        voice: Voice.person(answeredBy, coAuthors),
        attachments,
      },
      command.decision,
      command.edits,
    );

    const runId = answered.wantsRun(line)
      ? await this.dispatch.runIdFor({ task: answered, line })
      : null;

    await this.tasks.save(runId ? answered.assignRun(runId, line) : answered);
    await this.files.takenIn(task.workspaceId, attachments);

    return { taskId: task.id, next: sent && answered.draftGeneration };
  }
}
