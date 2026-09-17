import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { ChatRunWork } from '@work/application/services/chat-run-work';
import type { RunWork } from '@work/application/services/run-work';
import { TaskRunWork } from '@work/application/services/task-run-work';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export interface WorkedRun {
  readonly run: Run;
  readonly work: RunWork | null;
}

export class RunWorks {
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
    private readonly chats: ChatRepository,
    private readonly lines: LineRepository,
  ) {}

  async heldBy(runId: string, runnerId: string): Promise<WorkedRun> {
    const run = await this.runs.findById(RunId.of(runId));

    if (!run) {
      throw new UnknownRunError(`there is no run ${runId}`);
    }

    run.assertHeldBy(RunnerId.of(runnerId));

    return { run, work: await this.workOf(run) };
  }

  private async workOf(run: Run): Promise<RunWork | null> {
    if (!run.subject) {
      return null;
    }

    return run.subject.match<Promise<RunWork | null>>({
      task: async (taskId) => {
        const task = await this.tasks.find(taskId);

        return task?.heldBy(run.id)
          ? new TaskRunWork(run, task, this.tasks, this.lines)
          : null;
      },
      chat: async (chatId) => {
        const chat = await this.chats.find(chatId);

        return chat ? new ChatRunWork(run, chat, this.chats) : null;
      },
    });
  }
}
