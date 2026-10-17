import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { StopRunCommand } from '@work/application/commands/stop-run.command';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class StopRunHandler
  implements CommandHandlerPort<StopRunCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
    private readonly clock: ClockPort,
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
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
