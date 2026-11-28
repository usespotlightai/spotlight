import { firstOf } from '@shared-kernel/domain/item-at';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { InboxItemDto } from '@work/application/dto/inbox.dto';
import { FIRST_PAGE } from '@work/application/dto/page.dto';
import type {
  InboxEntrySummary,
  InboxItemSummary,
  InboxNote,
  InboxReaderPort,
  InboxScope,
} from '@work/application/ports/inbox-reader.port';
import {
  ListInboxHandler,
  ReadInboxItemHandler,
} from '@work/application/queries/handlers/list-inbox.handler';
import {
  ListInboxQuery,
  ReadInboxItemQuery,
} from '@work/application/queries/list-inbox.query';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { describe, expect, it, vi } from 'vitest';

const asked = new Date('2026-09-26T09:15:00.000Z');

const exited = { source: 'run', code: 'exited', occurrences: 3 };

const note = (failure: InboxNote['failure']): InboxNote => ({
  position: 0,
  kind: 'asked',
  form: failure ? 'failure' : 'words',
  voice: 'station',
  station: 'Implementation',
  stationId: 'station_implementation',
  stationColor: '#edc12b',
  stationPosition: 1,
  runId: 'run_1',
  body: failure ? 'The run exited before it finished.' : 'Which queue?',
  attachments: [],
  at: asked,
  author: null,
  coAuthors: [],
  source: null,
  deferredTo: null,
  readAt: null,
  approval: null,
  failure,
  connection: null,
  resumption: null,
  suggestsClosing: false,
});

const item = (failure: InboxItemSummary['failure']): InboxItemSummary => ({
  kind: 'task',
  id: 'task_1:0',
  taskId: 'task_1',
  teamId: 'team_1',
  title: 'Fix the queue',
  description: null,
  attachments: [],
  station: 'Implementation',
  stationColor: '#edc12b',
  stationPosition: 1,
  stationCount: 3,
  originStation: { name: 'Triage', color: '#edc12b', position: 0 },
  currentStation: {
    name: 'Implementation',
    color: '#edc12b',
    position: 1,
    latestRunId: null,
  },
  createdAt: asked,
  askedAt: asked,
  resolved: false,
  section: 'open',
  standing: 'assignee',
  answerable: true,
  resolvable: true,
  reopenable: false,
  progress: null,
  runId: null,
  stoppableByYou: false,
  unread: true,
  briefing: null,
  failure,
  lastNote: note(failure),
  conversationId: 'task_1:0',
  unreadCount: 1,
  latest: { kind: failure ? 'failure' : 'question', count: 1 },
  quiet: false,
  parts: [
    {
      id: 'task_1:0',
      kind: failure ? 'failure' : 'question',
      form: null,
      about: null,
      asks: 1,
      open: true,
      waits: true,
      unread: true,
      unreadSince: asked,
      arrivedAt: asked,
      interactedAt: asked,
      resolvedAt: null,
      resolvable: true,
      reopenable: false,
    },
  ],
  firstUnread: { partId: 'task_1:0', position: 0 },
});

const reader = (
  open: InboxEntrySummary[],
  resolved: InboxEntrySummary[] = [],
): InboxReaderPort => ({
  open: vi.fn().mockResolvedValue(open),
  resolved: vi.fn().mockResolvedValue({ items: resolved, next: 'cursor' }),
  item: vi.fn().mockResolvedValue(null),
  notice: vi.fn().mockResolvedValue(null),
});

const SCOPE: InboxScope = {
  workspaceId: 'ws_1',
  viewer: UserId.of('user_1'),
  teamsSeen: new Set(['team_1']),
  teamsActedOn: new Set(),
  teamsJoined: new Set(),
};

const access = (scope: InboxScope | null = SCOPE): WorkAccess =>
  partial<WorkAccess>({ inboxOf: vi.fn(async () => scope) });

const handle = (inbox: InboxReaderPort, seen = access()) =>
  new ListInboxHandler(inbox, seen).execute(
    new ListInboxQuery('acme', 'user_1', 'open', FIRST_PAGE),
  );

const firstTask = async (
  inbox: InboxReaderPort,
): Promise<InboxItemDto | undefined> =>
  ((await handle(inbox))?.items ?? []).find(
    (each): each is InboxItemDto => each.kind === 'task',
  );

describe('ListInboxHandler', () => {
  it('reports the failure a conversation is about, and how often it happened', async () => {
    const about = await firstTask(reader([item(exited)]));

    expect(about?.failure).toEqual(exited);
    expect(about?.lastNote?.failure).toEqual(exited);
  });

  it('reports no failure for a conversation that is not about one', async () => {
    const about = await firstTask(reader([item(null)]));

    expect(about?.failure).toBeNull();
    expect(about?.lastNote?.failure).toBeNull();
  });

  it('hands back dates as they would travel', async () => {
    const about = await firstTask(reader([item(null)]));

    expect(about?.askedAt).toBe('2026-09-26T09:15:00.000Z');
    expect(about?.lastNote?.at).toBe('2026-09-26T09:15:00.000Z');
  });

  it('hands back the open entries in one page', async () => {
    await expect(handle(reader([item(null)]))).resolves.toMatchObject({
      next: null,
    });
  });

  it('hands back a notice beside the conversations, its date as it would travel', async () => {
    const [noticed] =
      (
        await handle(
          reader([
            {
              kind: 'notice',
              id: 'notice_1',
              teamId: 'team_1',
              form: 'ended',
              headline: 'The search stalled',
              points: ['Fix the claims.'],
              link: 'lines/line_1/stations/station_1',
              linkLabel: 'Open the station',
              externalLink: {
                url: 'https://github.com/acme/config/pull/12',
                label: 'Review the pull request',
              },
              askedAt: asked,
              unread: true,
              unreadCount: 1,
              resolved: false,
              section: 'open',
              resolvable: true,
              reopenable: false,
            },
          ]),
        )
      )?.items ?? [];

    expect(noticed).toEqual({
      kind: 'notice',
      id: 'notice_1',
      teamId: 'team_1',
      form: 'ended',
      headline: 'The search stalled',
      points: ['Fix the claims.'],
      link: 'lines/line_1/stations/station_1',
      linkLabel: 'Open the station',
      externalLink: {
        url: 'https://github.com/acme/config/pull/12',
        label: 'Review the pull request',
      },
      askedAt: '2026-09-26T09:15:00.000Z',
      unread: true,
      unreadCount: 1,
      resolved: false,
      section: 'open',
      resolvable: true,
      reopenable: false,
    });
  });

  it('hands back each part of a task, its date as it would travel', async () => {
    const about = await firstTask(reader([item(null)]));

    expect(about?.parts).toEqual([
      {
        id: 'task_1:0',
        kind: 'question',
        form: null,
        about: null,
        asks: 1,
        at: '2026-09-26T09:15:00.000Z',
        open: true,
        unread: true,
        resolvable: true,
        reopenable: false,
      },
    ]);
  });

  it('reads the resolved entries a page at a time', async () => {
    const inbox = reader([], [{ ...item(null), resolved: true }]);
    const page = { before: 'cursor', limit: 20 };

    const found = await new ListInboxHandler(inbox, access()).execute(
      new ListInboxQuery('acme', 'user_1', 'resolved', page),
    );

    expect(inbox.resolved).toHaveBeenCalledWith(SCOPE, page);
    expect(found?.items).toHaveLength(1);
    expect(found?.next).toBe('cursor');
  });

  it('hands back nothing where the workspace is not visible', async () => {
    await expect(handle(reader([]), access(null))).resolves.toBeNull();
  });
});

describe('ReadInboxItemHandler', () => {
  it('hands back the item with every note of its conversation', async () => {
    const inbox = reader([]);
    vi.mocked(inbox.item).mockResolvedValue({
      ...item(null),
      notes: [note(null)],
      folded: [
        {
          first: note(null),
          to: 0,
          endedAt: new Date('2026-09-26T09:20:00.000Z'),
          closing: null,
          answers: [note(null)],
          passedBack: false,
        },
      ],
    });

    const found = await new ReadInboxItemHandler(inbox, access()).execute(
      new ReadInboxItemQuery('acme', 'task_1:0', 'user_1'),
    );

    expect(found?.notes.map((each) => each.at)).toEqual([
      '2026-09-26T09:15:00.000Z',
    ]);
    const visit = firstOf(found?.folded ?? []);

    expect(visit?.first.at).toBe('2026-09-26T09:15:00.000Z');
    expect(visit?.endedAt).toBe('2026-09-26T09:20:00.000Z');
    expect(visit?.answers.map((each) => each.at)).toEqual([
      '2026-09-26T09:15:00.000Z',
    ]);
  });

  it('hands back nothing for an item the caller cannot see', async () => {
    await expect(
      new ReadInboxItemHandler(reader([]), access()).execute(
        new ReadInboxItemQuery('acme', 'task_1:0', 'user_1'),
      ),
    ).resolves.toBeNull();
  });
});
