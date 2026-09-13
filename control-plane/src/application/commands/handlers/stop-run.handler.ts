import type { StopRunCommand } from '@application/commands/stop-run.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import { UnknownTaskError } from '@domain/exceptions/unknown-task.error';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { RunId } from '@domain/value-objects/run-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class StopRunHandler
  implements CommandHandlerPort<StopRunCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
    private readonly clock: ClockPort,
    private readonly events: DomainEventDispatcher,
  ) {}

  async execute(command: StopRunCommand): Promise<void> {
    try {
      const run = await this.runs.findById(RunId.of(command.runId));
      const task = run?.taskId ? await this.tasks.find(run.taskId) : null;

      if (
        !run?.stationId ||
        !task?.assignedToThem(UserId.of(command.stoppedBy))
      ) {
        throw new UnknownTaskError(command.runId);
      }

      const stopping = run.requestStop(this.clock.now());
      await this.runs.save(stopping);

      await this.events.dispatch(stopping.pullEvents());
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
