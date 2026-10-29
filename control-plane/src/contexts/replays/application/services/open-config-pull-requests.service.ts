import { ConfigRepositoryError } from '@replays/application/errors/config-repository.error';
import type { ConfigRepositoryPort } from '@replays/application/ports/config-repository.port';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type { StationSourceEditorPort } from '@replays/application/ports/station-source-editor.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import {
  ConfigPullRequestBody,
  type ConfigPullRequestFacts,
} from '@replays/application/rendering/config-pull-request-body';
import { taskRowsOf } from '@replays/application/rendering/task-rows';
import type { SearchFindings } from '@replays/application/services/search-findings.service';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type {
  ConfigPullRequest,
  OpenedPullRequest,
} from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { ConfigPullRequestVersionConflictError } from '@replays/domain/exceptions/config-pull-request-version-conflict.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { overfitOf } from '@replays/domain/services/overfit';
import { taskComparisons } from '@replays/domain/services/replay-results';
import {
  NO_REGRESSIONS,
  regressionLimitOf,
} from '@replays/domain/services/search-regressions';
import { scoresOf } from '@replays/domain/services/search-scores';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const CLAIM_MS = 10 * 60_000;

type Opened =
  | { readonly opened: OpenedPullRequest }
  | { readonly reason: ConfigPullRequestReason };

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const failedAs = (
  code: ConfigPullRequestReason['code'],
  message: string,
): Opened => ({ reason: ConfigPullRequestReason.of({ code, message }) });

export class OpenConfigPullRequests implements PendingJobsPort {
  readonly name = 'Opening config pull requests';

  constructor(
    private readonly pullRequests: ConfigPullRequestRepository,
    private readonly searches: SearchRepository,
    private readonly candidates: CandidateRepository,
    private readonly replays: ReplayRepository,
    private readonly work: WorkPort,
    private readonly people: PeoplePort,
    private readonly configs: ConfigRepositoryPort,
    private readonly editor: StationSourceEditorPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
    private readonly healths: SetHealths,
    private readonly sets: ReplaySetRepository,
    private readonly findings: SearchFindings,
  ) {}

  async processDue(): Promise<void> {
    for (const pullRequest of await this.pullRequests.due(
      'opening',
      this.clock.now(),
    )) {
      await this.attempt(pullRequest).catch((error: unknown) =>
        this.logger.warn(
          { err: error, pullRequestId: pullRequest.id.value },
          'A config pull request could not be opened',
        ),
      );
    }
  }

  private async attempt(due: ConfigPullRequest): Promise<void> {
    try {
      await this.saved(
        due.claimed(new Date(this.clock.now().getTime() + CLAIM_MS)),
      );
    } catch (error) {
      if (error instanceof ConfigPullRequestVersionConflictError) {
        return;
      }
      throw error;
    }

    let pullRequest = await this.pullRequests.find(due.id);

    if (!pullRequest) {
      return;
    }

    const committed = async (commit: string) => {
      const next = (pullRequest as ConfigPullRequest).commit(
        commit,
        this.clock.now(),
      );

      await this.saved(next);
      pullRequest = (await this.pullRequests.find(next.id)) ?? next;
    };
    let opened: Opened;

    try {
      opened = await this.opening(pullRequest, committed);
    } catch (error) {
      if (!(error instanceof ConfigRepositoryError)) {
        this.logger.warn(
          { err: error, pullRequestId: pullRequest.id.value },
          'Opening a config pull request failed; Spotlight retries it later',
        );
        await this.saved(pullRequest.tried(because(error), this.clock.now()));
        return;
      }

      opened = failedAs(error.code, error.message);
    }

    await this.saved(
      'opened' in opened
        ? pullRequest.open(opened.opened, this.clock.now())
        : pullRequest.failed(opened.reason, this.clock.now()),
    );
  }

  private saved(pullRequest: ConfigPullRequest): Promise<void> {
    return this.transaction.inTransaction(() =>
      this.pullRequests.save(pullRequest),
    );
  }

  private async opening(
    pullRequest: ConfigPullRequest,
    committed: (commit: string) => Promise<void>,
  ): Promise<Opened> {
    const { repository: named, path } = pullRequest;
    const [search, station, teamKey] = await Promise.all([
      this.searches.find(pullRequest.searchId),
      this.work.station(
        pullRequest.station.lineId,
        pullRequest.station.stationId,
      ),
      this.people.teamKey(pullRequest.teamId),
    ]);

    if (!named || !path) {
      return failedAs(
        'no-source',
        'The config pull request has no target repository.',
      );
    }
    if (!search || !station || !teamKey) {
      return failedAs(
        'block-not-found',
        'The searched station is gone from its line.',
      );
    }

    const repository = Repository.of(named);
    const found = await this.candidates.findMany([
      pullRequest.candidateId,
      search.seed.candidateId,
    ]);
    const candidate = found.find((each) =>
      each.id.equals(pullRequest.candidateId),
    );
    const seed = found.find((each) => each.id.equals(search.seed.candidateId));

    if (!candidate || !seed) {
      return failedAs(
        'block-not-found',
        'The picked candidate or the seed of the search no longer exists.',
      );
    }

    const file = await this.configs.fileAt(
      pullRequest.workspaceId,
      repository,
      path,
    );

    if (!file) {
      return failedAs(
        'file-missing',
        `File ${path} not found on the default branch of ${repository.value}.`,
      );
    }

    const module = (
      await this.configs.filesIn(
        pullRequest.workspaceId,
        repository,
        path.slice(0, Math.max(path.lastIndexOf('/'), 0)),
        file.commit,
      )
    ).filter((each) => each.endsWith('.tf') && each !== path);
    const edited = await this.editor.edited({
      file: { path, content: file.content },
      teamKey,
      lineKey: station.lineKey,
      stationKey: station.key,
      seed: seed.block,
      candidate: candidate.block,
      module,
      read: async (other) =>
        (
          await this.configs.fileAt(
            pullRequest.workspaceId,
            repository,
            other,
            file.commit,
          )
        )?.content ?? null,
    });

    if (!edited.ok) {
      return { reason: edited.reason };
    }

    const facts = await this.factsOf(
      pullRequest,
      search,
      candidate,
      station.lineKey,
      station.key,
      edited.unchecked,
    );
    const title = ConfigPullRequestBody.titleOf(facts);

    await committed(
      await this.configs.committed(pullRequest.workspaceId, repository, {
        branch: pullRequest.branch,
        base: file.commit,
        replacing: pullRequest.lastCommit,
        message: `${title}\n\nPicked from a Spotlight search of the ${station.key} station.`,
        files: edited.files,
      }),
    );

    const {
      url,
      number,
      gitHubId,
      repository: canonical,
    } = await this.configs.opened(pullRequest.workspaceId, repository, {
      branch: pullRequest.branch,
      title,
      body: ConfigPullRequestBody.of(facts),
    });

    return {
      opened: {
        url: PullRequestUrl.of(url),
        number,
        gitHubId,
        repository: Repository.of(canonical),
        basedOn: seed.fingerprint,
        proposing: candidate.fingerprint,
      },
    };
  }

  private async factsOf(
    pullRequest: ConfigPullRequest,
    search: Search,
    candidate: Candidate,
    lineKey: string,
    stationKey: string,
    unchecked: readonly string[],
  ): Promise<ConfigPullRequestFacts> {
    const replays = await this.replays.ofSearch(search.id);
    const live = await this.healths.standardAt(search.station);
    const set = await this.sets.find(search.setId);
    const found = await this.findings.findingsOf(search);
    const scores = scoresOf(search, replays, live.minGain);
    const picked = scores.candidates.find((each) =>
      each.candidateId.equals(candidate.id),
    );
    const replayOf = (id: ReplayId | null | undefined): Replay | null =>
      (id && replays.find((each) => each.id.equals(id))) || null;
    const regressions = picked?.regressions ?? NO_REGRESSIONS;
    const seedReplay = replayOf(scores.seed.replayId);
    const tasks = await this.tasksOf(
      search,
      seedReplay,
      replayOf(picked?.replayId),
      replayOf(picked?.heldOutReplayId),
    );
    const health = set ? await this.healths.ofSet(set, live) : null;

    return {
      stationKey,
      lineKey,
      candidateName: pullRequest.candidateName,
      hypothesis: candidate.search?.hypothesis.value ?? null,
      unchecked,
      changes: candidate.changedFrom.changes,
      candidate: {
        searchScore: picked?.searchScore ?? null,
        searchInterval: picked?.searchInterval ?? null,
        heldOutScore: picked?.heldOutScore ?? null,
        heldOutInterval: picked?.heldOutInterval ?? null,
        costPerRun: picked?.costPerRun ?? null,
      },
      seed: {
        searchScore: scores.seed.searchScore,
        searchInterval: scores.seed.searchInterval,
        heldOutScore: scores.seed.heldOutScore,
        heldOutInterval: scores.seed.heldOutInterval,
        costPerRun: scores.seed.costPerRun,
      },
      gains: {
        searched: picked?.searchedGain ?? null,
        heldOut: picked?.heldOutGain ?? null,
      },
      pairs: {
        searched: picked?.searchedPairs ?? null,
        heldOut: picked?.heldOutPairs ?? null,
      },
      overfit: overfitOf(
        picked?.searchedGain ?? null,
        picked?.heldOutGain ?? null,
      ),
      heldOutPending:
        !picked?.heldOutGain &&
        Boolean(picked?.heldOutReplayId) &&
        [picked?.heldOutReplayId, scores.seed.heldOutReplayId].some(
          (id) => id && !replayOf(id)?.endedAt,
        ),
      currency: search.budget.ceiling.currency,
      searchedTasks: search.split.searchedTasks,
      heldOutTasks: search.split.heldOutTasks,
      regressions,
      ...regressionLimitOf(regressions, live.threshold),
      tasks,
      search: {
        trigger: search.trigger,
        iterations: search.iterations.length,
        reflections: search.iterations.filter((each) => each.reflects).length,
        maxIterations: search.budget.iterations,
        perIteration: search.budget.perIteration,
        spent: search.spent.amount,
        ceiling: search.budget.ceiling.amount,
        agent: {
          harness: search.agent.harness,
          model: search.agent.model,
          effort: search.agent.effort,
        },
        setRuns: set?.entries.length ?? 0,
        refreshedAt: set?.refreshedAt ?? null,
        spread: health?.noise?.spread ?? null,
        minGain: live.minGain,
      },
      found,
    };
  }

  private async tasksOf(
    search: Search,
    seed: Replay | null,
    searched: Replay | null,
    heldOut: Replay | null,
  ): Promise<ConfigPullRequestFacts['tasks']> {
    const titles = new Map(
      (
        await this.work.runSummaries(search.workspaceId, [
          ...search.split.searchedRuns,
          ...search.split.heldOutRuns,
        ])
      ).map((each) => [each.runId.value, each.title] as const),
    );
    const rowsOf = (replay: Replay | null, runs: readonly RunId[]) =>
      replay
        ? taskRowsOf(
            taskComparisons(replay, seed, runs),
            { candidate: replay.scoring, live: seed?.scoring ?? null },
            titles,
          )
        : [];

    return {
      searched: rowsOf(searched, search.split.searchedRuns),
      heldOut: rowsOf(heldOut, search.split.heldOutRuns),
    };
  }
}
