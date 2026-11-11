import { RunJournalMapper } from '@work/application/mappers/run-journal.mapper';
import { describe, expect, it } from 'vitest';

describe('RunJournalMapper', () => {
  it('sends the step and message counts of a run', () => {
    expect(
      RunJournalMapper.runToDto({
        runId: 'run_1',
        createdAt: new Date('2026-11-06T09:30:00.000Z'),
        stepCount: 7,
        messageCount: 2,
      }),
    ).toEqual({
      runId: 'run_1',
      createdAt: '2026-11-06T09:30:00.000Z',
      stepCount: 7,
      messageCount: 2,
    });
  });

  it('sends zero counts for a run without steps', () => {
    expect(
      RunJournalMapper.runToDto({
        runId: 'run_2',
        createdAt: new Date('2026-11-06T09:31:00.000Z'),
        stepCount: 0,
        messageCount: 0,
      }),
    ).toMatchObject({ stepCount: 0, messageCount: 0 });
  });
});
