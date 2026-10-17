import {
  endedRecord,
  FIRST_CONFIG,
  SECOND_CONFIG,
} from '@outcomes/domain/outcomes.fake-spec';
import { configChangesAlong } from '@outcomes/domain/services/config-stretches';
import { describe, expect, it } from 'vitest';

const minute = (at: number) => new Date(Date.UTC(2026, 8, 30, 10, at));

const ranAt = (
  runId: string,
  fingerprint: string | null,
  startedAt: number | null,
  change: {
    endedAt?: number;
    stationId?: string;
    ending?: 'cancelled' | 'failed';
  } = {},
) =>
  endedRecord(runId, {
    fingerprint,
    stationId: change.stationId,
    ending: change.ending,
    startedAt: startedAt === null ? null : minute(startedAt),
    endedAt: minute(change.endedAt ?? (startedAt ?? 0) + 30),
  });

const startsOf = (records: Parameters<typeof configChangesAlong>[0]) =>
  configChangesAlong(records).map(
    ({ run }) =>
      `${run.stationId} ${run.runId.value} ${run.fingerprint === FIRST_CONFIG ? 'A' : 'B'}@${run.beganAt.getUTCMinutes()}`,
  );

describe('configChangesAlong', () => {
  it('starts a stretch at each run that began after a run of another config or none, A to B and back to A, whatever order they ended in', () => {
    expect(
      startsOf([
        ranAt('run_4', FIRST_CONFIG, 4),
        ranAt('run_2', SECOND_CONFIG, 2),
        ranAt('run_1', FIRST_CONFIG, 1),
        ranAt('run_3', FIRST_CONFIG, 3),
        ranAt('run_5', FIRST_CONFIG, 5),
      ]),
    ).toEqual([
      'station_1 run_1 A@1',
      'station_1 run_2 B@2',
      'station_1 run_3 A@3',
    ]);
  });

  it('orders runs that began at the same instant by run', () => {
    expect(
      startsOf([
        ranAt('run_b', SECOND_CONFIG, 5),
        ranAt('run_a', FIRST_CONFIG, 5),
        ranAt('run_c', FIRST_CONFIG, 6),
      ]),
    ).toEqual([
      'station_1 run_a A@5',
      'station_1 run_b B@5',
      'station_1 run_c A@6',
    ]);
  });

  it('passes over cancelled runs, runs that never started and runs with no config', () => {
    expect(
      startsOf([
        ranAt('run_1', FIRST_CONFIG, 1),
        ranAt('run_cancelled', SECOND_CONFIG, null, {
          endedAt: 2,
          ending: 'cancelled',
        }),
        ranAt('run_cancelled_started', SECOND_CONFIG, 2, {
          ending: 'cancelled',
        }),
        ranAt('run_none', null, 3),
        ranAt('run_2', FIRST_CONFIG, 4),
      ]),
    ).toEqual(['station_1 run_1 A@1']);
  });

  it('makes no change at a provisioning failure on B between two A runs', () => {
    expect(
      startsOf([
        ranAt('run_1', FIRST_CONFIG, 1),
        ranAt('run_failed', SECOND_CONFIG, null, {
          endedAt: 2,
          ending: 'failed',
        }),
        ranAt('run_2', FIRST_CONFIG, 3),
      ]),
    ).toEqual(['station_1 run_1 A@1']);
  });

  it('carries on from the last config run before, changing only where the first run after it ran another config', () => {
    const before = [
      ranAt('run_0', SECOND_CONFIG, 0, { stationId: 'station_2' }),
      ranAt('run_older', SECOND_CONFIG, 0),
      ranAt('run_last', FIRST_CONFIG, 1),
      ranAt('run_unstarted', SECOND_CONFIG, null, {
        endedAt: 2,
        ending: 'failed',
      }),
    ];

    expect(
      configChangesAlong(
        [
          ranAt('run_3', FIRST_CONFIG, 3),
          ranAt('run_4', FIRST_CONFIG, 4, { stationId: 'station_2' }),
          ranAt('run_5', FIRST_CONFIG, 5, { stationId: 'station_3' }),
        ],
        before,
      ).map(({ run, previous }) => [
        run.runId.value,
        previous === null ? null : previous === FIRST_CONFIG ? 'A' : 'B',
      ]),
    ).toEqual([
      ['run_4', 'B'],
      ['run_5', null],
    ]);
  });

  it('follows each station on its own', () => {
    expect(
      startsOf([
        ranAt('run_1', FIRST_CONFIG, 1),
        ranAt('run_2', FIRST_CONFIG, 2, { stationId: 'station_2' }),
        ranAt('run_3', FIRST_CONFIG, 3),
      ]),
    ).toEqual(['station_1 run_1 A@1', 'station_2 run_2 A@2']);
  });
});
