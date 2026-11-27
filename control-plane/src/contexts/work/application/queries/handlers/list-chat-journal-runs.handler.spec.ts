import type { JournalledRun } from '@runs/application/contracts/run-journal.contract';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type { RunsOfChat } from '@work/application/ports/viewed-runs';
import { ListChatJournalRunsQuery } from '@work/application/queries/chat.queries';
import { ListChatJournalRunsHandler } from '@work/application/queries/handlers/list-chat-journal-runs.handler';
import type { RunAccess } from '@work/application/services/run-access.service';
import { describe, expect, it, vi } from 'vitest';

const listing = (found: JournalledRun[]) =>
  new ListChatJournalRunsHandler(
    partial<RunJournalReaderPort>({
      runsOfChat: vi.fn(() =>
        Promise.resolve(partial<RunsOfChat<JournalledRun[]>>({ found })),
      ),
    }),
    partial<RunAccess>({
      shownOfChat: <T>(runs: RunsOfChat<T> | null) =>
        Promise.resolve(runs === null ? null : runs.found),
    }),
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
