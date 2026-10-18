import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class CreateTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly dispatch: TaskDispatching,
    private readonly transaction: TransactionPort,
    private readonly files: FilesLoader,
  ) {}

  async create(input: { task: Task; line: Line }): Promise<Task> {
    return this.transaction.inTransaction(async () => {
      const runId = input.task.wantsRun(input.line)
        ? await this.dispatch.runIdFor(input)
        : null;
      const handed = runId
        ? input.task.assignRun(runId, input.line)
        : input.task;

      await this.tasks.add(handed);
      await this.files.takenIn(handed.workspaceId, handed.attachments);

      return handed;
    });
  }
}
