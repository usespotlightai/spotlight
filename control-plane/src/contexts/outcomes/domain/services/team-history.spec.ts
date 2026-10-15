import { endedRecord } from '@outcomes/domain/outcomes.fake-spec';
import {
  endedWithin,
  stationsOf,
} from '@outcomes/domain/services/team-history';
import { describe, expect, it } from 'vitest';

const ENDED = new Date('2026-09-28T11:00:00.000Z');

const tied = [
  endedRecord('run_b', {
    stationId: 'station_b',
    startedAt: new Date('2026-09-28T09:00:00.000Z'),
    endedAt: ENDED,
  }),
  endedRecord('run_a', {
    stationId: 'station_a',
    startedAt: new Date('2026-09-28T10:00:00.000Z'),
    endedAt: ENDED,
  }),
];

describe('runs that ended at the same moment', () => {
  it('are kept in run id order, whatever order they came in or began in', () => {
    const ended = endedWithin(tied, {
      from: new Date('2026-09-28T00:00:00.000Z'),
      to: new Date('2026-09-29T00:00:00.000Z'),
    });

    expect(ended.map((each) => each.runId.value)).toEqual(['run_a', 'run_b']);
  });

  it('name their stations in run id order', () => {
    expect(stationsOf(tied).map((each) => each.stationId)).toEqual([
      'station_a',
      'station_b',
    ]);
  });
});
