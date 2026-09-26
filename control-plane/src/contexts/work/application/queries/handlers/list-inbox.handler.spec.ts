import type {
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
});

const item = (failure: InboxItemSummary['failure']): InboxItemSummary => ({
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
  raisedAt: { name: 'Triage', color: '#edc12b', position: 0 },
  standsAt: { name: 'Implementation', color: '#edc12b', position: 1 },
  createdAt: asked,
  askedAt: asked,
  resolved: false,
  working: false,
  runId: null,
  unread: true,
  briefing: null,
  failure,
  notes: [note(failure)],
});

const reader = (result: InboxItemSummary[] | null): InboxReaderPort => ({
  listForWorkspaceMember: vi.fn().mockResolvedValue(result),
});

const handle = (inbox: InboxReaderPort) =>
  new ListInboxHandler(inbox).execute(new ListInboxQuery('acme', 'user_1'));

describe('ListInboxHandler', () => {
  it('reports the failure a conversation is about, and how often it happened', async () => {
    const [about] = (await handle(reader([item(exited)]))) ?? [];

    expect(about?.failure).toEqual(exited);
    expect(about?.notes[0]?.failure).toEqual(exited);
  });

  it('reports no failure for a conversation that is not about one', async () => {
    const [about] = (await handle(reader([item(null)]))) ?? [];

    expect(about?.failure).toBeNull();
    expect(about?.notes[0]?.failure).toBeNull();
  });

  it('hands back dates as they would travel', async () => {
    const [about] = (await handle(reader([item(null)]))) ?? [];

    expect(about?.askedAt).toBe('2026-09-26T09:15:00.000Z');
    expect(about?.notes[0]?.at).toBe('2026-09-26T09:15:00.000Z');
  });

  it('hands back nothing where the workspace is not visible', async () => {
    await expect(handle(reader(null))).resolves.toBeNull();
  });
});
