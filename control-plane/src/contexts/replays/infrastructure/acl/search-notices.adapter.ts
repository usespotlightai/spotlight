import type {
  SearchNotice,
  SearchNoticesPort,
} from '@replays/application/ports/search-notices.port';
import type { NoticesPort } from '@work/application/ports/notices.port';

const OPENS = 'Open the search';

export class SearchNotices implements SearchNoticesPort {
  constructor(private readonly notices: NoticesPort) {}

  told(notice: SearchNotice): Promise<void> {
    return this.notices.raise({
      workspaceId: notice.workspaceId,
      teamId: notice.teamId,
      addressee: notice.addressee,
      form: notice.endedSearch ? 'ended' : 'advice',
      subject: `replay-search ${notice.searchId.value} ${notice.about}`,
      link: `lines/${notice.lineId}/stations/${notice.stationId}/searches/${notice.searchId.value}`,
      linkLabel: OPENS,
      headline: notice.headline,
      points: notice.points,
    });
  }
}
