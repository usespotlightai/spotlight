import type { SearchNoticesPort } from '@replays/application/ports/search-notices.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { NoticeWords } from '@replays/application/rendering/reflection-notice';
import {
  type PickedResult,
  type RequestedResult,
  SearchResultWording,
} from '@replays/application/rendering/search-result-notice';
import { isAdvised } from '@replays/application/rendering/skip-advice';
import type { SearchFindings } from '@replays/application/services/search-findings.service';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import type { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { ConfigPullRequestFailed } from '@replays/domain/events/config-pull-request-failed.event';
import type { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import type { SearchCandidatePicked } from '@replays/domain/events/search-candidate-picked.event';
import type { SearchEnded } from '@replays/domain/events/search-ended.event';
import type { SearchPickDeclined } from '@replays/domain/events/search-pick-declined.event';
import type { StationSearchSkipped } from '@replays/domain/events/station-search-skipped.event';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { scoresOf } from '@replays/domain/services/search-scores';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { SearchCutShort } from '@replays/domain/value-objects/search-stop-reason';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const RESULT = 'result';

const CUT_SHORT: readonly SearchCutShort[] = [
  'turned-off',
  'station-gone',
  'seed-failed',
];

const isCutShort = (reason: string): reason is SearchCutShort =>
  (CUT_SHORT as readonly string[]).includes(reason);

export class NoticeSearchResults {
  constructor(
    private readonly searches: SearchRepository,
    private readonly pullRequests: ConfigPullRequestRepository,
    private readonly candidates: CandidateRepository,
    private readonly replays: ReplayRepository,
    private readonly healths: SetHealths,
    private readonly findings: SearchFindings,
    private readonly work: WorkPort,
    private readonly notices: SearchNoticesPort,
  ) {}

  pullRequestOpened(event: ConfigPullRequestOpened): Promise<void> {
    return this.ofPullRequest(event.pullRequestId, (search, picked) =>
      this.notified(
        search,
        SearchResultWording.opened(picked),
        event.url.value,
        null,
      ),
    );
  }

  pullRequestFailed(event: ConfigPullRequestFailed): Promise<void> {
    return this.ofPullRequest(event.pullRequestId, (search, picked) =>
      this.notified(
        search,
        SearchResultWording.failed(picked, event.reason.message),
        null,
        null,
      ),
    );
  }

  async requestersOfDecline(event: SearchPickDeclined): Promise<void> {
    await this.toRequesters(event.searchId, null, (stationName, lines) =>
      SearchResultWording.declined(stationName, event.reason, lines),
    );
  }

  async requestersOfOtherPick(event: SearchCandidatePicked): Promise<void> {
    const search = await this.searches.find(event.searchId);
    const picked = search?.proposals.find((each) =>
      each.candidateId.equals(event.candidateId),
    );

    if (!picked) {
      return;
    }

    await this.toRequesters(
      event.searchId,
      event.candidateId,
      (stationName, lines) =>
        SearchResultWording.pickedOther(stationName, picked.name.value, lines),
    );
  }

  async requestersOfStop(event: SearchEnded): Promise<void> {
    const { stopReason } = event;

    if (event.state !== 'stopped' || !isCutShort(stopReason)) {
      return;
    }

    await this.toRequesters(event.searchId, null, (stationName, lines) =>
      SearchResultWording.stopped(stationName, stopReason, lines),
    );
  }

  async pickDeclined(event: SearchPickDeclined): Promise<void> {
    const search = await this.searches.find(event.searchId);
    const fixes = search ? await this.findings.stallFixesOf(search) : [];

    if (!search || fixes.length === 0) {
      return;
    }

    const { lineId, stationId } = search.station;

    await this.notices.advise({
      workspaceId: search.workspaceId,
      teamId: search.teamId,
      lineId,
      stationId,
      about: `stalled ${search.id.value}`,
      ...SearchResultWording.stalled(await this.stationNameOf(search), fixes),
    });
  }

  async skipped(event: StationSearchSkipped): Promise<void> {
    if (!isAdvised(event.reason)) {
      return;
    }

    const station = await this.work.station(event.lineId, event.stationId);

    await this.notices.advise({
      workspaceId: event.workspaceId,
      teamId: event.teamId,
      lineId: event.lineId,
      stationId: event.stationId,
      about: `${event.reason} ${event.at.toISOString()}`,
      ...SearchResultWording.skipped(station?.name ?? null, event.reason),
    });
  }

  private async ofPullRequest(
    id: ConfigPullRequestId,
    then: (search: Search, picked: PickedResult) => Promise<void>,
  ): Promise<void> {
    const pullRequest = await this.pullRequests.find(id);
    const search =
      pullRequest && (await this.searches.find(pullRequest.searchId));

    if (pullRequest && search) {
      await then(search, await this.pickedOf(search, pullRequest));
    }
  }

  private async pickedOf(
    search: Search,
    pullRequest: ConfigPullRequest,
  ): Promise<PickedResult> {
    const candidate = await this.candidates.find(pullRequest.candidateId);
    const replays = await this.replays.ofSearch(search.id);
    const live = await this.healths.standardAt(search.station);
    const stationName = await this.stationNameOf(search);
    const scores = scoresOf(search, replays, live.minGain);
    const picked = scores.candidates.find((each) =>
      each.candidateId.equals(pullRequest.candidateId),
    );

    return {
      objective: search.objective,
      stationName,
      candidateName: pullRequest.candidateName,
      changes: [
        ...new Set(
          candidate?.changedFrom.changes.map((each) => each.part) ?? [],
        ),
      ],
      heldOutGain: picked?.heldOutGain?.gain ?? null,
      costPerRun: picked?.costPerRun ?? null,
      liveCostPerRun: scores.seed.costPerRun,
      currency: search.budget.ceiling.currency,
    };
  }

  private async toRequesters(
    searchId: SearchId,
    picked: CandidateId | null,
    words: (
      stationName: string | null,
      lines: readonly RequestedResult[],
    ) => NoticeWords,
  ): Promise<void> {
    const search = await this.searches.find(searchId);

    if (!search) {
      return;
    }

    const isPicked = (candidateId: CandidateId): boolean =>
      picked?.equals(candidateId) ?? false;
    const requesters = search.requesters.filter(
      (requester) =>
        !search.requested.some(
          (each) =>
            each.requestedBy.equals(requester) && isPicked(each.candidateId),
        ),
    );

    if (requesters.length === 0) {
      return;
    }

    const stationName = await this.stationNameOf(search);
    const results = await this.requestedResultsOf(search);

    for (const requester of requesters) {
      await this.notified(
        search,
        words(
          stationName,
          results
            .filter((each) => each.requestedBy.equals(requester))
            .map((each) => each.result),
        ),
        null,
        requester,
      );
    }
  }

  private async requestedResultsOf(search: Search): Promise<
    readonly {
      readonly requestedBy: UserId;
      readonly result: RequestedResult;
    }[]
  > {
    const replays = await this.replays.ofSearch(search.id);
    const live = await this.healths.standardAt(search.station);
    const scores = scoresOf(search, replays, live.minGain);

    return search.requested.map((each) => {
      const scored = scores.candidates.find((one) =>
        one.candidateId.equals(each.candidateId),
      );
      const proposal = search.proposals.find((one) =>
        one.candidateId.equals(each.candidateId),
      );

      return {
        requestedBy: each.requestedBy,
        result: {
          objective: search.objective,
          candidateName: each.name.value,
          replayed: proposal ? (proposal.replay.end ?? 'unfinished') : null,
          heldOutGain: scored?.heldOutGain?.gain ?? null,
          searchedGain: scored?.searchedGain?.gain ?? null,
          costPerRun: scored?.costPerRun ?? null,
          liveCostPerRun: scores.seed.costPerRun,
          currency: search.budget.ceiling.currency,
        },
      };
    });
  }

  private async stationNameOf(search: Search): Promise<string | null> {
    const { lineId, stationId } = search.station;

    return (await this.work.station(lineId, stationId))?.name ?? null;
  }

  private notified(
    search: Search,
    words: NoticeWords,
    pullRequest: string | null,
    addressee: UserId | null,
  ): Promise<void> {
    const { lineId, stationId } = search.station;

    return this.notices.notify({
      workspaceId: search.workspaceId,
      teamId: search.teamId,
      searchId: search.id,
      addressee,
      lineId,
      stationId,
      about: RESULT,
      pullRequest,
      ...words,
    });
  }
}
