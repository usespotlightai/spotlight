import type { TransactionPort } from '@application/ports/transaction.port';
import type { TaskDispatching } from '@application/services/task-dispatch';
import type { Line } from '@domain/aggregates/line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { TaskRepository } from '@domain/repositories/task.repository';

export class RaiseTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly dispatch: TaskDispatching,
    private readonly transaction: TransactionPort,
  ) {}

  async raise(input: { task: Task; line: Line }): Promise<Task> {
    return this.transaction.run(async () => {
      const runId = await this.dispatch.dispatch(input);
      const handed = runId ? input.task.handedTo(runId) : input.task;

      await this.tasks.add(handed);

      return handed;
    });
  }
}
