import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { OpenedPullRequest } from '@work/application/dto/pull-request.dto';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { PullRequestOpeningHook } from '@work/application/services/pull-request-opening-hook';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { PullRequestTitle } from '@work/domain/value-objects/pull-request-title.vo';
import { RepositoryName } from '@work/domain/value-objects/repository-name.vo';

interface PullRequestFor {
  readonly runId: RunId;
  readonly taskId: TaskId;
  readonly stationId: StationId;
}

interface PullRequestInput {
  readonly title: PullRequestTitle;
  readonly body: string | null;
  readonly repository: string | null;
}

export class OpenPullRequest {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly pullRequests: PullRequestPort,
    private readonly transaction: TransactionPort,
    private readonly openingHook: PullRequestOpeningHook,
    private readonly clock: ClockPort,
  ) {}

  async open(
    target: PullRequestFor,
    input: PullRequestInput,
  ): Promise<OpenedPullRequest> {
    const task = await this.found(target.taskId);
    const line = await this.lines.findByStation(target.stationId);

    if (!line) {
      throw new UnknownStationError(target.stationId.value);
    }

    const named =
      input.repository === null ? null : RepositoryName.of(input.repository);
    const repository = line.opening(named);
    const step = task.pullRequestStep(repository);

    if (step.kind !== 'open') {
      await this.pullRequests.edit({
        workspaceId: task.workspaceId,
        pullRequest: step.pullRequest,
        title: input.title.value,
        body: input.body,
      });

      return { url: step.pullRequest.value };
    }

    await this.openingHook.allows({
      task,
      runId: target.runId,
      repository,
      title: input.title.value,
    });

    const opened = await this.pullRequests.open({
      workspaceId: task.workspaceId,
      repository,
      branch: task.branch.value,
      title: input.title.value,
      body: input.body ?? '',
    });

    return this.transaction.inTransaction(async () => {
      const current = await this.found(target.taskId);

      const already = current.pullRequestIn(repository);

      if (already) {
        return { url: already.value };
      }

      const marked = current.recordPullRequest(
        target.runId,
        PullRequestUrl.of(opened.url),
        this.clock.now(),
        line,
      );

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
