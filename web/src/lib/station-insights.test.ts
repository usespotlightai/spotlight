import { describe, expect, it } from 'vitest';

import {
  configFingerprint,
  countedColumnsOf,
  type FingerprintGroup,
  hasRuns,
  outcomePartsOf,
  outcomeTone,
  recentRuns,
  runSpent,
  type StationRunOutcome,
  stationTableColumns,
  resolutionLabel,
} from '@/lib/station-insights';

describe('runSpent', () => {
  it('shows a dash where a run cost nothing known', () => {
    expect(runSpent(null)).toBe('–');
    expect(
      runSpent({
        ms: 1,
        steps: 1,
        errors: 0,
        contextTokens: null,
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

  it('lists only the live config, in the listing’s start order', () => {
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

describe('hasRuns', () => {
  const group = (fingerprint: string | null, ...runIds: string[]) =>
    ({
      fingerprint,
      runs: runIds.map((runId) => ({ runId })),
    }) as unknown as FingerprintGroup;

  it('counts runs in any group, with or without a config', () => {
    expect(hasRuns([group(null, 'run_1')])).toBe(true);
    expect(hasRuns([group('a', 'run_1')])).toBe(true);
  });

  it('says no runs when every group is empty', () => {
    expect(hasRuns([])).toBe(false);
    expect(hasRuns([group('a')])).toBe(false);
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
      passed: false,
      merged: false,
      cancelled: false,
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

describe('stationTableColumns', () => {
  it('leaves the checks, stops, passes and the slowest tenth to the station view', () => {
    expect(
      stationTableColumns({
        failed: true,
        stopped: true,
        checksPassed: true,
        checksFailed: true,
        accepted: true,
        sentBack: true,
        passed: true,
        merged: true,
        cancelled: false,
      }).map((column) => column.label),
    ).toEqual([
      'Runs',
      'Failed',
      'Accepted',
      'Sent back',
      'Merged',
      'Cost',
      'Median',
    ]);
  });
});

describe('configFingerprint', () => {
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
      configFingerprint([
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
      since: '2026-10-03',
      pullRequest: 'https://github.com/acme/config/pull/42',
    });
  });

  it('names no pull request where none brought the config', () => {
    expect(
      configFingerprint([group('a'.repeat(64), '2026-10-03')])?.pullRequest,
    ).toBeNull();
  });

  it('has no fingerprint before any run carried a config', () => {
    expect(configFingerprint([group(null, null)])).toBeNull();
  });
});

describe('outcomePartsOf', () => {
  it('shows each resolution the server counted, with its share, in a fixed order', () => {
    expect(
      outcomePartsOf({
        resolutions: {
          accepted: 2,
          sentBack: 1,
          movedOn: 3,
          failed: 1,
          other: 1,
        },
        resolutionShares: {
          accepted: 0.25,
          sentBack: 0.125,
          movedOn: 0.375,
          failed: 0.125,
          other: 0.125,
        },
      }).map((part) => [part.label, part.tone, part.count, part.share]),
    ).toEqual([
      ['Accepted', 'done', 2, 0.25],
      ['Moved on', 'movedOn', 3, 0.375],
      ['Sent back', 'sentBack', 1, 0.125],
      ['Failed, no answer', 'failed', 1, 0.125],
      ['Other', 'quiet', 1, 0.125],
    ]);
  });
});

describe('outcomeTone', () => {
  it('takes a run’s tone from its resolution, not from how it ended', () => {
    const run = (
      resolution: StationRunOutcome['resolution'],
      ending: StationRunOutcome['ending'],
    ) => ({ resolution, ending }) as StationRunOutcome;

    expect(outcomeTone(run('accepted', 'failed'))).toBe('done');
    expect(outcomeTone(run('moved-on', 'completed'))).toBe('movedOn');
    expect(outcomeTone(run('other', 'exhausted'))).toBe('quiet');
    expect(outcomeTone(run('failed', 'failed'))).toBe('failed');
    expect(outcomeTone(run('sent-back', 'completed'))).toBe('sentBack');
  });

  it('labels a run by its resolution, and by how it ended when the resolution is other', () => {
    const run = (
      resolution: StationRunOutcome['resolution'],
      ending: StationRunOutcome['ending'],
    ) => ({ resolution, ending }) as StationRunOutcome;

    expect(resolutionLabel(run('accepted', 'failed'))).toBe('Accepted');
    expect(resolutionLabel(run('moved-on', 'completed'))).toBe('Moved on');
    expect(resolutionLabel(run('other', 'stopped'))).toBe('Stopped');
  });
});
