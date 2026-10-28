import type {
  SearchNotice,
  SearchNoticesPort,
  StationNotice,
} from '@replays/application/ports/search-notices.port';
import type { NoticesPort } from '@work/application/ports/notices.port';

const OPENS_SEARCH = 'Open the search';

const OPENS_STATION = 'Open the station';

export class SearchNotices implements SearchNoticesPort {
  constructor(private readonly notices: NoticesPort) {}

  notify(notice: SearchNotice): Promise<void> {
    return this.notices.create({
      workspaceId: notice.workspaceId,
      teamId: notice.teamId,
      addressee: null,
      form: 'ended',
      subject: `replay-search ${notice.searchId.value} ${notice.about}`,
      link: `lines/${notice.lineId}/stations/${notice.stationId}/searches/${notice.searchId.value}`,
      linkLabel: OPENS_SEARCH,
      headline: notice.headline,
      points: notice.points,
    });
  }

  advise(notice: StationNotice): Promise<void> {
    return this.notices.create({
      workspaceId: notice.workspaceId,
      teamId: notice.teamId,
      addressee: null,
      form: 'advice',
      subject: `station-search ${notice.stationId} ${notice.about}`,
      link: `lines/${notice.lineId}/stations/${notice.stationId}`,
      linkLabel: OPENS_STATION,
      headline: notice.headline,
      points: notice.points,
    });
  }
}
