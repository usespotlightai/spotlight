import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class RaiseTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly dispatch: TaskDispatching,
    private readonly transaction: TransactionPort,
  ) {}

  async raise(input: { task: Task; line: Line }): Promise<Task> {
    return this.transaction.run(async () => {
      const runId = input.task.wantsRun(input.line)
        ? await this.dispatch.runIdFor(input)
        : null;
      const handed = runId
        ? input.task.handedTo(runId, input.line)
        : input.task;

      await this.tasks.add(handed);

      return handed;
    });
  }
}
