import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { firstOf } from '@shared-kernel/domain/item-at';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  InboxEntrySummary,
  InboxNote,
  InboxPartSummary,
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

const LATER = new Date('2026-11-11T11:00:00.000Z');

const part = (
  id: string,
  over: Partial<InboxPartSummary> = {},
): InboxPartSummary => ({
  id,
  kind: 'judge-question',
  form: 'judge-disagreement',
  about: `about_${id}`,
  asks: 1,
  open: true,
  unread: true,
  unreadSince: ASKED_AT,
  arrivedAt: ASKED_AT,
  interactedAt: ASKED_AT,
  resolvedAt: null,
  resolvable: true,
  reopenable: false,
  ...over,
});

const grouped = partial<InboxEntrySummary>({
  kind: 'task',
  id: 'task_1',
  taskId: 'task_1',
  teamId: PLATFORM.value,
  title: 'Fix the queue',
  description: 'The queue stalls.',
  conversationId: 'task_1:2',
  lastNote: partial<InboxNote>({ body: 'Which queue?' }),
  unread: true,
  askedAt: LATER,
  parts: [
    part('request_1'),
    part('request_2', { unread: false, open: false }),
    part('task_1:2', {
      kind: 'question',
      form: null,
      about: null,
      interactedAt: LATER,
    }),
  ],
});

const inboxesWith = (entries: InboxEntrySummary[] = [notice, chat]) => {
  const opened: InboxScope[] = [];
  const access = partial<WorkspaceAccessPort>({
    teamAccessOfMembers: async () => [
      {
        workspaceId: WorkspaceId.of('ws_1'),
        viewer: UserId.of('admin_1'),
        teams: [{ teamId: PLATFORM, sees: true, actsOn: true, joined: false }],
      },
      {
        workspaceId: WorkspaceId.of('ws_1'),
        viewer: UserId.of('member_1'),
        teams: [{ teamId: PLATFORM, sees: true, actsOn: false, joined: false }],
      },
    ],
  });
  const reader: InboxReaderPort = partial<InboxReaderPort>({
    open: async (scope: InboxScope) => {
      opened.push(scope);
      return entries;
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

  it('announces each thing on a task on its own, under the id it had before items were grouped by task', async () => {
    const { inboxes } = inboxesWith([grouped]);

    const admin = firstOf(await inboxes.of('ws_1'));

    expect(admin?.items).toEqual([
      expect.objectContaining({
        id: 'request_1',
        summary: 'The queue stalls.',
        unread: true,
        askedAt: ASKED_AT,
      }),
      expect.objectContaining({ id: 'request_2', unread: false }),
      expect.objectContaining({
        id: 'task_1:2',
        title: 'Fix the queue',
        summary: 'Which queue?',
        unread: true,
        askedAt: LATER,
      }),
    ]);
  });
});
