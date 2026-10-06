import { InvalidChangesAskedAboutError } from '@replays/domain/exceptions/invalid-changes-asked-about.error';
import {
  ChangesAskedAbout,
  MOST_CHANGES,
  type RawChange,
} from '@replays/domain/services/changes-asked-about';
import { describe, expect, it } from 'vitest';

const changeOf = (raw: Partial<RawChange> = {}): RawChange => ({
  stationId: 'station_build',
  runId: 'run_1',
  ...raw,
});

const distinct = (count: number): RawChange[] =>
  Array.from({ length: count }, (_, at) => changeOf({ runId: `run_${at}` }));

describe('ChangesAskedAbout', () => {
  it('reads each change', () => {
    const [change] = ChangesAskedAbout.of([changeOf()]).changes;

    expect(change?.stationId).toBe('station_build');
    expect(change?.runId.value).toBe('run_1');
  });

  it('asks about each run at a station once', () => {
    const asked = ChangesAskedAbout.of([
      changeOf(),
      changeOf({ runId: 'run_2' }),
      changeOf(),
      changeOf({ stationId: 'station_review' }),
    ]);

    expect(
      asked.changes.map((each) => `${each.stationId} ${each.runId.value}`),
    ).toEqual([
      'station_build run_1',
      'station_build run_2',
      'station_review run_1',
    ]);
  });

  it('names each station asked about once', () => {
    const asked = ChangesAskedAbout.of([
      changeOf(),
      changeOf({ stationId: 'station_review' }),
      changeOf({ runId: 'run_2' }),
    ]);

    expect(asked.stationIds).toEqual(['station_build', 'station_review']);
  });

  it(`takes ${MOST_CHANGES} changes at once`, () => {
    expect(ChangesAskedAbout.of(distinct(MOST_CHANGES)).changes).toHaveLength(
      MOST_CHANGES,
    );
  });

  it(`refuses more than ${MOST_CHANGES} at once, repeated or not, before reading any`, () => {
    for (const raw of [
      distinct(MOST_CHANGES + 1),
      [...distinct(MOST_CHANGES), changeOf({ runId: 'run_0' })],
      [...distinct(MOST_CHANGES), changeOf({ runId: ' ' })],
    ]) {
      expect(() => ChangesAskedAbout.of(raw)).toThrow(
        new InvalidChangesAskedAboutError(
          `${MOST_CHANGES + 1} changes. At most ${MOST_CHANGES} at once.`,
        ),
      );
    }
  });

  it('refuses a blank run by its place in the list, counting from one', () => {
    expect(() =>
      ChangesAskedAbout.of([changeOf(), changeOf(), changeOf({ runId: ' ' })]),
    ).toThrow(new InvalidChangesAskedAboutError('Change 3: runId is blank.'));
  });

  it('refuses a blank station', () => {
    expect(() => ChangesAskedAbout.of([changeOf({ stationId: ' ' })])).toThrow(
      new InvalidChangesAskedAboutError('Change 1: stationId is blank.'),
    );
  });
});
