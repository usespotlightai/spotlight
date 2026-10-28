import type { SearchNoticesPort } from '@replays/application/ports/search-notices.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import {
  type NoticeWords,
  ReflectionNoticeWording,
  UnreflectedStallWording,
} from '@replays/application/rendering/reflection-notice';
import {
  isAdvised,
  type PickedResult,
  SearchResultWording,
} from '@replays/application/rendering/search-result-notice';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { ConfigPullRequestFailed } from '@replays/domain/events/config-pull-request-failed.event';
import type { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import type { SearchPickDeclined } from '@replays/domain/events/search-pick-declined.event';
import type { StationSearchSkipped } from '@replays/domain/events/station-search-skipped.event';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { reflectionNotice } from '@replays/domain/services/reflection-notice';
import type { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';

const RESULT = 'result';

export class NoticeSearchResults {
  constructor(
    private readonly searches: SearchRepository,
    private readonly pullRequests: ConfigPullRequestRepository,
    private readonly work: WorkPort,
    private readonly notices: SearchNoticesPort,
  ) {}

  pullRequestOpened(event: ConfigPullRequestOpened): Promise<void> {
    return this.ofPullRequest(event.pullRequestId, (picked) =>
      SearchResultWording.opened(picked, event.url.value),
    );
  }

  pullRequestFailed(event: ConfigPullRequestFailed): Promise<void> {
    return this.ofPullRequest(event.pullRequestId, (picked) =>
      SearchResultWording.failed(picked, event.reason.message),
    );
  }

  async pickDeclined(event: SearchPickDeclined): Promise<void> {
    const search = await this.searches.find(event.searchId);

    if (search) {
      const { stationName, stalled } = await this.contextOf(search);

      await this.notified(
        search,
        SearchResultWording.declined(stationName, event.reason, stalled),
      );
    }
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

  async stallOf(search: Search): Promise<readonly string[]> {
    if (search.stopReason !== 'stalled') {
      return [];
    }

    const ending = [...search.iterations]
      .reverse()
      .find((each) => each.reflects && each.endedSearch);
    const notice = ending ? reflectionNotice(ending) : null;

    if (!notice) {
      return UnreflectedStallWording.points;
    }

    const titles = new Map(
      (
        await this.work.runSummaries(
          search.workspaceId,
          notice.fixes.map((each) => each.originalRunId),
        )
      ).map((each) => [each.runId.value, each.title] as const),
    );

    return ReflectionNoticeWording.pointsOf(notice, titles);
  }

  private async ofPullRequest(
    id: ConfigPullRequestId,
    words: (picked: PickedResult) => NoticeWords,
  ): Promise<void> {
    const pullRequest = await this.pullRequests.find(id);
    const search =
      pullRequest && (await this.searches.find(pullRequest.searchId));

    if (pullRequest && search) {
      await this.notified(
        search,
        words({
          ...(await this.contextOf(search)),
          candidateName: pullRequest.candidateName,
          objective: search.objective,
        }),
      );
    }
  }

  private async contextOf(search: Search): Promise<{
    readonly stationName: string | null;
    readonly stalled: readonly string[];
  }> {
    const { lineId, stationId } = search.station;

    return {
      stationName: (await this.work.station(lineId, stationId))?.name ?? null,
      stalled: await this.stallOf(search),
    };
  }

  private notified(search: Search, words: NoticeWords): Promise<void> {
    const { lineId, stationId } = search.station;

    return this.notices.notify({
      workspaceId: search.workspaceId,
      teamId: search.teamId,
      searchId: search.id,
      lineId,
      stationId,
      about: RESULT,
      ...words,
    });
  }
}
