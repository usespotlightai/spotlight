import { InvalidRunFilterError } from '@insights/domain/exceptions/invalid-run-filter.error';
import {
  type RunFilterQuery,
  runFilterOf,
} from '@insights/domain/services/run-filter';
import { InsightsPeriod } from '@insights/domain/value-objects/insights-period.vo';
import { describe, expect, it } from 'vitest';

const PERIOD = InsightsPeriod.of(
  '30d',
  new Date('2026-10-01T15:00:00.000Z'),
).current;

const NOTHING: RunFilterQuery = {
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
  skillEnabled: null,
  skillUsed: null,
  server: null,
  serverFailed: null,
  failedAfter: null,
  dismissedTool: null,
  dismissedServer: null,
  pullRequestState: null,
  humanAction: null,
  asked: null,
};

describe('runFilterOf', () => {
  it('narrows to the week that starts on the requested day, and rejects a day it cannot read', () => {
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

  it('rejects a week that is not a real day, or starts on a day other than Monday', () => {
    for (const week of ['2026-02-30', '2026-13-01', '2026-09-29']) {
      expect(() => runFilterOf({ ...NOTHING, week }, PERIOD)).toThrow(
        InvalidRunFilterError,
      );
    }
  });

  it('keeps the requested skill, server and tool', () => {
    expect(
      runFilterOf(
        {
          ...NOTHING,
          skillUsed: 'grafana',
          failedAfter: 'linear',
          dismissedTool: 'create_issue',
          dismissedServer: 'linear',
        },
        PERIOD,
      ),
    ).toMatchObject({
      skillUsed: 'grafana',
      failedAfter: 'linear',
      dismissedTool: 'create_issue',
      dismissedServer: { kind: 'is', value: 'linear' },
      server: null,
    });
  });

  it('narrows to dismissals of no server when the query names none', () => {
    expect(
      runFilterOf({ ...NOTHING, dismissedServer: 'none' }, PERIOD)
        .dismissedServer,
    ).toEqual({ kind: 'none' });
    expect(runFilterOf(NOTHING, PERIOD).dismissedServer).toEqual({
      kind: 'any',
    });
  });

  it('rejects a value longer than two hundred characters', () => {
    expect(
      runFilterOf({ ...NOTHING, skillUsed: 'a'.repeat(200) }, PERIOD).skillUsed,
    ).toHaveLength(200);
    expect(() =>
      runFilterOf({ ...NOTHING, dismissedTool: 'a'.repeat(201) }, PERIOD),
    ).toThrow(InvalidRunFilterError);
  });

  it('narrows by nothing when the query names nothing', () => {
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

  it('narrows to the requested tasks, and to none when the query names one task that the list leaves out', () => {
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

  it('rejects more than two hundred tasks at once', () => {
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

  it('rejects an outcome, pull request state or human action it does not know', () => {
    for (const query of [
      { outcome: 'exploded' },
      { pullRequestState: 'shipped' },
      { humanAction: 'shrugged' },
    ]) {
      expect(() => runFilterOf({ ...NOTHING, ...query }, PERIOD)).toThrow(
        InvalidRunFilterError,
      );
    }
    expect(
      runFilterOf(
        {
          ...NOTHING,
          outcome: 'failed',
          pullRequestState: 'merged',
          humanAction: 'answered',
        },
        PERIOD,
      ),
    ).toMatchObject({
      outcome: 'failed',
      pullRequestState: 'merged',
      humanAction: 'answered',
    });
  });

  it('narrows to a day of the period, and rejects a day it cannot read or that falls outside the period', () => {
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

  it('rejects a value repeated where it takes one', () => {
    for (const query of [
      { stationId: ['station_1', 'station_2'] },
      { model: ['opus', 'sonnet'] },
      { day: ['2026-09-28', '2026-09-29'] },
      { asked: ['true', 'true'] },
    ]) {
      expect(() => runFilterOf({ ...NOTHING, ...query }, PERIOD)).toThrow(
        InvalidRunFilterError,
      );
    }
  });

  it('narrows to tasks that asked someone during the period only when the query is true, and rejects anything but true or false', () => {
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
