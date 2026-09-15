import { ChatRunWork } from '@application/services/chat-run-work';
import type { RunWork } from '@application/services/run-work';
import { TaskRunWork } from '@application/services/task-run-work';
import type { Run } from '@domain/aggregates/run.aggregate';
import { UnknownRunError } from '@domain/exceptions/unknown-run.error';
import type { ChatRepository } from '@domain/repositories/chat.repository';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';

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

  async of(runId: string): Promise<WorkedRun | null> {
    const run = await this.runs.findById(RunId.of(runId));

    return run ? { run, work: await this.workOf(run) } : null;
  }

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

        return task ? new TaskRunWork(run, task, this.tasks, this.lines) : null;
      },
      chat: async (chatId) => {
        const chat = await this.chats.find(chatId);

        return chat ? new ChatRunWork(run, chat, this.chats, this.lines) : null;
      },
    });
  }
}
