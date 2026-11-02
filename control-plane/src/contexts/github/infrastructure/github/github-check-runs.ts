import type {
  CheckRunsPort,
  FailedCheckDto,
  FailedChecksDto,
} from '@github/application/ports/check-runs.port';
import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { answered, call } from '@github/infrastructure/github/github.rest';
import { InvalidPullRequestError } from '@shared-kernel/domain/exceptions/invalid-pull-request.error';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const FAILED = ['failure', 'timed_out', 'startup_failure'];

const ACTIONS = 'github-actions';

const RUNS_PER_PAGE = 100;

const LOGS_READ = 5;

const LOG_LINES = 200;

const LOG_CHARACTERS = 16_000;

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z ?/;

interface CheckRun {
  readonly id: number;
  readonly name: string;
  readonly conclusion: string | null;
  readonly html_url?: string | null;
  readonly app?: { readonly slug?: string } | null;
  readonly output?: {
    readonly title?: string | null;
    readonly summary?: string | null;
  } | null;
}

interface CheckRuns {
  readonly check_runs: readonly CheckRun[];
}

interface Job {
  readonly steps?: readonly {
    readonly name: string;
    readonly conclusion: string | null;
  }[];
}

const failed = (runs: CheckRuns): readonly CheckRun[] =>
  runs.check_runs.filter((run) => FAILED.includes(run.conclusion ?? ''));

const summaryOf = (run: CheckRun): string | null =>
  [run.output?.title, run.output?.summary]
    .filter((each): each is string => Boolean(each?.trim()))
    .join('\n\n') || null;

const tailOf = (log: string): string =>
  log
    .split('\n')
    .map((line) => line.replace(TIMESTAMP, ''))
    .slice(-LOG_LINES)
    .join('\n')
    .slice(-LOG_CHARACTERS);

export class GitHubCheckRuns implements CheckRunsPort {
  constructor(private readonly access: RepositoryAccessPort) {}

  async failedOn(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<FailedChecksDto> {
    const repository = pullRequest.repository;
    const number = pullRequest.number;

    if (!repository || number === null) {
      throw new InvalidPullRequestError(
        `at ${pullRequest.value} is not a GitHub pull request`,
      );
    }

    const token = await this.tokenFor(workspaceId);
    const { head } = await answered<{ head: { sha: string } }>(
      await call(`${this.at(repository)}/pulls/${number}`, token),
      `GitHub would not return ${repository.value}#${number}`,
    );
    const runs = failed(
      await answered<CheckRuns>(
        await call(
          `${this.at(repository)}/commits/${head.sha}/check-runs?filter=latest&per_page=${RUNS_PER_PAGE}`,
          token,
        ),
        `GitHub would not list the checks of ${repository.value}#${number}`,
      ),
    );

    return {
      commit: head.sha,
      failed: await Promise.all(
        runs.map((run, index) =>
          this.detailed(repository, run, token, index < LOGS_READ),
        ),
      ),
    };
  }

  async failedInSuite(
    workspaceId: WorkspaceId,
    repository: Repository,
    suite: number,
  ): Promise<readonly string[]> {
    const runs = await answered<CheckRuns>(
      await call(
        `${this.at(repository)}/check-suites/${suite}/check-runs?filter=latest&per_page=${RUNS_PER_PAGE}`,
        await this.tokenFor(workspaceId),
      ),
      `GitHub would not list the checks of suite ${suite} in ${repository.value}`,
    );

    return failed(runs).map((run) => run.name);
  }

  private async detailed(
    repository: Repository,
    run: CheckRun,
    token: string,
    withLog: boolean,
  ): Promise<FailedCheckDto> {
    const fromActions = withLog && run.app?.slug === ACTIONS;
    const [step, log] = fromActions
      ? await Promise.all([
          this.failedStep(repository, run.id, token),
          this.log(repository, run.id, token),
        ])
      : [null, null];

    return {
      name: run.name,
      conclusion: run.conclusion ?? 'failure',
      url: run.html_url ?? null,
      step,
      summary: summaryOf(run),
      log,
    };
  }

  private async failedStep(
    repository: Repository,
    job: number,
    token: string,
  ): Promise<string | null> {
    const response = await call(
      `${this.at(repository)}/actions/jobs/${job}`,
      token,
    );

    if (!response.ok) {
      return null;
    }

    const { steps } = (await response.json()) as Job;

    return (
      steps?.find((each) => FAILED.includes(each.conclusion ?? ''))?.name ??
      null
    );
  }

  private async log(
    repository: Repository,
    job: number,
    token: string,
  ): Promise<string | null> {
    const response = await call(
      `${this.at(repository)}/actions/jobs/${job}/logs`,
      token,
    );

    return response.ok ? tailOf(await response.text()) : null;
  }

  private at(repository: Repository): string {
    return `/repos/${repository.owner}/${repository.name}`;
  }

  private async tokenFor(workspaceId: WorkspaceId): Promise<string> {
    const { password } = await this.access.credential(workspaceId);

    return password;
  }
}
