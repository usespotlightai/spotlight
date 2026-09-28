import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ChatRunWork } from '@work/application/services/chat-run-work';
import type { RunWork } from '@work/application/services/run-work';
import { TaskRunWork } from '@work/application/services/task-run-work';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { repositoryWorkedOnNamed } from '@work/domain/services/task-checkouts';
import type { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';

export interface WorkedRun {
  readonly run: Run;
  readonly work: RunWork | null;
}

export interface CheckedRepository {
  readonly workspaceId: WorkspaceId;
  readonly repository: Repository;
}

export class RunWorks {
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
    private readonly chats: ChatRepository,
    private readonly lines: LineRepository,
    private readonly clock: ClockPort,
  ) {}

  async heldBy(runId: string, runnerId: string): Promise<WorkedRun> {
    const run = await this.runs.findById(RunId.of(runId));

    if (!run) {
      throw new UnknownRunError(`there is no run ${runId}`);
    }

    run.assertHeldBy(RunnerId.of(runnerId));

    return { run, work: await this.workOf(run) };
  }

  async stillOn(attempt: RunAttempt, runnerId: string): Promise<void> {
    const run = await this.runs.findById(attempt.runId);

    if (!run) {
      throw new UnknownRunError(`there is no run ${attempt.runId.value}`);
    }

    run.assertStillOn(attempt, RunnerId.of(runnerId));
  }

  async repositoryForCheck(
    runId: RunId,
    name: string,
  ): Promise<CheckedRepository | null> {
    const run = await this.runs.findById(runId);

    if (!run?.stationId) {
      return null;
    }

    const task =
      (await run.subject?.match<Promise<Task | null>>({
        task: (taskId) => this.tasks.find(taskId),
        chat: async () => null,
      })) ?? null;
    const line = await this.lines.holding(run.stationId);
    const repository = line ? repositoryWorkedOnNamed(name, task, line) : null;

    return repository ? { workspaceId: run.workspaceId, repository } : null;
  }

  private async workOf(run: Run): Promise<RunWork | null> {
    if (!run.subject) {
      return null;
    }

    return run.subject.match<Promise<RunWork | null>>({
      task: async (taskId) => {
        const task = await this.tasks.find(taskId);

        return task?.heldBy(run.id)
          ? new TaskRunWork(run, task, this.tasks, this.lines, this.clock)
          : null;
      },
      chat: async (chatId) => {
        const chat = await this.chats.find(chatId);

        return chat ? new ChatRunWork(run, chat, this.chats) : null;
      },
    });
  }
}
