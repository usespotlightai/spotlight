import { ConfigRepositoryError } from '@replays/application/errors/config-repository.error';
import type { ConfigRepositoryPort } from '@replays/application/ports/config-repository.port';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type { StationSourceEditorPort } from '@replays/application/ports/station-source-editor.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import {
  ConfigPullRequestBody,
  type ConfigPullRequestFacts,
} from '@replays/application/rendering/config-pull-request-body';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { ConfigPullRequestVersionConflictError } from '@replays/domain/exceptions/config-pull-request-version-conflict.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { overfitOf } from '@replays/domain/services/overfit';
import { comparedWith } from '@replays/domain/services/replay-results';
import { scoresOf } from '@replays/domain/services/search-scores';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { OwedWorkPort } from '@shared-kernel/application/ports/owed-work.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const CLAIM_MS = 10 * 60_000;

type Opened =
  | { readonly url: PullRequestUrl; readonly proposing: StationFingerprint }
  | { readonly reason: ConfigPullRequestReason };

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const failedAs = (
  code: ConfigPullRequestReason['code'],
  message: string,
): Opened => ({ reason: ConfigPullRequestReason.of({ code, message }) });

const regressionsOf = (
  replay: Replay | null,
  seed: Replay | null,
  among: readonly RunId[],
): number | null =>
  replay
    ? comparedWith(replay, seed, among).filter((each) => each.regressed).length
    : null;

export class OpenConfigPullRequests implements OwedWorkPort {
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
    private readonly appUrl: string,
    private readonly healths: SetHealths,
  ) {}

  async workDue(): Promise<void> {
    for (const pullRequest of await this.pullRequests.due(this.clock.now())) {
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
          'Opening a config pull request failed; it will be tried again',
        );
        await this.saved(pullRequest.tried(because(error), this.clock.now()));
        return;
      }

      opened = failedAs(error.code, error.message);
    }

    await this.saved(
      'url' in opened
        ? pullRequest.open(opened.url, opened.proposing, this.clock.now())
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

    const edited = await this.editor.edited({
      file: { path, content: file.content },
      teamKey,
      lineKey: station.lineKey,
      stationKey: station.key,
      seed: seed.block,
      candidate: candidate.block,
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

    return {
      url: PullRequestUrl.of(
        await this.configs.opened(pullRequest.workspaceId, repository, {
          branch: pullRequest.branch,
          title,
          body: ConfigPullRequestBody.of(facts),
        }),
      ),
      proposing: candidate.fingerprint,
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
    const [replays, slug, live] = await Promise.all([
      this.replays.ofSearch(search.id),
      this.people.workspaceSlug(pullRequest.workspaceId),
      this.healths.standardAt(search.station),
    ]);
    const scores = scoresOf(search, replays, live.minGain);
    const picked = scores.candidates.find((each) =>
      each.candidateId.equals(candidate.id),
    );
    const found = (id: ReplayId | null | undefined): Replay | null =>
      (id && replays.find((each) => each.id.equals(id))) || null;
    const seedReplay = found(search.seed.replay.replayId);
    const { station } = pullRequest;

    return {
      stationKey,
      lineKey,
      candidateName: pullRequest.candidateName,
      hypothesis: candidate.search?.hypothesis.value ?? null,
      unchecked,
      changes: [
        ...new Set(candidate.changedFrom.changes.map((each) => each.part)),
      ],
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
      onlyOnSeenTasks: overfitOf(
        picked?.searchedGain ?? null,
        picked?.heldOutGain ?? null,
      ),
      heldOutPending:
        !picked?.heldOutGain &&
        Boolean(picked?.heldOutReplayId) &&
        [picked?.heldOutReplayId, scores.seed.heldOutReplayId].some(
          (id) => id && !found(id)?.endedAt,
        ),
      currency: search.budget.ceiling.currency,
      searchedTasks: search.split.searchedTasks,
      heldOutTasks: search.split.heldOutTasks,
      regressions: {
        searched:
          regressionsOf(
            found(picked?.replayId),
            seedReplay,
            search.split.searchedRuns,
          ) ?? 0,
        heldOut: regressionsOf(
          found(picked?.heldOutReplayId),
          seedReplay,
          search.split.heldOutRuns,
        ),
      },
      link: slug
        ? `${this.appUrl.replace(/\/+$/, '')}/w/${slug}/team/${station.teamId.value}/lines/${station.lineId}/stations/${station.stationId}/searches/${search.id.value}`
        : null,
    };
  }
}
