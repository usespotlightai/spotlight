import type { InboxItemDto } from '@work/application/dto/inbox.dto';
import type {
  InboxEntrySummary,
  InboxItemSummary,
  InboxNote,
  InboxReaderPort,
} from '@work/application/ports/inbox-reader.port';
import { ListInboxHandler } from '@work/application/queries/handlers/list-inbox.handler';
import { ListInboxQuery } from '@work/application/queries/list-inbox.query';
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
  work: null,
  runId: null,
  unread: true,
  briefing: null,
  failure,
  inboxRequest: null,
  notes: [note(failure)],
});

const reader = (result: InboxEntrySummary[] | null): InboxReaderPort => ({
  listForWorkspaceMember: vi.fn().mockResolvedValue(result),
});

const NOW = new Date('2026-10-03T09:00:00.000Z');

const handle = (inbox: InboxReaderPort) =>
  new ListInboxHandler(inbox, {
    now: () => NOW,
    sleep: async () => {},
  }).execute(new ListInboxQuery('acme', 'user_1'));

const firstTask = async (
  inbox: InboxReaderPort,
): Promise<InboxItemDto | undefined> =>
  ((await handle(inbox)) ?? []).find(
    (each): each is InboxItemDto => each.kind === 'task',
  );

describe('ListInboxHandler', () => {
  it('reports the failure a conversation is about, and how often it happened', async () => {
    const about = await firstTask(reader([item(exited)]));

    expect(about?.failure).toEqual(exited);
    expect(about?.notes[0]?.failure).toEqual(exited);
  });

  it('reports no failure for a conversation that is not about one', async () => {
    const about = await firstTask(reader([item(null)]));

    expect(about?.failure).toBeNull();
    expect(about?.notes[0]?.failure).toBeNull();
  });

  it('hands back dates as they would travel', async () => {
    const about = await firstTask(reader([item(null)]));

    expect(about?.askedAt).toBe('2026-09-26T09:15:00.000Z');
    expect(about?.notes[0]?.at).toBe('2026-09-26T09:15:00.000Z');
  });

  it('hands back a notice beside the conversations, its date as it would travel', async () => {
    const [noticed] =
      (await handle(
        reader([
          {
            kind: 'notice',
            id: 'notice_1',
            teamId: 'team_1',
            form: 'ended',
            headline: 'The search stalled',
            points: ['Fix the rubric.'],
            link: 'lines/line_1/stations/station_1/searches/search_1',
            linkLabel: 'Open the search',
            askedAt: asked,
            unread: true,
            resolved: false,
          },
        ]),
      )) ?? [];

    expect(noticed).toEqual({
      kind: 'notice',
      id: 'notice_1',
      teamId: 'team_1',
      form: 'ended',
      headline: 'The search stalled',
      points: ['Fix the rubric.'],
      link: 'lines/line_1/stations/station_1/searches/search_1',
      linkLabel: 'Open the search',
      askedAt: '2026-09-26T09:15:00.000Z',
      unread: true,
      resolved: false,
    });
  });

  it('requests only the notices resolved in the last 30 days, beside every open one', async () => {
    const inbox = reader([]);

    await handle(inbox);

    expect(inbox.listForWorkspaceMember).toHaveBeenCalledWith(
      'acme',
      expect.anything(),
      new Date('2026-09-03T09:00:00.000Z'),
    );
  });

  it('hands back nothing where the workspace is not visible', async () => {
    await expect(handle(reader(null))).resolves.toBeNull();
  });
});
