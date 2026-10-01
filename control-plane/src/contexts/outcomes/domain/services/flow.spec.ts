import {
  deliveredOf,
  historyOf,
  touchesOf,
} from '@outcomes/domain/insights.fake-spec';
import { endedRecord } from '@outcomes/domain/outcomes.fake-spec';
import { flowOf } from '@outcomes/domain/services/flow';
import { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import { describe, expect, it } from 'vitest';

const PERIOD = InsightsPeriod.of('7d', new Date('2026-10-01T15:00:00.000Z'));
const MINUTE = 60_000;

const at = (hour: number, minute = 0) =>
  new Date(
    `2026-09-29T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`,
  );

describe('flowOf', () => {
  it('times how long each station’s runs waited for a runner and then ran', () => {
    const history = historyOf({
      records: [
        endedRecord('run_1', {
          taskId: 'task_1',
          queuedAt: at(9),
          startedAt: at(9, 2),
          endedAt: at(9, 12),
        }),
        endedRecord('run_2', {
          taskId: 'task_2',
          queuedAt: at(10),
          startedAt: at(10, 6),
          endedAt: at(10, 36),
        }),
        endedRecord('run_3', {
          taskId: 'task_3',
          stationId: 'station_2',
          queuedAt: at(11),
          startedAt: null,
          endedAt: at(11, 1),
          ending: 'withdrawn',
        }),
      ],
    });

    const [first, second] = flowOf(history, PERIOD.current).stations;

    expect(first).toMatchObject({
      stationId: 'station_1',
      tasks: 2,
      taskIds: ['task_1', 'task_2'],
      runs: 2,
      queued: { p50: 4 * MINUTE, p90: 6 * MINUTE, count: 2 },
      running: { p50: 20 * MINUTE, p90: 30 * MINUTE, count: 2 },
    });
    expect(second).toMatchObject({
      stationId: 'station_2',
      runs: 0,
      queued: { count: 0 },
    });
  });

  it('times how long each station’s asks waited in the inbox', () => {
    const history = historyOf({
      records: [endedRecord('run_1', { taskId: 'task_1', endedAt: at(8) })],
      touches: [
        touchesOf('task_1', {
          asks: [
            ['station_1', at(9)],
            ['station_1', at(12)],
          ],
          acts: [['answered', 'user_bob', 'station_1', at(9, 30)]],
        }),
      ],
    });

    expect(flowOf(history, PERIOD.current).stations[0]).toMatchObject({
      inbox: { p50: 30 * MINUTE, count: 1 },
      asks: 2,
      unanswered: 1,
    });
  });

  it('carries past the last station to pull request, first review and merge', () => {
    const history = historyOf({
      deliveries: [
        deliveredOf('task_1', {
          openedAt: at(10),
          reviewedAt: at(11),
          closedAt: at(13),
        }),
        deliveredOf('task_2', { openedAt: at(12), closedAt: at(12, 30) }),
      ],
      touches: [
        touchesOf('task_1', { openedAt: at(8) }),
        touchesOf('task_2', { openedAt: at(9) }),
      ],
    });

    expect(flowOf(history, PERIOD.current).delivery).toEqual({
      toPullRequest: { p50: 150 * MINUTE, p90: 180 * MINUTE, count: 2 },
      toFirstReview: { p50: 60 * MINUTE, p90: 60 * MINUTE, count: 1 },
      toMerge: { p50: 75 * MINUTE, p90: 120 * MINUTE, count: 2 },
      opened: 2,
      reviewed: 1,
      merged: 2,
      openedTaskIds: ['task_1', 'task_2'],
      reviewedTaskIds: ['task_1'],
      mergedTaskIds: ['task_1', 'task_2'],
    });
  });
});
