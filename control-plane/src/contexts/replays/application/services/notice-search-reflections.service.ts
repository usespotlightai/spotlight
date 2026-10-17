import type { SearchNoticesPort } from '@replays/application/ports/search-notices.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import {
  ReflectionNoticeWording,
  UnreflectedStallWording,
} from '@replays/application/rendering/reflection-notice';
import type { SearchReflected } from '@replays/domain/events/search-reflected.event';
import type { SearchStalledUnreflected } from '@replays/domain/events/search-stalled-unreflected.event';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { reflectionToTell } from '@replays/domain/services/reflection-notice';

export class NoticeSearchReflections {
  constructor(
    private readonly searches: SearchRepository,
    private readonly work: WorkPort,
    private readonly notices: SearchNoticesPort,
  ) {}

  async reflected(event: SearchReflected): Promise<void> {
    const search = await this.searches.find(event.searchId);
    const reflection = search?.iterations.find(
      (each) => each.number === event.iteration && each.reflects,
    );
    const told = reflection ? reflectionToTell(reflection) : null;

    if (!search?.startedBy || !told) {
      return;
    }

    const { lineId, stationId } = search.station;
    const station = await this.work.station(lineId, stationId);
    const titles = new Map(
      (
        await this.work.runSummaries(
          search.workspaceId,
          told.fixes.map((each) => each.originalRunId),
        )
      ).map((each) => [each.runId.value, each.title] as const),
    );

    await this.notices.told({
      workspaceId: search.workspaceId,
      teamId: search.teamId,
      addressee: search.startedBy,
      searchId: search.id,
      lineId,
      stationId,
      about: `iteration ${event.iteration}`,
      endedSearch: told.endedSearch,
      ...ReflectionNoticeWording.of(told, station?.name ?? null, titles),
    });
  }

  async stalledUnreflected(event: SearchStalledUnreflected): Promise<void> {
    const search = await this.searches.find(event.searchId);

    if (!search?.startedBy) {
      return;
    }

    const { lineId, stationId } = search.station;
    const station = await this.work.station(lineId, stationId);

    await this.notices.told({
      workspaceId: search.workspaceId,
      teamId: search.teamId,
      addressee: search.startedBy,
      searchId: search.id,
      lineId,
      stationId,
      about: 'stalled',
      endedSearch: true,
      ...UnreflectedStallWording.of(station?.name ?? null),
    });
  }
}
