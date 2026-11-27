import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  InboxEntrySummary,
  InboxReaderPort,
  InboxScope,
} from '@work/application/ports/inbox-reader.port';
import { MemberInboxes } from '@work/application/services/member-inboxes.service';
import { WorkAccess } from '@work/application/services/work-access.service';
import { describe, expect, it } from 'vitest';

const ASKED_AT = new Date('2026-11-11T10:00:00.000Z');
const PLATFORM = TeamId.of('team_platform');

const notice = partial<InboxEntrySummary>({
  kind: 'notice',
  id: 'ntc_1',
  teamId: PLATFORM.value,
  headline: 'The station drifted',
  points: ['The pass rate fell.'],
  unread: true,
  askedAt: ASKED_AT,
});

const chat = partial<InboxEntrySummary>({
  kind: 'chat',
  id: 'chat_1',
  teamId: PLATFORM.value,
  askedAt: ASKED_AT,
  unread: true,
});

const inboxesWith = () => {
  const opened: InboxScope[] = [];
  const access = partial<WorkspaceAccessPort>({
    teamAccessOfMembers: () =>
      Promise.resolve([
        {
          workspaceId: WorkspaceId.of('ws_1'),
          viewer: UserId.of('admin_1'),
          teams: [
            { teamId: PLATFORM, sees: true, actsOn: true, joined: false },
          ],
        },
        {
          workspaceId: WorkspaceId.of('ws_1'),
          viewer: UserId.of('member_1'),
          teams: [
            { teamId: PLATFORM, sees: true, actsOn: false, joined: false },
          ],
        },
      ]),
  });
  const reader: InboxReaderPort = partial<InboxReaderPort>({
    open: (scope: InboxScope) => {
      opened.push(scope);
      return Promise.resolve([notice, chat]);
    },
  });

  return {
    opened,
    inboxes: new MemberInboxes(
      reader,
      new WorkAccess(
        access,
        partial<WorkspaceReaderPort>({}),
        partial<TeamDirectoryPort>({}),
      ),
    ),
  };
};

describe('MemberInboxes', () => {
  it('reads the inbox of a workspace admin who is on no team, as their own inbox shows it', async () => {
    const { inboxes, opened } = inboxesWith();

    const read = await inboxes.of('ws_1');

    expect(read.map((each) => each.personId)).toEqual(['admin_1', 'member_1']);
    expect(read[0]).toEqual({
      personId: 'admin_1',
      teamsSeen: ['team_platform'],
      items: [
        {
          kind: 'notice',
          id: 'ntc_1',
          teamId: 'team_platform',
          title: 'The station drifted',
          summary: 'The pass rate fell.',
          unread: true,
          askedAt: ASKED_AT,
        },
      ],
    });
    expect(
      opened.map((each) => ({
        viewer: each.viewer.value,
        actsOn: [...each.teamsActedOn],
      })),
    ).toEqual([
      { viewer: 'admin_1', actsOn: ['team_platform'] },
      { viewer: 'member_1', actsOn: [] },
    ]);
  });
});
