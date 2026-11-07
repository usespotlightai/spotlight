import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BriefedTasksPort } from '@work/application/ports/briefed-tasks.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunFactsPort } from '@work/application/ports/run-facts.port';
import type {
  LeasedAttempt,
  LeasedRun,
  RunLeasesPort,
} from '@work/application/ports/run-leases.port';
import type { RunsPort } from '@work/application/ports/runs.port';
import { ChatRunWork } from '@work/application/services/chat-run-work';
import { ReplayRunWork } from '@work/application/services/replay-run-work';
import type { RunWork } from '@work/application/services/run-work';
import { SearchRunWork } from '@work/application/services/search-run-work';
import { TaskRunWork } from '@work/application/services/task-run-work';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { repositoryForTaskNamed } from '@work/domain/services/task-checkouts';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';

export interface LeasedRunWork {
  readonly run: LeasedRun;
  readonly work: RunWork | null;
}

export interface CheckedRepository {
  readonly workspaceId: WorkspaceId;
  readonly repository: Repository;
}

export class RunWorks {
  constructor(
    private readonly leases: RunLeasesPort,
    private readonly facts: RunFactsPort,
    private readonly runCommands: RunsPort,
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
    private readonly chats: ChatRepository,
    private readonly lines: LineMapsPort,
    private readonly briefedTasks: BriefedTasksPort,
    private readonly clock: ClockPort,
  ) {}

  async leasedBy(runId: string, runnerId: string): Promise<LeasedRunWork> {
    const run = await this.leases.leaseOf(
      RunId.of(runId),
      RunnerId.of(runnerId),
    );

    return { run, work: await this.workOf(run) };
  }

  async workLeasedBy(runId: string, runnerId: string): Promise<RunWork | null> {
    const run = await this.leases.leasedBy(
      RunId.of(runId),
      RunnerId.of(runnerId),
    );

    return run ? this.workOf(run) : null;
  }

  async stillOn(leased: LeasedAttempt, runnerId: string): Promise<void> {
    await this.leases.assertStillOn(
      leased.runId,
      leased.attempt,
      RunnerId.of(runnerId),
    );
  }

  async repositoryForCheck(
    runId: RunId,
    name: string,
  ): Promise<CheckedRepository | null> {
    const [run] = await this.facts.of([runId]);
    const subject = run?.subject;

    if (subject?.kind === 'replay') {
      const replayed = (await this.runs.findById(runId))?.replayedRepository(
        name,
      );

      return run && replayed
        ? { workspaceId: run.workspaceId, repository: replayed }
        : null;
    }

    if (!run || subject?.kind !== 'task' || !subject.stationId) {
      return null;
    }

    const task = await this.tasks.find(subject.taskId);
    const line = await this.lines.findByStation(subject.stationId);
    const repository = line ? repositoryForTaskNamed(name, task, line) : null;

    return repository ? { workspaceId: run.workspaceId, repository } : null;
  }

  private async workOf(run: LeasedRun): Promise<RunWork | null> {
    const subject = run.subject;

    switch (subject?.kind) {
      case 'task': {
        const task = await this.tasks.find(subject.taskId);

        return task?.hasCurrentRun(run.runId)
          ? new TaskRunWork(run, task, this.tasks, this.lines, this.clock)
          : null;
      }
      case 'chat': {
        const chat = await this.chats.find(ChatId.of(subject.chatId));

        return chat ? new ChatRunWork(run, chat, this.chats) : null;
      }
      case 'replay':
        return new ReplayRunWork(
          run,
          await this.briefedTasks.of(subject.replayOf),
          this.runs,
          this.runCommands,
        );
      case 'search':
        return new SearchRunWork(run, this.runCommands);
      default:
        return null;
    }
  }
}
