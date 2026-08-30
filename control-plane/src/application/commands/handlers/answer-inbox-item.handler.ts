import type { AnswerInboxItemCommand } from '@application/commands/answer-inbox-item.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { TaskDispatchPort } from '@application/ports/task-dispatch.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { UnknownTaskError } from '@domain/exceptions/unknown-task.error';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { ConversationId } from '@domain/value-objects/conversation-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

/**
 * A person answers, and the work carries on: the answer joins the trail and a
 * run picks it up at the same station, taking up the same conversation.
 */
export class AnswerInboxItemHandler
  implements CommandHandlerPort<AnswerInboxItemCommand, void>
{
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly dispatch: TaskDispatchPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: AnswerInboxItemCommand): Promise<void> {
    try {
      await this.transaction.run(async () => {
        const item = ConversationId.parse(command.itemId);
        const task = await this.tasks.find(item.taskId);

        if (!task?.raisedByThem(UserId.of(command.answeredBy))) {
          throw new UnknownTaskError(item.taskId.value);
        }

        const line = await this.lines.holding(task.stationId);
        const station = line?.stationAt(task.stationId);

        const answered = task.answered(item.from, {
          station: station?.name ?? StationName.of('Unknown'),
          body: TaskNoteBody.of(command.body),
          at: this.clock.now(),
          author: UserId.of(command.answeredBy),
        });

        // Nothing to start where one is already running, or where the station
        // has nothing to work it.
        const runId =
          line && station && !answered.currentRunId
            ? await this.dispatch.dispatch({ task: answered, line })
            : null;

        await this.tasks.save(runId ? answered.handedTo(runId) : answered);
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
