import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type { TouchedFile } from '@work/application/ports/team-memories.port';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';

const MOST_WAIT_MS = 5_000;

export const filesChangedIn = (
  journal: RunJournal,
  run: Run,
  repositories: readonly Repository[],
): TouchedFile[] =>
  journal.steps.flatMap((step) => {
    const within = step.change?.path
      ? run.spec.workspacePathOf(step.change.path)
      : null;
    const [folder, ...rest] = within?.split('/') ?? [];
    const repository = repositories.find((each) => each.name === folder);

    return repository && rest.length > 0
      ? [{ repository, path: rest.join('/') }]
      : [];
  });

export const distinctFiles = (files: readonly TouchedFile[]): TouchedFile[] => [
  ...new Map(
    files.map((each) => [`${each.repository.value}:${each.path}`, each]),
  ).values(),
];

export const repositoriesWorked = (
  task: Task | null,
  line: Line,
): readonly Repository[] => {
  const reviewed = task?.reviewed;
  return reviewed ? [reviewed] : line.repositories.all;
};

export class TouchedFiles {
  constructor(
    private readonly runs: RunRepository,
    private readonly journals: RunJournalReaderPort,
    private readonly pullRequests: PullRequestPort,
    private readonly logger: LoggerPort,
  ) {}

  async onTask(task: Task, line: Line): Promise<readonly TouchedFile[]> {
    const repositories = repositoriesWorked(task, line);
    const [earlier, pulled] = await Promise.all([
      this.earlierRuns(task, repositories),
      this.pullRequestFiles(task),
    ]);

    return distinctFiles([...earlier, ...pulled]);
  }

  private async earlierRuns(
    task: Task,
    repositories: readonly Repository[],
  ): Promise<TouchedFile[]> {
    const journals = await this.journals.ofTask(task.id);
    const changed = await Promise.all(
      journals.map(async (journal) => {
        const run = await this.runs.findById(RunId.of(journal.runId));
        return run ? filesChangedIn(journal, run, repositories) : [];
      }),
    );

    return changed.flat();
  }

  private async pullRequestFiles(task: Task): Promise<TouchedFile[]> {
    const url = task.pullRequest;
    const repository = url?.repository;

    if (!url || !repository) {
      return [];
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const paths = await Promise.race([
        this.pullRequests.changedIn(task.workspaceId, repository, url),
        new Promise<never>((_, refuse) => {
          timer = setTimeout(
            () => refuse(new Error('GitHub took too long to answer')),
            MOST_WAIT_MS,
          );
        }),
      ]);
      return paths.map((path) => ({ repository, path }));
    } catch (error) {
      this.logger.warn(
        { err: error, taskId: task.id.value },
        'Briefing without the pull request’s files, which GitHub did not give',
      );
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}
