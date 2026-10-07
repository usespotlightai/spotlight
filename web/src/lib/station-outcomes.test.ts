import { describe, expect, it } from 'vitest';
import {
  countedColumnsOf,
  type FingerprintGroup,
  recentRuns,
  runSpent,
} from '@/lib/station-outcomes';

describe('runSpent', () => {
  it('shows a dash where a run cost nothing known', () => {
    expect(runSpent(null)).toBe('–');
    expect(
      runSpent({
        ms: 1,
        steps: 1,
        faults: 0,
        used: null,
        cost: null,
        currency: null,
      }),
    ).toBe('–');
  });
});

describe('recentRuns', () => {
  it('keeps the listing’s start order across groups, not when runs ended', () => {
    const group = (...runIds: string[]) =>
      ({
        runs: runIds.map((runId, at) => ({
          runId,
          endedAt: `2026-10-0${at + 1}T00:00:00.000Z`,
        })),
      }) as unknown as FingerprintGroup;

    expect(
      recentRuns([group('run_4', 'run_3'), group('run_2', 'run_1')], 3).map(
        (run) => run.runId,
      ),
    ).toEqual(['run_4', 'run_3', 'run_2']);
  });
});

describe('countedColumnsOf', () => {
  it('keeps the counts the server marks counted, and always runs, cost and times', () => {
    const labels = countedColumnsOf({
      failed: true,
      stopped: false,
      checksPassed: false,
      checksFailed: false,
      accepted: true,
      sentBack: false,
      handedOn: false,
      merged: false,
      withdrawn: false,
    }).map((column) => column.label);

    expect(labels).toEqual([
      'Runs',
      'Failed',
      'Accepted',
      'Cost',
      'Median',
      'p90',
    ]);
  });
});
