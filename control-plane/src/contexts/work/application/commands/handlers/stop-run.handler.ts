import type { RunsPort } from '@runs/application/ports/runs.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { StopRunCommand } from '@work/application/commands/stop-run.command';
import type { TakeTurn } from '@work/application/services/take-turn.service';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { RunStopPolicy } from '@work/domain/services/run-stop-policy';

export class StopRunHandler
  implements CommandHandlerPort<StopRunCommand, void>
{
  constructor(
    private readonly runs: RunsPort,
    private readonly dispatches: DispatchRepository,
    private readonly tasks: TaskRepository,
    private readonly turns: TakeTurn,
    private readonly access: WorkAccess,
  ) {}

  async execute(command: StopRunCommand): Promise<void> {
    try {
      const runId = RunId.of(command.runId);
      const stoppedBy = UserId.of(command.stoppedBy);
      const dispatch = await this.dispatches.find(runId);
      const subject = dispatch?.subject;
      const task =
        subject?.kind === 'task' ? await this.tasks.find(subject.taskId) : null;
      const unknown = () =>
        new UnknownRunError(`Run ${command.runId} is not one you may stop.`);

      if (
        !dispatch?.teamId ||
        subject?.kind !== 'task' ||
        !RunStopPolicy.allows(subject, task, stoppedBy)
      ) {
        throw unknown();
      }

      (
        await this.access.standingOn(dispatch.teamId, stoppedBy)
      ).assertActsOnTasks(unknown);

      const stop = await this.runs.requestStop(runId);

      if (stop.pendingTurn !== null) {
        await this.turns.take(runId, stop.pendingTurn);
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
