import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { StopRunCommand } from '@work/application/commands/stop-run.command';
import type { RunFactsPort } from '@work/application/ports/run-facts.port';
import type { RunsPort } from '@work/application/ports/runs.port';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { RunStopPolicy } from '@work/domain/services/run-stop-policy';

export class StopRunHandler
  implements CommandHandlerPort<StopRunCommand, void>
{
  constructor(
    private readonly runs: RunsPort,
    private readonly facts: RunFactsPort,
    private readonly tasks: TaskRepository,
  ) {}

  async execute(command: StopRunCommand): Promise<void> {
    try {
      const runId = RunId.of(command.runId);
      const [run] = await this.facts.of([runId]);
      const subject = run?.subject?.kind === 'task' ? run.subject : null;
      const task = subject ? await this.tasks.find(subject.taskId) : null;

      if (
        !subject ||
        !RunStopPolicy.allows(subject, task, UserId.of(command.stoppedBy))
      ) {
        throw new UnknownRunError(
          `Run ${command.runId} is not one you may stop.`,
        );
      }

      await this.runs.requestStop(runId);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
