import type { AnswerInboxItemCommand } from '@application/commands/answer-inbox-item.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { ConversationAtHand } from '@application/services/conversation-at-hand.service';
import type { FilesAtHand } from '@application/services/files-at-hand.service';
import type { TaskDispatching } from '@application/services/task-dispatch';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';

/**
 * A person answers, and the work carries on: the answer joins the trail and a
 * run picks it up at the same station, taking up the same conversation.
 */
export class AnswerInboxItemHandler
  implements CommandHandlerPort<AnswerInboxItemCommand, void>
{
  constructor(
    private readonly conversations: ConversationAtHand,
    private readonly tasks: TaskRepository,
    private readonly dispatch: TaskDispatching,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly files: FilesAtHand,
  ) {}

  async execute(command: AnswerInboxItemCommand): Promise<void> {
    try {
      await this.transaction.run(async () => {
        const { item, task, line, station } = await this.conversations.putTo(
          command.itemId,
          command.answeredBy,
        );

        const answeredBy = UserId.of(command.answeredBy);
        const attachments = await this.files.handedOver(
          task.workspaceId,
          command.attachments,
        );

        const answered = task.answered(item.from, {
          station,
          body: TaskNoteBody.given(command.body, attachments),
          at: this.clock.now(),
          voice: Voice.person(answeredBy),
          attachments,
        });

        // Nothing to start where one is already running, or where the station
        // has nothing to work it.
        const runId =
          line?.stationAt(task.stationId) && !answered.currentRunId
            ? await this.dispatch.dispatch({ task: answered, line })
            : null;

        await this.tasks.save(runId ? answered.handedTo(runId) : answered);
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
