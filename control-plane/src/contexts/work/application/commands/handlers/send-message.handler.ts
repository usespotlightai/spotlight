import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { SendMessageCommand } from '@work/application/commands/send-message.command';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

interface MessageTarget {
  readonly runId: RunId;
  readonly taskId: TaskId;
  readonly stationId: StationId;
}

export class SendMessageHandler
  implements CommandHandlerPort<SendMessageCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly transaction: TransactionPort,
    private readonly dispatch: TaskDispatching,
    private readonly clock: ClockPort,
    private readonly files: FilesLoader,
  ) {}

  async execute(command: SendMessageCommand): Promise<void> {
    try {
      const run = await this.runs.findById(RunId.of(command.runId));
      const taskId = run?.taskId;
      const stationId = run?.stationId;

      if (!run || !taskId || !stationId) {
        throw new UnknownTaskError(command.runId);
      }

      const attachments = await this.files.handedOver(
        run.workspaceId,
        command.attachments,
      );

      await this.transaction.inTransaction(() =>
        this.send(command, { runId: run.id, taskId, stationId }, attachments),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async send(
    command: SendMessageCommand,
    target: MessageTarget,
    attachments: readonly Attachment[],
  ): Promise<void> {
    const sentBy = UserId.of(command.sentBy);
    const task = await this.tasks.find(target.taskId);

    if (!task?.assignedToThem(sentBy)) {
      throw new UnknownTaskError(command.runId);
    }

    const line = await this.lines.findByStation(task.stationId);
    const station = line?.stationAt(task.stationId);

    const received = task.receiveMessage(
      target.runId,
      {
        station: station?.name ?? StationName.unknown(),
        body: TaskNoteBody.given(command.body, attachments),
        at: this.clock.now(),
        voice: Voice.person(sentBy),
        attachments,
      },
      target.stationId,
    );

    await this.tasks.save(
      line && received.wantsRun(line)
        ? await this.assignRun(received, line)
        : received,
    );
    await this.files.takenIn(task.workspaceId, attachments);
  }

  private async assignRun(task: Task, line: Line): Promise<Task> {
    const runId = await this.dispatch.runIdFor({ task, line });

    return runId ? task.assignRun(runId, line) : task;
  }
}
