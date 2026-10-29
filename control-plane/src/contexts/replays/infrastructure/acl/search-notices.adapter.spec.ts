import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { SearchNotices } from '@replays/infrastructure/acl/search-notices.adapter';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { NoticeOf } from '@work/application/ports/notices.port';
import { beforeEach, describe, expect, it } from 'vitest';

let created: NoticeOf[];

const work = () => ({
  create: async (notice: NoticeOf) => {
    created.push(notice);
  },
  allowsExternalLink: (url: string) => url.startsWith('https://github.com/'),
});

const noticeOf = (pullRequest: string | null) => ({
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  searchId: SearchId.of('search_1'),
  lineId: 'line_1',
  stationId: 'station_1',
  about: 'result',
  headline: 'Spotlight opened a config pull request for the Build station',
  points: ['Candidate terse changes prompt.'],
  pullRequest,
});

beforeEach(() => {
  created = [];
});

describe('SearchNotices', () => {
  it('links the pull request to review on GitHub, beside the station', async () => {
    await new SearchNotices(work()).notify(
      noticeOf('https://github.com/acme/config/pull/7'),
    );

    expect(created[0]).toMatchObject({
      link: 'lines/line_1/stations/station_1',
      linkLabel: 'Open the station',
      externalLink: {
        url: 'https://github.com/acme/config/pull/7',
        label: 'Review the pull request',
      },
    });
  });

  it('still tells the team, without the link, when the address is not one Work takes', async () => {
    await new SearchNotices(work()).notify(
      noticeOf('https://git.example.test/acme/config/pull/7'),
    );

    expect(created).toHaveLength(1);
    expect(created[0]?.externalLink).toBeNull();
  });
});
