import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { OpenedPullRequest } from '@work/application/dto/pull-request.dto';
import type { HookedTasksPort } from '@work/application/ports/hooked-tasks.port';
import type { LifecycleHooksPort } from '@work/application/ports/lifecycle-hooks.port';
import { takeTaskMarks } from '@work/application/services/task-marks';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { PullRequestHookDeniedError } from '@work/domain/exceptions/pull-request-hook-denied.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

interface PullRequestFor {
  readonly runId: RunId;
  readonly taskId: TaskId;
  readonly stationId: StationId;
}

interface PullRequestAsked {
  readonly title: string;
  readonly body: string;
  readonly repository: string | null;
}

export class OpenPullRequest {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly pullRequests: PullRequestPort,
    private readonly transaction: TransactionPort,
    private readonly hookedTasks: HookedTasksPort,
    private readonly hooks: LifecycleHooksPort,
    private readonly clock: ClockPort,
  ) {}

  async open(
    target: PullRequestFor,
    asked: PullRequestAsked,
  ): Promise<OpenedPullRequest> {
    const task = await this.found(target.taskId);

    if (task.pullRequest) {
      return { url: task.pullRequest.value };
    }

    const line = await this.lines.findByStation(target.stationId);

    if (!line) {
      throw new UnknownStationError(target.stationId.value);
    }

    const repository = line.opening(asked.repository);
    const hooked = await this.hookedTasks.of(
      target.taskId.value,
      target.runId.value,
    );

    if (
      hooked &&
      (await this.hooks.listens(hooked.teamId, 'pull-request.opening'))
    ) {
      const verdict = await this.hooks.before(hooked, {
        on: 'pull-request.opening',
        repository: repository.value,
        branch: task.branch.value,
        title: asked.title,
        changed: await this.pullRequests.changedOn(
          task.workspaceId,
          repository,
          task.branch.value,
        ),
      });

      if (verdict.kind === 'denied') {
        throw new PullRequestHookDeniedError(verdict.reason);
      }
    }

    const opened = await this.pullRequests.open({
      workspaceId: task.workspaceId,
      repository,
      branch: task.branch.value,
      title: asked.title,
      body: asked.body,
    });

    return this.transaction.inTransaction(async () => {
      const current = await this.found(target.taskId);

      if (current.pullRequest) {
        return { url: current.pullRequest.value };
      }

      const marked = current.recordPullRequest(
        target.runId,
        PullRequestUrl.of(opened.url),
        this.clock.now(),
        line,
      );

      await takeTaskMarks(this.tasks, marked);
      await this.tasks.save(marked);

      return opened;
    });
  }

  private async found(taskId: TaskId): Promise<Task> {
    const task = await this.tasks.find(taskId);

    if (!task) {
      throw new UnknownTaskError(taskId.value);
    }

    return task;
  }
}
