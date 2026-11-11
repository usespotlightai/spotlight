import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import { ListChatJournalRunsQuery } from '@work/application/queries/chat.queries';
import { ListChatJournalRunsHandler } from '@work/application/queries/handlers/list-chat-journal-runs.handler';
import type { RunAccess } from '@work/application/services/run-access.service';
import { describe, expect, it, vi } from 'vitest';

const listing = (found: unknown) =>
  new ListChatJournalRunsHandler(
    {
      runsOfChat: vi.fn(async () => ({ found })),
    } as unknown as RunJournalReaderPort,
    {
      shownOfChat: vi.fn(async (runs: { found: unknown }) => runs.found),
    } as unknown as RunAccess,
  ).execute(new ListChatJournalRunsQuery('team_1', 'chat_1', 'user_1'));

describe('ListChatJournalRunsHandler', () => {
  it('lists the runs of a chat in order with their step and message counts', async () => {
    const runs = await listing([
      {
        runId: 'run_1',
        createdAt: new Date('2026-11-06T09:30:00.000Z'),
        stepCount: 5,
        messageCount: 1,
      },
      {
        runId: 'run_2',
        createdAt: new Date('2026-11-06T09:40:00.000Z'),
        stepCount: 0,
        messageCount: 0,
      },
    ]);

    expect(runs).toEqual([
      {
        runId: 'run_1',
        createdAt: '2026-11-06T09:30:00.000Z',
        stepCount: 5,
        messageCount: 1,
      },
      {
        runId: 'run_2',
        createdAt: '2026-11-06T09:40:00.000Z',
        stepCount: 0,
        messageCount: 0,
      },
    ]);
  });
});
