import type { RunOutcomeShape } from '@work/application/ports/run-outcomes.port';
import {
  historyLength,
  turnedOut,
} from '@work/application/read-models/history-selection';
import { describe, expect, it } from 'vitest';

const outcome: RunOutcomeShape = {
  runId: 'run_1',
  fingerprint: null,
  endedAt: '2026-09-30T10:00:00.000Z',
  ending: 'failed',
  failure: 'exited',
  round: 2,
  checks: 'failed',
  next: { act: 'sent-back', at: '2026-09-30T11:00:00.000Z' },
  delivery: 'merged',
};

describe('history selection', () => {
  it('reads thirty runs unless asked, and never more than fifty', () => {
    expect(historyLength(null)).toBe(30);
    expect(historyLength(0)).toBe(30);
    expect(historyLength(12.7)).toBe(12);
    expect(historyLength(1000)).toBe(50);
  });

  it('matches a run by how it ended, its failure, the next act, its delivery or its checks', () => {
    for (const wanted of [
      'failed',
      'exited',
      'sent-back',
      'merged',
      'checks-failed',
    ]) {
      expect(turnedOut(outcome, wanted)).toBe(true);
    }

    expect(turnedOut(outcome, 'completed')).toBe(false);
    expect(turnedOut(null, 'failed')).toBe(false);
  });
});
