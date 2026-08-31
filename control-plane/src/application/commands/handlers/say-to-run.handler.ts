import type { SayToRunCommand } from '@application/commands/say-to-run.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import { UnknownTaskError } from '@domain/exceptions/unknown-task.error';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { RunId } from '@domain/value-objects/run-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

/**
 * A person says something to the agent working a run. The run names the
 * station it was dispatched from, and the task refuses anything said to a
 * station it has since left.
 */
export class SayToRunHandler
  implements CommandHandlerPort<SayToRunCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: SayToRunCommand): Promise<void> {
    try {
      const run = await this.runs.findById(RunId.of(command.runId));
      const task = run?.taskId ? await this.tasks.find(run.taskId) : null;

      if (!run?.stationId || !task?.raisedByThem(UserId.of(command.saidBy))) {
        throw new UnknownTaskError(command.runId);
      }

      const line = await this.lines.holding(task.stationId);
      const station = line?.stationAt(task.stationId);

      await this.tasks.save(
        task.told(run.stationId, {
          station: station?.name ?? StationName.unknown(),
          body: TaskNoteBody.of(command.body),
          at: this.clock.now(),
          author: UserId.of(command.saidBy),
        }),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
