import { day } from '@outcomes/domain/insights.fake-spec';
import {
  endedRecord,
  FIRST_CONFIG,
  SECOND_CONFIG,
} from '@outcomes/domain/outcomes.fake-spec';
import { changeSplitsOf } from '@outcomes/domain/services/before-after';
import { describe, expect, it } from 'vitest';

const THIRD_CONFIG = 'c'.repeat(64);

const ran = (
  runId: string,
  hour: number,
  fingerprint: string,
  stationId = 'station_1',
) =>
  endedRecord(runId, {
    stationId,
    fingerprint,
    startedAt: day('2026-09-30', hour),
    endedAt: day('2026-09-30', hour),
  });

const ids = (records: readonly { runId: { value: string } }[]) =>
  records.map((each) => each.runId.value);

describe('changeSplitsOf', () => {
  const records = [
    ran('run_1', 1, FIRST_CONFIG),
    ran('run_2', 2, FIRST_CONFIG),
    ran('run_3', 3, SECOND_CONFIG),
    ran('run_4', 4, SECOND_CONFIG),
    ran('run_5', 5, THIRD_CONFIG),
    ran('run_6', 6, FIRST_CONFIG, 'station_2'),
  ];

  it('splits a station’s runs at each config change, up to the changes either side', () => {
    const splits = changeSplitsOf(records, () => true);

    expect(
      splits.map((each) => [
        each.marker.fingerprint,
        each.previousFingerprint,
        ids(each.before),
        ids(each.after),
      ]),
    ).toEqual([
      [SECOND_CONFIG, FIRST_CONFIG, ['run_1', 'run_2'], ['run_3', 'run_4']],
      [THIRD_CONFIG, SECOND_CONFIG, ['run_3', 'run_4'], ['run_5']],
    ]);
  });

  it('keeps only the changes asked for, still bounded by the ones left out', () => {
    const splits = changeSplitsOf(
      records,
      (marker) => marker.fingerprint === THIRD_CONFIG,
    );

    expect(splits.map((each) => ids(each.before))).toEqual([
      ['run_3', 'run_4'],
    ]);
  });

  it('sets only the runs of the config before against only the runs of the new one, so a change rolled back is not mixed in', () => {
    const splits = changeSplitsOf(
      [
        ran('run_1', 1, FIRST_CONFIG),
        ran('run_2', 2, FIRST_CONFIG),
        ran('run_3', 3, SECOND_CONFIG),
        ran('run_4', 4, SECOND_CONFIG),
        ran('run_5', 5, FIRST_CONFIG),
        ran('run_6', 6, FIRST_CONFIG),
      ],
      () => true,
    );

    expect(
      splits.map((each) => [
        each.marker.fingerprint,
        ids(each.before),
        ids(each.after),
      ]),
    ).toEqual([[SECOND_CONFIG, ['run_1', 'run_2'], ['run_3', 'run_4']]]);
  });

  it('marks no change where a station only ever ran one config', () => {
    expect(changeSplitsOf([ran('run_1', 1, FIRST_CONFIG)], () => true)).toEqual(
      [],
    );
  });
});
