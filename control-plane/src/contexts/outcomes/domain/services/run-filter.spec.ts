import { InvalidRunFilterError } from '@outcomes/domain/exceptions/invalid-run-filter.error';
import {
  type RunFilterAsked,
  runFilterOf,
} from '@outcomes/domain/services/run-filter';
import { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import { describe, expect, it } from 'vitest';

const PERIOD = InsightsPeriod.of(
  '30d',
  new Date('2026-10-01T15:00:00.000Z'),
).current;

const NOTHING: RunFilterAsked = {
  lineId: null,
  stationId: null,
  outcome: null,
  harness: null,
  model: null,
  repository: null,
  fingerprint: null,
  taskId: null,
  taskIds: null,
  personId: null,
  day: null,
  week: null,
  skillGiven: null,
  skillUsed: null,
  server: null,
  serverFailed: null,
  failedAfter: null,
  refusedTool: null,
  refusedServer: null,
  delivery: null,
  next: null,
  asked: null,
};

describe('runFilterOf', () => {
  it('narrows to the week that starts on the day asked, and refuses a day it cannot read', () => {
    expect(
      runFilterOf({ ...NOTHING, week: '2026-09-28' }, PERIOD).week,
    ).toEqual({
      from: new Date('2026-09-28T00:00:00.000Z'),
      to: new Date('2026-10-05T00:00:00.000Z'),
    });
    expect(() =>
      runFilterOf({ ...NOTHING, week: 'last week' }, PERIOD),
    ).toThrow(InvalidRunFilterError);
  });

  it('refuses a week that is not a real day, or starts on a day other than Monday', () => {
    for (const week of ['2026-02-30', '2026-13-01', '2026-09-29']) {
      expect(() => runFilterOf({ ...NOTHING, week }, PERIOD)).toThrow(
        InvalidRunFilterError,
      );
    }
  });

  it('keeps the skill, server and tool asked for', () => {
    expect(
      runFilterOf(
        {
          ...NOTHING,
          skillUsed: 'grafana',
          failedAfter: 'linear',
          refusedTool: 'create_issue',
          refusedServer: 'linear',
        },
        PERIOD,
      ),
    ).toMatchObject({
      skillUsed: 'grafana',
      failedAfter: 'linear',
      refusedTool: 'create_issue',
      refusedServer: { kind: 'is', value: 'linear' },
      server: null,
    });
  });

  it('narrows to refusals of no server when asked for none', () => {
    expect(
      runFilterOf({ ...NOTHING, refusedServer: 'none' }, PERIOD).refusedServer,
    ).toEqual({ kind: 'none' });
    expect(runFilterOf(NOTHING, PERIOD).refusedServer).toEqual({
      kind: 'any',
    });
  });

  it('refuses a value longer than two hundred characters', () => {
    expect(
      runFilterOf({ ...NOTHING, skillUsed: 'a'.repeat(200) }, PERIOD).skillUsed,
    ).toHaveLength(200);
    expect(() =>
      runFilterOf({ ...NOTHING, refusedTool: 'a'.repeat(201) }, PERIOD),
    ).toThrow(InvalidRunFilterError);
  });

  it('narrows by nothing when nothing is asked', () => {
    expect(runFilterOf(NOTHING, PERIOD)).toMatchObject({
      model: { kind: 'any' },
      repository: { kind: 'any' },
      taskIds: null,
      askedWithin: null,
    });
  });

  it('reads ~default as the harness’s own model and none as no repository', () => {
    expect(
      runFilterOf(
        { ...NOTHING, model: '~default', repository: 'none' },
        PERIOD,
      ),
    ).toMatchObject({
      model: { kind: 'none' },
      repository: { kind: 'none' },
    });
    expect(
      runFilterOf(
        { ...NOTHING, model: 'opus', repository: 'acme/api' },
        PERIOD,
      ),
    ).toMatchObject({
      model: { kind: 'is', value: 'opus' },
      repository: { kind: 'is', value: 'acme/api' },
    });
  });

  it('narrows to the tasks asked for, and to none when one task is asked that the list leaves out', () => {
    expect(
      runFilterOf(
        { ...NOTHING, taskIds: ['task_1', 'task_2', 'task_1'] },
        PERIOD,
      ).taskIds,
    ).toEqual(['task_1', 'task_2']);
    expect(
      runFilterOf({ ...NOTHING, taskId: 'task_2', taskIds: ['task_1'] }, PERIOD)
        .taskIds,
    ).toEqual([]);
    expect(
      runFilterOf({ ...NOTHING, taskId: 'task_2' }, PERIOD).taskIds,
    ).toEqual(['task_2']);
  });

  it('refuses more than two hundred tasks at once', () => {
    expect(() =>
      runFilterOf(
        {
          ...NOTHING,
          taskIds: Array.from({ length: 201 }, (_, at) => `task_${at}`),
        },
        PERIOD,
      ),
    ).toThrow(InvalidRunFilterError);
  });

  it('refuses an outcome, delivery or next act it does not know', () => {
    for (const asked of [
      { outcome: 'exploded' },
      { delivery: 'shipped' },
      { next: 'shrugged' },
    ]) {
      expect(() => runFilterOf({ ...NOTHING, ...asked }, PERIOD)).toThrow(
        InvalidRunFilterError,
      );
    }
    expect(
      runFilterOf(
        { ...NOTHING, outcome: 'failed', delivery: 'merged', next: 'answered' },
        PERIOD,
      ),
    ).toMatchObject({
      outcome: 'failed',
      delivery: 'merged',
      next: 'answered',
    });
  });

  it('narrows to a day of the period, and refuses a day it cannot read or that falls outside the period', () => {
    expect(runFilterOf({ ...NOTHING, day: '2026-09-28' }, PERIOD).day).toEqual({
      from: new Date('2026-09-28T00:00:00.000Z'),
      to: new Date('2026-09-29T00:00:00.000Z'),
    });

    for (const day of [
      '2026-02-30',
      '28/09/2026',
      '2026-08-01',
      '2026-10-02',
    ]) {
      expect(() => runFilterOf({ ...NOTHING, day }, PERIOD)).toThrow(
        InvalidRunFilterError,
      );
    }
  });

  it('refuses a value asked more than once where it takes one', () => {
    for (const asked of [
      { stationId: ['station_1', 'station_2'] },
      { model: ['opus', 'sonnet'] },
      { day: ['2026-09-28', '2026-09-29'] },
      { asked: ['true', 'true'] },
    ]) {
      expect(() => runFilterOf({ ...NOTHING, ...asked }, PERIOD)).toThrow(
        InvalidRunFilterError,
      );
    }
  });

  it('narrows to tasks that asked someone during the period only when asked true, and refuses anything but true or false', () => {
    expect(
      runFilterOf({ ...NOTHING, asked: 'true' }, PERIOD).askedWithin,
    ).toEqual(PERIOD);
    expect(
      runFilterOf({ ...NOTHING, asked: 'false' }, PERIOD).askedWithin,
    ).toBeNull();
    expect(() => runFilterOf({ ...NOTHING, asked: 'yes' }, PERIOD)).toThrow(
      InvalidRunFilterError,
    );
  });
});
