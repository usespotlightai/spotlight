import type {
  RunNotesSummary,
  RunReaderPort,
} from '@work/application/ports/run-reader.port';
import type { RunUsage } from '@work/application/ports/run-usage-reader.port';
import { ReadRunNotesHandler } from '@work/application/queries/handlers/read-run-notes.handler';
import { ReadRunNotesQuery } from '@work/application/queries/read-run-notes.query';
import { Money } from '@work/domain/value-objects/money.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { describe, expect, it, vi } from 'vitest';

const RUN_ID = '4e1e84a2-0c39-406d-bbbb-559f29e450be';

const notes: RunNotesSummary = {
  runId: RUN_ID,
  taskId: 'task_1',
  title: 'Fix the queue',
  description: null,
  attachments: [],
  station: null,
  createdAt: new Date('2026-09-30T10:00:00Z'),
  briefing: 'Fix the queue so it drains.',
  progress: null,
  latestRun: {
    id: RUN_ID,
    state: 'completed',
    progress: null,
  },
  notes: [],
};

const usage: RunUsage = {
  ms: 60_000,
  steps: 12,
  errors: 0,
  changedLines: 0,
  contextTokens: 40_000,
  contextWindow: 200_000,
  cost: Money.of(0.42, 'USD'),
  tokens: Tokens.of({ input: 1_200, output: 900, cacheRead: 80_000 }),
};

const reading = (
  found: RunNotesSummary | null,
  usages: ReadonlyMap<string, RunUsage>,
) =>
  new ReadRunNotesHandler(
    {
      listForTask: vi.fn(),
      listForTeam: vi.fn(),
      notesFor: vi.fn().mockResolvedValue(found),
      configFor: vi.fn(),
    } satisfies RunReaderPort,
    { forRuns: async () => new Map(usages) },
  ).execute(new ReadRunNotesQuery(RUN_ID, 'user_1'));

describe('ReadRunNotesHandler', () => {
  it('finds nothing for a run the viewer cannot see', async () => {
    expect(await reading(null, new Map([[RUN_ID, usage]]))).toBeNull();
  });

  it('shows what an ended run spent, with a count never reported left unknown', async () => {
    const found = await reading(notes, new Map([[RUN_ID, usage]]));

    expect(found?.spend).toEqual({
      cost: 0.42,
      currency: 'USD',
      inputTokens: 1_200,
      outputTokens: 900,
      cacheReadTokens: 80_000,
      cacheWriteTokens: null,
    });
  });

  it('shows no spend for a run whose usage is not yet recorded', async () => {
    const found = await reading(notes, new Map());

    expect(found?.spend).toBeNull();
  });
});
