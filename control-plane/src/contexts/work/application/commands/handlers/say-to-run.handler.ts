import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { SayToRunCommand } from '@work/application/commands/say-to-run.command';
import type { FilesAtHand } from '@work/application/services/files-at-hand.service';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

export class SayToRunHandler
  implements CommandHandlerPort<SayToRunCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly clock: ClockPort,
    private readonly files: FilesAtHand,
  ) {}

  async execute(command: SayToRunCommand): Promise<void> {
    try {
      const saidBy = UserId.of(command.saidBy);
      const run = await this.runs.findById(RunId.of(command.runId));
      const task = run?.taskId ? await this.tasks.find(run.taskId) : null;

      if (!run?.stationId || !task?.assignedToThem(saidBy)) {
        throw new UnknownTaskError(command.runId);
      }

      const line = await this.lines.holding(task.stationId);
      const station = line?.stationAt(task.stationId);
      const attachments = await this.files.handedOver(
        task.workspaceId,
        command.attachments,
      );

      await this.tasks.save(
        task.spokenTo(
          run.id,
          {
            station: station?.name ?? StationName.unknown(),
            body: TaskNoteBody.given(command.body, attachments),
            at: this.clock.now(),
            voice: Voice.person(saidBy),
            attachments,
          },
          run.stationId,
        ),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
