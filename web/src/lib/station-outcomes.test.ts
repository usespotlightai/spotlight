import { describe, expect, it } from 'vitest';
import {
  configVersion,
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
  const group = (fingerprint: string | null, ...runIds: string[]) =>
    ({
      fingerprint,
      runs: runIds.map((runId, at) => ({
        runId,
        endedAt: `2026-10-0${at + 1}T00:00:00.000Z`,
      })),
    }) as unknown as FingerprintGroup;

  it('lists only the config in force, in the listing’s start order', () => {
    expect(
      recentRuns(
        [group('a', 'run_4', 'run_3', 'run_2'), group('b', 'run_1')],
        2,
      ).map((run) => run.runId),
    ).toEqual(['run_4', 'run_3']);
  });

  it('lists nothing before any run carried a config', () => {
    expect(recentRuns([group(null, 'run_1')], 5)).toEqual([]);
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

describe('configVersion', () => {
  const group = (
    fingerprint: string | null,
    firstDay: string | null,
    pullRequest: string | null = null,
  ) =>
    ({
      fingerprint,
      firstDay,
      pullRequest: pullRequest ? { url: pullRequest } : null,
    }) as unknown as FingerprintGroup;

  it('names the newest config, when it started and the pull request that brought it', () => {
    expect(
      configVersion([
        group(
          'a'.repeat(64),
          '2026-10-03',
          'https://github.com/acme/config/pull/42',
        ),
        group('b'.repeat(64), '2026-09-20'),
        group(null, null),
      ]),
    ).toEqual({
      fingerprint: 'aaaaaaaa',
      since: 'Oct 3',
      pullRequest: 'https://github.com/acme/config/pull/42',
    });
  });

  it('names no pull request where none brought the config', () => {
    expect(
      configVersion([group('a'.repeat(64), '2026-10-03')])?.pullRequest,
    ).toBeNull();
  });

  it('has no version before any run carried a config', () => {
    expect(configVersion([group(null, null)])).toBeNull();
  });
});
