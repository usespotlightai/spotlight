import { ConfigRepositoryRefusedError } from '@replays/application/errors/config-repository-refused.error';
import type { ConfigRepositoryPort } from '@replays/application/ports/config-repository.port';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type { StationSourceEditorPort } from '@replays/application/ports/station-source-editor.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import {
  ConfigPullRequestBody,
  type ConfigPullRequestFacts,
} from '@replays/application/rendering/config-pull-request-body';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { ConfigPullRequestMovedOnError } from '@replays/domain/exceptions/config-pull-request-moved-on.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { comparedWith } from '@replays/domain/services/replay-results';
import { scoresOf } from '@replays/domain/services/search-scores';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { OwedWorkPort } from '@shared-kernel/application/ports/owed-work.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const CLAIM_MS = 10 * 60_000;

type Opened =
  | { readonly url: string }
  | { readonly reason: ConfigPullRequestReason };

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const refusedAs = (
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
      if (error instanceof ConfigPullRequestMovedOnError) {
        return;
      }
      throw error;
    }

    let held = await this.pullRequests.find(due.id);

    if (!held) {
      return;
    }

    const committed = async (commit: string) => {
      const next = (held as ConfigPullRequest).committed(
        commit,
        this.clock.now(),
      );

      await this.saved(next);
      held = (await this.pullRequests.find(next.id)) ?? next;
    };
    let opened: Opened;

    try {
      opened = await this.opening(held, committed);
    } catch (error) {
      if (!(error instanceof ConfigRepositoryRefusedError)) {
        this.logger.warn(
          { err: error, pullRequestId: held.id.value },
          'Opening a config pull request failed; it will be tried again',
        );
        await this.saved(held.tried(because(error), this.clock.now()));
        return;
      }

      opened = refusedAs(error.code, error.message);
    }

    await this.saved(
      'url' in opened
        ? held.opened(opened.url, this.clock.now())
        : held.refused(opened.reason, this.clock.now()),
    );
  }

  private saved(pullRequest: ConfigPullRequest): Promise<void> {
    return this.transaction.run(() => this.pullRequests.save(pullRequest));
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
      return refusedAs('no-source', 'The pull request has nowhere to go');
    }
    if (!search || !station || !teamKey) {
      return refusedAs(
        'block-not-found',
        'The searched station is no longer on its line',
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
      return refusedAs(
        'block-not-found',
        'The picked candidate or the config the search started from is gone',
      );
    }

    const file = await this.configs.fileAt(
      pullRequest.workspaceId,
      repository,
      path,
    );

    if (!file) {
      return refusedAs(
        'file-missing',
        `${repository.value} holds no ${path} on its default branch`,
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
      url: await this.configs.opened(pullRequest.workspaceId, repository, {
        branch: pullRequest.branch,
        title,
        body: ConfigPullRequestBody.of(facts),
      }),
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
    const [replays, slug] = await Promise.all([
      this.replays.ofSearch(search.id),
      this.people.workspaceSlug(pullRequest.workspaceId),
    ]);
    const scores = scoresOf(search, replays);
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
        heldOutScore: picked?.heldOutScore ?? null,
        costPerRun: picked?.costPerRun ?? null,
      },
      seed: {
        searchScore: scores.seed.searchScore,
        heldOutScore: scores.seed.heldOutScore,
        costPerRun: scores.seed.costPerRun,
      },
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
