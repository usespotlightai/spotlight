import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { StartTaskRunCommand } from '@work/application/commands/start-task-run.command';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { handedToRun } from '@work/application/services/handed-to-run';
import type { LineLoader } from '@work/application/services/line-loader.service';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class StartTaskRunHandler implements CommandHandlerPort<
  StartTaskRunCommand,
  void
> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineLoader,
    private readonly dispatch: TaskDispatching,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: StartTaskRunCommand): Promise<void> {
    try {
      await this.transaction.inTransaction(() => this.start(command));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async start(command: StartTaskRunCommand): Promise<void> {
    const task = await this.tasks.find(TaskId.of(command.taskId));

    if (!task) {
      throw new UnknownTaskError(command.taskId);
    }

    const line = await this.lines.atStation(
      command.teamId,
      task.stationId,
      command.viewerId,
      () => new UnknownTaskError(command.taskId),
    );

    if (!task.runNotStartedHere) {
      throw new InvalidTaskTransitionError(
        `Task ${command.taskId} is not waiting for its run to start.`,
      );
    }

    await this.tasks.save(await handedToRun(this.dispatch, task, line));
  }
}
