import {
  endedRecord,
  FIRST_CONFIG,
  SECOND_CONFIG,
} from '@outcomes/domain/outcomes.fake-spec';
import { configChangesAlong } from '@outcomes/domain/services/config-stretches';
import {
  configInForce,
  daySpanOf,
  fingerprintGroupsNewestFirst,
} from '@outcomes/domain/services/fingerprint-groups';
import type { RunEnding } from '@outcomes/domain/value-objects/run-ending';
import { describe, expect, it } from 'vitest';

const at = (hour: number) =>
  new Date(`2026-09-30T${String(hour).padStart(2, '0')}:00:00.000Z`);

const ranAt = (
  runId: string,
  fingerprint: string | null,
  startedAt: number | null,
  change: { endedAt?: number; ending?: RunEnding } = {},
) =>
  endedRecord(runId, {
    fingerprint,
    startedAt: startedAt === null ? null : at(startedAt),
    endedAt: at(change.endedAt ?? (startedAt ?? 0) + 1),
    ending: change.ending,
  });

const nameOf = (fingerprint: string | null) =>
  fingerprint === FIRST_CONFIG
    ? 'A'
    : fingerprint === SECOND_CONFIG
      ? 'B'
      : null;

const shapeOf = (
  records: Parameters<typeof fingerprintGroupsNewestFirst>[0],
  before: Parameters<typeof fingerprintGroupsNewestFirst>[1] = [],
) =>
  fingerprintGroupsNewestFirst(records, before).map((each) => [
    each.firstRunId.value,
    `${nameOf(each.previous)}>${nameOf(each.fingerprint)}`,
    each.ran,
    each.records.map((one) => one.runId.value),
  ]);

describe('fingerprintGroupsNewestFirst', () => {
  it('starts a group at every config change in start order, A to B and back to A, whatever order the runs ended in, the newest group first', () => {
    expect(
      shapeOf([
        ranAt('run_1', FIRST_CONFIG, 1),
        ranAt('run_4', FIRST_CONFIG, 4),
        ranAt('run_2', FIRST_CONFIG, 2, { endedAt: 9 }),
        ranAt('run_3', SECOND_CONFIG, 3),
      ]),
    ).toEqual([
      ['run_4', 'B>A', true, ['run_4']],
      ['run_3', 'A>B', true, ['run_3']],
      ['run_1', 'null>A', true, ['run_2', 'run_1']],
    ]);
  });

  it('keeps a run of the config in force that ran no config, or a run with no config, in the group in force', () => {
    expect(
      shapeOf([
        ranAt('run_1', FIRST_CONFIG, 1),
        ranAt('run_cancelled', FIRST_CONFIG, null, {
          endedAt: 2,
          ending: 'cancelled',
        }),
        ranAt('run_unstarted', FIRST_CONFIG, null, {
          endedAt: 3,
          ending: 'failed',
        }),
        ranAt('run_unfingerprinted', null, 4),
        ranAt('run_2', FIRST_CONFIG, 5),
      ]),
    ).toEqual([
      [
        'run_1',
        'null>A',
        true,
        [
          'run_2',
          'run_unfingerprinted',
          'run_unstarted',
          'run_cancelled',
          'run_1',
        ],
      ],
    ]);
  });

  it('keeps runs meant for another config that never ran it apart, in a group of that config that never ran set against the config in force, and starts the group in force again after them', () => {
    expect(
      shapeOf([
        ranAt('run_1', FIRST_CONFIG, 1),
        ranAt('run_b_unstarted', SECOND_CONFIG, null, {
          endedAt: 2,
          ending: 'failed',
        }),
        ranAt('run_b_cancelled', SECOND_CONFIG, null, {
          endedAt: 3,
          ending: 'cancelled',
        }),
        ranAt('run_2', FIRST_CONFIG, 4),
        ranAt('run_3', SECOND_CONFIG, 5),
      ]),
    ).toEqual([
      ['run_3', 'A>B', true, ['run_3']],
      ['run_2', 'A>A', true, ['run_2']],
      ['run_b_unstarted', 'A>B', false, ['run_b_cancelled', 'run_b_unstarted']],
      ['run_1', 'null>A', true, ['run_1']],
    ]);
  });

  it('starts the group in force again for a run with no config or a run of the config in force that never ran after a group that never ran', () => {
    expect(
      shapeOf([
        ranAt('run_1', FIRST_CONFIG, 1),
        ranAt('run_b_unstarted', SECOND_CONFIG, null, {
          endedAt: 2,
          ending: 'failed',
        }),
        ranAt('run_a_unstarted', FIRST_CONFIG, null, {
          endedAt: 3,
          ending: 'failed',
        }),
        ranAt('run_b_late', SECOND_CONFIG, null, {
          endedAt: 4,
          ending: 'failed',
        }),
        ranAt('run_unfingerprinted', null, 5),
      ]),
    ).toEqual([
      ['run_unfingerprinted', 'A>A', true, ['run_unfingerprinted']],
      ['run_b_late', 'A>B', false, ['run_b_late']],
      ['run_a_unstarted', 'A>A', true, ['run_a_unstarted']],
      ['run_b_unstarted', 'A>B', false, ['run_b_unstarted']],
      ['run_1', 'null>A', true, ['run_1']],
    ]);
  });

  it('gathers runs before any config run, with none before them, into a group of no config, keeping those meant for a config apart', () => {
    expect(
      shapeOf([
        ranAt('run_cancelled', SECOND_CONFIG, null, {
          endedAt: 1,
          ending: 'cancelled',
        }),
        ranAt('run_unfingerprinted', null, 2),
        ranAt('run_1', FIRST_CONFIG, 3),
      ]),
    ).toEqual([
      ['run_1', 'null>A', true, ['run_1']],
      ['run_unfingerprinted', 'null>null', true, ['run_unfingerprinted']],
      ['run_cancelled', 'null>B', false, ['run_cancelled']],
    ]);
  });

  it('carries on the config of the last config run before the runs, gathering the runs before the first that changes it into a group of that config from its oldest run', () => {
    const before = [ranAt('run_before', FIRST_CONFIG, 0)];

    expect(
      shapeOf(
        [
          ranAt('run_cancelled', FIRST_CONFIG, null, {
            endedAt: 1,
            ending: 'cancelled',
          }),
          ranAt('run_1', FIRST_CONFIG, 2),
          ranAt('run_2', SECOND_CONFIG, 3),
        ],
        before,
      ),
    ).toEqual([
      ['run_2', 'A>B', true, ['run_2']],
      ['run_cancelled', 'A>A', true, ['run_1', 'run_cancelled']],
    ]);
    expect(
      shapeOf(
        [
          ranAt('run_unfingerprinted', null, 1),
          ranAt('run_2', SECOND_CONFIG, 3),
        ],
        before,
      ),
    ).toEqual([
      ['run_2', 'A>B', true, ['run_2']],
      ['run_unfingerprinted', 'A>A', true, ['run_unfingerprinted']],
    ]);
  });

  it('starts the oldest group at its first run when it changes the config carried on', () => {
    expect(
      shapeOf(
        [ranAt('run_1', SECOND_CONFIG, 1), ranAt('run_2', SECOND_CONFIG, 2)],
        [ranAt('run_before', FIRST_CONFIG, 0)],
      ),
    ).toEqual([['run_1', 'A>B', true, ['run_2', 'run_1']]]);
  });

  it('diffs a group of a config that never ran and the group where it then runs both against the config in force, and marks only the real run as a change', () => {
    const records = [
      ranAt('run_1', FIRST_CONFIG, 1),
      ranAt('run_x_unstarted', SECOND_CONFIG, null, {
        endedAt: 2,
        ending: 'failed',
      }),
      ranAt('run_x', SECOND_CONFIG, 3),
    ];

    expect(shapeOf(records)).toEqual([
      ['run_x', 'A>B', true, ['run_x']],
      ['run_x_unstarted', 'A>B', false, ['run_x_unstarted']],
      ['run_1', 'null>A', true, ['run_1']],
    ]);
    expect(
      configChangesAlong(records).map(({ run, previous }) => [
        run.runId.value,
        nameOf(previous),
        nameOf(run.fingerprint),
      ]),
    ).toEqual([
      ['run_1', null, 'A'],
      ['run_x', 'A', 'B'],
    ]);
  });

  it('has no groups without runs', () => {
    expect(fingerprintGroupsNewestFirst([])).toEqual([]);
  });
});

describe('configInForce', () => {
  const minute = (at: number) =>
    new Date(Date.UTC(2026, 8, 30, 0, at)).toISOString();
  const ranAtMinute = (
    runId: string,
    fingerprint: string | null,
    at: number,
    unstarted?: RunEnding,
  ) =>
    endedRecord(runId, {
      fingerprint,
      startedAt: unstarted ? null : new Date(minute(at)),
      endedAt: new Date(minute(unstarted ? at : at + 1)),
      ending: unstarted,
    });
  const inForceOf = (
    records: Parameters<typeof fingerprintGroupsNewestFirst>[0],
    before: Parameters<typeof fingerprintGroupsNewestFirst>[1] = [],
  ) => {
    const inForce = configInForce(
      fingerprintGroupsNewestFirst(records, before),
    );

    return inForce
      ? {
          config: nameOf(inForce.fingerprint),
          firstRunId: inForce.firstRunId.value,
          runs: inForce.records.length,
        }
      : null;
  };
  const forty = Array.from({ length: 40 }, (_, at) =>
    ranAtMinute(`run_a${String(at).padStart(2, '0')}`, FIRST_CONFIG, at),
  );

  it('tallies the config in force over its stretch, a group of another config that never ran between leaving it whole', () => {
    const records = [
      ...forty,
      ranAtMinute('run_x_unstarted', SECOND_CONFIG, 40, 'failed'),
      ranAtMinute('run_a40', FIRST_CONFIG, 41),
      ranAtMinute('run_a41', FIRST_CONFIG, 42),
    ];

    expect(inForceOf(records)).toEqual({
      config: 'A',
      firstRunId: 'run_a00',
      runs: 42,
    });
  });

  it('keeps the config that last ran in force when the newest group never ran its config', () => {
    expect(
      inForceOf([
        ...forty.slice(0, 3),
        ranAtMinute('run_x_unstarted', SECOND_CONFIG, 5, 'cancelled'),
      ]),
    ).toEqual({ config: 'A', firstRunId: 'run_a00', runs: 3 });
  });

  it('starts the stretch at the last change to another config that ran', () => {
    expect(
      inForceOf([
        ranAtMinute('run_a', FIRST_CONFIG, 1),
        ranAtMinute('run_b', SECOND_CONFIG, 2),
        ranAtMinute('run_a_again', FIRST_CONFIG, 3),
        ranAtMinute('run_unfingerprinted', null, 4),
      ]),
    ).toEqual({ config: 'A', firstRunId: 'run_a_again', runs: 2 });
  });

  it('starts the stretch at the oldest listed run when it carries on from before the listing', () => {
    expect(
      inForceOf(
        [ranAtMinute('run_unfingerprinted', null, 1)],
        [ranAtMinute('run_before', FIRST_CONFIG, 0)],
      ),
    ).toEqual({ config: 'A', firstRunId: 'run_unfingerprinted', runs: 1 });
  });

  it('has none when no listed config ran', () => {
    expect(
      inForceOf([
        ranAtMinute('run_unfingerprinted', null, 1),
        ranAtMinute('run_x_unstarted', SECOND_CONFIG, 2, 'failed'),
      ]),
    ).toBeNull();
    expect(inForceOf([])).toBeNull();
  });
});

describe('daySpanOf', () => {
  it('spans the days its runs ended on, whatever order they come in', () => {
    expect(
      daySpanOf([
        endedRecord('run_2', { endedAt: new Date('2026-09-30T08:00:00Z') }),
        endedRecord('run_1', { endedAt: new Date('2026-09-28T23:00:00Z') }),
        endedRecord('run_3', { endedAt: new Date('2026-09-29T10:00:00Z') }),
      ]),
    ).toEqual({ firstDay: '2026-09-28', lastDay: '2026-09-30' });
  });

  it('spans no days without runs', () => {
    expect(daySpanOf([])).toEqual({ firstDay: null, lastDay: null });
  });
});
