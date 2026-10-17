import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { SayToRunCommand } from '@work/application/commands/say-to-run.command';
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

interface SaidIn {
  readonly runId: RunId;
  readonly taskId: TaskId;
  readonly stationId: StationId;
}

export class SayToRunHandler
  implements CommandHandlerPort<SayToRunCommand, void>
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

  async execute(command: SayToRunCommand): Promise<void> {
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
        this.say(command, { runId: run.id, taskId, stationId }, attachments),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async say(
    command: SayToRunCommand,
    said: SaidIn,
    attachments: readonly Attachment[],
  ): Promise<void> {
    const saidBy = UserId.of(command.saidBy);
    const task = await this.tasks.find(said.taskId);

    if (!task?.assignedToThem(saidBy)) {
      throw new UnknownTaskError(command.runId);
    }

    const line = await this.lines.holding(task.stationId);
    const station = line?.stationAt(task.stationId);

    const heard = task.spokenTo(
      said.runId,
      {
        station: station?.name ?? StationName.unknown(),
        body: TaskNoteBody.given(command.body, attachments),
        at: this.clock.now(),
        voice: Voice.person(saidBy),
        attachments,
      },
      said.stationId,
    );

    await this.tasks.save(
      line && heard.wantsRun(line) ? await this.handedOn(heard, line) : heard,
    );
    await this.files.takenIn(task.workspaceId, attachments);
  }

  private async handedOn(task: Task, line: Line): Promise<Task> {
    const runId = await this.dispatch.runIdFor({ task, line });

    return runId ? task.handedTo(runId, line) : task;
  }
}
