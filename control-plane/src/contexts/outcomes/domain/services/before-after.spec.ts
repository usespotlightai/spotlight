import { day } from '@outcomes/domain/insights.fake-spec';
import {
  endedRecord,
  FIRST_CONFIG,
  SECOND_CONFIG,
} from '@outcomes/domain/outcomes.fake-spec';
import { changeSplitsOf } from '@outcomes/domain/services/before-after';
import { runTally } from '@outcomes/domain/services/run-tally';
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

  it('marks a rollback as a change of its own, setting the runs of each stretch against the next', () => {
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
    ).toEqual([
      [SECOND_CONFIG, ['run_1', 'run_2'], ['run_3', 'run_4']],
      [FIRST_CONFIG, ['run_3', 'run_4'], ['run_5', 'run_6']],
    ]);
  });

  it('sets a return to a config against only the stretch just before it, not the earlier runs of that config', () => {
    const splits = changeSplitsOf(
      [
        ran('run_1', 1, FIRST_CONFIG),
        ran('run_2', 2, SECOND_CONFIG),
        ran('run_3', 3, FIRST_CONFIG),
        ran('run_4', 4, SECOND_CONFIG),
        ran('run_5', 5, SECOND_CONFIG),
        ran('run_6', 6, FIRST_CONFIG),
      ],
      (marker) => marker.runId === 'run_4',
    );

    expect(
      splits.map((each) => [
        each.previousFingerprint,
        each.marker.fingerprint,
        ids(each.before),
        ids(each.after),
      ]),
    ).toEqual([[FIRST_CONFIG, SECOND_CONFIG, ['run_3'], ['run_4', 'run_5']]]);
  });

  it('tells apart runs that began at the same instant by run, as the markers do', () => {
    const at = day('2026-09-30', 1);
    const sameInstant = (runId: string, fingerprint: string) =>
      endedRecord(runId, {
        stationId: 'station_1',
        fingerprint,
        startedAt: at,
        endedAt: at,
      });
    const splits = changeSplitsOf(
      [
        sameInstant('run_b', SECOND_CONFIG),
        sameInstant('run_a', FIRST_CONFIG),
        ran('run_c', 2, SECOND_CONFIG),
      ],
      () => true,
    );

    expect(
      splits.map((each) => [
        each.marker.runId,
        ids(each.before),
        ids(each.after),
      ]),
    ).toEqual([['run_b', ['run_a'], ['run_b', 'run_c']]]);
  });

  it('splits at the first config run when the last config run before the records ran another config, with no runs before it to set against', () => {
    const splits = changeSplitsOf(
      [
        endedRecord('run_withdrawn', {
          fingerprint: FIRST_CONFIG,
          ending: 'withdrawn',
          endedAt: day('2026-09-30', 1),
        }),
        ran('run_3', 3, SECOND_CONFIG),
        ran('run_4', 4, SECOND_CONFIG),
      ],
      () => true,
      [ran('run_before', 0, FIRST_CONFIG)],
    );

    expect(
      splits.map((each) => [
        each.marker.runId,
        each.previousFingerprint,
        ids(each.before),
        ids(each.after),
      ]),
    ).toEqual([['run_3', FIRST_CONFIG, ['run_withdrawn'], ['run_3', 'run_4']]]);
  });

  describe('runs that failed provisioning', () => {
    const unstarted = (runId: string, hour: number, fingerprint: string) =>
      endedRecord(runId, {
        stationId: 'station_1',
        fingerprint,
        ending: 'failed',
        failure: 'provisioning',
        endedAt: day('2026-09-30', hour),
      });

    it('counts a run that failed provisioning with the config it was meant to run, among the runs failed: after the change where it ended there, before it with the config before', () => {
      const [split] = changeSplitsOf(
        [
          ran('run_1', 1, FIRST_CONFIG),
          unstarted('run_a_unstarted', 2, FIRST_CONFIG),
          ran('run_3', 3, SECOND_CONFIG),
          unstarted('run_b_unstarted', 4, SECOND_CONFIG),
          ran('run_5', 5, SECOND_CONFIG),
        ],
        () => true,
      );

      expect(ids(split?.before ?? [])).toEqual(['run_1', 'run_a_unstarted']);
      expect(ids(split?.after ?? [])).toEqual([
        'run_3',
        'run_b_unstarted',
        'run_5',
      ]);
      expect(runTally(split?.after ?? [], [])).toMatchObject({
        runs: 3,
        failed: 1,
      });
      expect(runTally(split?.before ?? [], [])).toMatchObject({
        runs: 2,
        failed: 1,
      });
    });

    it('counts a run with the new config that failed provisioning before the first run with it started after the change, as it was meant to run the new config', () => {
      const [split] = changeSplitsOf(
        [
          ran('run_1', 1, FIRST_CONFIG),
          unstarted('run_b_unstarted', 2, SECOND_CONFIG),
          ran('run_3', 3, SECOND_CONFIG),
        ],
        () => true,
      );

      expect(split?.marker.runId).toBe('run_3');
      expect(ids(split?.before ?? [])).toEqual(['run_1']);
      expect(ids(split?.after ?? [])).toEqual(['run_b_unstarted', 'run_3']);
    });

    it('counts such a run after only the next change to its config, not an earlier change to it', () => {
      const splits = changeSplitsOf(
        [
          ran('run_1', 1, FIRST_CONFIG),
          ran('run_2', 2, SECOND_CONFIG),
          ran('run_3', 3, FIRST_CONFIG),
          unstarted('run_b_unstarted', 4, SECOND_CONFIG),
          ran('run_5', 5, SECOND_CONFIG),
        ],
        () => true,
      );

      expect(
        splits.map((each) => [each.marker.runId, ids(each.after)]),
      ).toEqual([
        ['run_2', ['run_2']],
        ['run_3', ['run_3']],
        ['run_5', ['run_b_unstarted', 'run_5']],
      ]);
    });

    it('leaves out a run with the config before that failed provisioning after the change', () => {
      const [split] = changeSplitsOf(
        [
          ran('run_1', 1, FIRST_CONFIG),
          ran('run_2', 2, SECOND_CONFIG),
          unstarted('run_a_late', 3, FIRST_CONFIG),
        ],
        () => true,
      );

      expect(ids(split?.before ?? [])).toEqual(['run_1']);
      expect(ids(split?.after ?? [])).toEqual(['run_2']);
    });
  });

  it('marks no change where a station only ever ran one config', () => {
    expect(changeSplitsOf([ran('run_1', 1, FIRST_CONFIG)], () => true)).toEqual(
      [],
    );
  });
});
