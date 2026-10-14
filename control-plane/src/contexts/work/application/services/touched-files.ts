import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type { TouchedFile } from '@work/application/ports/team-memories.port';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { repositoriesWorkedOn } from '@work/domain/services/task-checkouts';
import { filesChangedIn } from '@work/domain/services/workspace-path';

const MOST_WAIT_MS = 5_000;

export const distinctFiles = (files: readonly TouchedFile[]): TouchedFile[] => [
  ...new Map(
    files.map((each) => [`${each.repository.value}:${each.path}`, each]),
  ).values(),
];

export class TouchedFiles {
  constructor(
    private readonly journals: RunJournalReaderPort,
    private readonly pullRequests: PullRequestPort,
    private readonly logger: LoggerPort,
    private readonly clock: ClockPort,
  ) {}

  async onTask(task: Task, line: Line): Promise<readonly TouchedFile[]> {
    const repositories = repositoriesWorkedOn(task, line);
    const earlier = await this.earlierRuns(task, repositories);
    const pulled = await this.pullRequestFiles(task);

    return distinctFiles([...earlier, ...pulled]);
  }

  private async earlierRuns(
    task: Task,
    repositories: readonly Repository[],
  ): Promise<TouchedFile[]> {
    return (await this.journals.changesOfTask(task.id)).flatMap((changes) =>
      filesChangedIn(changes, repositories),
    );
  }

  private async pullRequestFiles(task: Task): Promise<TouchedFile[]> {
    const url = task.pullRequest;
    const repository = url?.repository;

    if (!url || !repository) {
      return [];
    }

    const answered = new AbortController();

    try {
      const paths = await Promise.race([
        this.pullRequests.changedIn(task.workspaceId, repository, url),
        this.clock.sleep(MOST_WAIT_MS, answered.signal).then(() => null),
      ]);

      if (!paths) {
        throw new Error('GitHub took too long to answer');
      }

      return paths.map((path) => ({ repository, path }));
    } catch (error) {
      this.logger.warn(
        { err: error, taskId: task.id.value },
        'Briefing without the pull request’s files, which GitHub did not give',
      );
      return [];
    } finally {
      answered.abort();
    }
  }
}
