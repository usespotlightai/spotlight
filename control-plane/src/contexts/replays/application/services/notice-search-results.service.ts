import type { SearchNoticesPort } from '@replays/application/ports/search-notices.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import {
  isAdvised,
  type PickedResult,
  SearchResultWording,
} from '@replays/application/rendering/search-result-notice';
import type { SearchFindings } from '@replays/application/services/search-findings.service';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import type { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { ConfigPullRequestFailed } from '@replays/domain/events/config-pull-request-failed.event';
import type { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import type { SearchPickDeclined } from '@replays/domain/events/search-pick-declined.event';
import type { StationSearchSkipped } from '@replays/domain/events/station-search-skipped.event';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { scoresOf } from '@replays/domain/services/search-scores';
import type { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';

const RESULT = 'result';

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
      ),
    );
  }

  pullRequestFailed(event: ConfigPullRequestFailed): Promise<void> {
    return this.ofPullRequest(event.pullRequestId, (search, picked) =>
      this.notified(
        search,
        SearchResultWording.failed(picked, event.reason.message),
        null,
      ),
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

  private async stationNameOf(search: Search): Promise<string | null> {
    const { lineId, stationId } = search.station;

    return (await this.work.station(lineId, stationId))?.name ?? null;
  }

  private notified(
    search: Search,
    words: { readonly headline: string; readonly points: readonly string[] },
    pullRequest: string | null,
  ): Promise<void> {
    const { lineId, stationId } = search.station;

    return this.notices.notify({
      workspaceId: search.workspaceId,
      teamId: search.teamId,
      searchId: search.id,
      lineId,
      stationId,
      about: RESULT,
      pullRequest,
      ...words,
    });
  }
}
