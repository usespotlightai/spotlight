import type { InboxItemDto } from '@work/application/dto/inbox.dto';
import { FIRST_PAGE } from '@work/application/dto/page.dto';
import type {
  InboxEntrySummary,
  InboxItemSummary,
  InboxNote,
  InboxReaderPort,
} from '@work/application/ports/inbox-reader.port';
import {
  ListInboxHandler,
  ReadInboxItemHandler,
} from '@work/application/queries/handlers/list-inbox.handler';
import {
  ListInboxQuery,
  ReadInboxItemQuery,
} from '@work/application/queries/list-inbox.query';
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
  readAt: null,
  approval: null,
  failure,
  connection: null,
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
  currentStation: { name: 'Implementation', color: '#edc12b', position: 1 },
  createdAt: asked,
  askedAt: asked,
  resolved: false,
  section: 'open',
  reopenable: false,
  progress: null,
  runId: null,
  unread: true,
  briefing: null,
  failure,
  inboxRequest: null,
  lastNote: note(failure),
});

const reader = (
  open: InboxEntrySummary[] | null,
  resolved: InboxEntrySummary[] | null = [],
): InboxReaderPort => ({
  openForWorkspaceMember: vi.fn().mockResolvedValue(open),
  resolvedForWorkspaceMember: vi
    .fn()
    .mockResolvedValue(resolved && { items: resolved, next: 'cursor' }),
  itemForWorkspaceMember: vi.fn().mockResolvedValue(null),
  noticeForWorkspaceMember: vi.fn().mockResolvedValue(null),
});

const handle = (inbox: InboxReaderPort) =>
  new ListInboxHandler(inbox).execute(
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
              points: ['Fix the rubric.'],
              link: 'lines/line_1/stations/station_1',
              linkLabel: 'Open the station',
              externalLink: {
                url: 'https://github.com/acme/config/pull/12',
                label: 'Review the pull request',
              },
              askedAt: asked,
              unread: true,
              resolved: false,
              section: 'open',
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
      points: ['Fix the rubric.'],
      link: 'lines/line_1/stations/station_1',
      linkLabel: 'Open the station',
      externalLink: {
        url: 'https://github.com/acme/config/pull/12',
        label: 'Review the pull request',
      },
      askedAt: '2026-09-26T09:15:00.000Z',
      unread: true,
      resolved: false,
      section: 'open',
      reopenable: false,
    });
  });

  it('reads the resolved entries a page at a time', async () => {
    const inbox = reader([], [{ ...item(null), resolved: true }]);
    const page = { before: 'cursor', limit: 20 };

    const found = await new ListInboxHandler(inbox).execute(
      new ListInboxQuery('acme', 'user_1', 'resolved', page),
    );

    expect(inbox.resolvedForWorkspaceMember).toHaveBeenCalledWith(
      'acme',
      expect.anything(),
      page,
    );
    expect(found?.items).toHaveLength(1);
    expect(found?.next).toBe('cursor');
  });

  it('hands back nothing where the workspace is not visible', async () => {
    await expect(handle(reader(null))).resolves.toBeNull();
  });
});

describe('ReadInboxItemHandler', () => {
  it('hands back the item with every note of its conversation', async () => {
    const inbox = reader([]);
    vi.mocked(inbox.itemForWorkspaceMember).mockResolvedValue({
      ...item(null),
      notes: [note(null)],
    });

    const found = await new ReadInboxItemHandler(inbox).execute(
      new ReadInboxItemQuery('acme', 'task_1:0', 'user_1'),
    );

    expect(found?.notes.map((each) => each.at)).toEqual([
      '2026-09-26T09:15:00.000Z',
    ]);
  });

  it('hands back nothing for an item the caller cannot see', async () => {
    await expect(
      new ReadInboxItemHandler(reader([])).execute(
        new ReadInboxItemQuery('acme', 'task_1:0', 'user_1'),
      ),
    ).resolves.toBeNull();
  });
});
