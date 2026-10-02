import type { RunDigest } from '@work/application/ports/run-digest-reader.port';
import type {
  RunConversationSummary,
  RunReaderPort,
} from '@work/application/ports/run-reader.port';
import { ReadRunConversationHandler } from '@work/application/queries/handlers/read-run-conversation.handler';
import { ReadRunConversationQuery } from '@work/application/queries/read-run-conversation.query';
import { Money } from '@work/domain/value-objects/money.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { describe, expect, it, vi } from 'vitest';

const RUN_ID = '4e1e84a2-0c39-406d-bbbb-559f29e450be';

const conversation: RunConversationSummary = {
  runId: RUN_ID,
  taskId: 'task_1',
  title: 'Fix the queue',
  description: null,
  attachments: [],
  station: null,
  createdAt: new Date('2026-09-30T10:00:00Z'),
  briefing: 'Fix the queue so it drains.',
  working: false,
  notes: [],
};

const digest: RunDigest = {
  ms: 60_000,
  steps: 12,
  faults: 0,
  changedLines: 0,
  used: 40_000,
  size: 200_000,
  cost: Money.of(0.42, 'USD'),
  tokens: Tokens.of({ input: 1_200, output: 900, cacheRead: 80_000 }),
};

const reading = (
  found: RunConversationSummary | null,
  digests: ReadonlyMap<string, RunDigest>,
) =>
  new ReadRunConversationHandler(
    {
      listForTask: vi.fn(),
      listForTeam: vi.fn(),
      conversationFor: vi.fn().mockResolvedValue(found),
      configFor: vi.fn(),
      replayFor: vi.fn(),
      searchRunFor: vi.fn(),
    } satisfies RunReaderPort,
    { forRuns: async () => new Map(digests) },
  ).execute(new ReadRunConversationQuery(RUN_ID, 'user_1'));

describe('ReadRunConversationHandler', () => {
  it('finds nothing for a run the viewer cannot see', async () => {
    expect(await reading(null, new Map([[RUN_ID, digest]]))).toBeNull();
  });

  it('shows what an ended run spent, with a count never reported left unknown', async () => {
    const found = await reading(conversation, new Map([[RUN_ID, digest]]));

    expect(found?.spend).toEqual({
      cost: 0.42,
      currency: 'USD',
      inputTokens: 1_200,
      outputTokens: 900,
      cacheReadTokens: 80_000,
      cacheWriteTokens: null,
    });
  });

  it('shows no spend for a run not yet digested', async () => {
    const found = await reading(conversation, new Map());

    expect(found?.spend).toBeNull();
  });
});
